import { Router, Request, Response } from "express";
import { AuditRepository } from "../repositories";

export function createAuditRouter(): Router {
  const router = Router();
  const auditRepo = new AuditRepository();

  // GET /api/audit?limit=...
  router.get("/", async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
      const events = await auditRepo.findRecent(limit);
      res.json({
        success: true,
        data: events,
        meta: { total: events.length, timestamp: new Date().toISOString() },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  // POST /api/audit
  router.post("/", async (req: Request, res: Response) => {
    try {
      const { operatorId, action, targetType, targetId, previousState, newState, result } = req.body ?? {};

      if (!action || !targetType) {
        res.status(400).json({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "action and targetType are required fields" },
        });
        return;
      }

      const event = {
        id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        operatorId: operatorId || "op-duty-officer",
        action,
        targetType,
        targetId,
        previousState,
        newState,
        result: result || "SUCCESS",
        createdAt: new Date(),
      };

      const inserted = await auditRepo.insert(event);
      res.status(201).json({ success: true, data: inserted });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  return router;
}
