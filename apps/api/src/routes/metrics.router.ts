import { Router, Request, Response } from "express";
import { MetricDefinitionRepository } from "../repositories";

export function createMetricsRouter(): Router {
  const router = Router();
  const metricRepo = new MetricDefinitionRepository();

  // GET /api/metrics
  router.get("/", async (_req: Request, res: Response) => {
    try {
      const defs = await metricRepo.findAll();
      res.json({
        success: true,
        data: defs,
        meta: { total: defs.length, timestamp: new Date().toISOString() },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  // GET /api/metrics/:metric
  router.get("/:metric", async (req: Request, res: Response) => {
    try {
      const def = await metricRepo.findByMetric(req.params.metric);
      if (!def) {
        res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Metric definition not found" } });
        return;
      }
      res.json({ success: true, data: def });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  return router;
}
