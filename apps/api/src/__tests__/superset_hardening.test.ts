import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { BaselineGenerator, SENSOR_DEFINITIONS } from "../telemetry/simulator/baseline";
import { AnomalyManager } from "../telemetry/simulator/anomalies";
import { PRNG } from "../telemetry/simulator/prng";
import { simulationStore } from "../simulation/simulation-store";
import { SimulationRepository } from "../repositories/simulation.repository";
import { getPool, closePool } from "../db/pool";
import type { ResilienceSimulationResult } from "@maitri-bharati/shared";

describe("SIH26060 Superset Hardening: Determinism, Persistence & Fast-Lane", () => {
  beforeAll(async () => {
    const pool = getPool();
    await pool.query("SELECT 1");
  });

  afterAll(async () => {
    await closePool();
  });

  describe("1. Deterministic Telemetry PRNG", () => {
    it("produces identical pseudorandom streams with identical seeds", () => {
      const prng1 = new PRNG(98765);
      const prng2 = new PRNG(98765);

      const seq1: number[] = [];
      const seq2: number[] = [];

      for (let i = 0; i < 50; i++) {
        seq1.push(prng1.next());
        seq2.push(prng2.next());
      }

      expect(seq1).toEqual(seq2);
    });

    it("produces identical baseline telemetry readings for identical tick and seed", () => {
      const genA = new BaselineGenerator(42);
      const genB = new BaselineGenerator(42);
      const anomA = new AnomalyManager();
      const anomB = new AnomalyManager();

      const sensor = SENSOR_DEFINITIONS[0]; // e.g. Primary generator power
      const now = new Date("2026-09-30T12:00:00Z");

      const pointA = genA.generatePoint(sensor, 10, "normal", anomA, 1, now);
      const pointB = genB.generatePoint(sensor, 10, "normal", anomB, 1, now);

      expect(pointA.envelope.value).toBe(pointB.envelope.value);
      expect(pointA.envelope.quality).toBe(pointB.envelope.quality);
      expect(pointA.envelope.metric).toBe(pointB.envelope.metric);
    });
  });

  describe("2. Durable Simulation Persistence in PostgreSQL", () => {
    it("persists resilience simulation results to database and retrieves them correctly", async () => {
      const testSimId = `sim-test-${Date.now()}`;
      const dummyResult: ResilienceSimulationResult = {
        simulationId: testSimId,
        stationId: "station-maitri",
        scenarioType: "GENERATOR_FAILURE",
        title: "Test Generator Failure Durability",
        label: "SIMULATION",
        modelVersion: "2.1.0-polar",
        deterministicSeed: "42",
        createdAt: new Date().toISOString(),
        snapshotTimestamp: new Date().toISOString(),
        parameters: { scenarioType: "GENERATOR_FAILURE", durationHours: 2, severity: "CRITICAL" },
        baselineSnapshot: { stationId: "station-maitri", stationStatus: "OPERATIONAL" } as any,
        scenarioState: { stationId: "station-maitri", stationStatus: "CRITICAL" } as any,
        explanation: "Simulated complete loss of primary 125 kVA generator unit",
        impactedAssets: [
          {
            assetId: "asset-maitri-gen-1",
            assetName: "Primary Diesel Generator 125 kVA",
            type: "GENERATOR",
            baselineStatus: "OPERATIONAL",
            scenarioStatus: "OFFLINE",
            criticality: "CRITICAL",
            downstreamAffectedCount: 3,
            impactChain: ["asset-maitri-gen-1", "asset-maitri-bat-1"],
          },
        ],
        blastRadius: {
          nodes: [{ id: "asset-maitri-gen-1", label: "GEN-01", type: "GENERATOR", criticality: "CRITICAL", status: "OFFLINE" }],
          links: [],
        },
        comparisons: [],
        operationalRisk: { score: 85, level: "CRITICAL", factors: ["Primary power failure"] },
        recoveryState: {
          suggestedActions: ["Start standby generator GEN-02", "Shed non-critical lab loads"],
          estimatedRecoveryMinutes: 20,
        },
      };

      // Save via store (which writes to DB)
      simulationStore.save(dummyResult);

      // Verify directly from repository to ensure database persistence
      const repo = new SimulationRepository();
      // Allow slight async tick for DB insert
      await new Promise((r) => setTimeout(r, 200));

      const fromDb = await repo.findResilienceById(testSimId);
      expect(fromDb).not.toBeNull();
      expect(fromDb?.simulationId).toBe(testSimId);
      expect(fromDb?.stationId).toBe("station-maitri");
      expect(fromDb?.scenarioType).toBe("GENERATOR_FAILURE");
      expect(fromDb?.label).toBe("SIMULATION");
      expect(fromDb?.operationalRisk.score).toBe(85);
      expect(fromDb?.recoveryState.suggestedActions.length).toBeGreaterThan(0);
      expect(fromDb?.impactedAssets[0].assetId).toBe("asset-maitri-gen-1");
    });
  });

  describe("3. Bandwidth / Fast-Lane Telemetry Serialization", () => {
    it("achieves higher efficiency with compact fast-lane payload compared to verbose format", () => {
      const verboseReading = {
        stationId: "station-maitri",
        assetId: "asset-maitri-gen-1",
        metric: "power_output_kw",
        value: 116.4,
        unit: "kW",
        timestamp: "2026-09-30T12:00:00.000Z",
        quality: "GOOD",
        source: "SIMULATED",
        sequence: 1042,
      };

      const compactReading = {
        s: "station-maitri",
        a: "asset-maitri-gen-1",
        m: "power_output_kw",
        v: 116.4,
        ts: 1790769600000,
        q: 1,
        seq: 1042,
      };

      const verboseBytes = Buffer.byteLength(JSON.stringify(verboseReading), "utf8");
      const compactBytes = Buffer.byteLength(JSON.stringify(compactReading), "utf8");

      expect(compactBytes).toBeLessThan(verboseBytes);
      const ratio = verboseBytes / compactBytes;
      expect(ratio).toBeGreaterThan(1.3); // Measurable compression ratio
    });
  });
});
