import { getPool } from "../db/pool";
import type { TelemetryPoint, TelemetrySource, DataQuality } from "@maitri-bharati/shared";

interface TelemetryRow {
  id: string;
  station_id: string;
  asset_id: string | null;
  metric: string;
  value: number;
  unit: string;
  timestamp: Date;
  source: string;
  quality: string;
}

function mapRowToTelemetry(row: TelemetryRow): TelemetryPoint {
  return {
    id: row.id,
    stationId: row.station_id,
    assetId: row.asset_id ?? undefined,
    metric: row.metric,
    value: Number(row.value),
    unit: row.unit,
    timestamp: new Date(row.timestamp),
    source: row.source as TelemetrySource,
    quality: row.quality as DataQuality,
  };
}

export interface TelemetryQueryOptions {
  stationId: string;
  assetId?: string;
  metric?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}

export class TelemetryRepository {
  async insert(point: TelemetryPoint): Promise<TelemetryPoint> {
    const pool = getPool();
    const res = await pool.query<TelemetryRow>(
      `INSERT INTO telemetry_points (id, station_id, asset_id, metric, value, unit, timestamp, source, quality)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, station_id, asset_id, metric, value, unit, timestamp, source, quality;`,
      [
        point.id,
        point.stationId,
        point.assetId ?? null,
        point.metric,
        point.value,
        point.unit,
        point.timestamp,
        point.source,
        point.quality,
      ]
    );
    return mapRowToTelemetry(res.rows[0]);
  }

  async findRecent(options: TelemetryQueryOptions): Promise<TelemetryPoint[]> {
    const pool = getPool();
    const conditions: string[] = ["station_id = $1"];
    const params: unknown[] = [options.stationId];
    let idx = 2;

    if (options.assetId) {
      conditions.push(`asset_id = $${idx++}`);
      params.push(options.assetId);
    }
    if (options.metric) {
      conditions.push(`metric = $${idx++}`);
      params.push(options.metric);
    }
    if (options.from) {
      conditions.push(`timestamp >= $${idx++}`);
      params.push(options.from);
    }
    if (options.to) {
      conditions.push(`timestamp <= $${idx++}`);
      params.push(options.to);
    }

    const limit = Math.min(options.limit ?? 100, 1000); // capped query limit per coding standards
    const query = `
      SELECT id, station_id, asset_id, metric, value, unit, timestamp, source, quality
      FROM telemetry_points
      WHERE ${conditions.join(" AND ")}
      ORDER BY timestamp DESC
      LIMIT ${limit};
    `;

    const res = await pool.query<TelemetryRow>(query, params);
    return res.rows.map(mapRowToTelemetry);
  }
}
