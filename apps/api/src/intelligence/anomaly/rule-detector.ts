import type {
  TelemetryPoint,
  AnomalySeverity,
} from "@maitri-bharati/shared";

export interface RollingStats {
  mean: number;
  stdDev: number;
  count: number;
  rateOfChangePerMinute: number;
  min: number;
  max: number;
  trend: "RISING" | "FALLING" | "STABLE";
}

export interface RuleDetectionResult {
  isAnomaly: boolean;
  score: number; // 0.0 to 1.0
  severity: AnomalySeverity;
  zScore: number;
  deviation: number;
  expectedValue: number;
  thresholdCrossing?: {
    threshold: number;
    thresholdType: "WARNING" | "CRITICAL";
    actual: number;
  };
  stats: RollingStats;
}

export class RuleDetector {
  /**
   * Calculates rolling statistics from an ordered window of numeric samples.
   */
  public calculateRollingStats(samples: { value: number; timestamp: number }[]): RollingStats {
    if (samples.length === 0) {
      return {
        mean: 0,
        stdDev: 0,
        count: 0,
        rateOfChangePerMinute: 0,
        min: 0,
        max: 0,
        trend: "STABLE",
      };
    }

    const n = samples.length;
    const values = samples.map((s) => s.value);
    const sum = values.reduce((acc, v) => acc + v, 0);
    const mean = sum / n;

    const variance =
      n > 1
        ? values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (n - 1)
        : 0;
    const stdDev = Math.sqrt(variance);

    // Calculate rate of change over the last interval
    let rateOfChangePerMinute = 0;
    let trend: "RISING" | "FALLING" | "STABLE" = "STABLE";

    if (n >= 2) {
      const first = samples[0];
      const last = samples[n - 1];
      const timeDeltaMinutes = Math.max(0.1, (last.timestamp - first.timestamp) / 60000);
      rateOfChangePerMinute = (last.value - first.value) / timeDeltaMinutes;

      if (rateOfChangePerMinute > 0.05 * (stdDev || 1)) {
        trend = "RISING";
      } else if (rateOfChangePerMinute < -0.05 * (stdDev || 1)) {
        trend = "FALLING";
      }
    }

    return {
      mean,
      stdDev,
      count: n,
      rateOfChangePerMinute,
      min: Math.min(...values),
      max: Math.max(...values),
      trend,
    };
  }

  /**
   * Evaluates a current telemetry point against rolling baseline stats and static limits.
   */
  public evaluate(
    point: TelemetryPoint,
    stats: RollingStats,
    thresholds?: {
      warningLow?: number;
      warningHigh?: number;
      criticalLow?: number;
      criticalHigh?: number;
    }
  ): RuleDetectionResult {
    const val = point.value;
    const mean = stats.count > 0 ? stats.mean : val;
    const deviation = val - mean;

    // Minimum physical noise floor: avoid division by near-zero stdDev on ultra-stable telemetry
    // Requires at least 0.5 physical units or 2.5% deviation from mean before declaring a statistical outlier
    const noiseFloor = Math.max(0.5, Math.abs(mean) * 0.025);
    const effectiveStdDev = Math.max(stats.stdDev, noiseFloor * 0.33);
    const zScore = Math.abs(deviation / effectiveStdDev);
    const isMeaningfulDeviation = Math.abs(deviation) >= noiseFloor;

    let thresholdCrossing: RuleDetectionResult["thresholdCrossing"];
    let isAnomaly = false;
    let severity: AnomalySeverity = "INFO";
    let score = 0.0;

    // 1. Physical Threshold Check
    if (thresholds) {
      if (thresholds.criticalHigh !== undefined && val >= thresholds.criticalHigh) {
        thresholdCrossing = {
          threshold: thresholds.criticalHigh,
          thresholdType: "CRITICAL",
          actual: val,
        };
        isAnomaly = true;
        severity = "CRITICAL";
        score = Math.min(1.0, 0.85 + (val - thresholds.criticalHigh) / (thresholds.criticalHigh * 0.2 || 1));
      } else if (thresholds.criticalLow !== undefined && val <= thresholds.criticalLow) {
        thresholdCrossing = {
          threshold: thresholds.criticalLow,
          thresholdType: "CRITICAL",
          actual: val,
        };
        isAnomaly = true;
        severity = "CRITICAL";
        score = Math.min(1.0, 0.85 + (thresholds.criticalLow - val) / (Math.abs(thresholds.criticalLow) * 0.2 || 1));
      } else if (thresholds.warningHigh !== undefined && val >= thresholds.warningHigh) {
        thresholdCrossing = {
          threshold: thresholds.warningHigh,
          thresholdType: "WARNING",
          actual: val,
        };
        isAnomaly = true;
        severity = "WARNING";
        score = Math.min(0.84, 0.65 + (val - thresholds.warningHigh) / (thresholds.warningHigh * 0.2 || 1));
      } else if (thresholds.warningLow !== undefined && val <= thresholds.warningLow) {
        thresholdCrossing = {
          threshold: thresholds.warningLow,
          thresholdType: "WARNING",
          actual: val,
        };
        isAnomaly = true;
        severity = "WARNING";
        score = Math.min(0.84, 0.65 + (thresholds.warningLow - val) / (Math.abs(thresholds.warningLow) * 0.2 || 1));
      }
    }

    // 2. Statistical Process Control (Z-Score) Check
    if (!isAnomaly && stats.count >= 5 && isMeaningfulDeviation) {
      if (zScore >= 3.5) {
        isAnomaly = true;
        severity = "CRITICAL";
        score = Math.min(0.98, 0.75 + (zScore - 3.5) * 0.1);
      } else if (zScore >= 2.5) {
        isAnomaly = true;
        severity = "WARNING";
        score = Math.min(0.74, 0.55 + (zScore - 2.5) * 0.15);
      } else {
        score = Math.min(0.4, (zScore / 2.5) * 0.4);
      }
    }

    // 3. Excessive Rate of Change Check
    if (!isAnomaly && stats.count >= 5 && isMeaningfulDeviation && Math.abs(stats.rateOfChangePerMinute) > Math.max(2.0, 3.0 * effectiveStdDev)) {
      isAnomaly = true;
      severity = "WARNING";
      score = 0.68;
    }

    return {
      isAnomaly,
      score: Number(score.toFixed(3)),
      severity,
      zScore: Number(zScore.toFixed(2)),
      deviation: Number(deviation.toFixed(2)),
      expectedValue: Number(mean.toFixed(2)),
      thresholdCrossing,
      stats,
    };
  }
}
