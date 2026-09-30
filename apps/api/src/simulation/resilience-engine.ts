import { getTwinRegistry } from "../twin";
import { TwinDependencyGraph } from "../twin/dependency-graph";
import { simulationStore } from "./simulation-store";
import type {
  TwinState,
  TwinAssetState,
  ResilienceScenarioType,
  SimulationParameters,
  ResilienceSimulationResult,
  SimulationComparisonItem,
  ImpactedAssetSummary,
  BlastRadiusNode,
  BlastRadiusEdge,
  Criticality,
} from "@maitri-bharati/shared";

export class ResilienceSimulationEngine {
  private readonly modelVersion = "resilience-sim-v1.0.0";

  /**
   * Executes a counterfactual "what-if" resilience simulation against an immutable snapshot of the Digital Twin.
   * GUARANTEE: Never mutates the live TwinState.
   */
  public runSimulation(
    stationId: string,
    scenarioType: ResilienceScenarioType,
    params: SimulationParameters = { scenarioType }
  ): ResilienceSimulationResult {
    const registry = getTwinRegistry();
    const liveState = registry.getTwinState(stationId);

    if (!liveState) {
      throw new Error(`Cannot run simulation: Station ${stationId} not found in Digital Twin`);
    }

    // ── 1. Create Immutable Baseline Snapshot (Structured Clone) ──
    const baselineSnapshot: TwinState = JSON.parse(JSON.stringify(liveState));
    // Simulated state begins as an isolated deep clone
    const scenarioState: TwinState = JSON.parse(JSON.stringify(liveState));

    const dependencyGraph = registry.getDependencyGraph();
    const nowIso = new Date().toISOString();
    const deterministicSeed = String(params.deterministicSeed ?? 42);
    const simulationId = `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const isMaitri = stationId.toLowerCase().includes("maitri");
    const targetAssetId =
      params.targetAssetId ?? (isMaitri ? "asset-maitri-gen-1" : "asset-bharati-chp-1");

    let title = "";
    let explanation = "";
    const impactedAssets: ImpactedAssetSummary[] = [];
    const comparisons: SimulationComparisonItem[] = [];
    const blastNodes: BlastRadiusNode[] = [];
    const blastLinks: BlastRadiusEdge[] = [];
    let riskScore = 15;
    let riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";
    const riskFactors: string[] = [];
    const recoveryActions: string[] = [];
    let recoveryMinutes = 30;

    // ── 2. Scenario Dispatcher ────────────────────────────────────
    switch (scenarioType) {
      case "GENERATOR_FAILURE": {
        title = "Primary Generator Trip & Rapid Battery Discharge Cascade";
        const durationHours = params.durationHours ?? 2.0;

        // Baseline values
        const baseGenKw = baselineSnapshot.energy.totalGenerationKw;
        const baseLoadKw = baselineSnapshot.energy.totalLoadKw;
        const baseSoc = baselineSnapshot.energy.batterySocPct;
        const baseReserve = baselineSnapshot.energy.netPowerKw;

        // Mutate target generator in simulated state
        const targetGen = scenarioState.assets.find((a) => a.assetId === targetAssetId);
        if (targetGen) {
          targetGen.status = "FAILED";
          targetGen.healthScore = 12;
          if (targetGen.currentTelemetry.power_output_kw) {
            targetGen.currentTelemetry.power_output_kw.value = 0;
            targetGen.currentTelemetry.power_output_kw.quality = "BAD";
          }
          impactedAssets.push({
            assetId: targetGen.assetId,
            assetName: targetGen.name,
            assetType: targetGen.type,
            baselineStatus: "OPERATIONAL",
            simulatedStatus: "FAILED",
            baselineHealth: 92,
            simulatedHealth: 12,
            failureCause: "Catastrophic mechanical / thermal shutdown",
            criticality: targetGen.criticality,
          });
        }

        // Trace downstream dependencies via TwinDependencyGraph
        const downstream = dependencyGraph.getDownstreamImpact(targetAssetId);
        for (const depId of downstream.impactedAssetIds) {
          const a = scenarioState.assets.find((ast) => ast.assetId === depId);
          if (a) {
            let simStatus: TwinAssetState["status"] = "DEGRADED";
            let simHealth = Math.max(25, a.healthScore - 45);
            let cause = "Loss of primary 3-phase alternator power";

            if (a.type === "BATTERY") {
              simStatus = "DEGRADED";
              simHealth = 40;
              cause = "Deep cycle emergency discharge sustaining station load";
            } else if (a.type === "WATER") {
              simStatus = "CRITICAL";
              simHealth = 20;
              cause = "Trace heating loss on Priyadarshini water pipeline; imminent freeze hazard";
            } else if (a.type === "COMMUNICATION") {
              simStatus = "WARNING";
              simHealth = 55;
              cause = "Transferred to emergency UPS battery buffer";
            } else if (a.type === "HVAC") {
              simStatus = "DEGRADED";
              simHealth = 35;
              cause = "Primary heating elements de-energized; thermal slip across station envelope";
            }

            a.status = simStatus;
            a.healthScore = simHealth;

            impactedAssets.push({
              assetId: a.assetId,
              assetName: a.name,
              assetType: a.type,
              baselineStatus: "OPERATIONAL",
              simulatedStatus: simStatus,
              baselineHealth: 88,
              simulatedHealth: simHealth,
              failureCause: cause,
              criticality: a.criticality,
            });
          }
        }

        // Energy recalculations
        const simulatedGenKw = Math.max(0, baseGenKw - (isMaitri ? 125 : 100));
        const deficitKw = Math.max(0, baseLoadKw - simulatedGenKw);
        // Battery discharge rate is the deficit
        const dischargeKw = deficitKw;
        // Battery drain: deficitKw * durationHours / capacity (120 kWh)
        const batteryCapacityKwh = isMaitri ? 120.0 : 160.0;
        const drainedKwh = deficitKw * durationHours;
        const drainedPct = (drainedKwh / batteryCapacityKwh) * 100;
        const simulatedSoc = Math.max(0, Math.round(baseSoc - drainedPct));
        const simulatedReserveKw = Math.round((simulatedGenKw - baseLoadKw) * 10) / 10;
        const batteryAutonomyHours = Number(((baseSoc / 100) * batteryCapacityKwh / Math.max(1, deficitKw)).toFixed(1));

        scenarioState.energy.totalGenerationKw = simulatedGenKw;
        scenarioState.energy.batterySocPct = simulatedSoc;
        scenarioState.energy.netPowerKw = simulatedReserveKw;
        scenarioState.energy.gridStatus = simulatedReserveKw < 0 ? "DEFICIT" : "BALANCED";

        // Operational risk
        riskScore = 95;
        riskLevel = "CRITICAL";
        riskFactors.push(
          "Catastrophic primary generator loss induces immediate 125 kW generation deficit",
          `Station battery bank discharging rapidly at ${dischargeKw.toFixed(1)} kW (autonomy: ${batteryAutonomyHours}h)`,
          "Secondary heating de-energized; lake water intake freeze risk within 90 minutes"
        );

        explanation =
          `Generator failure on ${targetAssetId} causes an immediate ${deficitKw.toFixed(1)} kW generation deficit ` +
          `because available renewable generation is insufficient to support the active station load (${baseLoadKw} kW). ` +
          `The central battery bank absorbs the deficit, discharging at ${dischargeKw.toFixed(1)} kW and dropping from ` +
          `${baseSoc}% to ${simulatedSoc}% SOC over ${durationHours}h. Cascading downstream power loss de-energizes ` +
          `Priyadarshini water pipeline trace heating, triggering a critical freeze failure within 2 hours.`;

        comparisons.push(
          {
            metric: "Total Active Generation",
            unit: "kW",
            baseline: baseGenKw,
            scenario: simulatedGenKw,
            absoluteChange: `-${baseGenKw - simulatedGenKw} kW`,
            percentageChange: `-${Math.round(((baseGenKw - simulatedGenKw) / Math.max(1, baseGenKw)) * 100)}%`,
            severity: "CRITICAL",
            reason: "Primary generator trip removed prime alternator capacity",
          },
          {
            metric: "Net Generation Reserve Margin",
            unit: "kW",
            baseline: `${baseReserve > 0 ? "+" : ""}${baseReserve}`,
            scenario: `${simulatedReserveKw > 0 ? "+" : ""}${simulatedReserveKw}`,
            absoluteChange: `${simulatedReserveKw - baseReserve} kW`,
            percentageChange: "-100%",
            severity: "CRITICAL",
            reason: "Demand exceeds total generation, plunging station into energy deficit",
          },
          {
            metric: "Battery State of Charge",
            unit: "%",
            baseline: `${baseSoc}%`,
            scenario: `${simulatedSoc}%`,
            absoluteChange: `-${baseSoc - simulatedSoc}%`,
            percentageChange: `-${Math.round(((baseSoc - simulatedSoc) / baseSoc) * 100)}%`,
            severity: simulatedSoc < 20 ? "CRITICAL" : "WARNING",
            reason: `Deep emergency discharge sustaining ${deficitKw.toFixed(1)} kW load for ${durationHours}h`,
          },
          {
            metric: "Battery Autonomy Remaining",
            unit: "Hours",
            baseline: "> 14.0 h",
            scenario: `${batteryAutonomyHours} h`,
            absoluteChange: `-${(14.0 - batteryAutonomyHours).toFixed(1)} h`,
            percentageChange: "-82%",
            severity: "CRITICAL",
            reason: "High discharge draw depletes remaining buffer hours",
          },
          {
            metric: "Lake Water Intake Status",
            unit: "Status",
            baseline: "OPERATIONAL",
            scenario: "FREEZE RISK",
            absoluteChange: "TRIP",
            percentageChange: "N/A",
            severity: "CRITICAL",
            reason: "Submersible pump and pipe trace heating de-energized",
          },
          {
            metric: "Overall Station Risk Score",
            unit: "/100",
            baseline: "15 (LOW)",
            scenario: "95 (CRITICAL)",
            absoluteChange: "+80 pts",
            percentageChange: "+533%",
            severity: "CRITICAL",
            reason: "Life-support power loss and thermal freeze hazard",
          }
        );

        // Blast radius nodes & links
        blastNodes.push(
          {
            id: targetAssetId,
            label: "GEN-01 Primary Genset",
            domain: "INFRASTRUCTURE",
            severity: "CRITICAL",
            status: "FAILED",
            impactDescription: "Prime alternator trip; 0 kW output",
            metricValue: "0 kW",
          },
          {
            id: "node-bat",
            label: "Central Battery Bank",
            domain: "ENERGY",
            severity: "CRITICAL",
            status: "DISCHARGING",
            impactDescription: `Absorbing ${deficitKw} kW station deficit; SOC ${simulatedSoc}%`,
            metricValue: `SOC ${simulatedSoc}%`,
          },
          {
            id: "node-hvac",
            label: "Main HVAC Air Handler",
            domain: "LIFE_SUPPORT",
            severity: "WARNING",
            status: "DERATED",
            impactDescription: "Electric trace heating curtailed; indoor temp dropping",
            metricValue: "+8°C",
          },
          {
            id: "node-water",
            label: "Lake Water Intake Pump",
            domain: "LIFE_SUPPORT",
            severity: "CRITICAL",
            status: "FREEZE RISK",
            impactDescription: "Pipe trace heating de-energized; freeze damage imminent",
            metricValue: "-18°C line",
          },
          {
            id: "node-comms",
            label: "Satellite Radome",
            domain: "COMMS",
            severity: "WARNING",
            status: "UPS BUFFER",
            impactDescription: "Operating on temporary 4-hour UPS battery buffer",
            metricValue: "UPS 68%",
          }
        );

        blastLinks.push(
          {
            source: targetAssetId,
            target: "node-bat",
            dependencyType: "POWER",
            impactReason: "Generation deficit forces battery into maximum emergency discharge",
          },
          {
            source: targetAssetId,
            target: "node-hvac",
            dependencyType: "POWER",
            impactReason: "3-phase power drop disables high-draw HVAC electric boiler elements",
          },
          {
            source: targetAssetId,
            target: "node-water",
            dependencyType: "POWER",
            impactReason: "Lake intake trace heaters lose grid supply, risking pipe freeze",
          },
          {
            source: targetAssetId,
            target: "node-comms",
            dependencyType: "POWER",
            impactReason: "Radome primary feed cut; fails over to local UPS battery",
          }
        );

        recoveryActions.push(
          "Auto-dispatch Standby Diesel Generator 2 to restore primary bus voltage (ETA 12 minutes).",
          "Execute emergency load shedding on non-essential science and auxiliary laboratory equipment (-25 kW).",
          "Prioritize electric trace heaters on Priyadarshini water pipeline before ice formation begins."
        );
        recoveryMinutes = 15;
        break;
      }

      case "BATTERY_DEGRADATION": {
        title = "Sub-Zero Battery Cell Degradation & Headroom Loss";
        const degPct = params.batteryDegradationPct ?? 65;
        const targetBat = scenarioState.assets.find((a) => a.type === "BATTERY");

        if (targetBat) {
          targetBat.status = "DEGRADED";
          targetBat.healthScore = 32;
          impactedAssets.push({
            assetId: targetBat.assetId,
            assetName: targetBat.name,
            assetType: targetBat.type,
            baselineStatus: "OPERATIONAL",
            simulatedStatus: "DEGRADED",
            baselineHealth: 90,
            simulatedHealth: 32,
            failureCause: `Severe sub-zero lithium plating; ${degPct}% usable capacity derated`,
            criticality: targetBat.criticality,
          });
        }

        const baseKwh = baselineSnapshot.energy.batteryStorageKwh;
        const simKwh = Math.round(baseKwh * (1 - degPct / 100));
        scenarioState.energy.batteryStorageKwh = simKwh;

        riskScore = 72;
        riskLevel = "HIGH";
        riskFactors.push(
          `Battery bank storage capacity degraded by ${degPct}% (remaining: ${simKwh} kWh)`,
          "Dynamic grid buffering and peak shaving lost; high vulnerability to load surges"
        );

        explanation =
          `Sub-zero electrolyte crystallization degrades central battery storage capacity by ${degPct}%, ` +
          `shrinking available energy buffer from ${baseKwh} kWh to ${simKwh} kWh. Maximum safe discharge current is ` +
          `severely throttled to prevent cell reversal, eliminating station peak-shaving resilience.`;

        comparisons.push(
          {
            metric: "Usable Battery Storage Capacity",
            unit: "kWh",
            baseline: baseKwh,
            scenario: simKwh,
            absoluteChange: `-${baseKwh - simKwh} kWh`,
            percentageChange: `-${degPct}%`,
            severity: "CRITICAL",
            reason: "Internal impedance spike and electrolyte plating",
          },
          {
            metric: "Emergency Grid Buffer Duration",
            unit: "Hours",
            baseline: "3.2 h",
            scenario: "1.1 h",
            absoluteChange: "-2.1 h",
            percentageChange: "-65%",
            severity: "CRITICAL",
            reason: "Reduced kWh reserve severely shortens generator failover window",
          },
          {
            metric: "Peak Shaving Resilience",
            unit: "Capability",
            baseline: "NOMINAL",
            scenario: "UNAVAILABLE",
            absoluteChange: "OFFLINE",
            percentageChange: "N/A",
            severity: "WARNING",
            reason: "Current throttling prevents absorbing inductive motor startup spikes",
          }
        );

        blastNodes.push(
          {
            id: targetBat?.assetId ?? "bat-1",
            label: "Central Battery Bank",
            domain: "ENERGY",
            severity: "CRITICAL",
            status: "DEGRADED",
            impactDescription: `Usable capacity throttled by ${degPct}%`,
            metricValue: `${simKwh} kWh`,
          },
          {
            id: "node-grid",
            label: "Station Microgrid Bus",
            domain: "ENERGY",
            severity: "WARNING",
            status: "VOLATILE",
            impactDescription: "Grid harmonics and inductive startup vulnerability",
            metricValue: "THD +8%",
          }
        );

        blastLinks.push({
          source: targetBat?.assetId ?? "bat-1",
          target: "node-grid",
          dependencyType: "POWER",
          impactReason: "Battery unable to damp generator load surges",
        });

        recoveryActions.push(
          "Activate auxiliary battery thermal management blankets to raise cell core temp above +10°C.",
          "Derate cyclic peak equipment loads and maintain continuous spinning reserve on diesel generators."
        );
        recoveryMinutes = 45;
        break;
      }

      case "FUEL_SHORTAGE": {
        title = "Polar Diesel Storage Depletion & Resupply Crisis";
        const lossLiters = params.fuelLossLiters ?? 75000;
        const currentQty = isMaitri ? 118500 : 152000;
        const simQty = Math.max(10000, currentQty - lossLiters);
        const dailyBurn = 680.0;
        const simRunwayDays = Number((simQty / dailyBurn).toFixed(1));
        const baseRunwayDays = Number((currentQty / dailyBurn).toFixed(1));

        scenarioState.logistics.daysOfFuelRemaining = Math.round(simRunwayDays);

        riskScore = 88;
        riskLevel = "CRITICAL";
        riskFactors.push(
          `Polar fuel reserve depleted from ${currentQty} L to ${simQty} L (-${lossLiters} L)`,
          `Runway shortened to ${simRunwayDays} days (critical winter threshold: 45 days)`,
          "Resupply urgency escalated to EMERGENCY"
        );

        explanation =
          `Major Polar Diesel fuel loss of ${lossLiters.toLocaleString()} Liters plunges station fuel reserves from ` +
          `${baseRunwayDays} days to ${simRunwayDays} days. This breaches the mandatory 45-day winter survival buffer, ` +
          `endangering station survival through the 6-month Antarctic polar night before next summer ship access.`;

        comparisons.push(
          {
            metric: "Bulk Polar Fuel Reserve",
            unit: "Liters",
            baseline: currentQty,
            scenario: simQty,
            absoluteChange: `-${lossLiters.toLocaleString()} L`,
            percentageChange: `-${Math.round((lossLiters / currentQty) * 100)}%`,
            severity: "CRITICAL",
            reason: "Major tank breach or catastrophic transfer leak",
          },
          {
            metric: "Polar Fuel Runway",
            unit: "Days",
            baseline: `${baseRunwayDays} Days`,
            scenario: `${simRunwayDays} Days`,
            absoluteChange: `-${(baseRunwayDays - simRunwayDays).toFixed(1)} Days`,
            percentageChange: `-${Math.round(((baseRunwayDays - simRunwayDays) / baseRunwayDays) * 100)}%`,
            severity: "CRITICAL",
            reason: "Depletion breaches winter survival reserve threshold",
          },
          {
            metric: "Resupply Urgency",
            unit: "Level",
            baseline: "ATTENTION",
            scenario: "EMERGENCY",
            absoluteChange: "ESCALATION",
            percentageChange: "N/A",
            severity: "CRITICAL",
            reason: "Immediate external logistical intervention required",
          }
        );

        blastNodes.push(
          {
            id: "node-fuel",
            label: "Main Fuel Storage Tankage",
            domain: "LOGISTICS",
            severity: "CRITICAL",
            status: "DEPLETED",
            impactDescription: `Reserve dropped to ${simQty.toLocaleString()} L`,
            metricValue: `${simRunwayDays} Days`,
          },
          {
            id: "node-gens",
            label: "Diesel Power Plant",
            domain: "INFRASTRUCTURE",
            severity: "WARNING",
            status: "RATIONED",
            impactDescription: "Fuel feed throttled to conserve critical runway",
            metricValue: "-30% Burn",
          },
          {
            id: "node-habitat",
            label: "Station Habitat Complex",
            domain: "LIFE_SUPPORT",
            severity: "WARNING",
            status: "CONSERVATION",
            impactDescription: "Non-essential module heating curtailed",
            metricValue: "+12°C Setpoint",
          }
        );

        blastLinks.push(
          {
            source: "node-fuel",
            target: "node-gens",
            dependencyType: "FUEL",
            impactReason: "Diminishing fuel supply forces generator throttle and load rationing",
          },
          {
            source: "node-gens",
            target: "node-habitat",
            dependencyType: "THERMAL",
            impactReason: "Reduced thermal output lowers ambient building setpoint to save liters",
          }
        );

        recoveryActions.push(
          "Initiate Level-2 Polar Fuel Emergency Conservation Protocol.",
          "Consolidate station crew into core insulated habitat module; shut down auxiliary labs.",
          "Request emergency winter air-drop or overland traverse resupply."
        );
        recoveryMinutes = 60;
        break;
      }

      case "EXTREME_COLD": {
        title = "Antarctic Polar Chill Extreme (-45°C) & Thermal Overload";
        const simTemp = params.ambientTempC ?? -45.0;
        const baseTemp = baselineSnapshot.environment.ambientTempC;
        const tempDelta = Math.abs(simTemp - baseTemp);

        scenarioState.environment.ambientTempC = simTemp;
        scenarioState.environment.condition = "EXTREME_COLD";

        // Higher electrical load from heating
        const baseLoadKw = baselineSnapshot.energy.totalLoadKw;
        const extraHeatingKw = Math.round(tempDelta * 1.5);
        const simLoadKw = Math.round((baseLoadKw + extraHeatingKw) * 10) / 10;
        const singleGenCap = isMaitri ? 125.0 : 100.0;
        const loadFactorPct = Math.round((simLoadKw / singleGenCap) * 100);

        scenarioState.energy.totalLoadKw = simLoadKw;
        scenarioState.energy.netPowerKw = Math.round((scenarioState.energy.totalGenerationKw - simLoadKw) * 10) / 10;

        riskScore = 82;
        riskLevel = "HIGH";
        riskFactors.push(
          `Ambient temperature dropped to ${simTemp}°C (-${tempDelta.toFixed(1)}°C chill)`,
          `Station heating demand surged by +${extraHeatingKw} kW to ${simLoadKw} kW`,
          `Primary generator operating at ${loadFactorPct}% load factor (overload risk)`
        );

        explanation =
          `Severe polar cold snap drops ambient temperature from ${baseTemp}°C to ${simTemp}°C. ` +
          `Building envelope thermal conductivity increases by 180%, auto-triggering HVAC trace heating and boilers ` +
          `which adds +${extraHeatingKw} kW of electrical demand. Total load reaches ${simLoadKw} kW (${loadFactorPct}% capacity), ` +
          `approaching single-generator trip thresholds.`;

        comparisons.push(
          {
            metric: "Ambient Temperature",
            unit: "°C",
            baseline: `${baseTemp}°C`,
            scenario: `${simTemp}°C`,
            absoluteChange: `-${tempDelta.toFixed(1)}°C`,
            percentageChange: `-${Math.round((tempDelta / Math.abs(baseTemp)) * 100)}%`,
            severity: "CRITICAL",
            reason: "Severe polar cold front and katabatic wind chill",
          },
          {
            metric: "Station Electrical Load",
            unit: "kW",
            baseline: `${baseLoadKw} kW`,
            scenario: `${simLoadKw} kW`,
            absoluteChange: `+${extraHeatingKw} kW`,
            percentageChange: `+${Math.round((extraHeatingKw / baseLoadKw) * 100)}%`,
            severity: "CRITICAL",
            reason: "Trace heating auto-triggered to prevent pipeline and habitat freeze",
          },
          {
            metric: "Primary Generator Load Factor",
            unit: "%",
            baseline: `${Math.round((baseLoadKw / singleGenCap) * 100)}%`,
            scenario: `${loadFactorPct}%`,
            absoluteChange: `+${loadFactorPct - Math.round((baseLoadKw / singleGenCap) * 100)}%`,
            percentageChange: `+${Math.round(((loadFactorPct - Math.round((baseLoadKw / singleGenCap) * 100)) / Math.round((baseLoadKw / singleGenCap) * 100)) * 100)}%`,
            severity: loadFactorPct > 100 ? "CRITICAL" : "WARNING",
            reason: "Approaching generator maximum continuous rating",
          }
        );

        blastNodes.push(
          {
            id: "node-env",
            label: "Antarctic Environment",
            domain: "ENVIRONMENT",
            severity: "CRITICAL",
            status: "EXTREME COLD",
            impactDescription: `Severe chill: ${simTemp}°C`,
            metricValue: `${simTemp}°C`,
          },
          {
            id: "node-hvac",
            label: "HVAC Thermal Boilers",
            domain: "LIFE_SUPPORT",
            severity: "WARNING",
            status: "PEAK LOAD",
            impactDescription: `Drawing +${extraHeatingKw} kW thermal heating power`,
            metricValue: `+${extraHeatingKw} kW`,
          },
          {
            id: "node-gen",
            label: "Primary Generator",
            domain: "INFRASTRUCTURE",
            severity: loadFactorPct > 100 ? "CRITICAL" : "WARNING",
            status: "OVERLOAD RISK",
            impactDescription: `Load factor surging at ${loadFactorPct}%`,
            metricValue: `${loadFactorPct}% Load`,
          }
        );

        blastLinks.push(
          {
            source: "node-env",
            target: "node-hvac",
            dependencyType: "THERMAL",
            impactReason: "Harsh cold increases building heat conduction",
          },
          {
            source: "node-hvac",
            target: "node-gen",
            dependencyType: "POWER",
            impactReason: "Heating boilers draw peak current from generator bus",
          }
        );

        recoveryActions.push(
          "Prime and synchronize Standby Generator 2 to split grid electrical load.",
          "Inspect Priyadarshini water pipeline trace heating circuit amperages."
        );
        recoveryMinutes = 20;
        break;
      }

      case "HIGH_WIND": {
        title = "Category 5 Polar Blizzard Gale (>48 m/s) & Renewable Lockout";
        const simWind = params.windSpeedMs ?? 48.0;
        const baseWind = baselineSnapshot.environment.windSpeedMs;

        scenarioState.environment.windSpeedMs = simWind;
        scenarioState.environment.condition = "BLIZZARD";

        // Wind turbine mechanical storm lock
        const windTurbine = scenarioState.assets.find(
          (a) =>
            a.type === ("WIND_TURBINE" as any) ||
            a.name.toLowerCase().includes("wind") ||
            a.assetId.toLowerCase().includes("wnd")
        );
        if (windTurbine) {
          windTurbine.status = "MAINTENANCE";
          windTurbine.healthScore = 50;
          if (windTurbine.currentTelemetry.power_output_kw) {
            windTurbine.currentTelemetry.power_output_kw.value = 0;
          }
          impactedAssets.push({
            assetId: windTurbine.assetId,
            assetName: windTurbine.name,
            assetType: windTurbine.type,
            baselineStatus: "OPERATIONAL",
            simulatedStatus: "MAINTENANCE",
            baselineHealth: 88,
            simulatedHealth: 50,
            failureCause: "Emergency aerodynamic feathering and mechanical disk brake engagement",
            criticality: windTurbine.criticality,
          });
        }

        // Solar PV blinded by blowing snow
        const solar = scenarioState.assets.find(
          (a) =>
            a.type === "SOLAR" ||
            a.type === ("SOLAR_ARRAY" as any) ||
            a.name.toLowerCase().includes("solar") ||
            a.assetId.toLowerCase().includes("sol")
        );
        if (solar) {
          solar.status = "DEGRADED";
          solar.healthScore = 40;
          impactedAssets.push({
            assetId: solar.assetId,
            assetName: solar.name,
            assetType: solar.type,
            baselineStatus: "OPERATIONAL",
            simulatedStatus: "DEGRADED",
            baselineHealth: 92,
            simulatedHealth: 40,
            failureCause: "Solar panels obscured under blowing snow drifts; 0 kW generation",
            criticality: solar.criticality,
          });
        }

        riskScore = 78;
        riskLevel = "HIGH";
        riskFactors.push(
          `Blizzard wind speeds reached ${simWind} m/s (${Math.round(simWind * 3.6)} km/h)`,
          "Renewable generation lockout: wind turbine feathered & solar panels blinded",
          "Station exterior personnel movements locked down under Red Storm Alert"
        );

        explanation =
          `Category 5 Antarctic blizzard winds of ${simWind} m/s trigger automated turbine blade feathering ` +
          `and mechanical storm braking to prevent structural mast collapse. Blowing snow drifts reduce solar irradiance ` +
          `to zero, shifting 100% of station power generation to diesel generators. Outside maintenance is barred.`;

        comparisons.push(
          {
            metric: "Wind Speed",
            unit: "m/s",
            baseline: `${baseWind} m/s`,
            scenario: `${simWind} m/s`,
            absoluteChange: `+${(simWind - baseWind).toFixed(1)} m/s`,
            percentageChange: `+${Math.round(((simWind - baseWind) / Math.max(1, baseWind)) * 100)}%`,
            severity: "CRITICAL",
            reason: "Severe polar katabatic blizzard gale",
          },
          {
            metric: "Renewable Generation Share",
            unit: "kW",
            baseline: "22.5 kW",
            scenario: "0.0 kW",
            absoluteChange: "-22.5 kW",
            percentageChange: "-100%",
            severity: "CRITICAL",
            reason: "Turbines locked out for safety; solar arrays covered in snow",
          },
          {
            metric: "Outside Access Status",
            unit: "Safety",
            baseline: "PERMITTED",
            scenario: "RED LOCKDOWN",
            absoluteChange: "BARRED",
            percentageChange: "N/A",
            severity: "CRITICAL",
            reason: "Extreme wind chill and zero-visibility whiteout",
          }
        );

        blastNodes.push(
          {
            id: "node-env",
            label: "Antarctic Gale Front",
            domain: "ENVIRONMENT",
            severity: "CRITICAL",
            status: "BLIZZARD",
            impactDescription: `Gale wind speed: ${simWind} m/s (${Math.round(simWind * 3.6)} km/h)`,
            metricValue: `${simWind} m/s`,
          },
          {
            id: windTurbine?.assetId ?? "wnd-1",
            label: "Wind Turbine",
            domain: "ENERGY",
            severity: "WARNING",
            status: "FEATHERED",
            impactDescription: "Storm brake engaged; 0 kW generation",
            metricValue: "0 kW",
          },
          {
            id: "node-gens",
            label: "Diesel Generators",
            domain: "INFRASTRUCTURE",
            severity: "WARNING",
            status: "SOLE PROVIDER",
            impactDescription: "Carrying 100% station load without renewable buffer",
            metricValue: "100% Diesel",
          }
        );

        blastLinks.push(
          {
            source: "node-env",
            target: windTurbine?.assetId ?? "wnd-1",
            dependencyType: "MECHANICAL",
            impactReason: "Excessive wind force triggers protective mechanical cutoff",
          },
          {
            source: windTurbine?.assetId ?? "wnd-1",
            target: "node-gens",
            dependencyType: "POWER",
            impactReason: "Renewable drop shifts load to diesel generation",
          }
        );

        recoveryActions.push(
          "Enforce Station Red Lockdown; seal all habitat airlock doors.",
          "Monitor diesel generator air intake filters for snow ingestion.",
          "Await wind abatement below 25 m/s before releasing turbine mechanical brakes."
        );
        recoveryMinutes = 120;
        break;
      }

      case "LOAD_REDUCTION": {
        title = "Strategic Demand Response & Non-Critical Load Curtailment";
        const reductionPct = params.loadReductionPct ?? 30;
        const baseLoadKw = baselineSnapshot.energy.totalLoadKw;
        const baseGenKw = baselineSnapshot.energy.totalGenerationKw;
        const baseReserve = baselineSnapshot.energy.netPowerKw;

        const savedKw = Math.round(baseLoadKw * (reductionPct / 100) * 10) / 10;
        const simLoadKw = Math.round((baseLoadKw - savedKw) * 10) / 10;
        const simReserve = Math.round((baseGenKw - simLoadKw) * 10) / 10;

        scenarioState.energy.totalLoadKw = simLoadKw;
        scenarioState.energy.netPowerKw = simReserve;

        riskScore = 10;
        riskLevel = "LOW";
        riskFactors.push(
          `Demand reduction protocol curtailed ${savedKw} kW of non-essential loads (-${reductionPct}%)`,
          `Net generation reserve margin expanded to +${simReserve} kW`,
          "Diesel fuel burn rate reduced by ~170 L/day, extending winter runway"
        );

        explanation =
          `Strategic ${reductionPct}% demand response curtails auxiliary science rock-cutting saws, ` +
          `soil analysis incubators, and secondary vehicle bay heaters. Grid load drops by ${savedKw} kW, expanding ` +
          `generation headroom to +${simReserve} kW and extending polar fuel runway by an estimated +36 days.`;

        comparisons.push(
          {
            metric: "Station Electrical Load",
            unit: "kW",
            baseline: `${baseLoadKw} kW`,
            scenario: `${simLoadKw} kW`,
            absoluteChange: `-${savedKw} kW`,
            percentageChange: `-${reductionPct}%`,
            severity: "IMPROVEMENT",
            reason: "Non-critical loads severed per emergency shedding schedule",
          },
          {
            metric: "Net Generation Reserve Margin",
            unit: "kW",
            baseline: `${baseReserve} kW`,
            scenario: `${simReserve} kW`,
            absoluteChange: `+${savedKw} kW`,
            percentageChange: `+${Math.round((savedKw / Math.max(1, Math.abs(baseReserve))) * 100)}%`,
            severity: "IMPROVEMENT",
            reason: "Lower load expands available power reserve headroom",
          },
          {
            metric: "Daily Diesel Burn Rate",
            unit: "L/day",
            baseline: "680 L/day",
            scenario: "510 L/day",
            absoluteChange: "-170 L/day",
            percentageChange: "-25%",
            severity: "IMPROVEMENT",
            reason: "Lower electrical load reduces generator fuel consumption curve",
          },
          {
            metric: "Overall Station Risk Score",
            unit: "/100",
            baseline: "35 (MED)",
            scenario: "10 (LOW)",
            absoluteChange: "-25 pts",
            percentageChange: "-71%",
            severity: "IMPROVEMENT",
            reason: "Generators operating in optimal stress-free regime",
          }
        );

        blastNodes.push(
          {
            id: "node-curtail",
            label: "Load Shed Controller",
            domain: "OPERATIONS",
            severity: "NORMAL",
            status: "ACTIVE",
            impactDescription: `Curtailed ${savedKw} kW non-essential science load`,
            metricValue: `-${savedKw} kW`,
          },
          {
            id: "node-grid",
            label: "Microgrid Reserve",
            domain: "ENERGY",
            severity: "NORMAL",
            status: "OPTIMAL",
            impactDescription: `Headroom expanded to +${simReserve} kW`,
            metricValue: `+${simReserve} kW`,
          }
        );

        blastLinks.push({
          source: "node-curtail",
          target: "node-grid",
          dependencyType: "POWER",
          impactReason: "Load shed expands generator spinning reserve",
        });

        recoveryActions.push(
          "Maintain current curtailed state for 48 hours to accumulate fuel reserve margin.",
          "Restore science laboratory equipment sequentially during daytime solar generation peaks."
        );
        recoveryMinutes = 10;
        break;
      }

      case "BACKUP_GEN_ACTIVATION": {
        title = "Standby Diesel Generator Auto-Start & Grid Synchronization";
        const standbyGen = scenarioState.assets.find(
          (a) => a.assetId.includes("gen-2") || a.name.toLowerCase().includes("standby")
        );

        if (standbyGen) {
          standbyGen.status = "OPERATIONAL";
          standbyGen.healthScore = 95;
          if (standbyGen.currentTelemetry.power_output_kw) {
            standbyGen.currentTelemetry.power_output_kw.value = 65.0;
          }
          impactedAssets.push({
            assetId: standbyGen.assetId,
            assetName: standbyGen.name,
            assetType: standbyGen.type,
            baselineStatus: "STANDBY",
            simulatedStatus: "OPERATIONAL",
            baselineHealth: 85,
            simulatedHealth: 95,
            failureCause: "Autonomous start-up and parallel bus synchronization",
            criticality: standbyGen.criticality,
          });
        }

        const baseGen = baselineSnapshot.energy.totalGenerationKw;
        const simGen = baseGen + (isMaitri ? 125 : 100);
        scenarioState.energy.totalGenerationKw = simGen;
        scenarioState.energy.netPowerKw = Math.round((simGen - scenarioState.energy.totalLoadKw) * 10) / 10;

        riskScore = 12;
        riskLevel = "LOW";
        riskFactors.push(
          "Standby generator synchronized to primary bus; total capacity doubled to 250 kW",
          "Single-point failure vulnerability completely mitigated"
        );

        explanation =
          `Standby generator ${standbyGen?.assetId ?? "GEN-02"} successfully synchronizes to the main station switchboard. ` +
          `Total installed online capacity doubles to 250 kW, reducing individual engine load factors to ~38% ` +
          `and guaranteeing uninterrupted life-support redundancy.`;

        comparisons.push(
          {
            metric: "Online Generating Capacity",
            unit: "kW",
            baseline: `${baseGen} kW`,
            scenario: `${simGen} kW`,
            absoluteChange: `+${simGen - baseGen} kW`,
            percentageChange: `+${Math.round(((simGen - baseGen) / baseGen) * 100)}%`,
            severity: "IMPROVEMENT",
            reason: "Dual generator parallel bus operation active",
          },
          {
            metric: "Net Generation Reserve Margin",
            unit: "kW",
            baseline: `${baselineSnapshot.energy.netPowerKw} kW`,
            scenario: `${scenarioState.energy.netPowerKw} kW`,
            absoluteChange: `+${simGen - baseGen} kW`,
            percentageChange: "+148%",
            severity: "IMPROVEMENT",
            reason: "Substantial reserve buffer secured against sudden load surges",
          },
          {
            metric: "Engine Thermal Stress",
            unit: "Status",
            baseline: "HIGH (Single Gen)",
            scenario: "BALANCED (Dual Gen)",
            absoluteChange: "DERATED",
            percentageChange: "-50%",
            severity: "IMPROVEMENT",
            reason: "Load evenly shared across both alternator engines",
          }
        );

        blastNodes.push(
          {
            id: standbyGen?.assetId ?? "gen-2",
            label: "GEN-02 Standby Generator",
            domain: "INFRASTRUCTURE",
            severity: "NORMAL",
            status: "SYNCHRONIZED",
            impactDescription: "Online and load-sharing at 50/50 ratio",
            metricValue: "65 kW",
          },
          {
            id: "node-grid",
            label: "Station Microgrid Switchboard",
            domain: "ENERGY",
            severity: "NORMAL",
            status: "REDUNDANT",
            impactDescription: "Dual-source N+1 electrical redundancy secured",
            metricValue: "250 kW Headroom",
          }
        );

        blastLinks.push({
          source: standbyGen?.assetId ?? "gen-2",
          target: "node-grid",
          dependencyType: "POWER",
          impactReason: "Synchronous alternator injects power into station ring main",
        });

        recoveryActions.push(
          "Verify governor frequency droop matching at 50.0 Hz.",
          "Check engine coolant operating temperatures for balanced thermal equilibrium."
        );
        recoveryMinutes = 15;
        break;
      }

      case "COMMUNICATION_OUTAGE": {
        title = "Polar Satellite Link Blackout & Edge Store-and-Forward Buffering";
        const commAsset = scenarioState.assets.find((a) => a.type === "COMMUNICATION");

        if (commAsset) {
          commAsset.status = "OFFLINE";
          commAsset.healthScore = 20;
          if (commAsset.currentTelemetry.snr_db) {
            commAsset.currentTelemetry.snr_db.value = 0;
            commAsset.currentTelemetry.snr_db.quality = "BAD";
          }
          if (commAsset.currentTelemetry.packet_loss_pct) {
            commAsset.currentTelemetry.packet_loss_pct.value = 100;
          }
          impactedAssets.push({
            assetId: commAsset.assetId,
            assetName: commAsset.name,
            assetType: commAsset.type,
            baselineStatus: "OPERATIONAL",
            simulatedStatus: "OFFLINE",
            baselineHealth: 94,
            simulatedHealth: 20,
            failureCause: "Severe geomagnetic storm / transponder link fade",
            criticality: commAsset.criticality,
          });
        }

        scenarioState.connectivityState = "OFFLINE";
        scenarioState.dataFreshness.status = "STALE";

        riskScore = 65;
        riskLevel = "MEDIUM";
        riskFactors.push(
          "Polar satellite transponder lost; 100% packet loss to mainland HQ",
          "Station transitioned to local edge autonomous store-and-forward mode",
          "Buffer accumulating ~1,200 telemetry packets/hour in SSD queue"
        );

        explanation =
          `Severe space weather geomagnetic disturbance causes 100% satellite signal degradation on ` +
          `${commAsset?.assetId ?? "satellite radome"}. Station edge resilience layer autonomously isolates MQTT routing ` +
          `and activates non-volatile SSD store-and-forward queuing, guaranteeing zero telemetry loss while mainland link is severed.`;

        comparisons.push(
          {
            metric: "Station Connectivity State",
            unit: "State",
            baseline: baselineSnapshot.connectivityState,
            scenario: "OFFLINE",
            absoluteChange: "SEVERED",
            percentageChange: "N/A",
            severity: "CRITICAL",
            reason: "Antarctic station isolated; telemetry buffered at edge",
          },
          {
            metric: "Satellite Signal-to-Noise Ratio (SNR)",
            unit: "dB",
            baseline: "14.2 dB",
            scenario: "0.0 dB",
            absoluteChange: "-14.2 dB",
            percentageChange: "-100%",
            severity: "CRITICAL",
            reason: "Geomagnetic blackout attenuates polar satellite transponder",
          },
          {
            metric: "Satellite Link Packet Loss",
            unit: "%",
            baseline: "0.0%",
            scenario: "100.0%",
            absoluteChange: "+100%",
            percentageChange: "+100%",
            severity: "CRITICAL",
            reason: "Complete radio blackout to National Polar Data Center",
          },
          {
            metric: "Edge Store-and-Forward Buffer",
            unit: "Status",
            baseline: "STANDBY (0 pkts)",
            scenario: "ACCUMULATING (1,200/hr)",
            absoluteChange: "+1,200 pkts/hr",
            percentageChange: "N/A",
            severity: "WARNING",
            reason: "Local SSD spooling active to prevent data loss",
          }
        );

        blastNodes.push(
          {
            id: commAsset?.assetId ?? "comm-1",
            label: "Polar Satellite Radome",
            domain: "COMMS",
            severity: "CRITICAL",
            status: "BLACKOUT",
            impactDescription: "0 dB SNR; link completely severed",
            metricValue: "100% Loss",
          },
          {
            id: "node-edge",
            label: "Station Edge SSD Buffer",
            domain: "INFRASTRUCTURE",
            severity: "WARNING",
            status: "BUFFERING",
            impactDescription: "Queuing packets for automated recovery batch replay",
            metricValue: "Spooling",
          }
        );

        blastLinks.push({
          source: commAsset?.assetId ?? "comm-1",
          target: "node-edge",
          dependencyType: "DATA",
          impactReason: "Outage reroutes live MQTT stream into local storage buffer",
        });

        recoveryActions.push(
          "Verify edge TimescaleDB local ingestion and SSD buffer volume free space.",
          "Prepare automated batch replay synchronization upon satellite signal acquisition."
        );
        recoveryMinutes = 30;
        break;
      }
    }

    // Update overall simulated operational risk
    scenarioState.operationalRisk = {
      score: riskScore,
      level: riskLevel,
      factors: riskFactors,
    };

    // ── 3. Assemble and Persist Immutable Simulation Result ──────
    const result: ResilienceSimulationResult = {
      simulationId,
      stationId,
      scenarioType,
      title,
      label: "SIMULATION",
      modelVersion: this.modelVersion,
      deterministicSeed,
      createdAt: nowIso,
      snapshotTimestamp: baselineSnapshot.timestamp,
      parameters: params,
      baselineSnapshot,
      scenarioState,
      explanation,
      impactedAssets,
      blastRadius: {
        nodes: blastNodes,
        links: blastLinks,
      },
      comparisons,
      operationalRisk: {
        score: riskScore,
        level: riskLevel,
        factors: riskFactors,
      },
      recoveryState: {
        suggestedActions: recoveryActions,
        estimatedRecoveryMinutes: recoveryMinutes,
      },
    };

    // Save to in-memory history store
    simulationStore.save(result);

    return result;
  }
}

export const resilienceEngine = new ResilienceSimulationEngine();
