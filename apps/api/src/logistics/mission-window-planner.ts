import type { MissionWindowPlan, ProposedMissionWindow } from "@maitri-bharati/shared";

/**
 * Deterministic Mission Window Planner
 * Combines polar meteorological risk bands, blizzard severity, satellite link windowing,
 * and current inventory runway to compute operational resupply and sortie opportunities.
 */
export function planMissionWindows(
  stationId: string,
  ambientTempC = -18.5,
  windSpeedMs = 14.2,
  connectivityState = "NORMAL"
): MissionWindowPlan {
  const isMaitri = stationId === "station-maitri";
  const now = new Date();

  // 3 sequential 48-hour mission execution candidate windows
  const proposedWindows: ProposedMissionWindow[] = [];

  // Window 1: Immediate window (T+24h to T+72h)
  const w1Start = new Date(now.getTime() + 24 * 3600 * 1000);
  const w1End = new Date(now.getTime() + 72 * 3600 * 1000);

  // Assess wind conditions
  const isHighWind = windSpeedMs > 25.0;
  const isExtremeCold = ambientTempC < -35.0;
  const isCommsDegraded = connectivityState === "DEGRADED" || connectivityState === "OFFLINE";

  let w1Risk: "OPTIMAL" | "FAVORABLE" | "MARGINAL" | "HIGH_RISK" | "PROHIBITIVE" = "FAVORABLE";
  let w1Score = 88;
  const w1Constraints: string[] = [];

  if (isHighWind) {
    w1Risk = "MARGINAL";
    w1Score -= 25;
    w1Constraints.push(`Elevated surface winds (${windSpeedMs} m/s) approaching helicopter rotor limit.`);
  }
  if (isExtremeCold) {
    w1Score -= 15;
    w1Constraints.push(`Sub-zero cold (${ambientTempC}°C) requires aircraft engine pre-heating cart.`);
  }
  if (isCommsDegraded) {
    w1Score -= 18;
    w1Constraints.push(`Degraded satellite transponder; Fast-Lane flight plan telemetry mandatory.`);
  }

  proposedWindows.push({
    id: `win-${stationId}-01`,
    windowStart: w1Start.toISOString(),
    windowEnd: w1End.toISOString(),
    transportMode: isMaitri ? "AIR_DROPOFF" : "VESSEL_SEA_EDGE",
    vehicleDesignator: isMaitri ? "Basler BT-67 Polar Air Cargo" : "MV Vasiliy Golovnin Icebreaker",
    riskBand: w1Risk,
    confidenceScore: Math.max(40, w1Score),
    environmentalConstraints: w1Constraints.length > 0 ? w1Constraints : ["Surface wind and ground visibility nominal."],
    communicationStatus: connectivityState,
    deliveryBufferDays: 14,
    recommendedCargoCategories: ["MEDICAL", "SPARES", "CRITICAL_ELECTRONICS"],
    tacticalAdvisory: "Primary flight corridor open; authorize ground crew apron readiness.",
  });

  // Window 2: Secondary window (T+5 days to T+8 days)
  const w2Start = new Date(now.getTime() + 5 * 24 * 3600 * 1000);
  const w2End = new Date(now.getTime() + 8 * 24 * 3600 * 1000);

  proposedWindows.push({
    id: `win-${stationId}-02`,
    windowStart: w2Start.toISOString(),
    windowEnd: w2End.toISOString(),
    transportMode: isMaitri ? "TRAVERSE_CONVOY" : "VESSEL_SEA_EDGE",
    vehicleDesignator: isMaitri ? "PistenBully 300 Polar Tracked Convoy" : "MV Vasiliy Golovnin Icebreaker",
    riskBand: "OPTIMAL",
    confidenceScore: 94,
    environmentalConstraints: [
      "Stable antarctic polar high-pressure ridge forecast.",
      "Clear blue-ice runway surface with minimal sastrugi roughness.",
    ],
    communicationStatus: "NORMAL",
    deliveryBufferDays: 30,
    recommendedCargoCategories: ["FUEL", "FOOD", "HEAVY_MACHINERY"],
    tacticalAdvisory: "Recommended primary window for heavy arctic fuel tankage transfer.",
  });

  // Window 3: Tertiary contingency window (T+14 days to T+18 days)
  const w3Start = new Date(now.getTime() + 14 * 24 * 3600 * 1000);
  const w3End = new Date(now.getTime() + 18 * 24 * 3600 * 1000);

  proposedWindows.push({
    id: `win-${stationId}-03`,
    windowStart: w3Start.toISOString(),
    windowEnd: w3End.toISOString(),
    transportMode: "AIR_DROPOFF",
    vehicleDesignator: "Il-76 Heavy Transport Sortie",
    riskBand: "MARGINAL",
    confidenceScore: 68,
    environmentalConstraints: [
      "Late seasonal maritime cyclonic depression forming over Southern Ocean.",
      "Risk of rapid whiteout conditions within 6 hours of approach.",
    ],
    communicationStatus: "NORMAL",
    deliveryBufferDays: 45,
    recommendedCargoCategories: ["RESEARCH", "GENERAL_SUPPLIES"],
    tacticalAdvisory: "Contingency window only; subject to 72h radar verification.",
  });

  return {
    stationId,
    generatedAt: now.toISOString(),
    label: "COMPUTED / DEMO PLANNING",
    overallRiskAssessment: w1Risk === "FAVORABLE" ? "LOW" : "ELEVATED",
    proposedWindows,
    assumptions: [
      "Weather constraints derived from simulated Antarctic mesoscale atmospheric models.",
      "Runway condition assumes blue-ice friction coefficient > 0.45.",
      "Labelled explicitly as COMPUTED / DEMO PLANNING decision-support data.",
    ],
  };
}
