import type {
  TelemetryPoint,
  AnomalyResult,
  AnomalySeverity,
} from "@maitri-bharati/shared";
import { RuleDetector } from "./rule-detector";
import { IsolationForest } from "./isolation-forest";
import { EvidenceBuilder } from "./evidence-builder";

interface BufferedSample {
  value: number;
  timestamp: number;
}

export class AnomalyService {
  private ruleDetector: RuleDetector;
  private iForest: IsolationForest;
  private evidenceBuilder: EvidenceBuilder;

  // Key: stationId:assetId:metric -> ring buffer of recent samples
  private buffers: Map<string, BufferedSample[]> = new Map();
  private readonly maxBufferSize = 50;

  // Active anomalies per station: Map<stationId, Map<key, AnomalyResult>>
  private activeAnomalies: Map<string, Map<string, AnomalyResult>> = new Map();

  // Physical threshold definitions for standard polar telemetry streams
  private metricThresholds: Map<
    string,
    { warningLow?: number; warningHigh?: number; criticalLow?: number; criticalHigh?: number }
  > = new Map([
    ["temperature", { warningHigh: 85.0, criticalHigh: 95.0 }],
    ["coolant_temperature", { warningHigh: 85.0, criticalHigh: 95.0 }],
    ["fuel_consumption_lph", { warningHigh: 45.0, criticalHigh: 60.0 }],
    ["state_of_charge_pct", { warningLow: 30.0, criticalLow: 15.0 }],
    ["thermal_load_kw", { warningHigh: 75.0, criticalHigh: 90.0 }],
    ["wind_speed", { warningHigh: 28.0, criticalHigh: 45.0 }],
    ["ambient_temperature", { warningLow: -45.0, criticalLow: -60.0 }],
    ["packet_loss_pct", { warningHigh: 20.0, criticalHigh: 50.0 }],
    ["latency_ms", { warningHigh: 1200.0, criticalHigh: 2000.0 }],
    ["snr_db", { warningLow: 8.0, criticalLow: 4.0 }],
    ["voltage", { warningLow: 360.0, warningHigh: 440.0, criticalLow: 340.0, criticalHigh: 460.0 }],
    ["power_output_kw", { warningHigh: 185.0, criticalHigh: 220.0 }],
  ]);

  constructor() {
    this.ruleDetector = new RuleDetector();
    this.iForest = new IsolationForest(25, 64);
    this.evidenceBuilder = new EvidenceBuilder();
  }

  private getStreamKey(stationId: string, assetId: string | undefined, metric: string): string {
    return `${stationId}:${assetId || "station"}:${metric}`;
  }

  /**
   * Records a sample into the rolling history window.
   */
  public recordSample(point: TelemetryPoint): void {
    const key = this.getStreamKey(point.stationId, point.assetId, point.metric);
    let buf = this.buffers.get(key);
    if (!buf) {
      buf = [];
      this.buffers.set(key, buf);
    }

    const ts = new Date(point.timestamp).getTime();
    buf.push({ value: point.value, timestamp: ts });
    if (buf.length > this.maxBufferSize) {
      buf.shift();
    }
  }

  /**
   * Ingests and evaluates a telemetry point against rule detector and Isolation Forest.
   */
  public evaluatePoint(
    point: TelemetryPoint,
    thresholds?: {
      warningLow?: number;
      warningHigh?: number;
      criticalLow?: number;
      criticalHigh?: number;
    }
  ): AnomalyResult {
    const key = this.getStreamKey(point.stationId, point.assetId, point.metric);
    let stationMap = this.activeAnomalies.get(point.stationId);
    const wasAnomaly = !!stationMap?.has(key);

    const effectiveThresholds = thresholds || this.metricThresholds.get(point.metric);

    // Record sample to baseline buffer if not anomalous according to physical limits
    this.recordSample(point);

    const buf = this.buffers.get(key) || [];
    const stats = this.ruleDetector.calculateRollingStats(buf);
    const ruleResult = this.ruleDetector.evaluate(point, stats, effectiveThresholds);

    // Prepare feature vector for Isolation Forest
    // [normalized_deviation, zScore, rateOfChange, relativeVariance]
    const devRatio = stats.stdDev > 0 ? (point.value - stats.mean) / stats.stdDev : 0;
    const rocNorm = stats.stdDev > 0 ? stats.rateOfChangePerMinute / stats.stdDev : 0;
    const relVar = stats.stdDev > 0 ? 1.0 : 0.5;

    const iForestResult = this.iForest.scorePoint([
      devRatio,
      ruleResult.zScore,
      rocNorm,
      relVar,
    ]);

    // Anomaly fusion logic:
    // Physical rules & SPC take precedence; iForest provides multivariate confirmation and scoring
    let isAnomaly = false;
    let severity: AnomalySeverity = "INFO";
    let fusedScore = ruleResult.score;

    if (ruleResult.severity === "CRITICAL") {
      isAnomaly = true;
      severity = "CRITICAL";
      fusedScore = Math.max(ruleResult.score, iForestResult.score);
    } else if (ruleResult.severity === "WARNING") {
      isAnomaly = true;
      severity = "WARNING";
      fusedScore = Math.max(ruleResult.score, iForestResult.score);
    } else if (ruleResult.isAnomaly && iForestResult.score >= 0.70) {
      isAnomaly = true;
      severity = "WARNING";
      fusedScore = Math.max(ruleResult.score, iForestResult.score);
    } else {
      isAnomaly = false;
      fusedScore = Math.min(ruleResult.score, iForestResult.score);
    }

    // Data quality penalty on confidence
    let baseConfidence = 0.94;
    if (point.quality === "SUSPECT") baseConfidence = 0.65;
    if (point.quality === "BAD") baseConfidence = 0.25;
    if (stats.count < 5) baseConfidence *= 0.8;

    const windowMinutes = Math.round(
      buf.length >= 2 ? (buf[buf.length - 1].timestamp - buf[0].timestamp) / 60000 : 5
    );

    const evidence = this.evidenceBuilder.buildEvidence(
      point,
      ruleResult,
      iForestResult,
      Math.max(5, windowMinutes)
    );

    const result: AnomalyResult = {
      id: `anom-${point.stationId}-${point.assetId || "stn"}-${point.metric}-${Date.now()}`,
      stationId: point.stationId,
      assetId: point.assetId || "station",
      metric: point.metric,
      score: Number(fusedScore.toFixed(3)),
      isAnomaly,
      severity,
      confidence: Number(baseConfidence.toFixed(2)),
      detectedAt: new Date(point.timestamp).toISOString(),
      modelVersion: `rule-spc-v1+${iForestResult.modelVersion}`,
      modelType: "HYBRID",
      evidence,
      dataQuality: point.quality,
    };

    // Update active anomalies store
    if (!stationMap) {
      stationMap = new Map();
      this.activeAnomalies.set(point.stationId, stationMap);
    }

    if (isAnomaly) {
      stationMap.set(key, result);
    } else {
      // Auto-resolve if condition normalized
      stationMap.delete(key);
    }

    return result;
  }

  /**
   * Retrieves active anomalies for a given station.
   */
  public getActiveAnomalies(stationId: string): AnomalyResult[] {
    const stationMap = this.activeAnomalies.get(stationId);
    if (!stationMap) return [];
    return Array.from(stationMap.values()).sort((a, b) => b.score - a.score);
  }

  /**
   * Manually register or clear anomalies (e.g. for deterministic simulation testing)
   */
  public setAnomaly(stationId: string, anomaly: AnomalyResult): void {
    let stationMap = this.activeAnomalies.get(stationId);
    if (!stationMap) {
      stationMap = new Map();
      this.activeAnomalies.set(stationId, stationMap);
    }
    const key = this.getStreamKey(anomaly.stationId, anomaly.assetId, anomaly.metric);
    stationMap.set(key, anomaly);
  }

  public clearAnomalies(stationId?: string): void {
    if (stationId) {
      this.activeAnomalies.delete(stationId);
      // Clean buffers for this station
      for (const k of this.buffers.keys()) {
        if (k.startsWith(stationId)) this.buffers.delete(k);
      }
    } else {
      this.activeAnomalies.clear();
      this.buffers.clear();
    }
  }
}
