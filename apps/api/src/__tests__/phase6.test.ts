import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import { resilienceEngine, simulationStore } from "../simulation";
import { getTwinRegistry } from "../twin";
import type {
  ResilienceScenarioType,
  ResilienceSimulationResult,
} from "@maitri-bharati/shared";

const app = createApp();

describe("Phase 6: What-If Resilience Simulation Engine", () => {
  beforeEach(() => {
    simulationStore.clear();
  });

  // ────────────────────────────────────────────────────────────────
  // 1. Core Invariant: Twin State Immutability
  // ────────────────────────────────────────────────────────────────
  describe("1. Baseline Twin Immutability", () => {
    it("never mutates the live TwinStateRegistry during or after simulation execution", () => {
      const stationId = "station-maitri";
      const registry = getTwinRegistry();
      const beforeState = JSON.parse(
        JSON.stringify(registry.getTwinState(stationId))
      );

      // Run critical scenario that causes heavy simulated degradation
      const result = resilienceEngine.runSimulation(
        stationId,
        "GENERATOR_FAILURE",
        {
          durationHours: 4,
          severity: "CRITICAL",
        }
      );

      const afterState = JSON.parse(
        JSON.stringify(registry.getTwinState(stationId))
      );

      // Live twin registry MUST NOT be altered
      expect(afterState.statusAssessment.overallStatus).toBe(
        beforeState.statusAssessment.overallStatus
      );
      expect(afterState.energy.dieselFuelLiters).toBe(
        beforeState.energy.dieselFuelLiters
      );
      expect(afterState.assets.length).toBe(beforeState.assets.length);

      const beforeGen = beforeState.assets.find((a: any) =>
        a.assetId === "asset-maitri-gen-1"
      );
      const afterGen = afterState.assets.find((a: any) =>
        a.assetId === "asset-maitri-gen-1"
      );
      expect(afterGen.healthScore).toBe(beforeGen.healthScore);
      expect(afterGen.status).toBe(beforeGen.status);

      // But simulated scenario state reflects the failure!
      const simGen = result.scenarioState.assets.find((a: any) =>
        a.assetId === "asset-maitri-gen-1"
      );
      expect(simGen.healthScore).toBeLessThan(beforeGen.healthScore);
      expect(result.label).toBe("SIMULATION");
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 2. All 8 Counterfactual Scenarios
  // ────────────────────────────────────────────────────────────────
  describe("2. Counterfactual Scenarios Execution", () => {
    const stationId = "station-maitri";

    it("executes GENERATOR_FAILURE and computes battery & freeze cascade", () => {
      const result = resilienceEngine.runSimulation(stationId, "GENERATOR_FAILURE", {
        durationHours: 3.5,
      });

      expect(result.scenarioType).toBe("GENERATOR_FAILURE");
      expect(result.label).toBe("SIMULATION");
      expect(result.impactedAssets.length).toBeGreaterThanOrEqual(1);

      // Verify comparisons contain power and battery metrics
      const powerComp = result.comparisons.find((c) =>
        c.metric.toLowerCase().includes("generation")
      );
      expect(powerComp).toBeDefined();
      expect(powerComp?.severity).toBe("CRITICAL");

      // Verify blast radius includes downstream dependencies
      expect(result.blastRadius.nodes.length).toBeGreaterThanOrEqual(2);
      expect(result.blastRadius.links.length).toBeGreaterThanOrEqual(1);
      expect(result.recoveryState.suggestedActions.length).toBeGreaterThan(0);
    });

    it("executes BATTERY_DEGRADATION and computes sub-zero capacity loss", () => {
      const result = resilienceEngine.runSimulation(stationId, "BATTERY_DEGRADATION", {
        batteryDegradationPct: 60,
      });

      expect(result.scenarioType).toBe("BATTERY_DEGRADATION");
      const batComp = result.comparisons.find((c) =>
        c.metric.toLowerCase().includes("battery")
      );
      expect(batComp).toBeDefined();
      expect(result.operationalRisk.level).toMatch(/HIGH|CRITICAL/);
    });

    it("executes FUEL_SHORTAGE and warns of winter emergency survival breach", () => {
      const result = resilienceEngine.runSimulation(stationId, "FUEL_SHORTAGE", {
        fuelLossLiters: 60000,
      });

      expect(result.scenarioType).toBe("FUEL_SHORTAGE");
      const fuelComp = result.comparisons.find((c) =>
        c.metric.toLowerCase().includes("fuel")
      );
      expect(fuelComp).toBeDefined();
      expect(result.explanation).toContain("Polar Diesel");
      expect(result.recoveryState.suggestedActions.length).toBeGreaterThan(0);
    });

    it("executes EXTREME_COLD and calculates thermal envelope surge", () => {
      const result = resilienceEngine.runSimulation(stationId, "EXTREME_COLD", {
        ambientTempC: -46.5,
      });

      expect(result.scenarioType).toBe("EXTREME_COLD");
      expect(result.scenarioState.environment.ambientTempC).toBe(-46.5);
      const tempComp = result.comparisons.find((c) =>
        c.metric.toLowerCase().includes("ambient")
      );
      expect(tempComp).toBeDefined();
    });

    it("executes HIGH_WIND and engages aerodynamic turbine storm lock", () => {
      const result = resilienceEngine.runSimulation("station-bharati", "HIGH_WIND", {
        windSpeedMs: 50.0,
      });

      expect(result.scenarioType).toBe("HIGH_WIND");
      expect(result.scenarioState.environment.windSpeedMs).toBe(50.0);
      const windTurbine = result.impactedAssets.find((a) =>
        a.assetName.toLowerCase().includes("turbine") || a.assetId.toLowerCase().includes("wnd")
      );
      expect(windTurbine).toBeDefined();
      expect(windTurbine?.failureCause).toMatch(/feather|brake|storm|lock/i);
    });

    it("executes LOAD_REDUCTION (Demand Response) and reflects positive margin expansion", () => {
      const result = resilienceEngine.runSimulation(stationId, "LOAD_REDUCTION", {
        loadReductionPct: 35,
      });

      expect(result.scenarioType).toBe("LOAD_REDUCTION");
      const loadComp = result.comparisons.find((c) =>
        c.metric.toLowerCase().includes("load")
      );
      expect(loadComp).toBeDefined();
      expect(loadComp?.severity).toBe("IMPROVEMENT");
      expect(result.operationalRisk.score).toBeLessThanOrEqual(20);
      expect(result.operationalRisk.level).toBe("LOW");
    });

    it("executes BACKUP_GEN_ACTIVATION and restores redundancy", () => {
      const result = resilienceEngine.runSimulation(stationId, "BACKUP_GEN_ACTIVATION");

      expect(result.scenarioType).toBe("BACKUP_GEN_ACTIVATION");
      const redundancyComp = result.comparisons.find((c) =>
        c.metric.toLowerCase().includes("redundancy") || c.metric.toLowerCase().includes("online")
      );
      expect(redundancyComp).toBeDefined();
      expect(redundancyComp?.severity).toBe("IMPROVEMENT");
    });

    it("executes COMMUNICATION_OUTAGE and engages local store-and-forward edge queue", () => {
      const result = resilienceEngine.runSimulation(stationId, "COMMUNICATION_OUTAGE", {
        durationHours: 12,
      });

      expect(result.scenarioType).toBe("COMMUNICATION_OUTAGE");
      expect(result.scenarioState.connectivityState).toBe("OFFLINE");
      const commComp = result.comparisons.find((c) =>
        c.metric.toLowerCase().includes("comms") || c.metric.toLowerCase().includes("connectivity")
      );
      expect(commComp).toBeDefined();
      expect(commComp?.scenario).toBe("OFFLINE");
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 3. Determinism and Comparison Outputs
  // ────────────────────────────────────────────────────────────────
  describe("3. Determinism and Structural Integrity", () => {
    it("produces identical output given the same deterministic seed", () => {
      const stationId = "station-maitri";
      const params = {
        durationHours: 3,
        deterministicSeed: 98765,
      };

      const run1 = resilienceEngine.runSimulation(
        stationId,
        "GENERATOR_FAILURE",
        params
      );
      const run2 = resilienceEngine.runSimulation(
        stationId,
        "GENERATOR_FAILURE",
        params
      );

      expect(run1.comparisons.length).toBe(run2.comparisons.length);
      expect(run1.operationalRisk.score).toBe(run2.operationalRisk.score);
      expect(run1.impactedAssets.length).toBe(run2.impactedAssets.length);
      expect(run1.recoveryState.estimatedRecoveryMinutes).toBe(
        run2.recoveryState.estimatedRecoveryMinutes
      );
    });

    it("persists runs into SimulationStore and allows retrieval", () => {
      const stationId = "station-maitri";
      const result = resilienceEngine.runSimulation(stationId, "EXTREME_COLD");

      const stored = simulationStore.getById(result.simulationId);
      expect(stored).toBeDefined();
      expect(stored?.simulationId).toBe(result.simulationId);

      const list = simulationStore.listByStation(stationId);
      expect(list.length).toBeGreaterThan(0);
      expect(list[0].simulationId).toBe(result.simulationId);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 4. REST API Integration Endpoints
  // ────────────────────────────────────────────────────────────────
  describe("4. Simulations REST API Endpoints", () => {
    it("GET /api/simulations/scenarios/supported returns all 8 scenario definitions", async () => {
      const res = await request(app).get("/api/simulations/scenarios/supported");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(8);

      const types = res.body.data.map((s: any) => s.type);
      expect(types).toContain("GENERATOR_FAILURE");
      expect(types).toContain("BATTERY_DEGRADATION");
      expect(types).toContain("FUEL_SHORTAGE");
      expect(types).toContain("EXTREME_COLD");
      expect(types).toContain("HIGH_WIND");
      expect(types).toContain("LOAD_REDUCTION");
      expect(types).toContain("BACKUP_GEN_ACTIVATION");
      expect(types).toContain("COMMUNICATION_OUTAGE");
    });

    it("POST /api/simulations executes simulation and returns 201 with SIMULATION label", async () => {
      const res = await request(app)
        .post("/api/simulations")
        .send({
          stationId: "station-maitri",
          scenarioType: "GENERATOR_FAILURE",
          parameters: { durationHours: 2 },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const sim: ResilienceSimulationResult = res.body.data;
      expect(sim.label).toBe("SIMULATION");
      expect(sim.simulationId).toMatch(/^sim-/);
      expect(sim.comparisons.length).toBeGreaterThan(0);
      expect(sim.blastRadius.nodes.length).toBeGreaterThan(0);
      expect(sim.recoveryState.suggestedActions.length).toBeGreaterThan(0);

      // Verify retrieval by ID
      const getRes = await request(app).get(`/api/simulations/${sim.simulationId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.simulationId).toBe(sim.simulationId);
    });

    it("POST /api/simulations validates required scenarioType field", async () => {
      const res = await request(app).post("/api/simulations").send({
        stationId: "station-maitri",
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("MISSING_SCENARIO_TYPE");
    });

    it("GET /api/simulations/:simulationId returns 404 for nonexistent simulation", async () => {
      const res = await request(app).get("/api/simulations/sim-nonexistent-12345");
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("SIMULATION_NOT_FOUND");
    });
  });
});
