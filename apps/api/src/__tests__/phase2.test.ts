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

describe("Phase 2: Antarctic Telemetry & Comms-Resilience Layer", () => {
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
      expect(["SIMULATED", "SIMULATOR"]).toContain(point1.envelope.source);
    });
  });

  describe("2. Expanded sensor telemetry model", () => {
    it("includes sensors across environment, generators, batteries, HVAC, water, comms, energy, and logistics", () => {
      const metrics = SENSOR_DEFINITIONS.map((s) => s.metric);

      // Environment
      expect(metrics).toContain("ambient_temperature");
      expect(metrics).toContain("wind_speed");
      expect(metrics).toContain("atmospheric_pressure");

      // Generators & Energy
      expect(metrics).toContain("power_output_kw");
      expect(metrics).toContain("fuel_consumption_lph");
      expect(metrics).toContain("oil_pressure_bar");
      expect(metrics).toContain("grid_load_kw");

      // Batteries
      expect(metrics).toContain("state_of_charge_pct");
      expect(metrics).toContain("voltage");
      expect(metrics).toContain("charge_rate_kw");

      // HVAC
      expect(metrics).toContain("indoor_temperature");
      expect(metrics).toContain("thermal_load_kw");
      expect(metrics).toContain("airflow_cfm");

      // Water Systems
      expect(metrics).toContain("water_temperature");
      expect(metrics).toContain("flow_rate_lpm");
      expect(metrics).toContain("storage_level_liters");

      // Communications
      expect(metrics).toContain("snr_db");
      expect(metrics).toContain("packet_loss_pct");
      expect(metrics).toContain("latency_ms");

      // Logistics
      expect(metrics).toContain("daily_fuel_burn_liters");
      expect(metrics).toContain("water_consumption_lpd");
    });
  });

  describe("3. Validation & Strict Provenance", () => {
    it("validates valid telemetry envelope correctly", () => {
      const validPayload = {
        stationId: "station-maitri",
        assetId: "maitri-gen-01",
        metric: "temperature",
        value: 72.4,
        unit: "degC",
        timestamp: new Date().toISOString(),
        source: "SIMULATED",
        quality: "GOOD",
        sequence: 10291,
      };

      const result = validateTelemetryEnvelope(validPayload);
      expect(result.valid).toBe(true);
      expect(result.point).toBeDefined();
      expect(result.point?.stationId).toBe("station-maitri");
      expect(result.point?.source).toBe("SIMULATED");
      expect(result.point?.sequence).toBe(10291);
      expect(result.point?.quality).toBe("GOOD");
    });

    it("rejects envelopes with missing or invalid provenance source (no silent conversion)", () => {
      const invalidSource = {
        stationId: "station-maitri",
        metric: "temperature",
        value: 72.4,
        unit: "degC",
        timestamp: new Date().toISOString(),
        source: "INVALID_PROVENANCE_SOURCE",
      };

      const result = validateTelemetryEnvelope(invalidSource);
      expect(result.valid).toBe(false);
      expect(result.errors?.some((e) => e.includes("source"))).toBe(true);
    });

    it("flags implausible values as SUSPECT without dropping", () => {
      const implausible = {
        stationId: "station-maitri",
        metric: "wind_speed",
        value: 120.0, // beyond 100 m/s bound
        unit: "m/s",
        timestamp: new Date().toISOString(),
        source: "SIMULATED",
        quality: "GOOD",
        sequence: 1,
      };

      const result = validateTelemetryEnvelope(implausible);
      expect(result.valid).toBe(true);
      expect(result.point?.quality).toBe("SUSPECT");
    });
  });

  describe("4. Sequence handling: duplicates, gaps, out-of-order, and deduplication", () => {
    it("detects gaps, duplicates, and out-of-order packets and exposes ingestion statistics", async () => {
      const localIngest = new TelemetryIngestService(mqtt, telemRepo);

      // Packet 1: sequence 1
      const env1: TelemetryEnvelope = {
        stationId: "station-maitri",
        assetId: "asset-maitri-gen-1",
        metric: "temperature",
        value: 72.0,
        unit: "degC",
        timestamp: new Date().toISOString(),
        source: "SIMULATED",
        quality: "GOOD",
        sequence: 1,
      };
      await localIngest.handleMessage("stations/station-maitri/telemetry/asset-maitri-gen-1", Buffer.from(JSON.stringify(env1)));

      // Packet 2: sequence 5 (Gap of 3 packets: 2, 3, 4 missing)
      const env2: TelemetryEnvelope = {
        stationId: "station-maitri",
        assetId: "asset-maitri-gen-1",
        metric: "temperature",
        value: 72.5,
        unit: "degC",
        timestamp: new Date().toISOString(),
        source: "SIMULATED",
        quality: "GOOD",
        sequence: 5,
      };
      await localIngest.handleMessage("stations/station-maitri/telemetry/asset-maitri-gen-1", Buffer.from(JSON.stringify(env2)));

      // Packet 3: duplicate sequence 5
      await localIngest.handleMessage("stations/station-maitri/telemetry/asset-maitri-gen-1", Buffer.from(JSON.stringify(env2)));

      // Packet 4: out-of-order packet (sequence 3 arrived late)
      const env3: TelemetryEnvelope = {
        stationId: "station-maitri",
        assetId: "asset-maitri-gen-1",
        metric: "temperature",
        value: 72.2,
        unit: "degC",
        timestamp: new Date().toISOString(),
        source: "SIMULATED",
        quality: "GOOD",
        sequence: 3,
      };
      await localIngest.handleMessage("stations/station-maitri/telemetry/asset-maitri-gen-1", Buffer.from(JSON.stringify(env3)));

      const stats = localIngest.getStats();
      expect(stats.totalReceived).toBe(4);
      expect(stats.duplicateCount).toBe(1);
      expect(stats.gapCount).toBe(3);
      expect(stats.outOfOrderCount).toBe(1);
      expect(stats.totalPersisted).toBe(3); // 1 duplicate was dropped/deduplicated!
    });
  });

  describe("5. Store-and-forward edge buffer and batch replay with acknowledgement metadata", () => {
    it("buffers offline messages, assigns replay batches, and acknowledges them", () => {
      const buffer = new OfflineBufferQueue(100);
      buffer.clear();

      const env1: TelemetryEnvelope = {
        stationId: "station-maitri",
        metric: "wind_speed",
        value: 15.5,
        unit: "m/s",
        timestamp: new Date().toISOString(),
        source: "SIMULATED",
        quality: "GOOD",
        sequence: 10,
      };
      const env2: TelemetryEnvelope = {
        stationId: "station-maitri",
        metric: "wind_speed",
        value: 18.2,
        unit: "m/s",
        timestamp: new Date().toISOString(),
        source: "SIMULATED",
        quality: "GOOD",
        sequence: 11,
      };

      buffer.enqueue(env1, "stations/station-maitri/environment");
      buffer.enqueue(env2, "stations/station-maitri/environment");

      expect(buffer.size()).toBe(2);
      expect(buffer.getOldestTimestamp()).toBeDefined();

      // Prepare batch for replay
      const replay = buffer.prepareReplayBatch(10);
      expect(replay).toBeDefined();
      expect(replay?.metadata.totalCount).toBe(2);
      expect(replay?.metadata.sequenceRange).toEqual([10, 11]);
      expect(replay?.metadata.batchId).toBeDefined();
      expect(replay?.metadata.publishedAt).toBeDefined();
      expect(replay?.metadata.replayStatus).toBe("REPLAYING");

      // Server acknowledgement
      const acked = buffer.acknowledgeBatch(replay!.metadata.batchId);
      expect(acked).toBe(2);
      expect(buffer.size()).toBe(0);
    });
  });

  describe("6. Connectivity degradation and recovery simulation", () => {
    it("supports NORMAL, DEGRADED, OFFLINE, and RECOVERY connectivity transitions", async () => {
      const sim = new TelemetrySimulator(mqtt);
      sim.getBuffer().clear();

      expect(sim.getConnectivityState()).toBe("NORMAL");

      // Switch to OFFLINE
      sim.setConnectivityState("OFFLINE");
      expect(sim.getConnectivityState()).toBe("OFFLINE");

      // Step while offline buffers packets
      const emitted = await sim.step();
      expect(emitted.length).toBeGreaterThan(0);
      expect(sim.getBuffer().size()).toBe(emitted.length);

      // Switch to RECOVERY: replays store-and-forward batches and clears buffer
      sim.setConnectivityState("RECOVERY");
      await sim.replayStoreAndForwardBatches();

      expect(sim.getBuffer().size()).toBe(0);
      expect(sim.getConnectivityState()).toBe("NORMAL");
    });
  });

  describe("7. Deterministic anomaly demo controls", () => {
    it("provides demo controls for all 6 required anomaly presets", () => {
      const sim = new TelemetrySimulator(mqtt);

      // 1. Generator overheating
      const anom1 = sim.injectGeneratorOverheating();
      expect(anom1.type).toBe("GENERATOR_OVERHEAT");
      expect(anom1.targetValue).toBe(98.5);

      // 2. Fuel consumption spike
      const anom2 = sim.injectFuelConsumptionSpike();
      expect(anom2.type).toBe("FUEL_CONSUMPTION_SPIKE");
      expect(anom2.multiplier).toBe(2.2);

      // 3. Battery discharge
      const anom3 = sim.injectBatteryDischarge();
      expect(anom3.type).toBe("BATTERY_DISCHARGE");
      expect(anom3.targetValue).toBe(14.5);

      // 4. HVAC load spike
      const anom4 = sim.injectHvacLoadSpike();
      expect(anom4.type).toBe("HVAC_LOAD_SPIKE");
      expect(anom4.targetValue).toBe(92.0);

      // 5. Communication loss
      const anom5 = sim.injectCommunicationLoss();
      expect(anom5.type).toBe("COMMUNICATION_LOSS");
      expect(anom5.targetValue).toBe(78.0);

      // 6. Environmental extreme
      const anom6 = sim.injectEnvironmentalExtreme();
      expect(anom6.type).toBe("ENVIRONMENTAL_EXTREME");
      expect(anom6.targetValue).toBe(46.5);

      expect(sim.getActiveAnomalies().length).toBeGreaterThanOrEqual(6);

      sim.clearAnomalies();
      expect(sim.getActiveAnomalies().length).toBe(0);
    });
  });

  describe("8. Exit Criteria: Full Pipeline (telemetry -> MQTT -> validate -> persist -> query)", () => {
    it("executes discrete simulation step and verifies live ingestion into TimescaleDB", async () => {
      const sim = new TelemetrySimulator(mqtt);

      const stepEmitted = await sim.step();
      expect(stepEmitted.length).toBeGreaterThanOrEqual(20);

      // Allow broker brief moment to deliver to ingest subscriber
      await new Promise((resolve) => setTimeout(resolve, 800));

      const recentPoints = await telemRepo.findRecent({
        stationId: "station-maitri",
        limit: 20,
      });

      expect(recentPoints.length).toBeGreaterThan(0);
      const latest = recentPoints[0];
      expect(latest.stationId).toBe("station-maitri");
      expect(["SIMULATED", "SIMULATOR"]).toContain(latest.source);
      expect(latest.timestamp).toBeInstanceOf(Date);
      expect(typeof latest.value).toBe("number");
    });

    it("verifies HTTP APIs for simulation status, connectivity, replay, and anomaly presets", async () => {
      // 1. Status API
      const statusRes = await request(app).get("/api/telemetry/simulate/status");
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.data.simulator).toHaveProperty("connectivityState");
      expect(statusRes.body.data.simulator).toHaveProperty("offlineBufferedCount");
      expect(statusRes.body.data.ingest).toHaveProperty("duplicateCount");
      expect(statusRes.body.data.ingest).toHaveProperty("gapCount");

      // 2. Connectivity API
      const connRes = await request(app).post("/api/telemetry/simulate/connectivity").send({ state: "DEGRADED" });
      expect(connRes.status).toBe(200);
      expect(connRes.body.data.connectivityState).toBe("DEGRADED");

      // Reset to NORMAL
      await request(app).post("/api/telemetry/simulate/connectivity").send({ state: "NORMAL" });

      // 3. Anomaly Preset API
      const anomRes = await request(app).post("/api/telemetry/simulate/anomaly/preset").send({
        preset: "FUEL_CONSUMPTION_SPIKE",
        stationId: "station-maitri",
      });
      expect(anomRes.status).toBe(200);
      expect(anomRes.body.data.type).toBe("FUEL_CONSUMPTION_SPIKE");

      // 4. Ingest stats API
      const ingestRes = await request(app).get("/api/telemetry/ingest/stats");
      expect(ingestRes.status).toBe(200);
      expect(ingestRes.body.data).toHaveProperty("stats");
      expect(ingestRes.body.data).toHaveProperty("streams");
    });
  });
});
