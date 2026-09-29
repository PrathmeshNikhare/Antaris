import { getPool } from "../db/pool";
import type { MaintenanceEvent, MaintenanceType, MaintenanceResult } from "@maitri-bharati/shared";

interface MaintenanceRow {
  id: string;
  station_id: string;
  asset_id: string;
  maintenance_type: string;
  scheduled_at: Date;
  completed_at: Date | null;
  notes: string | null;
  parts_used: unknown;
  result: string;
  created_at: Date;
}

function mapRowToMaintenance(row: MaintenanceRow): MaintenanceEvent {
  const parts = Array.isArray(row.parts_used)
    ? (row.parts_used as string[])
    : typeof row.parts_used === "string"
      ? (JSON.parse(row.parts_used) as string[])
      : [];

  return {
    id: row.id,
    stationId: row.station_id,
    assetId: row.asset_id,
    maintenanceType: row.maintenance_type as MaintenanceType,
    scheduledAt: new Date(row.scheduled_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    notes: row.notes ?? undefined,
    partsUsed: parts,
    result: row.result as MaintenanceResult,
    createdAt: new Date(row.created_at),
  };
}

export class MaintenanceRepository {
  async findByStationId(stationId: string): Promise<MaintenanceEvent[]> {
    const pool = getPool();
    const res = await pool.query<MaintenanceRow>(
      `SELECT id, station_id, asset_id, maintenance_type, scheduled_at, completed_at, notes, parts_used, result, created_at
       FROM maintenance_events
       WHERE station_id = $1
       ORDER BY scheduled_at DESC;`,
      [stationId]
    );
    return res.rows.map(mapRowToMaintenance);
  }

  async findByAssetId(assetId: string): Promise<MaintenanceEvent[]> {
    const pool = getPool();
    const res = await pool.query<MaintenanceRow>(
      `SELECT id, station_id, asset_id, maintenance_type, scheduled_at, completed_at, notes, parts_used, result, created_at
       FROM maintenance_events
       WHERE asset_id = $1
       ORDER BY scheduled_at DESC;`,
      [assetId]
    );
    return res.rows.map(mapRowToMaintenance);
  }

  async insert(event: MaintenanceEvent): Promise<MaintenanceEvent> {
    const pool = getPool();
    const res = await pool.query<MaintenanceRow>(
      `INSERT INTO maintenance_events (id, station_id, asset_id, maintenance_type, scheduled_at, completed_at, notes, parts_used, result, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, station_id, asset_id, maintenance_type, scheduled_at, completed_at, notes, parts_used, result, created_at;`,
      [
        event.id,
        event.stationId,
        event.assetId,
        event.maintenanceType,
        event.scheduledAt,
        event.completedAt ?? null,
        event.notes ?? null,
        JSON.stringify(event.partsUsed ?? []),
        event.result,
        event.createdAt,
      ]
    );
    return mapRowToMaintenance(res.rows[0]);
  }
}
