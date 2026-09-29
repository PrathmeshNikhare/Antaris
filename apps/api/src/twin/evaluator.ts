import type {
  StationStatus,
  StationStatusAssessment,
  EnergyState,
  EnvironmentState,
  LogisticsState,
  OperationalRisk,
  TwinAssetState,
  Alert,
  ConnectivityState,
} from "@maitri-bharati/shared";

export class StationAggregateEvaluator {
  evaluateStationStatus(
    assets: TwinAssetState[],
    activeAlerts: Alert[],
    connectivityState: ConnectivityState
  ): StationStatusAssessment {
    const contributingAssets: string[] = [];
    const contributingAlerts: string[] = [];

    // 1. Check for critical alerts
    const criticalAlerts = activeAlerts.filter(
      (a) => a.severity === "CRITICAL" && a.status === "OPEN"
    );
    if (criticalAlerts.length > 0) {
      for (const a of criticalAlerts) {
        contributingAlerts.push(`${a.title} (${a.severity})`);
      }
    }

    // 2. Check for failed critical assets
    const failedCriticalAssets = assets.filter(
      (a) => (a.status === "FAILED" || a.status === "OFFLINE") && (a.criticality === "CRITICAL" || a.criticality === "HIGH")
    );
    if (failedCriticalAssets.length > 0) {
      for (const a of failedCriticalAssets) {
        contributingAssets.push(`${a.name} [${a.status}]`);
      }
    }

    if (criticalAlerts.length > 0 || failedCriticalAssets.length > 0) {
      return {
        currentState: "OFFLINE", // Or CRITICAL
        reason: `Critical failure condition: ${[...contributingAlerts, ...contributingAssets].join("; ")}`,
        contributingAssets,
        contributingAlerts,
      };
    }

    // 3. Check for warning alerts or degraded critical assets
    const warningAlerts = activeAlerts.filter(
      (a) => a.severity === "WARNING" && a.status === "OPEN"
    );
    if (warningAlerts.length > 0) {
      for (const a of warningAlerts) {
        contributingAlerts.push(`${a.title} (${a.severity})`);
      }
    }

    const degradedCriticalAssets = assets.filter(
      (a) => a.status === "DEGRADED" && (a.criticality === "CRITICAL" || a.criticality === "HIGH")
    );
    if (degradedCriticalAssets.length > 0) {
      for (const a of degradedCriticalAssets) {
        contributingAssets.push(`${a.name} [DEGRADED]`);
      }
    }

    if (warningAlerts.length > 0 || degradedCriticalAssets.length > 0) {
      return {
        currentState: "DEGRADED",
        reason: `Warning condition active: ${[...contributingAlerts, ...contributingAssets].join("; ")}`,
        contributingAssets,
        contributingAlerts,
      };
    }

    // 4. Check connectivity degradation
    if (connectivityState === "DEGRADED" || connectivityState === "OFFLINE") {
      return {
        currentState: "DEGRADED",
        reason: `Communications link degraded (${connectivityState})`,
        contributingAssets,
        contributingAlerts,
      };
    }

    // 5. Default healthy status
    return {
      currentState: "OPERATIONAL",
      reason: "All primary infrastructure operational and telemetry nominal",
      contributingAssets: [],
      contributingAlerts: [],
    };
  }

  evaluateEnergyState(assets: TwinAssetState[], timestamp = new Date().toISOString()): EnergyState {
    let totalGenerationKw = 0;
    let totalLoadKw = 95.0; // Nominal station default
    let batterySocPct = 85.0;
    let batteryStorageKwh = 150.0;

    for (const asset of assets) {
      const telem = asset.currentTelemetry;

      if (telem.power_output_kw) {
        totalGenerationKw += telem.power_output_kw.value;
      }
      if (telem.grid_load_kw) {
        totalLoadKw = telem.grid_load_kw.value;
      }
      if (telem.state_of_charge_pct) {
        batterySocPct = telem.state_of_charge_pct.value;
      }
    }

    const netPowerKw = Math.round((totalGenerationKw - totalLoadKw) * 10) / 10;

    let gridStatus: "STABLE" | "DEFICIT" | "SURPLUS" | "EMERGENCY" = "STABLE";
    if (netPowerKw < -20 && batterySocPct < 25) {
      gridStatus = "EMERGENCY";
    } else if (netPowerKw < 0) {
      gridStatus = "DEFICIT";
    } else if (netPowerKw > 20) {
      gridStatus = "SURPLUS";
    }

    return {
      totalGenerationKw: Math.round(totalGenerationKw * 10) / 10,
      totalLoadKw: Math.round(totalLoadKw * 10) / 10,
      batteryStorageKwh,
      batterySocPct: Math.round(batterySocPct * 10) / 10,
      netPowerKw,
      gridStatus,
      lastUpdate: timestamp,
    };
  }

  evaluateEnvironmentState(assets: TwinAssetState[], timestamp = new Date().toISOString()): EnvironmentState {
    let ambientTempC = -22.0;
    let windSpeedMs = 14.0;
    let atmosphericPressureHpa = 985.0;
    let solarIrradianceWm2 = 0.0;

    for (const asset of assets) {
      const telem = asset.currentTelemetry;
      if (telem.ambient_temperature) ambientTempC = telem.ambient_temperature.value;
      if (telem.wind_speed) windSpeedMs = telem.wind_speed.value;
      if (telem.atmospheric_pressure) atmosphericPressureHpa = telem.atmospheric_pressure.value;
      if (telem.solar_irradiance) solarIrradianceWm2 = telem.solar_irradiance.value;
    }

    let condition: "NORMAL" | "HIGH_WIND" | "BLIZZARD" | "EXTREME_COLD" = "NORMAL";
    if (windSpeedMs > 30.0 && ambientTempC < -30.0) {
      condition = "BLIZZARD";
    } else if (windSpeedMs > 25.0) {
      condition = "HIGH_WIND";
    } else if (ambientTempC < -45.0) {
      condition = "EXTREME_COLD";
    }

    return {
      ambientTempC,
      windSpeedMs,
      atmosphericPressureHpa,
      solarIrradianceWm2,
      condition,
      lastUpdate: timestamp,
    };
  }

  evaluateLogisticsState(assets: TwinAssetState[], timestamp = new Date().toISOString()): LogisticsState {
    let fuelBurnLpd = 680.0;
    let waterConsumptionLpd = 1200.0;
    let waterStorageL = 12000.0;
    const estimatedFuelStorageL = 45000.0; // Standard base fuel depot reserve

    for (const asset of assets) {
      const telem = asset.currentTelemetry;
      if (telem.daily_fuel_burn_liters) fuelBurnLpd = telem.daily_fuel_burn_liters.value;
      if (telem.water_consumption_lpd) waterConsumptionLpd = telem.water_consumption_lpd.value;
      if (telem.storage_level_liters) waterStorageL = telem.storage_level_liters.value;
    }

    const daysOfFuelRemaining = Math.max(1, Math.round(estimatedFuelStorageL / Math.max(1, fuelBurnLpd)));
    const daysOfWaterRemaining = Math.max(1, Math.round(waterStorageL / Math.max(1, waterConsumptionLpd)));
    const daysOfFoodRemaining = 120; // 4 months standard expedition ration pack storage

    return {
      daysOfFuelRemaining,
      daysOfWaterRemaining,
      daysOfFoodRemaining,
      criticalSuppliesCount: 5,
      lastUpdate: timestamp,
    };
  }

  evaluateOperationalRisk(
    stationStatus: StationStatus,
    env: EnvironmentState,
    energy: EnergyState,
    logistics: LogisticsState
  ): OperationalRisk {
    let score = 15; // Baseline Antarctic risk
    const factors: string[] = [];

    if (stationStatus === "OFFLINE" || stationStatus === "DEGRADED") {
      score += 35;
      factors.push(`Station status is ${stationStatus}`);
    }

    if (env.condition === "BLIZZARD") {
      score += 25;
      factors.push("Severe blizzard conditions limit external movement and solar generation");
    } else if (env.condition === "HIGH_WIND") {
      score += 15;
      factors.push("High katabatic wind speeds recorded");
    }

    if (energy.gridStatus === "EMERGENCY") {
      score += 30;
      factors.push("Severe power deficit with depleted battery reserves");
    } else if (energy.gridStatus === "DEFICIT") {
      score += 15;
      factors.push("Current electrical grid in deficit state");
    }

    if (logistics.daysOfWaterRemaining < 3) {
      score += 25;
      factors.push(`Critical water reserves: only ${logistics.daysOfWaterRemaining} days remaining`);
    }

    score = Math.min(100, Math.max(0, score));

    let level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";
    if (score >= 75) level = "CRITICAL";
    else if (score >= 50) level = "HIGH";
    else if (score >= 30) level = "MEDIUM";

    return {
      score,
      level,
      factors: factors.length > 0 ? factors : ["All station environmental and operational parameters nominal"],
    };
  }
}
