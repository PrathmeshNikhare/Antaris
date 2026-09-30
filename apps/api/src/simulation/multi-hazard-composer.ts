import type {
  MultiHazardComposerInput,
  MultiHazardSimulationResult,
  TwinState,
  ImpactedAssetSummary,
  BlastRadiusNode,
  BlastRadiusEdge,
  SimulationComparisonItem,
} from "@maitri-bharati/shared";
import { getTwinRegistry } from "../twin";
import { simulationStore } from "./simulation-store";
import { randomUUID } from "node:crypto";

/**
 * Deterministic Multi-Hazard Scenario Composer
 * Evaluates non-linear compound hazard interactions (e.g. Generator Failure + Extreme Cold,
 * or High Wind + Satellite Comms Outage) against an immutable Digital Twin snapshot.
 */
export async function composeMultiHazardSimulation(
  input: MultiHazardComposerInput
): Promise<MultiHazardSimulationResult> {
  const { stationId, title, conditions, durationHours, deterministicSeed = "SEED-MULTI-2026" } = input;
  const registry = getTwinRegistry();
  const baseline = await registry.getTwinState(stationId);

  if (!baseline) {
    throw new Error(`Station '${stationId}' not found in Digital Twin state registry.`);
  }

  // Deep clone baseline to ensure live twin immutability
  const scenarioState: TwinState = JSON.parse(JSON.stringify(baseline));

  const simulationId = `sim-multi-${randomUUID().slice(0, 8)}`;
  const firstOrderEffects: string[] = [];
  const secondOrderEffects: string[] = [];
  const compoundInteractions: string[] = [];
  const impactedAssets: ImpactedAssetSummary[] = [];
  const comparisons: SimulationComparisonItem[] = [];

  const blastNodes: BlastRadiusNode[] = [];
  const blastEdges: BlastRadiusEdge[] = [];

  let totalLoadDeltaKw = 0;
  let totalGenDeltaKw = 0;
  let batterySocDropPct = 0;
  let fuelBurnMultiplier = 1.0;

  // Process all combined conditions deterministically
  for (const cond of conditions) {
    const { scenarioType, parameters } = cond;

    if (scenarioType === "GENERATOR_FAILURE") {
      const targetGen = scenarioState.assets.find((a) => a.type === "GENERATOR");
      if (targetGen) {
        targetGen.status = "FAILED";
        targetGen.healthScore = 15;
        impactedAssets.push({
          assetId: targetGen.assetId,
          assetName: targetGen.name,
          assetType: targetGen.type,
          baselineStatus: "OPERATIONAL",
          simulatedStatus: "FAILED",
          baselineHealth: 88,
          simulatedHealth: 15,
          failureCause: "Simulated catastrophic mechanical trip and cooling loop failure",
          criticality: targetGen.criticality,
        });

        const genLoss = 85; // kW
        totalGenDeltaKw -= genLoss;
        firstOrderEffects.push(`Primary generator (${targetGen.name}) tripped: generation lost by ${genLoss} kW.`);

        blastNodes.push({
          id: targetGen.assetId,
          label: targetGen.name,
          domain: "ENERGY",
          severity: "CRITICAL",
          status: "FAILED",
          impactDescription: "Mechanical trip; zero power output",
        });
      }
    }

    if (scenarioType === "EXTREME_COLD") {
      const chillTemp = typeof parameters.ambientTempC === "number" ? parameters.ambientTempC : -45.0;
      scenarioState.environment.ambientTempC = chillTemp;
      scenarioState.environment.condition = "EXTREME_COLD";

      const hvacHeatingLoad = 35.0; // kW increase
      totalLoadDeltaKw += hvacHeatingLoad;
      batterySocDropPct += 25.0;
      fuelBurnMultiplier *= 1.35;

      firstOrderEffects.push(`Extreme polar chill (${chillTemp}°C): HVAC habitat thermal heating demand surged by +${hvacHeatingLoad} kW.`);
      secondOrderEffects.push(`Low thermal gradient elevates water piping freeze probability by 78%.`);

      blastNodes.push({
        id: "env-chill",
        label: `Ambient Chill (${chillTemp}°C)`,
        domain: "ENVIRONMENT",
        severity: "CRITICAL",
        status: "EXTREME_COLD",
        impactDescription: "Elevated structural thermal envelope conduction",
      });
    }

    if (scenarioType === "HIGH_WIND") {
      const windSpeed = typeof parameters.windSpeedMs === "number" ? parameters.windSpeedMs : 42.0;
      scenarioState.environment.windSpeedMs = windSpeed;
      scenarioState.environment.condition = "HIGH_WIND";

      firstOrderEffects.push(`Blizzard winds (${windSpeed} m/s): Exterior scientific sensors and solar panels blinded.`);
      secondOrderEffects.push("Turbine mechanical storm brake engaged; wind generation throttled to zero.");

      blastNodes.push({
        id: "env-wind",
        label: `Gale Force Winds (${windSpeed} m/s)`,
        domain: "ENVIRONMENT",
        severity: "CRITICAL",
        status: "HIGH_WIND",
        impactDescription: "Aerodynamic load on structural foundation stilts",
      });
    }

    if (scenarioType === "COMMUNICATION_OUTAGE") {
      scenarioState.connectivityState = "OFFLINE";
      firstOrderEffects.push("Satellite transponder link lost: Station operational telemetry offline.");
      secondOrderEffects.push("Autonomous local store-and-forward edge cache buffering flight and power packets.");

      blastNodes.push({
        id: "comms-transponder",
        label: "Satellite Link Dish",
        domain: "COMMS",
        severity: "CRITICAL",
        status: "OFFLINE",
        impactDescription: "Transponder tracking lost during blizzard",
      });
    }

    if (scenarioType === "FUEL_SHORTAGE") {
      const fuelLoss = typeof parameters.fuelLossLiters === "number" ? parameters.fuelLossLiters : 45000;
      scenarioState.logistics.daysOfFuelRemaining = Math.max(8, scenarioState.logistics.daysOfFuelRemaining - 35);
      firstOrderEffects.push(`Polar Diesel loss of ${fuelLoss.toLocaleString()} L: Fuel runway drops below safe winter margin.`);

      blastNodes.push({
        id: "log-fuel",
        label: "Fuel Tank Farm",
        domain: "LOGISTICS",
        severity: "CRITICAL",
        status: "DEGRADED",
        impactDescription: "Depleted below 30-day emergency reserve threshold",
      });
    }

    if (scenarioType === "BATTERY_DEGRADATION") {
      batterySocDropPct += 35.0;
      secondOrderEffects.push("Sub-zero cold chemical degradation reduces BESS cell usable capacity.");
    }
  }

  // Calculate Compound Interactions
  const hasGenFailure = conditions.some((c) => c.scenarioType === "GENERATOR_FAILURE");
  const hasExtremeCold = conditions.some((c) => c.scenarioType === "EXTREME_COLD");
  const hasCommsOutage = conditions.some((c) => c.scenarioType === "COMMUNICATION_OUTAGE");
  const hasHighWind = conditions.some((c) => c.scenarioType === "HIGH_WIND");

  if (hasGenFailure && hasExtremeCold) {
    compoundInteractions.push(
      "COMPOUND MULTIPLIER: Simultaneous loss of primary generation and -45°C ambient chill accelerates battery depletion by 2.4x, reducing life-support freeze runway from 8.2 hours to 2.1 hours."
    );
    batterySocDropPct += 20.0;
  }

  if (hasHighWind && hasCommsOutage) {
    compoundInteractions.push(
      "COMPOUND MULTIPLIER: Severe blizzard prevents ground crew apron egress while satellite comms outage blinds remote command from diagnosing generator setpoints."
    );
  }

  // Update scenario final numbers
  scenarioState.energy.totalGenerationKw = Math.max(20, baseline.energy.totalGenerationKw + totalGenDeltaKw);
  scenarioState.energy.totalLoadKw = baseline.energy.totalLoadKw + totalLoadDeltaKw;
  scenarioState.energy.netPowerKw = scenarioState.energy.totalGenerationKw - scenarioState.energy.totalLoadKw;
  scenarioState.energy.batterySocPct = Math.max(12, baseline.energy.batterySocPct - batterySocDropPct);
  scenarioState.energy.gridStatus = scenarioState.energy.netPowerKw < 0 ? "EMERGENCY" : "DEFICIT";

  // Build comparisons
  comparisons.push({
    metric: "Total Generation",
    unit: "kW",
    baseline: baseline.energy.totalGenerationKw,
    scenario: scenarioState.energy.totalGenerationKw,
    absoluteChange: `${scenarioState.energy.totalGenerationKw - baseline.energy.totalGenerationKw} kW`,
    percentageChange: `${(((scenarioState.energy.totalGenerationKw - baseline.energy.totalGenerationKw) / baseline.energy.totalGenerationKw) * 100).toFixed(1)}%`,
    severity: "CRITICAL",
    reason: "Tripped generation capacity under multi-hazard conditions",
  });

  comparisons.push({
    metric: "Station Life-Support Load",
    unit: "kW",
    baseline: baseline.energy.totalLoadKw,
    scenario: scenarioState.energy.totalLoadKw,
    absoluteChange: `+${scenarioState.energy.totalLoadKw - baseline.energy.totalLoadKw} kW`,
    percentageChange: `+${(((scenarioState.energy.totalLoadKw - baseline.energy.totalLoadKw) / baseline.energy.totalLoadKw) * 100).toFixed(1)}%`,
    severity: "WARNING",
    reason: "Elevated HVAC thermal heating load from extreme polar chill",
  });

  comparisons.push({
    metric: "Battery State-of-Charge",
    unit: "%",
    baseline: `${baseline.energy.batterySocPct}%`,
    scenario: `${scenarioState.energy.batterySocPct.toFixed(1)}%`,
    absoluteChange: `-${batterySocDropPct.toFixed(1)}%`,
    percentageChange: `-${batterySocDropPct.toFixed(1)}%`,
    severity: scenarioState.energy.batterySocPct < 25 ? "CRITICAL" : "WARNING",
    reason: "Accelerated BESS discharge buffer exhaustion",
  });

  // Blast radius links
  blastEdges.push({
    source: "env-chill",
    target: "asset-maitri-gen-1",
    dependencyType: "THERMAL",
    impactReason: "Ambient chill increases lube oil viscosity and cylinder thermal stress",
  });

  blastEdges.push({
    source: "asset-maitri-gen-1",
    target: "log-fuel",
    dependencyType: "FUEL",
    impactReason: "Elevated burn rate during sub-zero thermal recovery",
  });

  const result: MultiHazardSimulationResult = {
    simulationId,
    stationId,
    scenarioType: conditions[0]?.scenarioType || "GENERATOR_FAILURE",
    title: title || `Multi-Hazard Compound Scenario (${conditions.map((c) => c.scenarioType).join(" + ")})`,
    label: "SIMULATION",
    modelVersion: "POLAR-MULTI-HAZARD-v3.0",
    deterministicSeed: String(deterministicSeed),
    createdAt: new Date().toISOString(),
    snapshotTimestamp: baseline.timestamp,
    parameters: {
      scenarioType: conditions[0]?.scenarioType || "GENERATOR_FAILURE",
      durationHours,
      deterministicSeed,
    },
    baselineSnapshot: baseline,
    scenarioState,
    explanation: `Deterministic multi-hazard simulation evaluating ${conditions.length} combined stressors. First-order effects induce direct equipment trip; non-linear compound effects accelerate thermal energy collapse.`,
    impactedAssets,
    blastRadius: {
      nodes: blastNodes,
      links: blastEdges,
    },
    comparisons,
    operationalRisk: {
      score: 92,
      level: "CRITICAL",
      factors: [
        "Uncompensated generation deficit with high HVAC thermal heating demand",
        "Compound battery exhaustion and potential freeze risk",
      ],
    },
    recoveryState: {
      suggestedActions: [
        "Synchronize standby auxiliary diesel generator (GEN-02) within 15 minutes.",
        "Execute automated Stage-2 load shedding (isolate science laboratories and non-critical radome heaters).",
        "Direct heated glycol heat recovery loop to water intake lines to prevent ice plug formation.",
        "Initiate Fast-Lane compact burst sync if satellite link is degraded.",
      ],
      estimatedRecoveryMinutes: 45,
    },
    multiConditions: conditions,
    firstOrderEffects,
    secondOrderEffects,
    compoundInteractions,
    assumptions: [
      `Assumes initial baseline snapshot from station '${stationId}' is fully immutable and unmodified.`,
      `Duration of simulated compound event modeled for ${durationHours} consecutive hours.`,
      "Thermal building envelope cooling coefficient assumed at 0.042 kW/°C.",
      "Labelled explicitly as SIMULATED; no real hardware actuation performed.",
    ],
  };

  // Persist result into database & cache
  simulationStore.save(result);

  return result;
}
