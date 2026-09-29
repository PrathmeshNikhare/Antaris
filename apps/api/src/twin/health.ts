import type { AssetStatus, MetricDefinition, TwinTelemetryProperty } from "@maitri-bharati/shared";

export interface HealthEvaluationResult {
  healthScore: number;
  status: AssetStatus;
  primaryConcern?: string;
  contributingMetrics: string[];
}

export const DEFAULT_METRIC_THRESHOLDS: Record<string, Partial<MetricDefinition>> = {
  temperature: {
    metric: "temperature",
    warningThresholdHigh: 85.0,
    criticalThresholdHigh: 95.0,
  },
  thermal_load_kw: {
    metric: "thermal_load_kw",
    warningThresholdHigh: 65.0,
    criticalThresholdHigh: 80.0,
  },
  packet_loss_pct: {
    metric: "packet_loss_pct",
    warningThresholdHigh: 20.0,
    criticalThresholdHigh: 50.0,
  },
  latency_ms: {
    metric: "latency_ms",
    warningThresholdHigh: 1200.0,
    criticalThresholdHigh: 2000.0,
  },
  snr_db: {
    metric: "snr_db",
    warningThresholdLow: 8.0,
    criticalThresholdLow: 4.0,
  },
  oil_pressure_bar: {
    metric: "oil_pressure_bar",
    warningThresholdLow: 2.5,
    criticalThresholdLow: 1.5,
  },
  state_of_charge_pct: {
    metric: "state_of_charge_pct",
    warningThresholdLow: 35.0,
    criticalThresholdLow: 20.0,
  },
  fuel_consumption_lph: {
    metric: "fuel_consumption_lph",
    warningThresholdHigh: 45.0,
    criticalThresholdHigh: 60.0,
  },
  power_output_kw: {
    metric: "power_output_kw",
    warningThresholdHigh: 185.0,
    criticalThresholdHigh: 220.0,
  },
  voltage: {
    metric: "voltage",
    warningThresholdLow: 360.0,
    warningThresholdHigh: 440.0,
    criticalThresholdLow: 340.0,
    criticalThresholdHigh: 460.0,
  },
  indoor_temperature: {
    metric: "indoor_temperature",
    warningThresholdLow: 17.5,
    warningThresholdHigh: 25.0,
    criticalThresholdLow: 13.0,
    criticalThresholdHigh: 28.0,
  },
  water_temperature: {
    metric: "water_temperature",
    warningThresholdLow: 2.5,
    criticalThresholdLow: 1.0,
  },
  flow_rate_lpm: {
    metric: "flow_rate_lpm",
    warningThresholdLow: 25.0,
    criticalThresholdLow: 10.0,
  },
  wind_speed: {
    metric: "wind_speed",
    warningThresholdHigh: 28.0,
    criticalThresholdHigh: 45.0,
  },
};

export class AssetHealthEvaluator {
  private metricDefs: Map<string, MetricDefinition> = new Map();

  constructor(metricDefinitions: MetricDefinition[] = []) {
    this.updateDefinitions(metricDefinitions);
  }

  updateDefinitions(metricDefinitions: MetricDefinition[]): void {
    this.metricDefs.clear();
    for (const def of metricDefinitions) {
      this.metricDefs.set(def.metric, def);
    }
  }

  evaluateAsset(
    currentTelemetry: Record<string, TwinTelemetryProperty>,
    baseHealthScore = 90
  ): HealthEvaluationResult {
    let minScore = baseHealthScore;
    let worstStatus: AssetStatus = "OPERATIONAL";
    let primaryConcern: string | undefined;
    const contributingMetrics: string[] = [];

    for (const [metric, prop] of Object.entries(currentTelemetry)) {
      const def = this.metricDefs.get(metric) || (DEFAULT_METRIC_THRESHOLDS[metric] as MetricDefinition | undefined);
      const val = prop.value;

      if (!def) {
        continue;
      }

      let metricScore = 100;
      let metricStatus: AssetStatus = "OPERATIONAL";

      // 1. Critical threshold checks
      if (
        (def.criticalThresholdHigh !== null && def.criticalThresholdHigh !== undefined && val >= def.criticalThresholdHigh) ||
        (def.criticalThresholdLow !== null && def.criticalThresholdLow !== undefined && val <= def.criticalThresholdLow)
      ) {
        metricScore = 25;
        metricStatus = "FAILED";
        primaryConcern = `Critical breach on ${metric}: ${val} ${prop.unit}`;
        contributingMetrics.push(metric);
      }
      // 2. Warning threshold checks
      else if (
        (def.warningThresholdHigh !== null && def.warningThresholdHigh !== undefined && val >= def.warningThresholdHigh) ||
        (def.warningThresholdLow !== null && def.warningThresholdLow !== undefined && val <= def.warningThresholdLow)
      ) {
        metricScore = 60;
        metricStatus = "DEGRADED";
        if (!primaryConcern) {
          primaryConcern = `Warning threshold breach on ${metric}: ${val} ${prop.unit}`;
        }
        contributingMetrics.push(metric);
      }
      // 3. Quality penalty
      if (prop.quality === "SUSPECT") {
        metricScore = Math.min(metricScore, 65);
        if (metricStatus === "OPERATIONAL") metricStatus = "DEGRADED";
      }

      if (metricScore < minScore) {
        minScore = metricScore;
      }

      if (metricStatus === "FAILED") {
        worstStatus = "FAILED";
      } else if (metricStatus === "DEGRADED" && worstStatus !== "FAILED") {
        worstStatus = "DEGRADED";
      }
    }

    return {
      healthScore: Math.round(minScore),
      status: worstStatus,
      primaryConcern,
      contributingMetrics,
    };
  }
}
