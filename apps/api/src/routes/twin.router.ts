import { Router, Request, Response } from "express";
import { getTwinRegistry } from "../twin";

export function createTwinRouter(): Router {
  const router = Router();

  // GET /api/twin/:stationId - Returns live operational Twin state for station
  router.get("/:stationId", async (req: Request, res: Response) => {
    try {
      const { stationId } = req.params;
      const registry = getTwinRegistry();
      await registry.init();

      const state = registry.getTwinState(stationId);
      if (!state) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: `Station ${stationId} not found in Digital Twin` },
        });
        return;
      }

      res.json({
        success: true,
        data: state,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  // GET /api/twin/:stationId/assets/:assetId - Returns live asset twin state
  router.get("/:stationId/assets/:assetId", async (req: Request, res: Response) => {
    try {
      const { stationId, assetId } = req.params;
      const registry = getTwinRegistry();
      await registry.init();

      const state = registry.getTwinState(stationId);
      if (!state) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: `Station ${stationId} not found in Digital Twin` },
        });
        return;
      }

      const asset = state.assets.find((a) => a.assetId === assetId);
      if (!asset) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: `Asset ${assetId} not found in Station ${stationId}` },
        });
        return;
      }

      res.json({
        success: true,
        data: asset,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  // GET /api/twin/:stationId/impact/:assetId - Returns downstream impact analysis
  router.get("/:stationId/impact/:assetId", async (req: Request, res: Response) => {
    try {
      const { assetId } = req.params;
      const registry = getTwinRegistry();
      await registry.init();

      const impact = registry.getDependencyGraph().getDownstreamImpact(assetId);

      res.json({
        success: true,
        data: impact,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  // GET /api/twin/:stationId/snapshot - Returns immutable, serializable Twin snapshot
  router.get("/:stationId/snapshot", async (req: Request, res: Response) => {
    try {
      const { stationId } = req.params;
      const registry = getTwinRegistry();
      await registry.init();

      const snapshot = registry.createSnapshot(stationId);

      res.json({
        success: true,
        data: snapshot,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  // GET /api/twin/:stationId/time-travel?at=... - Historical state reconstruction
  router.get("/:stationId/time-travel", async (req: Request, res: Response) => {
    try {
      const { stationId } = req.params;
      const atQuery = req.query.at;

      if (!atQuery) {
        res.status(400).json({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "'at' query parameter (ISO timestamp) is required" },
        });
        return;
      }

      const timestamp = new Date(String(atQuery));
      if (Number.isNaN(timestamp.getTime())) {
        res.status(400).json({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid ISO timestamp for 'at'" },
        });
        return;
      }

      const registry = getTwinRegistry();
      const reconstructed = await registry.reconstructStateAt(stationId, timestamp);

      res.json({
        success: true,
        data: reconstructed,
        meta: { targetTimestamp: timestamp.toISOString() },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  return router;
}
