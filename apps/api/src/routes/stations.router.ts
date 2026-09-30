import { Router, Request, Response } from "express";
import { StationRepository, AssetRepository, AlertRepository } from "../repositories";
import type { ApiResponse } from "@maitri-bharati/shared";

export function createStationsRouter(): Router {
  const router = Router();
  const stationRepo = new StationRepository();
  const assetRepo = new AssetRepository();
  const alertRepo = new AlertRepository();

  // GET /api/stations
  router.get("/", async (_req: Request, res: Response) => {
    try {
      const stations = await stationRepo.findAll();
      const response: ApiResponse<typeof stations> = {
        success: true,
        data: stations,
        meta: { timestamp: new Date().toISOString(), total: stations.length },
      };
      res.json(response);
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  // GET /api/stations/:stationId
  router.get("/:stationId", async (req: Request, res: Response) => {
    try {
      const { stationId } = req.params;
      const station = await stationRepo.findById(stationId);
      if (!station) {
        res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: `Station ${stationId} not found` } });
        return;
      }
      res.json({ success: true, data: station });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  // GET /api/stations/:stationId/summary
  router.get("/:stationId/summary", async (req: Request, res: Response) => {
    try {
      const { stationId } = req.params;
      const station = await stationRepo.findById(stationId);
      if (!station) {
        res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: `Station ${stationId} not found` } });
        return;
      }
      const assets = await assetRepo.findByStationId(stationId);
      const openAlerts = await alertRepo.findByStationId(stationId, "OPEN");

      const operationalAssets = assets.filter((a) => a.status === "OPERATIONAL").length;
      const degradedAssets = assets.filter((a) => a.status === "DEGRADED").length;
      const failedAssets = assets.filter((a) => a.status === "FAILED").length;

      res.json({
        success: true,
        data: {
          station,
          assetSummary: {
            total: assets.length,
            operational: operationalAssets,
            degraded: degradedAssets,
            failed: failedAssets,
          },
          activeAlertCount: openAlerts.length,
          lastSyncAt: station.lastSyncAt,
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  // GET /api/stations/:stationId/assets
  router.get("/:stationId/assets", async (req: Request, res: Response) => {
    try {
      const { stationId } = req.params;
      const assets = await assetRepo.findByStationId(stationId);
      res.json({ success: true, data: assets, meta: { total: assets.length, timestamp: new Date().toISOString() } });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  // ── Station Thresholds & Mission Configuration ─────────────────────
  router.get("/:stationId/settings/thresholds", async (req: Request, res: Response) => {
    try {
      const { stationId } = req.params;
      const pool = (await import("../db/pool")).getPool();
      const result = await pool.query(
        `SELECT id, station_id as "stationId", metric,
                warning_threshold_low as "warningThresholdLow",
                warning_threshold_high as "warningThresholdHigh",
                critical_threshold_low as "criticalThresholdLow",
                critical_threshold_high as "criticalThresholdHigh",
                updated_by as "updatedBy", updated_at as "updatedAt", comment
         FROM station_thresholds
         WHERE station_id = $1
         ORDER BY metric ASC`,
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

  router.put("/:stationId/settings/thresholds", async (req: Request, res: Response) => {
    try {
      const { stationId } = req.params;
      const {
        metric,
        warningThresholdLow,
        warningThresholdHigh,
        criticalThresholdLow,
        criticalThresholdHigh,
        comment,
      } = req.body;

      if (!metric) {
        res.status(400).json({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "metric identifier is required" },
        });
        return;
      }

      const operatorUsername = (req as any).user?.username || "admin";
      const pool = (await import("../db/pool")).getPool();

      // Retrieve previous threshold for audit trail
      const prevRes = await pool.query(
        `SELECT * FROM station_thresholds WHERE station_id = $1 AND metric = $2`,
        [stationId, metric]
      );
      const prevRow = prevRes.rows[0] || null;

      const threshId = prevRow?.id || `thresh-${stationId}-${metric.replace(/_/g, "-")}`;

      const upsertRes = await pool.query(
        `INSERT INTO station_thresholds (
          id, station_id, metric, warning_threshold_low, warning_threshold_high,
          critical_threshold_low, critical_threshold_high, updated_by, updated_at, comment
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)
        ON CONFLICT (station_id, metric) DO UPDATE SET
          warning_threshold_low = EXCLUDED.warning_threshold_low,
          warning_threshold_high = EXCLUDED.warning_threshold_high,
          critical_threshold_low = EXCLUDED.critical_threshold_low,
          critical_threshold_high = EXCLUDED.critical_threshold_high,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW(),
          comment = EXCLUDED.comment
        RETURNING id, station_id as "stationId", metric,
                  warning_threshold_low as "warningThresholdLow",
                  warning_threshold_high as "warningThresholdHigh",
                  critical_threshold_low as "criticalThresholdLow",
                  critical_threshold_high as "criticalThresholdHigh",
                  updated_by as "updatedBy", updated_at as "updatedAt", comment`,
        [
          threshId,
          stationId,
          metric,
          warningThresholdLow ?? null,
          warningThresholdHigh ?? null,
          criticalThresholdLow ?? null,
          criticalThresholdHigh ?? null,
          operatorUsername,
          comment || "Updated via Mission Settings Console",
        ]
      );

      // Audit log entry
      const auditRepo = new (await import("../repositories/audit.repository")).AuditRepository();
      await auditRepo.create({
        id: `audit-thresh-${Date.now()}`,
        operatorId: (req as any).user?.id || "op-admin",
        action: "UPDATE_STATION_THRESHOLD",
        targetType: "CONFIGURATION",
        targetId: `${stationId}:${metric}`,
        details: {
          stationId,
          metric,
          previous: prevRow
            ? {
                warnLow: prevRow.warning_threshold_low,
                warnHigh: prevRow.warning_threshold_high,
                critLow: prevRow.critical_threshold_low,
                critHigh: prevRow.critical_threshold_high,
              }
            : null,
          updated: {
            warnLow: warningThresholdLow,
            warnHigh: warningThresholdHigh,
            critLow: criticalThresholdLow,
            critHigh: criticalThresholdHigh,
          },
          comment,
        },
        result: "SUCCESS",
        timestamp: new Date(),
      });

      res.json({ success: true, data: upsertRes.rows[0] });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  // ── Mission Events Log ─────────────────────────────────────────────
  router.get("/:stationId/events", async (req: Request, res: Response) => {
    try {
      const { stationId } = req.params;
      const category = req.query.category as string | undefined;
      const severity = req.query.severity as string | undefined;
      const search = req.query.search as string | undefined;
      const limit = parseInt(String(req.query.limit ?? "50"), 10);

      const pool = (await import("../db/pool")).getPool();
      let query = `
        SELECT id, station_id as "stationId", category, severity, title, description,
               asset_id as "assetId", alert_id as "alertId", source, provenance_type as "provenanceType",
               zone, metadata, created_at as "createdAt"
        FROM mission_events
        WHERE station_id = $1
      `;
      const params: any[] = [stationId];

      if (category) {
        params.push(category);
        query += ` AND category = $${params.length}`;
      }
      if (severity) {
        params.push(severity);
        query += ` AND severity = $${params.length}`;
      }
      if (search) {
        params.push(`%${search}%`);
        query += ` AND (title ILIKE $${params.length} OR description ILIKE $${params.length} OR zone ILIKE $${params.length})`;
      }

      params.push(limit);
      query += ` ORDER BY created_at DESC LIMIT $${params.length}`;

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

  return router;
}
