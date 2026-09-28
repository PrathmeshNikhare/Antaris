import { Router, Request, Response } from "express";
import { ForecastRepository } from "../repositories";

export function createForecastsRouter(): Router {
  const router = Router();
  const forecastRepo = new ForecastRepository();

  // GET /api/stations/:stationId/forecasts
  router.get("/:stationId/forecasts", async (req: Request, res: Response) => {
    try {
      const { stationId } = req.params;
      const target = req.query.target ? String(req.query.target) : undefined;
      const forecasts = await forecastRepo.findByStationId(stationId, target);
      res.json({ success: true, data: forecasts, meta: { total: forecasts.length, timestamp: new Date().toISOString() } });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  return router;
}
