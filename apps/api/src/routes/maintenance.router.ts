import { Router, Request, Response } from "express";
import { MaintenanceRepository } from "../repositories";

export function createMaintenanceRouter(): Router {
  const router = Router();
  const maintRepo = new MaintenanceRepository();

  // GET /api/maintenance?stationId=...&assetId=...
  router.get("/", async (req: Request, res: Response) => {
    try {
      const stationId = req.query.stationId ? String(req.query.stationId) : undefined;
      const assetId = req.query.assetId ? String(req.query.assetId) : undefined;

      let events;
      if (assetId) {
        events = await maintRepo.findByAssetId(assetId);
      } else if (stationId) {
        events = await maintRepo.findByStationId(stationId);
      } else {
        events = await maintRepo.findByStationId("station-maitri");
      }

      res.json({
        success: true,
        data: events,
        meta: { total: events.length, timestamp: new Date().toISOString() },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  return router;
}
