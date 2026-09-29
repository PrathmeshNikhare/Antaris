import { Router, Request, Response } from "express";
import { OperatorRepository } from "../repositories";

export function createOperatorsRouter(): Router {
  const router = Router();
  const operatorRepo = new OperatorRepository();

  // GET /api/operators
  router.get("/", async (_req: Request, res: Response) => {
    try {
      const operators = await operatorRepo.findAll();
      res.json({
        success: true,
        data: operators,
        meta: { total: operators.length, timestamp: new Date().toISOString() },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  return router;
}
