import { getPool } from "../db/pool";
import type { Forecast } from "@maitri-bharati/shared";

interface ForecastRow {
  id: string;
  station_id: string;
  target: string;
  horizon_hours: number;
  predicted_value: number;
  lower_bound: number | null;
  upper_bound: number | null;
  model_version: string;
  generated_at: Date;
}

function mapRowToForecast(row: ForecastRow): Forecast {
  return {
    id: row.id,
    stationId: row.station_id,
    target: row.target,
    horizonHours: row.horizon_hours,
    predictedValue: Number(row.predicted_value),
    lowerBound: row.lower_bound !== null ? Number(row.lower_bound) : undefined,
    upperBound: row.upper_bound !== null ? Number(row.upper_bound) : undefined,
    modelVersion: row.model_version,
    generatedAt: new Date(row.generated_at),
  };
}

export class ForecastRepository {
  async findByStationId(stationId: string, target?: string): Promise<Forecast[]> {
    const pool = getPool();
    let query = `
      SELECT id, station_id, target, horizon_hours, predicted_value, lower_bound, upper_bound, model_version, generated_at
      FROM forecasts
      WHERE station_id = $1
    `;
    const params: unknown[] = [stationId];

    if (target) {
      query += " AND target = $2";
      params.push(target);
    }

    query += " ORDER BY generated_at DESC LIMIT 50;";
    const res = await pool.query<ForecastRow>(query, params);
    return res.rows.map(mapRowToForecast);
  }

  async insert(forecast: Forecast): Promise<Forecast> {
    const pool = getPool();
    const res = await pool.query<ForecastRow>(
      `INSERT INTO forecasts (id, station_id, target, horizon_hours, predicted_value, lower_bound, upper_bound, model_version, generated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, station_id, target, horizon_hours, predicted_value, lower_bound, upper_bound, model_version, generated_at;`,
      [
        forecast.id,
        forecast.stationId,
        forecast.target,
        forecast.horizonHours,
        forecast.predictedValue,
        forecast.lowerBound ?? null,
        forecast.upperBound ?? null,
        forecast.modelVersion,
        forecast.generatedAt,
      ]
    );
    return mapRowToForecast(res.rows[0]);
  }
}
