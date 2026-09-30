import type {
  AssetHealthScore,
  TwinAssetState,
  AnomalyResult,
  AssetStatus,
} from "@maitri-bharati/shared";

export class AssetHealthEvaluator {
  private readonly disclaimer =
    "Decision-support indicator, not a guaranteed failure probability";

  /**
   * Computes an explainable asset health score (0 - 100) with penalty breakdown.
   */
  public evaluate(
    asset: TwinAssetState,
    activeAnomalies: AnomalyResult[] = [],
    evaluatedAt: string = new Date().toISOString()
  ): AssetHealthScore {
    let telemetryPenalty = 0;
    let anomalyPenalty = 0;
    let runtimePenalty = 0;
    let maintenancePenalty = 0;
    let stressPenalty = 0;
    let dataConfidencePenalty = 0;
    const factors: string[] = [];

    // 1. Telemetry Deviation Penalty (up to 25 pts)
    const telemetryEntries = Object.entries(asset.currentTelemetry || {});
    for (const [metric, prop] of telemetryEntries) {
      if (prop.quality === "BAD") {
        telemetryPenalty += 10;
        factors.push(`Bad telemetry quality on metric ${metric} (-10 pts)`);
      } else if (prop.quality === "SUSPECT") {
        telemetryPenalty += 5;
        factors.push(`Suspect telemetry reading on metric ${metric} (-5 pts)`);
      }

      // Check for elevated temperatures or vibrations
      if (metric.includes("temperature") && prop.value > 85.0) {
        const extra = Math.min(15, Math.round((prop.value - 85.0) * 1.5));
        telemetryPenalty += extra;
        factors.push(`Elevated operating temperature ${prop.value}°C (-${extra} pts)`);
      } else if (metric.includes("vibration") && prop.value > 4.5) {
        const extra = Math.min(15, Math.round((prop.value - 4.5) * 4));
        telemetryPenalty += extra;
        factors.push(`High vibration reading ${prop.value} mm/s (-${extra} pts)`);
      }
    }
    telemetryPenalty = Math.min(25, telemetryPenalty);

    // 2. Anomaly History Penalty (up to 30 pts)
    const relatedAnomalies = activeAnomalies.filter(
      (a) => a.assetId === asset.assetId || a.assetId === asset.name
    );
    for (const anom of relatedAnomalies) {
      if (anom.severity === "CRITICAL") {
        anomalyPenalty += 20;
        factors.push(`Active CRITICAL anomaly on ${anom.metric} (score ${anom.score}) (-20 pts)`);
      } else if (anom.severity === "WARNING") {
        anomalyPenalty += 10;
        factors.push(`Active WARNING anomaly on ${anom.metric} (score ${anom.score}) (-10 pts)`);
      }
    }
    anomalyPenalty = Math.min(30, anomalyPenalty);

    // 3. Maintenance Age & Status Penalty (up to 15 pts)
    if (asset.maintenanceState?.inMaintenance) {
      maintenancePenalty += 15;
      factors.push("Asset is currently flagged under active maintenance (-15 pts)");
    } else if (asset.status === "MAINTENANCE") {
      maintenancePenalty += 12;
      factors.push("Asset status is MAINTENANCE (-12 pts)");
    } else {
      // Nominal routine maintenance deduction based on asset criticality
      if (asset.criticality === "CRITICAL") {
        maintenancePenalty += 2;
      }
    }

    // 4. Runtime & Operating Stress Penalty (up to 20 pts)
    if (asset.type === "GENERATOR") {
      // Simulate cumulative run stress
      stressPenalty += 4;
      factors.push("Continuous polar duty cycle runtime penalty (-4 pts)");
    } else if (asset.type === "BATTERY") {
      stressPenalty += 3;
      factors.push("Sub-zero cold charge/discharge cycle stress (-3 pts)");
    }

    // 5. Data Freshness & Confidence Penalty (up to 10 pts)
    if (asset.freshness?.status === "STALE") {
      dataConfidencePenalty += 8;
      factors.push(`Telemetry feed is STALE (age ${asset.freshness.ageSeconds}s) (-8 pts)`);
    } else if (asset.freshness?.status === "UNKNOWN") {
      dataConfidencePenalty += 10;
      factors.push("Telemetry feed status is UNKNOWN (-10 pts)");
    }

    const totalPenalties =
      telemetryPenalty +
      anomalyPenalty +
      runtimePenalty +
      maintenancePenalty +
      stressPenalty +
      dataConfidencePenalty;

    const overallScore = Math.max(0, Math.min(100, Math.round(100 - totalPenalties)));

    // Derive computed asset status if health degraded significantly
    let status: AssetStatus = asset.status;
    if (overallScore < 40 && status === "OPERATIONAL") {
      status = "DEGRADED";
    } else if (overallScore < 20 && status !== "OFFLINE") {
      status = "FAILED";
    }

    if (factors.length === 0) {
      factors.push("All operational parameters within nominal baseline limits");
    }

    return {
      assetId: asset.assetId,
      stationId: asset.stationId,
      assetName: asset.name,
      assetType: asset.type,
      overallScore,
      status,
      telemetryPenalty,
      anomalyPenalty,
      runtimePenalty,
      maintenancePenalty,
      stressPenalty,
      dataConfidencePenalty,
      factors,
      disclaimer: this.disclaimer,
      evaluatedAt,
    };
  }
}
