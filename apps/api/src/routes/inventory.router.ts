import { Router, Request, Response } from "express";
import { InventoryRepository } from "../repositories";
import type { InventoryCategory } from "@maitri-bharati/shared";

export function createInventoryRouter(): Router {
  const router = Router();
  const invRepo = new InventoryRepository();

  // GET /api/stations/:stationId/inventory
  router.get("/:stationId/inventory", async (req: Request, res: Response) => {
    try {
      const { stationId } = req.params;
      const category = req.query.category as InventoryCategory | undefined;

      const items = category
        ? await invRepo.findByCategory(stationId, category)
        : await invRepo.findByStationId(stationId);

      res.json({ success: true, data: items, meta: { total: items.length, timestamp: new Date().toISOString() } });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  return router;
}
