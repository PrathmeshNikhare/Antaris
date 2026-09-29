import { getPool } from "../db/pool";
import type { AuditEvent } from "@maitri-bharati/shared";

interface AuditRow {
  id: string;
  operator_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  previous_state: unknown;
  new_state: unknown;
  result: string;
  correlation_id: string | null;
  created_at: Date;
}

function mapRowToAudit(row: AuditRow): AuditEvent {
  return {
    id: row.id,
    operatorId: row.operator_id ?? undefined,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id ?? undefined,
    previousState:
      typeof row.previous_state === "string"
        ? JSON.parse(row.previous_state)
        : ((row.previous_state as Record<string, unknown>) ?? undefined),
    newState:
      typeof row.new_state === "string"
        ? JSON.parse(row.new_state)
        : ((row.new_state as Record<string, unknown>) ?? undefined),
    result: row.result,
    correlationId: row.correlation_id ?? undefined,
    createdAt: new Date(row.created_at),
  };
}

export class AuditRepository {
  async findRecent(limit = 100): Promise<AuditEvent[]> {
    const pool = getPool();
    const res = await pool.query<AuditRow>(
      `SELECT id, operator_id, action, target_type, target_id, previous_state, new_state, result, correlation_id, created_at
       FROM audit_events
       ORDER BY created_at DESC
       LIMIT $1;`,
      [Math.min(limit, 1000)]
    );
    return res.rows.map(mapRowToAudit);
  }

  async findAll(limit = 100): Promise<AuditEvent[]> {
    return this.findRecent(limit);
  }

  async insert(event: AuditEvent): Promise<AuditEvent> {
    const pool = getPool();
    const res = await pool.query<AuditRow>(
      `INSERT INTO audit_events (id, operator_id, action, target_type, target_id, previous_state, new_state, result, correlation_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, operator_id, action, target_type, target_id, previous_state, new_state, result, correlation_id, created_at;`,
      [
        event.id,
        event.operatorId ?? null,
        event.action,
        event.targetType,
        event.targetId ?? null,
        JSON.stringify(event.previousState ?? {}),
        JSON.stringify(event.newState ?? {}),
        event.result,
        event.correlationId ?? null,
        event.createdAt,
      ]
    );
    return mapRowToAudit(res.rows[0]);
  }
}
