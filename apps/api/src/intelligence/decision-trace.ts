import type { DecisionTraceRecord } from "@maitri-bharati/shared";

/**
 * In-memory & historical store for end-to-end Decision Traces.
 * Connects INPUT -> EVIDENCE -> RULE/MODEL -> EFFECT -> RECOMMENDATION -> OPERATOR ACTION.
 */
class DecisionTraceStore {
  private traces: DecisionTraceRecord[] = [];

  constructor() {
    this.seedDefaultTraces();
  }

  public record(trace: DecisionTraceRecord): void {
    this.traces.unshift(trace);
    // Keep max 200 traces
    if (this.traces.length > 200) {
      this.traces.pop();
    }
  }

  public getByStation(stationId: string, limit = 50): DecisionTraceRecord[] {
    return this.traces
      .filter((t) => t.stationId === stationId)
      .slice(0, limit);
  }

  public getAll(limit = 100): DecisionTraceRecord[] {
    return this.traces.slice(0, limit);
  }

  private seedDefaultTraces(): void {
    const now = new Date();

    // Maitri Trace: Generator Cylinder Thermal Elevation
    this.traces.push({
      correlationId: "trace-maitri-gen-01",
      stationId: "station-maitri",
      operatorId: "officer.maitri",
      timestamp: new Date(now.getTime() - 42 * 60 * 1000).toISOString(),
      inputTelemetry: {
        metric: "engine_temp_c",
        assetId: "asset-maitri-gen-1",
        value: 104.2,
        unit: "°C",
        source: "SIMULATOR",
      },
      evidenceDossier: {
        deviation: "+18.2°C above 86.0°C baseline",
        zScore: 3.42,
        thresholdBreached: "Warning >95.0°C, Critical >102.0°C",
      },
      ruleOrModelVersion: "ISOLATION_FOREST_V2 + CRITICAL_THERMAL_RULE_04",
      propagatedCascade: [
        "Primary Genset GEN-01 mechanical stress",
        "HVAC Habitat heating thermal loop deficit",
        "Polar diesel consumption rate elevated (+14%)",
        "Microgrid spinning reserve drops below 20 kW",
      ],
      recommendation: "Activate auxiliary generator GEN-02 and shed 15 kW non-essential science lab load.",
      operatorActionTaken: "ACKNOWLEDGED by Station Commander; simulated load shedding proposal reviewed.",
      auditRefId: "audit-gen-shed-01",
    });

    // Maitri Trace: Battery Storage SOC Decline
    this.traces.push({
      correlationId: "trace-maitri-bess-02",
      stationId: "station-maitri",
      operatorId: "engineer.patel",
      timestamp: new Date(now.getTime() - 115 * 60 * 1000).toISOString(),
      inputTelemetry: {
        metric: "battery_soc_pct",
        assetId: "asset-maitri-battery-1",
        value: 48.5,
        unit: "%",
        source: "SIMULATOR",
      },
      evidenceDossier: {
        deviation: "-21.5% below nominal 70% threshold",
        zScore: 2.15,
        thresholdBreached: "Warning Low <50.0%",
      },
      ruleOrModelVersion: "ENERGY_AUTONOMY_FORECASTER_V1",
      propagatedCascade: [
        "Battery autonomy reduced to 3.2 hours at current load",
        "Heightened vulnerability during wind turbine lulls",
      ],
      recommendation: "Increase diesel generation throttle by 12% to initiate BESS trickle recharge cycle.",
      operatorActionTaken: "Diesel generator setpoint adjusted via mission command.",
      auditRefId: "audit-bess-recharge-02",
    });

    // Bharati Trace: Coastal Maritime Wind Hazard
    this.traces.push({
      correlationId: "trace-bharati-wind-01",
      stationId: "station-bharati",
      operatorId: "officer.bharati",
      timestamp: new Date(now.getTime() - 85 * 60 * 1000).toISOString(),
      inputTelemetry: {
        metric: "wind_speed_ms",
        assetId: "asset-bharati-env-1",
        value: 28.4,
        unit: "m/s",
        source: "SIMULATOR",
      },
      evidenceDossier: {
        deviation: "+14.2 m/s over 14.0 m/s nominal average",
        zScore: 2.88,
        thresholdBreached: "Warning >22.0 m/s, Critical >28.0 m/s",
      },
      ruleOrModelVersion: "EXTREME_WIND_CASCADE_MODEL_V3",
      propagatedCascade: [
        "Aerodynamic building hydraulic stilt shear stress elevated",
        "Larsemann Hills coastal maritime gale warning",
        "Helicopter flight corridor and vessel cargo apron prohibited",
      ],
      recommendation: "Execute Station Storm Lockdown procedure; secure exterior scientific instrumentation.",
      operatorActionTaken: "Simulated Storm Lockdown Policy triggered by Expedition Leader.",
      auditRefId: "audit-storm-lockdown-01",
    });
  }
}

export const decisionTraceStore = new DecisionTraceStore();
