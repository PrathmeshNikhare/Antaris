import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import { closePool } from "../db/pool";
import { runMigrations } from "../db/migrate";
import { runSeeds } from "../db/seed";
import { TelemetryRepository } from "../repositories";
import {
  PRNG,
  BaselineGenerator,
  AnomalyManager,
  OfflineBufferQueue,
  TelemetrySimulator,
  validateTelemetryEnvelope,
  TelemetryIngestService,
  MqttManager,
  SENSOR_DEFINITIONS,
} from "../telemetry";
import type { TelemetryEnvelope } from "@maitri-bharati/shared";

const app = createApp();

describe("Phase 2: Telemetry Simulator & MQTT Edge Ingestion", () => {
  let telemRepo: TelemetryRepository;
  let mqtt: MqttManager;
  let ingest: TelemetryIngestService;

  beforeAll(async () => {
    await runMigrations();
    await runSeeds();
    telemRepo = new TelemetryRepository();

    mqtt = new MqttManager();
    await mqtt.connect();

    ingest = new TelemetryIngestService(mqtt, telemRepo);
    await ingest.start();
  }, 30000);

  afterAll(async () => {
    await mqtt.disconnect();
    await closePool();
  });

  describe("1. Deterministic baseline telemetry & PRNG", () => {
    it("should produce reproducible values with identical seeds", () => {
      const prng1 = new PRNG(42);
      const prng2 = new PRNG(42);

      const seq1 = [prng1.next(), prng1.gaussian(70, 2), prng1.range(10, 20)];
      const seq2 = [prng2.next(), prng2.gaussian(70, 2), prng2.range(10, 20)];

      expect(seq1).toEqual(seq2);
    });

    it("generates deterministic diurnal baseline for Maitri and Bharati sensors", () => {
      const gen1 = new BaselineGenerator(100);
      const gen2 = new BaselineGenerator(100);
      const anomMgr = new AnomalyManager();
      const testDate = new Date("2026-09-29T12:00:00Z");

      const sensor = SENSOR_DEFINITIONS.find(
        (s) => s.stationId === "station-maitri" && s.assetId === "asset-maitri-gen-1" && s.metric === "temperature"
      )!;

      expect(sensor).toBeDefined();

      const point1 = gen1.generatePoint(sensor, 1, "normal", anomMgr, 1, testDate);
      const point2 = gen2.generatePoint(sensor, 1, "normal", anomMgr, 1, testDate);

      expect(point1.envelope.value).toBe(point2.envelope.value);
      expect(point1.envelope.metric).toBe("temperature");
      expect(point1.envelope.unit).toBe("degC");
      expect(point1.envelope.quality).toBe("GOOD");
      expect(point1.envelope.source).toBe("SIMULATOR");
    });
  });

  describe("2. Realistic noise generation", () => {
    it("should apply bounded gaussian noise when mode is 'noisy'", () => {
      const gen = new BaselineGenerator(200);
      const anomMgr = new AnomalyManager();
      const testDate = new Date("2026-09-29T12:00:00Z");

      const sensor = SENSOR_DEFINITIONS.find(
        (s) => s.stationId === "station-maitri" && s.metric === "ambient_temperature"
      )!;

      const normal = gen.generatePoint(sensor, 1, "normal", anomMgr, 1, testDate);
      const noisy1 = gen.generatePoint(sensor, 2, "noisy", anomMgr, 2, testDate);
      const noisy2 = gen.generatePoint(sensor, 3, "noisy", anomMgr, 3, testDate);

      // Noise should fluctuate around the base value without unbounded divergence
      expect(noisy1.envelope.value).not.toBe(noisy2.envelope.value);
      expect(Math.abs(noisy1.envelope.value - normal.envelope.value)).toBeLessThan(10);
    });
  });

  describe("3. Anomaly injection", () => {
    it("should inject generator overheat anomaly and reflect high temperature", () => {
      const gen = new BaselineGenerator(300);
      const anomMgr = new AnomalyManager();
      const testDate = new Date("2026-09-29T12:00:00Z");

      const sensor = SENSOR_DEFINITIONS.find(
        (s) => s.stationId === "station-maitri" && s.assetId === "asset-maitri-gen-1" && s.metric === "temperature"
      )!;

      // Normal baseline is ~73.5°C
      const normal = gen.generatePoint(sensor, 1, "normal", anomMgr, 1, testDate);
      expect(normal.envelope.value).toBeGreaterThan(68);
      expect(normal.envelope.value).toBeLessThan(80);

      // Inject anomaly targeting 98°C
      anomMgr.inject({
        type: "GENERATOR_OVERHEAT",
        stationId: "station-maitri",
        assetId: "asset-maitri-gen-1",
        metric: "temperature",
        targetValue: 98.0,
      });

      const anomalous = gen.generatePoint(sensor, 2, "anomaly", anomMgr, 2, testDate);
      expect(anomalous.envelope.value).toBeGreaterThan(90);
      expect(anomalous.envelope.value).toBeLessThan(105);
    });

    it("should flag out-of-bound anomalies as SUSPECT quality instead of dropping", () => {
      const gen = new BaselineGenerator(400);
      const anomMgr = new AnomalyManager();
      const testDate = new Date("2026-09-29T12:00:00Z");

      const sensor = SENSOR_DEFINITIONS.find(
        (s) => s.stationId === "station-maitri" && s.assetId === "asset-maitri-gen-1" && s.metric === "temperature"
      )!;

      // Inject extreme anomaly beyond max plausible (e.g. 140°C where max plausible is 120°C)
      anomMgr.inject({
        type: "CUSTOM",
        stationId: "station-maitri",
        assetId: "asset-maitri-gen-1",
        metric: "temperature",
        targetValue: 140.0,
      });

      const extreme = gen.generatePoint(sensor, 1, "anomaly", anomMgr, 1, testDate);
      expect(extreme.envelope.quality).toBe("SUSPECT");
    });
  });

  describe("4. Offline buffering and store-and-forward", () => {
    it("should buffer messages when in offline mode and drain them in order on recovery", async () => {
      const buffer = new OfflineBufferQueue(100);
      expect(buffer.size()).toBe(0);

      const env1: TelemetryEnvelope = {
        stationId: "station-maitri",
        metric: "wind_speed",
        value: 15.5,
        unit: "m/s",
        timestamp: new Date().toISOString(),
        source: "SIMULATOR",
        quality: "GOOD",
        sequence: 1,
      };

      const env2: TelemetryEnvelope = {
        stationId: "station-maitri",
        metric: "wind_speed",
        value: 18.2,
        unit: "m/s",
        timestamp: new Date().toISOString(),
        source: "SIMULATOR",
        quality: "GOOD",
        sequence: 2,
      };

      buffer.enqueue(env1, "stations/station-maitri/environment");
      buffer.enqueue(env2, "stations/station-maitri/environment");

      expect(buffer.size()).toBe(2);

      const drained = buffer.drainAll();
      expect(drained.length).toBe(2);
      expect(drained[0].envelope.sequence).toBe(1);
      expect(drained[1].envelope.sequence).toBe(2);
      expect(buffer.size()).toBe(0);
    });

    it("simulator handles offline toggling and store-and-forward drain", async () => {
      const sim = new TelemetrySimulator(mqtt);

      sim.setMode("offline");
      expect(sim.getMode()).toBe("offline");

      // Generate offline step
      const emitted = await sim.step();
      expect(emitted.length).toBeGreaterThan(0);
      expect(sim.getBuffer().size()).toBe(emitted.length);

      // Switch to recovery / normal mode - drains buffer
      sim.setMode("recovery");
      expect(sim.getBuffer().size()).toBe(0);
    });
  });

  describe("5. Validation and Canonical Envelope", () => {
    it("validates valid telemetry envelope correctly", () => {
      const validPayload = {
        stationId: "station-maitri",
        assetId: "maitri-gen-01",
        metric: "temperature",
        value: 72.4,
        unit: "degC",
        timestamp: new Date().toISOString(),
        source: "SIMULATOR",
        quality: "GOOD",
        sequence: 10291,
      };

      const result = validateTelemetryEnvelope(validPayload);
      expect(result.valid).toBe(true);
      expect(result.point).toBeDefined();
      expect(result.point?.stationId).toBe("station-maitri");
      expect(result.point?.quality).toBe("GOOD");
    });

    it("rejects envelopes with missing required fields", () => {
      const invalid = { stationId: "station-maitri" };
      const result = validateTelemetryEnvelope(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors?.length).toBeGreaterThan(0);
    });

    it("flags implausible values as SUSPECT without dropping", () => {
      const implausible = {
        stationId: "station-maitri",
        metric: "wind_speed",
        value: 120.0, // beyond 100 m/s bound
        unit: "m/s",
        timestamp: new Date().toISOString(),
        source: "SIMULATOR",
        quality: "GOOD",
        sequence: 1,
      };

      const result = validateTelemetryEnvelope(implausible);
      expect(result.valid).toBe(true);
      expect(result.point?.quality).toBe("SUSPECT");
    });
  });

  describe("6. Exit Criteria: Live telemetry enters database with provenance", () => {
    it("publishes telemetry via MQTT and persists it into TimescaleDB", async () => {
      const sim = new TelemetrySimulator(mqtt);

      // Execute a simulation step (publishes all sensors to MQTT)
      const stepEmitted = await sim.step();
      expect(stepEmitted.length).toBeGreaterThanOrEqual(15);

      // Give MQTT broker brief moment to deliver to ingest subscriber
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Query database for the newly inserted points
      const recentPoints = await telemRepo.findRecent({
        stationId: "station-maitri",
        limit: 20,
      });

      expect(recentPoints.length).toBeGreaterThan(0);

      const latestPoint = recentPoints[0];
      expect(latestPoint.stationId).toBe("station-maitri");
      expect(latestPoint.timestamp).toBeInstanceOf(Date);
      expect(latestPoint.source).toBe("SIMULATOR");
      expect(["GOOD", "SUSPECT"]).toContain(latestPoint.quality);
      expect(typeof latestPoint.value).toBe("number");
    });

    it("GET /api/telemetry retrieves persisted live telemetry via HTTP", async () => {
      const res = await request(app).get("/api/telemetry?stationId=station-maitri&limit=10");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it("simulation control API endpoints function correctly", async () => {
      // Check status endpoint
      const statusRes = await request(app).get("/api/telemetry/simulate/status");
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.success).toBe(true);
      expect(statusRes.body.data).toHaveProperty("simulator");
      expect(statusRes.body.data).toHaveProperty("ingest");

      // Trigger a discrete step via API
      const stepRes = await request(app).post("/api/telemetry/simulate/step");
      expect(stepRes.status).toBe(200);
      expect(stepRes.body.data.emittedCount).toBeGreaterThan(0);

      // Inject anomaly via API
      const anomRes = await request(app).post("/api/telemetry/simulate/anomaly").send({
        type: "GENERATOR_OVERHEAT",
        stationId: "station-maitri",
        assetId: "asset-maitri-gen-1",
        metric: "temperature",
        targetValue: 95.0,
      });
      expect(anomRes.status).toBe(200);
      expect(anomRes.body.success).toBe(true);

      // Clear anomalies via API
      const clearRes = await request(app).post("/api/telemetry/simulate/clear-anomalies");
      expect(clearRes.status).toBe(200);
      expect(clearRes.body.success).toBe(true);
    });
  });
});
