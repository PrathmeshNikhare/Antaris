import { Router, Request, Response } from "express";
import { TelemetryRepository } from "../repositories";
import { getTelemetryPipeline, type AnomalyDefinition } from "../telemetry";
import type { SimulatorMode } from "@maitri-bharati/shared";

export function createTelemetryRouter(): Router {
  const router = Router();
  const telemRepo = new TelemetryRepository();

  // GET /api/telemetry?stationId=...&metric=...&from=...&to=...&limit=...
  router.get("/", async (req: Request, res: Response) => {
    try {
      const stationId = String(req.query.stationId ?? "");
      if (!stationId) {
        res.status(400).json({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "stationId query parameter is required" },
        });
        return;
      }
      const metric = req.query.metric ? String(req.query.metric) : undefined;
      const assetId = req.query.assetId ? String(req.query.assetId) : undefined;
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 100;
      const from = req.query.from ? new Date(String(req.query.from)) : undefined;
      const to = req.query.to ? new Date(String(req.query.to)) : undefined;

      const points = await telemRepo.findRecent({
        stationId,
        metric,
        assetId,
        limit,
        from,
        to,
      });

      res.json({
        success: true,
        data: points,
        meta: { total: points.length, timestamp: new Date().toISOString() },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  // GET /api/telemetry/simulate/status
  router.get("/simulate/status", (_req: Request, res: Response) => {
    try {
      const { simulator, ingest } = getTelemetryPipeline();
      res.json({
        success: true,
        data: {
          simulator: simulator.getStatus(),
          ingest: ingest.getStats(),
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  // POST /api/telemetry/simulate/start
  router.post("/simulate/start", (req: Request, res: Response) => {
    try {
      const { simulator } = getTelemetryPipeline();
      const intervalMs = req.body?.intervalMs ? parseInt(req.body.intervalMs, 10) : undefined;
      simulator.start(intervalMs);
      res.json({ success: true, data: simulator.getStatus() });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  // POST /api/telemetry/simulate/stop
  router.post("/simulate/stop", (_req: Request, res: Response) => {
    try {
      const { simulator } = getTelemetryPipeline();
      simulator.stop();
      res.json({ success: true, data: simulator.getStatus() });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  // POST /api/telemetry/simulate/step - Trigger a single discrete simulation tick
  router.post("/simulate/step", async (_req: Request, res: Response) => {
    try {
      const { simulator } = getTelemetryPipeline();
      const emitted = await simulator.step();
      res.json({
        success: true,
        data: {
          emittedCount: emitted.length,
          status: simulator.getStatus(),
          sample: emitted.slice(0, 3),
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  // POST /api/telemetry/simulate/mode
  router.post("/simulate/mode", (req: Request, res: Response) => {
    try {
      const { simulator } = getTelemetryPipeline();
      const mode = req.body?.mode as SimulatorMode;
      if (!["normal", "noisy", "anomaly", "offline", "recovery"].includes(mode)) {
        res.status(400).json({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid mode. Allowed: normal, noisy, anomaly, offline, recovery" },
        });
        return;
      }
      simulator.setMode(mode);
      res.json({ success: true, data: simulator.getStatus() });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  // POST /api/telemetry/simulate/anomaly
  router.post("/simulate/anomaly", (req: Request, res: Response) => {
    try {
      const { simulator } = getTelemetryPipeline();
      const { type, stationId, assetId, metric, targetValue, multiplier, durationSeconds } = req.body ?? {};

      if (!type || !stationId || !metric) {
        res.status(400).json({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "type, stationId, and metric are required fields" },
        });
        return;
      }

      const anomalyDef: AnomalyDefinition = {
        type,
        stationId,
        assetId,
        metric,
        targetValue,
        multiplier,
        durationSeconds,
      };

      const injected = simulator.injectAnomaly(anomalyDef);
      res.json({ success: true, data: injected });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  // POST /api/telemetry/simulate/clear-anomalies
  router.post("/simulate/clear-anomalies", (_req: Request, res: Response) => {
    try {
      const { simulator } = getTelemetryPipeline();
      simulator.clearAnomalies();
      res.json({ success: true, data: simulator.getStatus() });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  // POST /api/telemetry/simulate/offline
  router.post("/simulate/offline", (req: Request, res: Response) => {
    try {
      const { simulator } = getTelemetryPipeline();
      const offline = Boolean(req.body?.offline);
      simulator.toggleOffline(offline);
      res.json({ success: true, data: simulator.getStatus() });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  // POST /api/telemetry/simulate/connectivity
  router.post("/simulate/connectivity", (req: Request, res: Response) => {
    try {
      const { simulator } = getTelemetryPipeline();
      const state = req.body?.state;
      if (!["NORMAL", "DEGRADED", "OFFLINE", "RECOVERY"].includes(state)) {
        res.status(400).json({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "state must be one of: NORMAL, DEGRADED, OFFLINE, RECOVERY" },
        });
        return;
      }
      simulator.setConnectivityState(state);
      res.json({ success: true, data: simulator.getStatus() });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  // POST /api/telemetry/simulate/replay - Trigger store-and-forward batch replay
  router.post("/simulate/replay", async (req: Request, res: Response) => {
    try {
      const { simulator } = getTelemetryPipeline();
      const batchSize = req.body?.batchSize ? parseInt(String(req.body.batchSize), 10) : 100;
      const replayResult = await simulator.replayStoreAndForwardBatches(batchSize);
      res.json({
        success: true,
        data: {
          replayed: Boolean(replayResult),
          batch: replayResult?.metadata,
          remainingBufferedCount: simulator.getStatus().offlineBufferedCount,
          simulatorStatus: simulator.getStatus(),
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  // POST /api/telemetry/simulate/anomaly/preset
  router.post("/simulate/anomaly/preset", async (req: Request, res: Response) => {
    try {
      const { simulator } = getTelemetryPipeline();
      const { preset, stationId = "station-maitri" } = req.body ?? {};

      if (preset === "NORMAL") {
        simulator.clearAnomalies();
        simulator.setConnectivityState("NORMAL");
        await simulator.step();
        res.json({
          success: true,
          message: "Nominal conditions restored",
          data: { status: simulator.getStatus() },
        });
        return;
      }

      let anomaly;
      switch (preset) {
        case "GENERATOR_OVERHEAT":
          anomaly = simulator.injectGeneratorOverheating(stationId);
          break;
        case "FUEL_CONSUMPTION_SPIKE":
          anomaly = simulator.injectFuelConsumptionSpike(stationId);
          break;
        case "BATTERY_DISCHARGE":
          anomaly = simulator.injectBatteryDischarge(stationId);
          break;
        case "HVAC_LOAD_SPIKE":
          anomaly = simulator.injectHvacLoadSpike(stationId);
          break;
        case "COMMUNICATION_LOSS":
          anomaly = simulator.injectCommunicationLoss(stationId);
          simulator.setConnectivityState("DEGRADED");
          break;
        case "ENVIRONMENTAL_EXTREME":
          anomaly = simulator.injectEnvironmentalExtreme(stationId);
          break;
        default:
          res.status(400).json({
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "preset must be one of: NORMAL, GENERATOR_OVERHEAT, FUEL_CONSUMPTION_SPIKE, BATTERY_DISCHARGE, HVAC_LOAD_SPIKE, COMMUNICATION_LOSS, ENVIRONMENTAL_EXTREME",
            },
          });
          return;
      }

      // Step simulator immediately so anomalous telemetry is published and reflected in Digital Twin without delay
      await simulator.step();

      res.json({ success: true, data: anomaly });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  // GET /api/telemetry/ingest/stats
  router.get("/ingest/stats", (_req: Request, res: Response) => {
    try {
      const { ingest } = getTelemetryPipeline();
      res.json({
        success: true,
        data: {
          stats: ingest.getStats(),
          streams: ingest.getStreamStats(),
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  return router;
}
