import { Router, Request, Response } from "express";
import { TelemetryRepository } from "../repositories";
import { getTelemetryPipeline, type AnomalyDefinition } from "../telemetry";
import { intelligenceService } from "../intelligence";
import { twinWebSocketManager } from "../twin/websocket";
import { getTwinRegistry } from "../twin/registry";
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
  router.post("/simulate/connectivity", async (req: Request, res: Response) => {
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
      try {
        const twinRegistry = getTwinRegistry();
        twinRegistry.setConnectivityState("station-maitri", state);
        twinRegistry.setConnectivityState("station-bharati", state);
      } catch (e) {
        console.warn("[telemetry.router] Warning synchronizing twin registry connectivity:", e);
      }

      if (state === "OFFLINE") {
        for (const stn of ["station-maitri", "station-bharati"] as const) {
          const assetId = stn === "station-maitri" ? "asset-maitri-comm-1" : "asset-bharati-ground-1";
          intelligenceService.evaluateTelemetry({
            id: `blackout-loss-${Date.now()}`,
            stationId: stn,
            assetId,
            metric: "packet_loss_pct",
            value: 100.0,
            unit: "%",
            timestamp: new Date(),
            source: "SIMULATED",
            quality: "BAD",
            sequence: 0,
          });
          intelligenceService.evaluateTelemetry({
            id: `blackout-snr-${Date.now()}`,
            stationId: stn,
            assetId,
            metric: "snr_db",
            value: 0.0,
            unit: "dB",
            timestamp: new Date(),
            source: "SIMULATED",
            quality: "BAD",
            sequence: 0,
          });
          const anomalies = intelligenceService.anomalyService.getActiveAnomalies(stn);
          twinWebSocketManager.broadcast("intelligence.updated", stn, {
            stationId: stn,
            activeAnomalies: anomalies,
          });
        }
      } else if (state === "RECOVERY") {
        await simulator.replayStoreAndForwardBatches(100);
      }

      // Step simulator immediately so comms degradation, blackout, or recovery is published without delay
      await simulator.step();
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
        intelligenceService.anomalyService.clearAnomalies(stationId);
        twinWebSocketManager.broadcast("intelligence.updated", stationId, {
          stationId,
          activeAnomalies: [],
        });
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

  // GET /api/telemetry/fast-lane
  router.get("/fast-lane", async (req: Request, res: Response) => {
    try {
      const stationId = String(req.query.stationId ?? "station-maitri");
      const sinceSeq = parseInt(String(req.query.since ?? "0"), 10);
      const limit = parseInt(String(req.query.limit ?? "100"), 10);

      const registry = getTwinRegistry();
      const twin = registry.getTwinState(stationId);

      const deltaItems: any[] = [];
      if (twin) {
        for (const asset of twin.assets) {
          for (const [metric, telemVal] of Object.entries(asset.currentTelemetry)) {
            const telem = telemVal as any;
            if (telem && typeof telem.sequence === "number" && telem.sequence > sinceSeq) {
              deltaItems.push({
                stationId,
                assetId: asset.assetId,
                metric,
                val: telem.value,
                ts: new Date(telem.timestamp).getTime(),
                q: telem.quality === "GOOD" ? 1 : telem.quality === "SUSPECT" ? 2 : 3,
                seq: telem.sequence,
              });
            }
          }
        }
      }

      deltaItems.sort((a, b) => a.seq - b.seq);
      const results = deltaItems.slice(0, limit);

      res.json({
        success: true,
        data: results,
        meta: {
          stationId,
          count: results.length,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  // GET /api/telemetry/fast-lane/metrics
  router.get("/fast-lane/metrics", (req: Request, res: Response) => {
    try {
      const stationId = String(req.query.stationId ?? "station-maitri");
      const { simulator } = getTelemetryPipeline();
      const status = simulator.getStatus();
      const conn = status.connectivityState;

      const rawFullBatchSample = JSON.stringify({
        stationId,
        envelopeVersion: "2.1",
        readings: Array.from({ length: 12 }, (_, i) => ({
          assetId: `asset-${stationId}-gen-${i}`,
          metric: "power_output_kw",
          value: 114.5 + i,
          unit: "kW",
          timestamp: new Date().toISOString(),
          quality: "GOOD",
          source: "SIMULATED",
          sequence: 100 + i,
        })),
      });

      const compactBatchSample = JSON.stringify({
        s: stationId,
        r: Array.from({ length: 12 }, (_, i) => [i, "p", 114.5 + i, 100 + i, 1]),
      });

      const fullBytes = Buffer.byteLength(rawFullBatchSample, "utf8");
      const compactBytes = Buffer.byteLength(compactBatchSample, "utf8");
      const empiricalRatio = Number((fullBytes / Math.max(compactBytes, 1)).toFixed(2));

      let bandwidthMode: "BROADBAND" | "FAST_LANE_COMPACT" | "STORE_FORWARD_OFFLINE" = "BROADBAND";
      let estimatedLatencyMs = 280;

      if (conn === "OFFLINE") {
        bandwidthMode = "STORE_FORWARD_OFFLINE";
        estimatedLatencyMs = 3200;
      } else if (conn === "DEGRADED") {
        bandwidthMode = "FAST_LANE_COMPACT";
        estimatedLatencyMs = 1450;
      }

      const metrics = {
        stationId,
        queueDepth: status.offlineBufferedCount,
        oldestQueuedEventAgeSec: status.offlineBufferedCount > 0 ? 42 : 0,
        lastSyncTimestamp: status.lastSuccessfulSync || new Date().toISOString(),
        estimatedLatencyMs,
        averagePayloadBytes: compactBytes,
        compressionRatio: empiricalRatio,
        bandwidthMode,
      };

      res.json({
        success: true,
        data: metrics,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  return router;
}
