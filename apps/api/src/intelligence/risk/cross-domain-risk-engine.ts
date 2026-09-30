import type {
  CrossDomainRiskAssessment,
  CrossDomainCascade,
  CausalNode,
  CausalLink,
  AnomalyResult,
  TwinState,
} from "@maitri-bharati/shared";

export class CrossDomainRiskEngine {
  /**
   * Deterministically evaluates cross-domain cascading risks across:
   * Infrastructure -> Energy -> Environment -> Logistics
   */
  public evaluate(
    stationId: string,
    twinState?: Partial<TwinState>,
    activeAnomalies: AnomalyResult[] = [],
    evaluatedAt: string = new Date().toISOString()
  ): CrossDomainRiskAssessment {
    const isMaitri = stationId.toLowerCase().includes("maitri");
    const cascades: CrossDomainCascade[] = [];
    const contributingFactors: string[] = [];

    // Check for thermal / generator degradation anomalies (strictly thermal/coolant metrics)
    const genThermalAnom = activeAnomalies.find(
      (a) =>
        (a.assetId.includes("gen") || a.assetId.includes("chp")) &&
        (a.metric.includes("coolant") || a.metric.includes("temp") || a.metric.includes("thermal")) &&
        a.isAnomaly
    );

    // Check for power output / electrical derating anomalies
    const genPowerAnom = activeAnomalies.find(
      (a) =>
        (a.assetId.includes("gen") || a.assetId.includes("chp")) &&
        (a.metric.includes("power") || a.metric.includes("output") || a.metric.includes("load")) &&
        a.isAnomaly
    );

    // Check for fuel consumption / leak anomalies
    const fuelAnom = activeAnomalies.find(
      (a) => (a.metric.includes("fuel") || a.metric.includes("burn") || a.assetId.includes("tank")) && a.isAnomaly
    );

    // Check for environment extremes (high wind / extreme cold)
    const envCold = (twinState?.environment?.ambientTempC ?? -20) < -30;
    const envWind = (twinState?.environment?.windSpeedMs ?? 10) > 28;

    // Check for battery degradation
    const battAnom = activeAnomalies.find(
      (a) => a.assetId.includes("batt") && a.isAnomaly
    );

    // ────────────────────────────────────────────────────────────────
    // CASCADE 1: Generator Thermal Degradation -> Logistics Risk
    // ────────────────────────────────────────────────────────────────
    const cascade1Active = !!genThermalAnom || !!fuelAnom || !!genPowerAnom;
    const cascade1Severity =
      genThermalAnom?.severity === "CRITICAL" || fuelAnom?.severity === "CRITICAL"
        ? "CRITICAL"
        : cascade1Active
        ? "HIGH"
        : "LOW";

    const toNodeSeverity = (s: string | undefined): "NORMAL" | "WARNING" | "CRITICAL" => {
      if (s === "CRITICAL") return "CRITICAL";
      if (s === "WARNING" || s === "HIGH") return "WARNING";
      return "NORMAL";
    };

    const c1Nodes: CausalNode[] = [
      {
        id: "c1-node-1",
        domain: "INFRASTRUCTURE",
        label: isMaitri ? "GEN-01 Thermal Stress" : "DG-01 Thermal Stress",
        severity: genThermalAnom ? toNodeSeverity(genThermalAnom.severity || "WARNING") : "NORMAL",
        description: genThermalAnom
          ? genThermalAnom.evidence?.humanReadable || "Operating temperature exceeding normal bounds"
          : "Operating at nominal 82°C coolant temperature; thermal stress nominal",
        metricValue: genThermalAnom
          ? genThermalAnom.evidence?.deviationFromBaseline !== undefined
            ? `+${genThermalAnom.evidence.deviationFromBaseline.toFixed(1)}°C Δ`
            : "+18.2°C Δ"
          : "Nominal (82°C)",
      },
      {
        id: "c1-node-2",
        domain: "ENERGY",
        label: "Engine Efficiency Degradation",
        severity: genThermalAnom || genPowerAnom ? "WARNING" : fuelAnom ? "WARNING" : "NORMAL",
        description: genThermalAnom
          ? "Thermal expansion and fuel injector derating causing 14% thermodynamic loss"
          : genPowerAnom
          ? genPowerAnom.evidence?.humanReadable || "Generator output power derated from nominal rating"
          : fuelAnom
          ? "Fuel delivery flow irregularity detected in combustion line"
          : "Generator operating at 94.2% mechanical efficiency",
        metricValue: genThermalAnom
          ? "-14% Eff"
          : genPowerAnom
          ? "-5.6 kW"
          : fuelAnom
          ? "Fuel Unbalance"
          : "Optimal",
      },
      {
        id: "c1-node-3",
        domain: "ENERGY",
        label: "Specific Fuel Consumption Surge",
        severity: fuelAnom ? toNodeSeverity(fuelAnom.severity || "CRITICAL") : genThermalAnom ? "WARNING" : "NORMAL",
        description: fuelAnom
          ? fuelAnom.evidence?.humanReadable || "Fuel line burn rate spiked significantly above baseline"
          : genThermalAnom
          ? "Fuel burn elevated to 0.315 L/kWh (+22% above baseline 0.258 L/kWh due to thermal slip)"
          : "Fuel burn stable at 0.258 L/kWh",
        metricValue: fuelAnom
          ? fuelAnom.evidence?.deviationFromBaseline !== undefined
            ? `+${fuelAnom.evidence.deviationFromBaseline.toFixed(1)} L/h`
            : "+120% Burn Spike"
          : genThermalAnom
          ? "+22% Burn"
          : "0.258 L/kWh",
      },
      {
        id: "c1-node-4",
        domain: "LOGISTICS",
        label: "Fuel Reserve Runway Shortening",
        severity: cascade1Active ? toNodeSeverity(cascade1Severity) : "NORMAL",
        description: cascade1Active
          ? fuelAnom
            ? "Unscheduled fuel drain advances estimated tank depletion date by 32 days"
            : "Estimated fuel reserve depletion date advances by 18 days"
          : "Fuel reserve buffer matches scheduled annual resupply",
        metricValue: cascade1Active ? (fuelAnom ? "-32 Days" : "-18 Days") : "Stable",
      },
      {
        id: "c1-node-5",
        domain: "LOGISTICS",
        label: "Logistics Resupply Buffer Risk",
        severity: cascade1Active ? toNodeSeverity(cascade1Severity) : "NORMAL",
        description: cascade1Active
          ? "Reserve buffer drops below mandatory 45-day winter survival margin"
          : "Logistics margins healthy across all storage tanks",
        metricValue: cascade1Active ? "High Urgency" : "Low Risk",
      },
    ];

    const c1Links: CausalLink[] = [
      { source: "c1-node-1", target: "c1-node-2", impact: "High heat induces power derating & thermal slip" },
      { source: "c1-node-2", target: "c1-node-3", impact: "Reduced mechanical efficiency requires higher fuel mass injection" },
      { source: "c1-node-3", target: "c1-node-4", impact: "Increased burn accelerates storage tank depletion" },
      { source: "c1-node-4", target: "c1-node-5", impact: "Advanced depletion breaches winter ship resupply window" },
    ];

    cascades.push({
      id: "cascade-gen-degradation",
      title: fuelAnom && !genThermalAnom ? "Fuel Leak & Polar Logistics Depletion Cascade" : "Generator Thermal Degradation Cascade",
      triggerDomain: fuelAnom && !genThermalAnom ? "LOGISTICS" : "INFRASTRUCTURE",
      riskLevel: cascade1Severity,
      nodes: c1Nodes,
      links: c1Links,
      summary: cascade1Active
        ? fuelAnom && !genThermalAnom
          ? "Fuel line leak / consumption surge detected; rapidly shortening polar winter reserve runway."
          : "Generator overheat degrades fuel efficiency, triggering an accelerated logistics reserve depletion."
        : "Primary generation and fuel burn chains operating in optimal equilibrium.",
    });

    if (cascade1Active) {
      if (fuelAnom && !genThermalAnom) {
        contributingFactors.push("Active fuel consumption surge / leak directly draining polar reserves");
      } else {
        contributingFactors.push("Active generator thermal elevation propagating into accelerated fuel depletion");
      }
    }

    // ────────────────────────────────────────────────────────────────
    // CASCADE 2: Polar Blizzard / Cold Extreme -> Grid Overload
    // ────────────────────────────────────────────────────────────────
    const cascade2Active = envCold || envWind;
    const cascade2Severity = envCold && envWind ? "CRITICAL" : cascade2Active ? "HIGH" : "LOW";

    const c2Nodes: CausalNode[] = [
      {
        id: "c2-node-1",
        domain: "ENVIRONMENT",
        label: "Polar Blizzard / Cold Extreme",
        severity: cascade2Active ? (cascade2Severity === "CRITICAL" ? "CRITICAL" : "WARNING") : "NORMAL",
        description: cascade2Active
          ? `Extreme Antarctic weather: Temp ${twinState?.environment?.ambientTempC ?? -28}°C, Wind ${twinState?.environment?.windSpeedMs ?? 32} m/s`
          : "Weather conditions within safe operational envelope",
        metricValue: cascade2Active ? "-34°C / 31m/s" : "Nominal",
      },
      {
        id: "c2-node-2",
        domain: "INFRASTRUCTURE",
        label: "Habitat & Pipeline Heat Loss",
        severity: cascade2Active ? "WARNING" : "NORMAL",
        description: cascade2Active
          ? "Accelerated building envelope thermal dissipation; trace heating auto-triggered"
          : "Habitat interior temperature stable at +21°C",
        metricValue: cascade2Active ? "+16 kW Thermal" : "Optimal",
      },
      {
        id: "c2-node-3",
        domain: "ENERGY",
        label: "Grid Electrical Load Surge",
        severity: cascade2Active ? (cascade2Severity === "CRITICAL" ? "CRITICAL" : "WARNING") : "NORMAL",
        description: cascade2Active
          ? "Peak electrical demand surges to 88% of total primary generator capacity"
          : "Grid load steady at 48% load factor",
        metricValue: cascade2Active ? "88% Load" : "48% Load",
      },
      {
        id: "c2-node-4",
        domain: "INFRASTRUCTURE",
        label: "Backup Generator Auto-Dispatch",
        severity: cascade2Active ? "WARNING" : "NORMAL",
        description: cascade2Active
          ? "Standby generator auto-start primed to prevent single-point overload"
          : "Standby generator in cold standby ready state",
        metricValue: cascade2Active ? "Primed" : "Standby",
      },
    ];

    const c2Links: CausalLink[] = [
      { source: "c2-node-1", target: "c2-node-2", impact: "Harsh cold increases heat conduction across buildings & pipes" },
      { source: "c2-node-2", target: "c2-node-3", impact: "HVAC boilers & trace heaters draw peak power" },
      { source: "c2-node-3", target: "c2-node-4", impact: "Demand exceeds single-generator threshold, requiring dual-gen dispatch" },
    ];

    cascades.push({
      id: "cascade-weather-overload",
      title: "Environmental Blizzard & Grid Surge Cascade",
      triggerDomain: "ENVIRONMENT",
      riskLevel: cascade2Severity,
      nodes: c2Nodes,
      links: c2Links,
      summary: cascade2Active
        ? "Severe environmental chill forces peak heating draw, approaching generator reserve margins."
        : "Environmental heating balance nominal.",
    });

    if (cascade2Active) {
      contributingFactors.push("Harsh polar wind/cold inducing heavy electrical and thermal HVAC draw");
    }

    // ────────────────────────────────────────────────────────────────
    // Aggregate Overall Operational Risk Score (0 - 100)
    // ────────────────────────────────────────────────────────────────
    let overallRiskScore = 15; // baseline nominal risk
    if (cascade1Active) overallRiskScore += genThermalAnom?.severity === "CRITICAL" ? 45 : 25;
    if (cascade2Active) overallRiskScore += cascade2Severity === "CRITICAL" ? 35 : 20;
    if (battAnom) overallRiskScore += 15;

    overallRiskScore = Math.min(100, overallRiskScore);

    let overallLevel: CrossDomainRiskAssessment["overallLevel"] = "LOW";
    if (overallRiskScore >= 75) overallLevel = "CRITICAL";
    else if (overallRiskScore >= 50) overallLevel = "HIGH";
    else if (overallRiskScore >= 30) overallLevel = "MEDIUM";

    if (contributingFactors.length === 0) {
      contributingFactors.push("All cross-domain cascade paths stable under current telemetry envelope");
    }

    return {
      stationId,
      overallRiskScore,
      overallLevel,
      cascades,
      contributingFactors,
      generatedAt: evaluatedAt,
    };
  }
}
