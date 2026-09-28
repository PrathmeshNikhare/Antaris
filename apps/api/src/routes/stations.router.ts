import { Router, Request, Response } from "express";
import { StationRepository, AssetRepository, AlertRepository } from "../repositories";
import type { ApiResponse } from "@maitri-bharati/shared";

export function createStationsRouter(): Router {
  const router = Router();
  const stationRepo = new StationRepository();
  const assetRepo = new AssetRepository();
  const alertRepo = new AlertRepository();

  // GET /api/stations
  router.get("/", async (_req: Request, res: Response) => {
    try {
      const stations = await stationRepo.findAll();
      const response: ApiResponse<typeof stations> = {
        success: true,
        data: stations,
        meta: { timestamp: new Date().toISOString(), total: stations.length },
      };
      res.json(response);
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  // GET /api/stations/:stationId
  router.get("/:stationId", async (req: Request, res: Response) => {
    try {
      const { stationId } = req.params;
      const station = await stationRepo.findById(stationId);
      if (!station) {
        res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: `Station ${stationId} not found` } });
        return;
      }
      res.json({ success: true, data: station });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  // GET /api/stations/:stationId/summary
  router.get("/:stationId/summary", async (req: Request, res: Response) => {
    try {
      const { stationId } = req.params;
      const station = await stationRepo.findById(stationId);
      if (!station) {
        res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: `Station ${stationId} not found` } });
        return;
      }
      const assets = await assetRepo.findByStationId(stationId);
      const openAlerts = await alertRepo.findByStationId(stationId, "OPEN");

      const operationalAssets = assets.filter((a) => a.status === "OPERATIONAL").length;
      const degradedAssets = assets.filter((a) => a.status === "DEGRADED").length;
      const failedAssets = assets.filter((a) => a.status === "FAILED").length;

      res.json({
        success: true,
        data: {
          station,
          assetSummary: {
            total: assets.length,
            operational: operationalAssets,
            degraded: degradedAssets,
            failed: failedAssets,
          },
          activeAlertCount: openAlerts.length,
          lastSyncAt: station.lastSyncAt,
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  // GET /api/stations/:stationId/assets
  router.get("/:stationId/assets", async (req: Request, res: Response) => {
    try {
      const { stationId } = req.params;
      const assets = await assetRepo.findByStationId(stationId);
      res.json({ success: true, data: assets, meta: { total: assets.length, timestamp: new Date().toISOString() } });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  return router;
}
