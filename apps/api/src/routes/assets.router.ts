import { Router, Request, Response } from "express";
import { AssetRepository, TelemetryRepository } from "../repositories";

export function createAssetsRouter(): Router {
  const router = Router();
  const assetRepo = new AssetRepository();
  const telemRepo = new TelemetryRepository();

  // GET /api/assets/:assetId
  router.get("/:assetId", async (req: Request, res: Response) => {
    try {
      const { assetId } = req.params;
      const asset = await assetRepo.findById(assetId);
      if (!asset) {
        res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: `Asset ${assetId} not found` } });
        return;
      }
      res.json({ success: true, data: asset });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  // GET /api/assets/:assetId/telemetry
  router.get("/:assetId/telemetry", async (req: Request, res: Response) => {
    try {
      const { assetId } = req.params;
      const asset = await assetRepo.findById(assetId);
      if (!asset) {
        res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: `Asset ${assetId} not found` } });
        return;
      }
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
      const telemetry = await telemRepo.findRecent({
        stationId: asset.stationId,
        assetId: asset.id,
        limit,
      });
      res.json({ success: true, data: telemetry, meta: { total: telemetry.length, timestamp: new Date().toISOString() } });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  return router;
}
