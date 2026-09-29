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
  rule_id: string | null;
  confidence: number | null;
  detected_at: Date | null;
  recommended_action: string | null;
  evidence_window: Record<string, unknown> | null;
  impact_summary: string | null;
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
    ruleId: row.rule_id ?? undefined,
    confidence: row.confidence ? Number(row.confidence) : undefined,
    detectedAt: row.detected_at ? new Date(row.detected_at) : undefined,
    recommendedAction: row.recommended_action ?? undefined,
    evidenceWindow:
      row.evidence_window && typeof row.evidence_window === "string"
        ? JSON.parse(row.evidence_window)
        : (row.evidence_window ?? undefined),
    impactSummary: row.impact_summary ?? undefined,
    createdAt: new Date(row.created_at),
    resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
  };
}

export class AlertRepository {
  async findByStationId(stationId: string, status?: AlertStatus): Promise<Alert[]> {
    const pool = getPool();
    let query = `
      SELECT id, station_id, asset_id, severity, category, title, description, evidence, status,
             rule_id, confidence, detected_at, recommended_action, evidence_window, impact_summary,
             created_at, resolved_at
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
      `SELECT id, station_id, asset_id, severity, category, title, description, evidence, status,
              rule_id, confidence, detected_at, recommended_action, evidence_window, impact_summary,
              created_at, resolved_at
       FROM alerts
       WHERE id = $1;`,
      [id]
    );
    if (res.rows.length === 0) return null;
    return mapRowToAlert(res.rows[0]);
  }

  async insert(alert: Alert): Promise<Alert> {
    const pool = getPool();
    const res = await pool.query<AlertRow>(
      `INSERT INTO alerts (id, station_id, asset_id, severity, category, title, description, evidence, status,
                           rule_id, confidence, detected_at, recommended_action, evidence_window, impact_summary,
                           created_at, resolved_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       RETURNING id, station_id, asset_id, severity, category, title, description, evidence, status,
                 rule_id, confidence, detected_at, recommended_action, evidence_window, impact_summary,
                 created_at, resolved_at;`,
      [
        alert.id,
        alert.stationId,
        alert.assetId ?? null,
        alert.severity,
        alert.category,
        alert.title,
        alert.description,
        JSON.stringify(alert.evidence ?? {}),
        alert.status,
        alert.ruleId ?? null,
        alert.confidence ?? 1.0,
        alert.detectedAt ?? new Date(),
        alert.recommendedAction ?? null,
        JSON.stringify(alert.evidenceWindow ?? {}),
        alert.impactSummary ?? null,
        alert.createdAt,
        alert.resolvedAt ?? null,
      ]
    );
    return mapRowToAlert(res.rows[0]);
  }

  async updateStatus(id: string, status: AlertStatus): Promise<Alert | null> {
    const pool = getPool();
    const resolvedAt = status === "RESOLVED" ? new Date() : null;
    const res = await pool.query<AlertRow>(
      `UPDATE alerts
       SET status = $1, resolved_at = COALESCE($2, resolved_at)
       WHERE id = $3
       RETURNING id, station_id, asset_id, severity, category, title, description, evidence, status,
                 rule_id, confidence, detected_at, recommended_action, evidence_window, impact_summary,
                 created_at, resolved_at;`,
      [status, resolvedAt, id]
    );
    if (res.rows.length === 0) return null;
    return mapRowToAlert(res.rows[0]);
  }
}
