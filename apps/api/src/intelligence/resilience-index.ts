import type {
  MissionResilienceIndex,
  ResilienceFactorScore,
  TwinState,
} from "@maitri-bharati/shared";

/**
 * Antarctic Mission Resilience Index (AMRI) Engine - Version 2.6
 * Computes an explainable, 8-factor resilience score for remote polar stations.
 * Each factor has an explicit weight, scoring formula, and penalty breakdown.
 */
export function computeMissionResilienceIndex(
  twinState: TwinState,
  activeAnomaliesCount = 0
): MissionResilienceIndex {
  const stationId = twinState.stationId;
  const isMaitri = stationId === "station-maitri";
  const stationName = isMaitri ? "Maitri Research Station" : "Bharati Station";

  const factors: ResilienceFactorScore[] = [];
  const topDegradationDrivers: string[] = [];

  // ── 1. Energy Reserve Margin (Weight: 15%) ──────────────────────────
  const netKw = twinState.energy.netPowerKw;
  const totalGen = Math.max(twinState.energy.totalGenerationKw, 1);
  const genRatio = Number(((netKw / totalGen) * 100).toFixed(1));
  let energyScore = 100;
  let energyStatus: ResilienceFactorScore["status"] = "OPTIMAL";
  let energyPenalty = 0;
  let energyExpl = `Positive net power reserve (+${netKw.toFixed(1)} kW) across microgrid.`;

  if (twinState.energy.gridStatus === "DEFICIT" || netKw < 0) {
    energyScore = 35;
    energyStatus = "CRITICAL";
    energyPenalty = 65;
    energyExpl = `Grid load exceeds generation by ${Math.abs(netKw).toFixed(1)} kW; draining battery storage.`;
    topDegradationDrivers.push("Microgrid Generation Deficit");
  } else if (genRatio < 15) {
    energyScore = 70;
    energyStatus = "DEGRADED";
    energyPenalty = 30;
    energyExpl = `Narrow generation spinning reserve margin (${genRatio}% of capacity).`;
    topDegradationDrivers.push("Low Energy Spinning Reserve");
  } else if (genRatio < 30) {
    energyScore = 85;
    energyStatus = "NOMINAL";
    energyPenalty = 15;
    energyExpl = `Generation reserve margin stable at ${genRatio}%.`;
  }

  factors.push({
    factor: "Energy Reserve Margin",
    weightPct: 15,
    score: energyScore,
    status: energyStatus,
    rawMetricValue: `${netKw >= 0 ? "+" : ""}${netKw.toFixed(1)} kW (${genRatio}%)`,
    penaltyPoints: energyPenalty,
    explanation: energyExpl,
  });

  // ── 2. Battery Storage Autonomy (Weight: 12%) ───────────────────────
  const soc = twinState.energy.batterySocPct;
  let socScore = 100;
  let socStatus: ResilienceFactorScore["status"] = "OPTIMAL";
  let socPenalty = 0;
  let socExpl = `BESS storage capacity nominal at ${soc.toFixed(1)}% State-of-Charge.`;

  if (soc < 25) {
    socScore = 20;
    socStatus = "CRITICAL";
    socPenalty = 80;
    socExpl = `Battery storage critically depleted (${soc.toFixed(1)}%); emergency load shedding required.`;
    topDegradationDrivers.push("Critical Battery Depletion");
  } else if (soc < 50) {
    socScore = 65;
    socStatus = "DEGRADED";
    socPenalty = 35;
    socExpl = `Battery SOC below 50% threshold; cycling risk during peak heating periods.`;
    topDegradationDrivers.push("Low Battery State-of-Charge");
  } else if (soc < 70) {
    socScore = 85;
    socStatus = "NOMINAL";
    socPenalty = 15;
    socExpl = `Battery autonomy stable at ${soc.toFixed(1)}% SOC.`;
  }

  factors.push({
    factor: "Battery Autonomy",
    weightPct: 12,
    score: socScore,
    status: socStatus,
    rawMetricValue: `${soc.toFixed(1)}% SOC (${twinState.energy.batteryStorageKwh.toFixed(0)} kWh)`,
    penaltyPoints: socPenalty,
    explanation: socExpl,
  });

  // ── 3. Fuel Runway Autonomy (Weight: 18%) ───────────────────────────
  const fuelDays = twinState.logistics.daysOfFuelRemaining;
  let fuelScore = 100;
  let fuelStatus: ResilienceFactorScore["status"] = "OPTIMAL";
  let fuelPenalty = 0;
  let fuelExpl = `Station Polar Diesel runway exceeds 60-day winter baseline (${fuelDays} days).`;

  if (fuelDays < 20) {
    fuelScore = 15;
    fuelStatus = "CRITICAL";
    fuelPenalty = 85;
    fuelExpl = `Only ${fuelDays} days of Polar Diesel remaining; below minimum survival threshold!`;
    topDegradationDrivers.push("Imminent Fuel Depletion (<20 days)");
  } else if (fuelDays < 45) {
    fuelScore = 60;
    fuelStatus = "DEGRADED";
    fuelPenalty = 40;
    fuelExpl = `Fuel buffer of ${fuelDays} days is below safe 60-day sea-ice freeze window.`;
    topDegradationDrivers.push("Reduced Fuel Runway (<45 days)");
  } else if (fuelDays < 75) {
    fuelScore = 88;
    fuelStatus = "NOMINAL";
    fuelPenalty = 12;
    fuelExpl = `Adequate fuel reserves (${fuelDays} days remaining).`;
  }

  factors.push({
    factor: "Fuel Runway Autonomy",
    weightPct: 18,
    score: fuelScore,
    status: fuelStatus,
    rawMetricValue: `${fuelDays} Days remaining`,
    penaltyPoints: fuelPenalty,
    explanation: fuelExpl,
  });

  // ── 4. Critical Infrastructure Health (Weight: 15%) ─────────────────
  const assets = twinState.assets || [];
  const validAssets = assets.filter((a) => typeof a.healthScore === "number");
  const avgHealth = validAssets.length > 0
    ? validAssets.reduce((acc, a) => acc + (a.healthScore ?? 85), 0) / validAssets.length
    : 85;
  const failedCount = assets.filter((a) => a.status === "FAILED").length;
  const degradedCount = assets.filter((a) => a.status === "DEGRADED").length;

  let infraScore = Math.max(10, Math.round(avgHealth));
  let infraStatus: ResilienceFactorScore["status"] = "OPTIMAL";
  let infraPenalty = 100 - infraScore;
  let infraExpl = `All critical life-support subsystems operating nominally.`;

  if (failedCount > 0) {
    infraScore = Math.min(infraScore, 40);
    infraStatus = "CRITICAL";
    infraPenalty = 100 - infraScore;
    infraExpl = `${failedCount} core asset(s) in FAILED state (e.g. Primary Diesel Generator or Water Plant).`;
    topDegradationDrivers.push("Failed Core Infrastructure Assets");
  } else if (degradedCount > 1 || avgHealth < 70) {
    infraScore = Math.min(infraScore, 68);
    infraStatus = "DEGRADED";
    infraPenalty = 100 - infraScore;
    infraExpl = `${degradedCount} asset(s) showing mechanical or electrical degradation.`;
    topDegradationDrivers.push("Degraded Subsystem Health");
  } else if (avgHealth < 85) {
    infraStatus = "NOMINAL";
  }

  factors.push({
    factor: "Infrastructure Health",
    weightPct: 15,
    score: infraScore,
    status: infraStatus,
    rawMetricValue: `${avgHealth.toFixed(1)}/100 Avg Health (${failedCount} Failed, ${degradedCount} Degraded)`,
    penaltyPoints: infraPenalty,
    explanation: infraExpl,
  });

  // ── 5. Thermal & Environmental Safety Margin (Weight: 12%) ──────────
  const temp = twinState.environment.ambientTempC;
  const wind = twinState.environment.windSpeedMs;
  let envScore = 100;
  let envStatus: ResilienceFactorScore["status"] = "OPTIMAL";
  let envPenalty = 0;
  let envExpl = `Moderate polar weather conditions; thermal envelope and structural loading nominal.`;

  if (twinState.environment.condition === "BLIZZARD" || wind > 30 || temp < -40) {
    envScore = 30;
    envStatus = "CRITICAL";
    envPenalty = 70;
    envExpl = `Severe blizzard or extreme cold (${temp}°C, ${wind} m/s wind); storm lockdown active.`;
    topDegradationDrivers.push("Severe Polar Blizzard Conditions");
  } else if (twinState.environment.condition === "HIGH_WIND" || wind > 20 || temp < -28) {
    envScore = 65;
    envStatus = "DEGRADED";
    envPenalty = 35;
    envExpl = `High wind speeds (${wind} m/s) and sub-zero chill elevating station thermal heating demand.`;
    topDegradationDrivers.push("High Wind & Cold Stress");
  } else if (temp < -20 || wind > 12) {
    envScore = 85;
    envStatus = "NOMINAL";
    envPenalty = 15;
    envExpl = `Typical Antarctic coastal/plateau conditions (${temp}°C).`;
  }

  factors.push({
    factor: "Thermal & Environment Margin",
    weightPct: 12,
    score: envScore,
    status: envStatus,
    rawMetricValue: `${temp}°C / ${wind} m/s (${twinState.environment.condition})`,
    penaltyPoints: envPenalty,
    explanation: envExpl,
  });

  // ── 6. Satellite Communication Freshness (Weight: 10%) ──────────────
  const commState = twinState.connectivityState;
  const dataFreshness = twinState.dataFreshness?.status || "FRESH";
  let commScore = 100;
  let commStatus: ResilienceFactorScore["status"] = "OPTIMAL";
  let commPenalty = 0;
  let commExpl = `Broadband telemetry synchronization verified via ISRO satellite link.`;

  if (commState === "OFFLINE") {
    commScore = 20;
    commStatus = "CRITICAL";
    commPenalty = 80;
    commExpl = `Station satellite link down; edge store-and-forward buffer active.`;
    topDegradationDrivers.push("Satellite Comms Blackout");
  } else if (commState === "DEGRADED" || dataFreshness === "STALE") {
    commScore = 65;
    commStatus = "DEGRADED";
    commPenalty = 35;
    commExpl = `High packet loss or transponder jitter; compact Fast-Lane delta telemetry active.`;
    topDegradationDrivers.push("Degraded Telemetry Sync");
  } else if (commState === "RECOVERY") {
    commScore = 80;
    commStatus = "NOMINAL";
    commPenalty = 20;
    commExpl = `Recovering link; flushing buffered telemetry batches to remote operations command.`;
  }

  factors.push({
    factor: "Communication Freshness",
    weightPct: 10,
    score: commScore,
    status: commStatus,
    rawMetricValue: `${commState} (${dataFreshness})`,
    penaltyPoints: commPenalty,
    explanation: commExpl,
  });

  // ── 7. Critical Inventory Coverage (Weight: 10%) ────────────────────
  const waterDays = twinState.logistics.daysOfWaterRemaining;
  const foodDays = twinState.logistics.daysOfFoodRemaining;
  const minConsumableDays = Math.min(waterDays, foodDays);
  let invScore = 100;
  let invStatus: ResilienceFactorScore["status"] = "OPTIMAL";
  let invPenalty = 0;
  let invExpl = `Potable water (${waterDays}d) and food (${foodDays}d) reserves exceed survival requirements.`;

  if (minConsumableDays < 10) {
    invScore = 25;
    invStatus = "CRITICAL";
    invPenalty = 75;
    invExpl = `Acute consumable deficit: water/food remaining at only ${minConsumableDays} days.`;
    topDegradationDrivers.push("Critical Water/Food Shortage");
  } else if (minConsumableDays < 25) {
    invScore = 70;
    invStatus = "DEGRADED";
    invPenalty = 30;
    invExpl = `Consumable reserve window narrowing (${minConsumableDays} days).`;
    topDegradationDrivers.push("Sub-Optimal Consumables Reserve");
  } else if (minConsumableDays < 50) {
    invScore = 88;
    invStatus = "NOMINAL";
    invPenalty = 12;
    invExpl = `Sufficient consumable stock (${minConsumableDays} days minimum).`;
  }

  factors.push({
    factor: "Critical Inventory Coverage",
    weightPct: 10,
    score: invScore,
    status: invStatus,
    rawMetricValue: `Water: ${waterDays}d | Food: ${foodDays}d`,
    penaltyPoints: invPenalty,
    explanation: invExpl,
  });

  // ── 8. Active Hazard & Incident Burden (Weight: 8%) ─────────────────
  const activeAlerts = twinState.activeAlerts || [];
  const criticalAlerts = activeAlerts.filter((a) => a.severity === "CRITICAL" && a.status !== "RESOLVED");
  const warningAlerts = activeAlerts.filter((a) => a.severity === "WARNING" && a.status !== "RESOLVED");

  let hazardScore = 100;
  let hazardStatus: ResilienceFactorScore["status"] = "OPTIMAL";
  let hazardPenalty = 0;
  let hazardExpl = `Zero active critical or warning alarms registered.`;

  if (criticalAlerts.length > 0) {
    hazardScore = Math.max(15, 100 - criticalAlerts.length * 35 - warningAlerts.length * 10);
    hazardStatus = "CRITICAL";
    hazardPenalty = 100 - hazardScore;
    hazardExpl = `${criticalAlerts.length} unresolved CRITICAL incident(s) active on station.`;
    topDegradationDrivers.push(`${criticalAlerts.length} Active Critical Alarm(s)`);
  } else if (warningAlerts.length > 0 || activeAnomaliesCount > 0) {
    hazardScore = Math.max(50, 100 - warningAlerts.length * 15 - activeAnomaliesCount * 10);
    hazardStatus = "DEGRADED";
    hazardPenalty = 100 - hazardScore;
    hazardExpl = `${warningAlerts.length} warning alert(s) and ${activeAnomaliesCount} statistical telemetry anomaly/anomalies.`;
    topDegradationDrivers.push("Active Operational Warnings / Sensor Anomalies");
  }

  factors.push({
    factor: "Active Hazard Burden",
    weightPct: 8,
    score: hazardScore,
    status: hazardStatus,
    rawMetricValue: `${criticalAlerts.length} Critical, ${warningAlerts.length} Warning, ${activeAnomaliesCount} Anomalies`,
    penaltyPoints: hazardPenalty,
    explanation: hazardExpl,
  });

  // ── Weighted Overall Index Calculation ──────────────────────────────
  const weightedSum = factors.reduce((sum, f) => sum + (f.score * f.weightPct) / 100, 0);
  const overallScore = Math.max(0, Math.min(100, Math.round(weightedSum)));

  let status: MissionResilienceIndex["status"] = "RESILIENT";
  if (overallScore < 45 || criticalAlerts.length > 1 || failedCount > 0) {
    status = "EMERGENCY";
  } else if (overallScore < 65) {
    status = "DEGRADED";
  } else if (overallScore < 85) {
    status = "STABLE";
  }

  const confidencePct = commState === "OFFLINE" ? 65 : commState === "DEGRADED" ? 82 : 96;
  const dataQuality: "GOOD" | "SUSPECT" | "BAD" =
    commState === "OFFLINE" ? "SUSPECT" : twinState.dataQualitySummary?.overallQuality || "GOOD";

  return {
    stationId,
    stationName,
    overallScore,
    status,
    modelVersion: "AMRI-v2.6-POLAR-CONFIGURABLE",
    timestamp: new Date().toISOString(),
    confidencePct,
    dataQuality,
    factors,
    topDegradationDrivers: topDegradationDrivers.length > 0 ? topDegradationDrivers : ["None - All systems within optimal margins"],
    disclaimer: "Decision-support index; not a real-world certification.",
  };
}
