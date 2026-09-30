import { Router, Request, Response } from "express";
import { getPool } from "../db/pool";
import { InventoryRepository, AuditRepository } from "../repositories";
import { optimizeCargoAllocation } from "../logistics/cargo-optimizer";
import { planMissionWindows } from "../logistics/mission-window-planner";
import { getTwinRegistry } from "../twin/registry";
import type { InventoryCategory } from "@maitri-bharati/shared";

export function createInventoryRouter(): Router {
  const router = Router();
  const invRepo = new InventoryRepository();
  const auditRepo = new AuditRepository();

  // ── 1. GET /api/stations/:stationId/inventory ───────────────────────
  router.get("/:stationId/inventory", async (req: Request, res: Response) => {
    try {
      const { stationId } = req.params;
      const category = req.query.category as InventoryCategory | undefined;

      const items = category
        ? await invRepo.findByCategory(stationId, category)
        : await invRepo.findByStationId(stationId);

      const computedItems = items.map((item) => {
        const burnRate = Math.max(item.averageDailyConsumption, 0.05);
        const daysRemaining = Number((item.quantity / burnRate).toFixed(1));
        let stockStatus = "NOMINAL";
        if (item.quantity <= item.minimumThreshold) {
          stockStatus = "CRITICAL";
        } else if (item.quantity <= item.minimumThreshold * 1.5) {
          stockStatus = "LOW";
        }

        return {
          ...item,
          daysRemaining,
          stockStatus,
          reorderPoint: item.minimumThreshold * 1.5,
          provenance: "DATABASE_MEASURED",
        };
      });

      res.json({
        success: true,
        data: computedItems,
        meta: { total: computedItems.length, timestamp: new Date().toISOString() },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  // ── 2. GET /api/stations/:stationId/inventory/transactions ──────────
  router.get("/:stationId/inventory/transactions", async (req: Request, res: Response) => {
    try {
      const { stationId } = req.params;
      const limit = parseInt(String(req.query.limit ?? "50"), 10);
      const pool = getPool();

      const result = await pool.query(
        `SELECT id, station_id as "stationId", item_id as "itemId",
                transaction_type as "transactionType", quantity,
                balance_after as "balanceAfter", reference_id as "referenceId",
                operator_id as "operatorId", created_at as "createdAt", notes
         FROM inventory_transactions
         WHERE station_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [stationId, limit]
      );

      res.json({
        success: true,
        data: result.rows,
        meta: { total: result.rows.length, timestamp: new Date().toISOString() },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  // ── 3. GET /api/stations/:stationId/cargo/missions ──────────────────
  router.get("/:stationId/cargo/missions", async (req: Request, res: Response) => {
    try {
      const { stationId } = req.params;
      const pool = getPool();

      const result = await pool.query(
        `SELECT id, station_id as "stationId", mission_code as "missionCode",
                vessel_or_flight as "vesselOrFlight", transport_mode as "transportMode",
                origin, departure_date as "departureDate", eta, eta_confidence as "etaConfidence",
                status, capacity_kg as "capacityKg", weather_risk_index as "weatherRiskIndex",
                lead_time_days as "leadTimeDays", created_at as "createdAt", updated_at as "updatedAt"
         FROM cargo_missions
         WHERE station_id = $1
         ORDER BY eta ASC`,
        [stationId]
      );

      res.json({
        success: true,
        data: result.rows,
        meta: { total: result.rows.length, timestamp: new Date().toISOString() },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  // ── 4. GET /api/stations/:stationId/cargo/requisitions ───────────────
  router.get("/:stationId/cargo/requisitions", async (req: Request, res: Response) => {
    try {
      const { stationId } = req.params;
      const status = req.query.status as string | undefined;
      const pool = getPool();

      let query = `
        SELECT id, station_id as "stationId", item_id as "itemId",
               item_name as "itemName", category, requested_quantity as "requestedQuantity",
               unit, priority, status, reason, requested_by as "requestedBy",
               approved_by as "approvedBy", mission_id as "missionId",
               created_at as "createdAt", updated_at as "updatedAt"
        FROM cargo_requisitions
        WHERE station_id = $1
      `;
      const params: any[] = [stationId];

      if (status) {
        params.push(status);
        query += ` AND status = $${params.length}`;
      }

      query += ` ORDER BY created_at DESC`;

      const result = await pool.query(query, params);

      res.json({
        success: true,
        data: result.rows,
        meta: { total: result.rows.length, timestamp: new Date().toISOString() },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  // ── 5. POST /api/stations/:stationId/cargo/requisitions ──────────────
  router.post("/:stationId/cargo/requisitions", async (req: Request, res: Response) => {
    try {
      const { stationId } = req.params;
      const { itemId, itemName, category, requestedQuantity, unit, priority = "MEDIUM", reason } = req.body;

      if (!itemId || !requestedQuantity) {
        res.status(400).json({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "itemId and requestedQuantity are required" },
        });
        return;
      }

      const operatorUsername = (req as any).user?.username || "officer.maitri";
      const reqId = `req-${stationId}-${Date.now().toString(36)}`;
      const pool = getPool();

      const insertRes = await pool.query(
        `INSERT INTO cargo_requisitions (
          id, station_id, item_id, item_name, category, requested_quantity,
          unit, priority, status, reason, requested_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'REQUESTED', $9, $10, NOW(), NOW())
        RETURNING id, station_id as "stationId", item_id as "itemId",
                  item_name as "itemName", category, requested_quantity as "requestedQuantity",
                  unit, priority, status, reason, requested_by as "requestedBy",
                  created_at as "createdAt", updated_at as "updatedAt"`,
        [
          reqId,
          stationId,
          itemId,
          itemName || itemId,
          category || "GENERAL",
          requestedQuantity,
          unit || "Units",
          priority,
          reason || "Routine station consumption resupply",
          operatorUsername,
        ]
      );

      // Audit requisition creation
      await auditRepo.create({
        id: `audit-req-${Date.now()}`,
        operatorId: (req as any).user?.id || "op-field",
        action: "CREATE_CARGO_REQUISITION",
        targetType: "LOGISTICS",
        targetId: reqId,
        newState: insertRes.rows[0],
        result: "SUCCESS",
        timestamp: new Date(),
      });

      res.status(201).json({ success: true, data: insertRes.rows[0] });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  // ── 6. PUT /api/stations/:stationId/cargo/requisitions/:id/status ───
  router.put("/:stationId/cargo/requisitions/:id/status", async (req: Request, res: Response) => {
    const client = await getPool().connect();
    try {
      const { stationId, id: reqId } = req.params;
      const { status, missionId } = req.body;

      if (!status) {
        res.status(400).json({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "status is required" },
        });
        return;
      }

      await client.query("BEGIN");

      // 1. Fetch current requisition
      const reqRes = await client.query(
        `SELECT * FROM cargo_requisitions WHERE id = $1 AND station_id = $2 FOR UPDATE`,
        [reqId, stationId]
      );
      if (reqRes.rows.length === 0) {
        await client.query("ROLLBACK");
        res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: `Requisition ${reqId} not found` } });
        return;
      }
      const existingReq = reqRes.rows[0];
      const prevStatus = existingReq.status;
      const operatorUsername = (req as any).user?.username || "admin";

      let approvedBy = existingReq.approved_by;
      if (status === "AUTHORITY_APPROVED" && !approvedBy) {
        approvedBy = operatorUsername;
      }

      // 2. Update status on requisition
      const updateRes = await client.query(
        `UPDATE cargo_requisitions
         SET status = $1, approved_by = $2, mission_id = COALESCE($3, mission_id), updated_at = NOW()
         WHERE id = $4
         RETURNING id, station_id as "stationId", item_id as "itemId",
                   item_name as "itemName", category, requested_quantity as "requestedQuantity",
                   unit, priority, status, reason, requested_by as "requestedBy",
                   approved_by as "approvedBy", mission_id as "missionId",
                   created_at as "createdAt", updated_at as "updatedAt"`,
        [status, approvedBy, missionId || null, reqId]
      );

      // 3. If transitioning to DELIVERED: execute atomic delivery transaction & update inventory!
      if (status === "DELIVERED" && prevStatus !== "DELIVERED") {
        const qtyToAdd = Number(existingReq.requested_quantity);
        const itemId = existingReq.item_id;

        // Atomically update inventory quantity
        const invUpdateRes = await client.query(
          `UPDATE inventory_items
           SET quantity = quantity + $1, updated_at = NOW()
           WHERE id = $2 AND station_id = $3
           RETURNING quantity`,
          [qtyToAdd, itemId, stationId]
        );

        const newBalance = invUpdateRes.rows[0]?.quantity ?? qtyToAdd;

        // Insert inventory transaction
        await client.query(
          `INSERT INTO inventory_transactions (
            id, station_id, item_id, transaction_type, quantity, balance_after, reference_id, operator_id, created_at, notes
          ) VALUES ($1, $2, $3, 'DELIVERY_INTAKE', $4, $5, $6, $7, NOW(), $8)`,
          [
            `tx-${Date.now().toString(36)}`,
            stationId,
            itemId,
            qtyToAdd,
            newBalance,
            reqId,
            operatorUsername,
            `Cargo mission resupply delivery intake: ${existingReq.item_name} (+${qtyToAdd} ${existingReq.unit})`,
          ]
        );

        // Invalidate and refresh Digital Twin state registry
        try {
          const registry = getTwinRegistry();
          const twin = registry.getTwinState(stationId);
          if (twin && twin.logistics) {
            twin.logistics.daysOfFuelRemaining = Math.min(180, twin.logistics.daysOfFuelRemaining + 20);
          }
        } catch {
          /* non-blocking twin refresh */
        }
      }

      await client.query("COMMIT");

      // 4. Audit event
      await auditRepo.create({
        id: `audit-req-status-${Date.now()}`,
        operatorId: (req as any).user?.id || "op-admin",
        action: "UPDATE_REQUISITION_STATUS",
        targetType: "LOGISTICS",
        targetId: reqId,
        previousState: { status: prevStatus },
        newState: { status, approvedBy },
        result: "SUCCESS",
        timestamp: new Date(),
      });

      res.json({ success: true, data: updateRes.rows[0] });
    } catch (err) {
      await client.query("ROLLBACK");
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    } finally {
      client.release();
    }
  });

  // ── 7. GET /api/stations/:stationId/cargo/optimize ──────────────────
  router.get("/:stationId/cargo/optimize", async (req: Request, res: Response) => {
    try {
      const { stationId } = req.params;
      const items = await invRepo.findByStationId(stationId);
      const pool = getPool();

      // Get next incoming mission
      const missionRes = await pool.query(
        `SELECT id, station_id as "stationId", mission_code as "missionCode",
                vessel_or_flight as "vesselOrFlight", transport_mode as "transportMode",
                origin, departure_date as "departureDate", eta, eta_confidence as "etaConfidence",
                status, capacity_kg as "capacityKg", weather_risk_index as "weatherRiskIndex",
                lead_time_days as "leadTimeDays"
         FROM cargo_missions
         WHERE station_id = $1 AND status != 'COMPLETED'
         ORDER BY eta ASC
         LIMIT 1`,
        [stationId]
      );

      const mission = missionRes.rows[0] || {
        id: `mission-mock-${stationId}`,
        stationId,
        missionCode: "EXP-SORTIE-OPTIMAL",
        vesselOrFlight: "MV Vasiliy Golovnin",
        transportMode: "VESSEL_SEA_EDGE",
        origin: "Cape Town Polar Port",
        capacityKg: 30000,
        weatherRiskIndex: 0.32,
      };

      const result = optimizeCargoAllocation(stationId, items, mission, mission.weatherRiskIndex);
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  // ── 8. GET /api/stations/:stationId/cargo/mission-windows ────────────
  router.get("/:stationId/cargo/mission-windows", (req: Request, res: Response) => {
    try {
      const { stationId } = req.params;
      const registry = getTwinRegistry();
      const twin = registry.getTwinState(stationId);

      const temp = twin?.environment?.ambientTempC ?? -18.5;
      const wind = twin?.environment?.windSpeedMs ?? 14.2;
      const conn = twin?.connectivityState ?? "NORMAL";

      const plan = planMissionWindows(stationId, temp, wind, conn);
      res.json({ success: true, data: plan });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  return router;
}
