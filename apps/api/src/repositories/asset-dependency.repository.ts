import { getPool } from "../db/pool";
import type { AssetDependency, DependencyType, Criticality } from "@maitri-bharati/shared";

interface AssetDependencyRow {
  id: string;
  from_asset_id: string;
  to_asset_id: string;
  dependency_type: string;
  criticality: string;
  description: string | null;
  created_at: Date;
}

function mapRowToDependency(row: AssetDependencyRow): AssetDependency {
  return {
    id: row.id,
    fromAssetId: row.from_asset_id,
    toAssetId: row.to_asset_id,
    dependencyType: row.dependency_type as DependencyType,
    criticality: row.criticality as Criticality,
    description: row.description ?? undefined,
    createdAt: new Date(row.created_at),
  };
}

export class AssetDependencyRepository {
  async findAll(): Promise<AssetDependency[]> {
    const pool = getPool();
    const res = await pool.query<AssetDependencyRow>(
      `SELECT id, from_asset_id, to_asset_id, dependency_type, criticality, description, created_at
       FROM asset_dependencies
       ORDER BY created_at ASC;`
    );
    return res.rows.map(mapRowToDependency);
  }

  async findByStationId(stationId: string): Promise<AssetDependency[]> {
    const pool = getPool();
    const res = await pool.query<AssetDependencyRow>(
      `SELECT ad.id, ad.from_asset_id, ad.to_asset_id, ad.dependency_type, ad.criticality, ad.description, ad.created_at
       FROM asset_dependencies ad
       JOIN assets a ON ad.from_asset_id = a.id
       WHERE a.station_id = $1
       ORDER BY ad.created_at ASC;`,
      [stationId]
    );
    return res.rows.map(mapRowToDependency);
  }

  async findByAssetId(assetId: string): Promise<AssetDependency[]> {
    const pool = getPool();
    const res = await pool.query<AssetDependencyRow>(
      `SELECT id, from_asset_id, to_asset_id, dependency_type, criticality, description, created_at
       FROM asset_dependencies
       WHERE from_asset_id = $1 OR to_asset_id = $1
       ORDER BY created_at ASC;`,
      [assetId]
    );
    return res.rows.map(mapRowToDependency);
  }

  /**
   * Traverses recursive downstream dependencies from a root asset
   * e.g. GEN-01 failure -> Energy Bus -> HVAC / Water / Comms -> Logistics
   */
  async findDownstream(rootAssetId: string): Promise<string[]> {
    const pool = getPool();
    const query = `
      WITH RECURSIVE downstream AS (
        SELECT to_asset_id
        FROM asset_dependencies
        WHERE from_asset_id = $1
        UNION
        SELECT ad.to_asset_id
        FROM asset_dependencies ad
        JOIN downstream d ON ad.from_asset_id = d.to_asset_id
      )
      SELECT DISTINCT to_asset_id FROM downstream;
    `;
    const res = await pool.query<{ to_asset_id: string }>(query, [rootAssetId]);
    return res.rows.map((r) => r.to_asset_id);
  }

  async insert(dep: AssetDependency): Promise<AssetDependency> {
    const pool = getPool();
    const res = await pool.query<AssetDependencyRow>(
      `INSERT INTO asset_dependencies (id, from_asset_id, to_asset_id, dependency_type, criticality, description, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (from_asset_id, to_asset_id, dependency_type) DO UPDATE
       SET criticality = EXCLUDED.criticality, description = EXCLUDED.description
       RETURNING id, from_asset_id, to_asset_id, dependency_type, criticality, description, created_at;`,
      [
        dep.id,
        dep.fromAssetId,
        dep.toAssetId,
        dep.dependencyType,
        dep.criticality,
        dep.description ?? null,
        dep.createdAt,
      ]
    );
    return mapRowToDependency(res.rows[0]);
  }
}
