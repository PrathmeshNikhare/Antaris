import { Router, Request, Response } from "express";
import { resilienceEngine, simulationStore } from "../simulation";
import type { ApiResponse, ResilienceScenarioType, SimulationParameters } from "@maitri-bharati/shared";

export function createSimulationsRouter(): Router {
  const router = Router();

  // ── GET /api/simulations/scenarios/supported ──────────────────────
  router.get("/scenarios/supported", (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: [
        {
          type: "GENERATOR_FAILURE",
          title: "Generator Failure & Rapid Discharge",
          category: "ENERGY",
          description: "Primary generator trip causing battery discharge and water intake freeze risk.",
          defaultParams: { durationHours: 2.0, severity: "CRITICAL" },
        },
        {
          type: "BATTERY_DEGRADATION",
          title: "Battery Sub-Zero Degradation",
          category: "ENERGY",
          description: "Deep chill capacity loss and grid buffer headroom throttling.",
          defaultParams: { batteryDegradationPct: 65 },
        },
        {
          type: "FUEL_SHORTAGE",
          title: "Polar Diesel Storage Shortage",
          category: "LOGISTICS",
          description: "Major fuel tankage loss breaching the 45-day winter emergency survival window.",
          defaultParams: { fuelLossLiters: 75000 },
        },
        {
          type: "EXTREME_COLD",
          title: "Extreme Polar Cold (-45°C)",
          category: "ENVIRONMENT",
          description: "Building envelope thermal loss surge and generator load spike.",
          defaultParams: { ambientTempC: -45.0, durationHours: 12 },
        },
        {
          type: "HIGH_WIND",
          title: "Category 5 Blizzard (>48 m/s)",
          category: "ENVIRONMENT",
          description: "Turbine mechanical storm lock, solar array blinding, and red station alert.",
          defaultParams: { windSpeedMs: 48.0, durationHours: 8 },
        },
        {
          type: "LOAD_REDUCTION",
          title: "Demand Response & Load Shedding",
          category: "OPERATIONS",
          description: "Intentional non-critical science load curtailment to expand generation headroom.",
          defaultParams: { loadReductionPct: 30 },
        },
        {
          type: "BACKUP_GEN_ACTIVATION",
          title: "Standby Generator Synchronization",
          category: "INFRASTRUCTURE",
          description: "Secondary generator auto-start to eliminate single-point failure vulnerability.",
          defaultParams: {},
        },
        {
          type: "COMMUNICATION_OUTAGE",
          title: "Satellite Outage & Edge Buffer",
          category: "COMMS",
          description: "Total transponder blackout with autonomous local SSD store-and-forward queuing.",
          defaultParams: { durationHours: 24 },
        },
      ],
      meta: { timestamp: new Date().toISOString() },
    });
  });

  // ── POST /api/simulations ─────────────────────────────────────────
  router.post("/", (req: Request, res: Response) => {
    try {
      const { stationId = "station-maitri", scenarioType, parameters } = req.body;

      if (!scenarioType) {
        res.status(400).json({
          success: false,
          error: {
            code: "MISSING_SCENARIO_TYPE",
            message: "Missing required field 'scenarioType'",
          },
        });
        return;
      }

      const simParams: SimulationParameters = {
        scenarioType: scenarioType as ResilienceScenarioType,
        ...parameters,
      };

      const result = resilienceEngine.runSimulation(
        stationId,
        scenarioType as ResilienceScenarioType,
        simParams
      );

      const response: ApiResponse<typeof result> = {
        success: true,
        data: result,
        meta: { timestamp: new Date().toISOString() },
      };

      res.status(201).json(response);
    } catch (err) {
      console.error("[simulations.router] Error running simulation:", err);
      res.status(500).json({
        success: false,
        error: {
          code: "SIMULATION_FAILED",
          message: (err as Error).message || "Internal error running resilience simulation",
        },
      });
    }
  });

  // ── GET /api/simulations ──────────────────────────────────────────
  router.get("/", (req: Request, res: Response) => {
    try {
      const stationId = req.query.stationId as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const history = stationId
        ? simulationStore.listByStation(stationId, limit)
        : simulationStore.getAll(limit);

      res.json({
        success: true,
        data: history,
        meta: { total: history.length, timestamp: new Date().toISOString() },
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: {
          code: "QUERY_FAILED",
          message: (err as Error).message,
        },
      });
    }
  });

  // ── GET /api/simulations/:simulationId ────────────────────────────
  router.get("/:simulationId", (req: Request, res: Response) => {
    try {
      const { simulationId } = req.params;
      const result = simulationStore.getById(simulationId);

      if (!result) {
        res.status(404).json({
          success: false,
          error: {
            code: "SIMULATION_NOT_FOUND",
            message: `Simulation ${simulationId} not found in history store`,
          },
        });
        return;
      }

      res.json({
        success: true,
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: {
          code: "QUERY_FAILED",
          message: (err as Error).message,
        },
      });
    }
  });

  return router;
}
