import { getPool } from "../db/pool";
import type { Asset, AssetType, AssetStatus, Criticality } from "@maitri-bharati/shared";

interface AssetRow {
  id: string;
  station_id: string;
  parent_asset_id: string | null;
  code: string;
  name: string;
  type: string;
  status: string;
  criticality: string;
  health_score: string | number | null;
}

function mapRowToAsset(row: AssetRow): Asset {
  return {
    id: row.id,
    stationId: row.station_id,
    parentAssetId: row.parent_asset_id ?? undefined,
    code: row.code,
    name: row.name,
    type: row.type as AssetType,
    status: row.status as AssetStatus,
    criticality: row.criticality as Criticality,
    healthScore: row.health_score !== null ? Number(row.health_score) : undefined,
  };
}

export class AssetRepository {
  async findByStationId(stationId: string): Promise<Asset[]> {
    const pool = getPool();
    const res = await pool.query<AssetRow>(
      `SELECT id, station_id, parent_asset_id, code, name, type, status, criticality, health_score
       FROM assets
       WHERE station_id = $1
       ORDER BY name ASC;`,
      [stationId]
    );
    return res.rows.map(mapRowToAsset);
  }

  async findById(id: string): Promise<Asset | null> {
    const pool = getPool();
    const res = await pool.query<AssetRow>(
      `SELECT id, station_id, parent_asset_id, code, name, type, status, criticality, health_score
       FROM assets
       WHERE id = $1;`,
      [id]
    );
    return res.rows.length > 0 ? mapRowToAsset(res.rows[0]) : null;
  }

  async findByType(stationId: string, type: AssetType): Promise<Asset[]> {
    const pool = getPool();
    const res = await pool.query<AssetRow>(
      `SELECT id, station_id, parent_asset_id, code, name, type, status, criticality, health_score
       FROM assets
       WHERE station_id = $1 AND type = $2
       ORDER BY name ASC;`,
      [stationId, type]
    );
    return res.rows.map(mapRowToAsset);
  }

  async updateStatus(id: string, status: AssetStatus, healthScore?: number): Promise<Asset | null> {
    const pool = getPool();
    const res = await pool.query<AssetRow>(
      `UPDATE assets
       SET status = $1,
           health_score = COALESCE($2, health_score),
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, station_id, parent_asset_id, code, name, type, status, criticality, health_score;`,
      [status, healthScore ?? null, id]
    );
    return res.rows.length > 0 ? mapRowToAsset(res.rows[0]) : null;
  }
}
