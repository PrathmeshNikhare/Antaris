import type { AnomalyEvidence, TelemetryPoint } from "@maitri-bharati/shared";
import type { RuleDetectionResult } from "./rule-detector";
import type { IForestScoringResult } from "./isolation-forest";

export class EvidenceBuilder {
  /**
   * Constructs an explainable AnomalyEvidence record.
   */
  public buildEvidence(
    point: TelemetryPoint,
    ruleResult: RuleDetectionResult,
    iForestResult?: IForestScoringResult,
    windowMinutes: number = 30
  ): AnomalyEvidence {
    const val = point.value;
    const unit = point.unit || "";
    const dev = ruleResult.deviation;
    const sign = dev >= 0 ? "+" : "";
    const z = ruleResult.zScore;
    const trend = ruleResult.stats.trend;
    const roc = Number(ruleResult.stats.rateOfChangePerMinute.toFixed(2));

    const sentences: string[] = [];

    // Sentence 1: Value vs Baseline
    sentences.push(
      `Observed ${val} ${unit} (${sign}${dev} ${unit} / ${z}σ from ${ruleResult.expectedValue} ${unit} baseline).`
    );

    // Sentence 2: Trend & Rate of Change
    if (Math.abs(roc) > 0.01) {
      const rocSign = roc >= 0 ? "+" : "";
      sentences.push(`Trend is ${trend} at ${rocSign}${roc} ${unit}/min.`);
    }

    // Sentence 3: Threshold Crossing
    if (ruleResult.thresholdCrossing) {
      const tc = ruleResult.thresholdCrossing;
      sentences.push(
        `Breached ${tc.thresholdType.toLowerCase()} limit of ${tc.threshold} ${unit} (actual: ${tc.actual} ${unit}).`
      );
    }

    // Sentence 4: Isolation Forest attribution
    if (iForestResult && iForestResult.isAnomaly) {
      sentences.push(
        `Isolation Forest confirmed multivariate isolation (score ${iForestResult.score}, top driver: ${iForestResult.topContributingFeature}).`
      );
    }

    return {
      deviationFromBaseline: dev,
      deviationUnit: unit,
      zScore: z,
      trendDirection: trend,
      rateOfChange: roc,
      thresholdCrossing: ruleResult.thresholdCrossing,
      contributingWindowMinutes: windowMinutes,
      baselineExpected: ruleResult.expectedValue,
      humanReadable: sentences.join(" "),
    };
  }
}
