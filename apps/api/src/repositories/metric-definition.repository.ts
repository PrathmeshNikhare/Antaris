import { getPool } from "../db/pool";
import type { MetricDefinition, AggregationStrategy, AssetType } from "@maitri-bharati/shared";

interface MetricDefinitionRow {
  id: string;
  metric: string;
  canonical_unit: string;
  min_plausible: number;
  max_plausible: number;
  warning_threshold_low: number | null;
  warning_threshold_high: number | null;
  critical_threshold_low: number | null;
  critical_threshold_high: number | null;
  expected_sampling_interval_seconds: number;
  aggregation_strategy: string;
  allowed_asset_types: unknown;
  created_at: Date;
}

function mapRowToDefinition(row: MetricDefinitionRow): MetricDefinition {
  const allowed = Array.isArray(row.allowed_asset_types)
    ? (row.allowed_asset_types as AssetType[])
    : typeof row.allowed_asset_types === "string"
      ? (JSON.parse(row.allowed_asset_types) as AssetType[])
      : [];

  return {
    id: row.id,
    metric: row.metric,
    canonicalUnit: row.canonical_unit,
    minPlausible: Number(row.min_plausible),
    maxPlausible: Number(row.max_plausible),
    warningThresholdLow: row.warning_threshold_low !== null ? Number(row.warning_threshold_low) : undefined,
    warningThresholdHigh: row.warning_threshold_high !== null ? Number(row.warning_threshold_high) : undefined,
    criticalThresholdLow: row.critical_threshold_low !== null ? Number(row.critical_threshold_low) : undefined,
    criticalThresholdHigh: row.critical_threshold_high !== null ? Number(row.critical_threshold_high) : undefined,
    expectedSamplingIntervalSeconds: Number(row.expected_sampling_interval_seconds),
    aggregationStrategy: row.aggregation_strategy as AggregationStrategy,
    allowedAssetTypes: allowed,
    createdAt: new Date(row.created_at),
  };
}

export class MetricDefinitionRepository {
  async findAll(): Promise<MetricDefinition[]> {
    const pool = getPool();
    const res = await pool.query<MetricDefinitionRow>(
      `SELECT id, metric, canonical_unit, min_plausible, max_plausible,
              warning_threshold_low, warning_threshold_high, critical_threshold_low, critical_threshold_high,
              expected_sampling_interval_seconds, aggregation_strategy, allowed_asset_types, created_at
       FROM metric_definitions
       ORDER BY metric ASC;`
    );
    return res.rows.map(mapRowToDefinition);
  }

  async findByMetric(metric: string): Promise<MetricDefinition | null> {
    const pool = getPool();
    const res = await pool.query<MetricDefinitionRow>(
      `SELECT id, metric, canonical_unit, min_plausible, max_plausible,
              warning_threshold_low, warning_threshold_high, critical_threshold_low, critical_threshold_high,
              expected_sampling_interval_seconds, aggregation_strategy, allowed_asset_types, created_at
       FROM metric_definitions
       WHERE metric = $1;`,
      [metric]
    );
    if (res.rows.length === 0) return null;
    return mapRowToDefinition(res.rows[0]);
  }

  async insert(def: MetricDefinition): Promise<MetricDefinition> {
    const pool = getPool();
    const res = await pool.query<MetricDefinitionRow>(
      `INSERT INTO metric_definitions (id, metric, canonical_unit, min_plausible, max_plausible,
                                       warning_threshold_low, warning_threshold_high, critical_threshold_low, critical_threshold_high,
                                       expected_sampling_interval_seconds, aggregation_strategy, allowed_asset_types, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (metric) DO UPDATE
       SET canonical_unit = EXCLUDED.canonical_unit,
           min_plausible = EXCLUDED.min_plausible,
           max_plausible = EXCLUDED.max_plausible,
           warning_threshold_low = EXCLUDED.warning_threshold_low,
           warning_threshold_high = EXCLUDED.warning_threshold_high,
           critical_threshold_low = EXCLUDED.critical_threshold_low,
           critical_threshold_high = EXCLUDED.critical_threshold_high,
           expected_sampling_interval_seconds = EXCLUDED.expected_sampling_interval_seconds,
           aggregation_strategy = EXCLUDED.aggregation_strategy,
           allowed_asset_types = EXCLUDED.allowed_asset_types
       RETURNING id, metric, canonical_unit, min_plausible, max_plausible,
                 warning_threshold_low, warning_threshold_high, critical_threshold_low, critical_threshold_high,
                 expected_sampling_interval_seconds, aggregation_strategy, allowed_asset_types, created_at;`,
      [
        def.id,
        def.metric,
        def.canonicalUnit,
        def.minPlausible,
        def.maxPlausible,
        def.warningThresholdLow ?? null,
        def.warningThresholdHigh ?? null,
        def.criticalThresholdLow ?? null,
        def.criticalThresholdHigh ?? null,
        def.expectedSamplingIntervalSeconds,
        def.aggregationStrategy,
        JSON.stringify(def.allowedAssetTypes),
        def.createdAt,
      ]
    );
    return mapRowToDefinition(res.rows[0]);
  }
}
