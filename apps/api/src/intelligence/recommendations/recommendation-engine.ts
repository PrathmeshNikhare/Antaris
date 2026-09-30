import type {
  AdvisoryRecommendation,
  AnomalyResult,
  CrossDomainRiskAssessment,
  AssetHealthScore,
  TwinState,
} from "@maitri-bharati/shared";

export class RecommendationEngine {
  /**
   * Generates structured, advisory operational recommendations based on active intelligence.
   */
  public generate(
    stationId: string,
    activeAnomalies: AnomalyResult[] = [],
    riskAssessment?: CrossDomainRiskAssessment,
    healthScores: AssetHealthScore[] = [],
    currentTwinState?: Partial<TwinState>,
    referenceTime: Date = new Date()
  ): AdvisoryRecommendation[] {
    const isMaitri = stationId.toLowerCase().includes("maitri");
    const recs: AdvisoryRecommendation[] = [];
    const nowIso = referenceTime.toISOString();
    let idCounter = 1;

    // 1. Generator Overheat / Degradation Anomaly -> Inspect Asset & Check Spares
    const genAnom = activeAnomalies.find(
      (a) => (a.assetId.includes("gen") || a.metric.includes("coolant") || a.metric.includes("temp")) && a.isAnomaly
    );

    if (genAnom) {
      recs.push({
        id: `rec-${stationId}-${idCounter++}`,
        stationId,
        title: `Inspect Primary Generator Cooling Radiator & Thermostat`,
        description: `Visual inspection of cooling circuit, glycol coolant concentration, and radiator airflow recommended due to thermal elevation on ${genAnom.assetId}.`,
        domain: "MAINTENANCE",
        priority: genAnom.severity === "CRITICAL" ? "CRITICAL" : "HIGH",
        suggestedAction: "INSPECT_ASSET",
        targetAssetId: genAnom.assetId,
        isAdvisory: true,
        rationale: genAnom.evidence?.humanReadable || "Generator temperature deviation from baseline",
        createdTimestamp: nowIso,
      });

      recs.push({
        id: `rec-${stationId}-${idCounter++}`,
        stationId,
        title: `Verify Replacement Coolant Pumps & Glycol Stores`,
        description: `Check Polar Store inventory for 50/50 ethylene glycol drums and standby impeller pump kits.`,
        domain: "LOGISTICS",
        priority: "MEDIUM",
        suggestedAction: "CHECK_SPARES",
        isAdvisory: true,
        rationale: "Mitigates supply chain disruption if generator requires coolant subsystem overhaul",
        createdTimestamp: nowIso,
      });
    }

    // 2. High Operational Risk -> Run What-If Simulation
    if (riskAssessment && (riskAssessment.overallLevel === "HIGH" || riskAssessment.overallLevel === "CRITICAL")) {
      recs.push({
        id: `rec-${stationId}-${idCounter++}`,
        stationId,
        title: `Run Generator Trip & Emergency Load Shedding Simulation`,
        description: `Simulate full trip of primary generator under current Antarctic load to verify backup auto-transfer and battery discharge duration.`,
        domain: "OPERATIONS",
        priority: "HIGH",
        suggestedAction: "RUN_SIMULATION",
        isAdvisory: true,
        rationale: `Cross-domain risk score elevated to ${riskAssessment.overallRiskScore}/100. Verifies station resilience prior to physical failure.`,
        createdTimestamp: nowIso,
      });
    }

    // 3. High Electrical Load / Cold Extreme -> Reduce Non-Critical Load
    const gridLoadPct = currentTwinState?.energy
      ? (currentTwinState.energy.totalLoadKw / (isMaitri ? 125 : 200)) * 100
      : 50;

    if (gridLoadPct > 75 || (riskAssessment?.overallRiskScore ?? 0) > 40) {
      recs.push({
        id: `rec-${stationId}-${idCounter++}`,
        stationId,
        title: `Shed Non-Critical Science & Auxiliary Laboratory Load`,
        description: `Curtail non-essential rock cutting saw and secondary soil analysis incubator heaters (estimated 12 kW reduction).`,
        domain: "ENERGY",
        priority: "MEDIUM",
        suggestedAction: "REDUCE_LOAD",
        isAdvisory: true,
        rationale: "Protects generation headroom and mitigates accelerated diesel fuel consumption",
        createdTimestamp: nowIso,
      });
    }

    // 4. Stale or Degraded Assets -> Monitor Trend
    const degradedAsset = healthScores.find((h) => h.overallScore < 60);
    if (degradedAsset) {
      recs.push({
        id: `rec-${stationId}-${idCounter++}`,
        stationId,
        title: `Monitor Health Trend for ${degradedAsset.assetName}`,
        description: `Place ${degradedAsset.assetId} on 5-minute sampling telemetry watch due to composite health score of ${degradedAsset.overallScore}/100.`,
        domain: "OPERATIONS",
        priority: "MEDIUM",
        suggestedAction: "MONITOR_TREND",
        targetAssetId: degradedAsset.assetId,
        isAdvisory: true,
        rationale: degradedAsset.factors.join("; "),
        createdTimestamp: nowIso,
      });
    }

    // 5. Default Routine Advisory if Everything is Nominal
    if (recs.length === 0) {
      recs.push({
        id: `rec-${stationId}-${idCounter++}`,
        stationId,
        title: `Maintain Routine Station Polar Watch`,
        description: `All power, environmental, logistics, and life support parameters are operating within established Antarctic baseline envelopes.`,
        domain: "OPERATIONS",
        priority: "LOW",
        suggestedAction: "MONITOR_TREND",
        isAdvisory: true,
        rationale: "Baseline diurnal telemetry stability verified across all asset domains",
        createdTimestamp: nowIso,
      });
    }

    return recs;
  }
}
