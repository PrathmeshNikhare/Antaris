import { Router, Request, Response } from "express";
import { SimulationRepository } from "../repositories";

export function createSimulationsRouter(): Router {
  const router = Router();
  const simRepo = new SimulationRepository();

  // GET /api/stations/:stationId/simulations
  router.get("/stations/:stationId/simulations", async (req: Request, res: Response) => {
    try {
      const { stationId } = req.params;
      const runs = await simRepo.findByStationId(stationId);
      res.json({ success: true, data: runs, meta: { total: runs.length, timestamp: new Date().toISOString() } });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  // GET /api/simulations/:simulationId
  router.get("/simulations/:simulationId", async (req: Request, res: Response) => {
    try {
      const { simulationId } = req.params;
      const run = await simRepo.findById(simulationId);
      if (!run) {
        res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: `Simulation ${simulationId} not found` } });
        return;
      }
      res.json({ success: true, data: run });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  return router;
}
