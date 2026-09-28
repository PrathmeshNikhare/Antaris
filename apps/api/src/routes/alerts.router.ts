import { Router, Request, Response } from "express";
import { AlertRepository } from "../repositories";
import type { AlertStatus } from "@maitri-bharati/shared";

export function createAlertsRouter(): Router {
  const router = Router();
  const alertRepo = new AlertRepository();

  // GET /api/stations/:stationId/alerts
  router.get("/stations/:stationId/alerts", async (req: Request, res: Response) => {
    try {
      const { stationId } = req.params;
      const status = req.query.status as AlertStatus | undefined;
      const alerts = await alertRepo.findByStationId(stationId, status);
      res.json({ success: true, data: alerts, meta: { total: alerts.length, timestamp: new Date().toISOString() } });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  // POST /api/alerts/:alertId/acknowledge
  router.post("/alerts/:alertId/acknowledge", async (req: Request, res: Response) => {
    try {
      const { alertId } = req.params;
      const updated = await alertRepo.updateStatus(alertId, "ACKNOWLEDGED");
      if (!updated) {
        res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: `Alert ${alertId} not found` } });
        return;
      }
      res.json({ success: true, data: updated });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  // POST /api/alerts/:alertId/resolve
  router.post("/alerts/:alertId/resolve", async (req: Request, res: Response) => {
    try {
      const { alertId } = req.params;
      const updated = await alertRepo.updateStatus(alertId, "RESOLVED");
      if (!updated) {
        res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: `Alert ${alertId} not found` } });
        return;
      }
      res.json({ success: true, data: updated });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  return router;
}
