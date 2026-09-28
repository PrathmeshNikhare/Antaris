import { Router, Request, Response } from "express";
import { TelemetryRepository } from "../repositories";

export function createTelemetryRouter(): Router {
  const router = Router();
  const telemRepo = new TelemetryRepository();

  // GET /api/telemetry?stationId=...&metric=...&from=...&to=...&limit=...
  router.get("/", async (req: Request, res: Response) => {
    try {
      const stationId = String(req.query.stationId ?? "");
      if (!stationId) {
        res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "stationId query parameter is required" } });
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

      res.json({ success: true, data: points, meta: { total: points.length, timestamp: new Date().toISOString() } });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  return router;
}
