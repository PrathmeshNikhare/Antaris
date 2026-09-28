import { getPool } from "../db/pool";
import type { Alert, AlertSeverity, AlertCategory, AlertStatus } from "@maitri-bharati/shared";

interface AlertRow {
  id: string;
  station_id: string;
  asset_id: string | null;
  severity: string;
  category: string;
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  status: string;
  created_at: Date;
  resolved_at: Date | null;
}

function mapRowToAlert(row: AlertRow): Alert {
  return {
    id: row.id,
    stationId: row.station_id,
    assetId: row.asset_id ?? undefined,
    severity: row.severity as AlertSeverity,
    category: row.category as AlertCategory,
    title: row.title,
    description: row.description,
    evidence: typeof row.evidence === "string" ? JSON.parse(row.evidence) : row.evidence,
    status: row.status as AlertStatus,
    createdAt: new Date(row.created_at),
    resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
  };
}

export class AlertRepository {
  async findByStationId(stationId: string, status?: AlertStatus): Promise<Alert[]> {
    const pool = getPool();
    let query = `
      SELECT id, station_id, asset_id, severity, category, title, description, evidence, status, created_at, resolved_at
      FROM alerts
      WHERE station_id = $1
    `;
    const params: unknown[] = [stationId];

    if (status) {
      query += " AND status = $2";
      params.push(status);
    }

    query += " ORDER BY created_at DESC;";
    const res = await pool.query<AlertRow>(query, params);
    return res.rows.map(mapRowToAlert);
  }

  async findById(id: string): Promise<Alert | null> {
    const pool = getPool();
    const res = await pool.query<AlertRow>(
      `SELECT id, station_id, asset_id, severity, category, title, description, evidence, status, created_at, resolved_at
       FROM alerts
       WHERE id = $1;`,
      [id]
    );
    return res.rows.length > 0 ? mapRowToAlert(res.rows[0]) : null;
  }

  async updateStatus(id: string, status: AlertStatus): Promise<Alert | null> {
    const pool = getPool();
    const resolvedAtClause = status === "RESOLVED" ? "NOW()" : "NULL";
    const res = await pool.query<AlertRow>(
      `UPDATE alerts
       SET status = $1, resolved_at = ${resolvedAtClause}
       WHERE id = $2
       RETURNING id, station_id, asset_id, severity, category, title, description, evidence, status, created_at, resolved_at;`,
      [status, id]
    );
    return res.rows.length > 0 ? mapRowToAlert(res.rows[0]) : null;
  }

  async create(alert: Alert): Promise<Alert> {
    const pool = getPool();
    const res = await pool.query<AlertRow>(
      `INSERT INTO alerts (id, station_id, asset_id, severity, category, title, description, evidence, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, station_id, asset_id, severity, category, title, description, evidence, status, created_at, resolved_at;`,
      [
        alert.id,
        alert.stationId,
        alert.assetId ?? null,
        alert.severity,
        alert.category,
        alert.title,
        alert.description,
        JSON.stringify(alert.evidence),
        alert.status,
        alert.createdAt,
      ]
    );
    return mapRowToAlert(res.rows[0]);
  }
}
