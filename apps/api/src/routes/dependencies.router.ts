import { Router, Request, Response } from "express";
import { AssetDependencyRepository } from "../repositories";

export function createDependenciesRouter(): Router {
  const router = Router();
  const depRepo = new AssetDependencyRepository();

  // GET /api/dependencies?stationId=...&assetId=...
  router.get("/", async (req: Request, res: Response) => {
    try {
      const stationId = req.query.stationId ? String(req.query.stationId) : undefined;
      const assetId = req.query.assetId ? String(req.query.assetId) : undefined;

      let dependencies;
      if (assetId) {
        dependencies = await depRepo.findByAssetId(assetId);
      } else if (stationId) {
        dependencies = await depRepo.findByStationId(stationId);
      } else {
        dependencies = await depRepo.findAll();
      }

      res.json({
        success: true,
        data: dependencies,
        meta: { total: dependencies.length, timestamp: new Date().toISOString() },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  // GET /api/dependencies/downstream/:assetId (Impact chain traversal)
  router.get("/downstream/:assetId", async (req: Request, res: Response) => {
    try {
      const { assetId } = req.params;
      const downstreamIds = await depRepo.findDownstream(assetId);
      res.json({
        success: true,
        data: {
          rootAssetId: assetId,
          downstreamAssetIds: downstreamIds,
          totalImpacted: downstreamIds.length,
        },
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  return router;
}
