import type {
  EnergyForecast,
  EnergyForecastPoint,
  TwinState,
} from "@maitri-bharati/shared";

export class EnergyForecaster {
  private readonly modelVersion = "diurnal-polar-reg-v1";

  /**
   * Generates a 24-hour ahead forward forecast for energy demand, generation, and fuel burn.
   */
  public forecast(
    stationId: string,
    currentTwinState?: Partial<TwinState>,
    referenceTime: Date = new Date()
  ): EnergyForecast {
    const isMaitri = stationId.toLowerCase().includes("maitri");
    const nominalBase = isMaitri ? 42.0 : 58.0;
    const liveLoad = currentTwinState?.energy?.totalLoadKw;
    // Base demand anchors 60% to live telemetry load + 40% to nominal base to reflect current operating regime
    const baseDemandKw = liveLoad ? Number((liveLoad * 0.6 + nominalBase * 0.4).toFixed(1)) : nominalBase;
    const peakThermalCoeff = 0.65; // kW extra electrical/heating draw per degree below -20°C

    const ambientBase = currentTwinState?.environment?.ambientTempC ?? (isMaitri ? -22.0 : -16.0);
    const windBase = currentTwinState?.environment?.windSpeedMs ?? 12.0;

    const points: EnergyForecastPoint[] = [];
    const nowMs = referenceTime.getTime();
    const currentHour = referenceTime.getUTCHours();

    for (let h = 1; h <= 24; h++) {
      const forecastHour = (currentHour + h) % 24;
      const pointTime = new Date(nowMs + h * 3600 * 1000).toISOString();

      // 1. Polar Diurnal cycle physics
      // Temp dips coldest around 04:00, warmest around 14:00
      const tempVariation = 4.0 * Math.sin(((forecastHour - 8) / 24) * 2 * Math.PI);
      const predictedAmbient = ambientBase + tempVariation;

      // 2. Solar generation
      // Solar window roughly 06:00 to 18:00 in polar transition/summer
      let solarKw = 0;
      if (forecastHour >= 6 && forecastHour <= 18) {
        const solarArc = Math.sin(((forecastHour - 6) / 12) * Math.PI);
        solarKw = Number((solarArc * (isMaitri ? 18.0 : 35.0)).toFixed(1));
      }

      // 3. Wind generation
      // Base wind turbine capacity with small variation
      const windVariation = Math.cos(((forecastHour - 3) / 24) * 2 * Math.PI) * 2.0;
      const predictedWindSpeed = Math.max(0, windBase + windVariation);
      const windKw = Number(
        (Math.min(1.0, Math.max(0, (predictedWindSpeed - 3.5) / 12)) * (isMaitri ? 12.0 : 25.0)).toFixed(1)
      );

      // 4. Electrical & Thermal Heating Demand
      // Extra load when temperature is colder
      const coldDelta = Math.max(0, -20.0 - predictedAmbient);
      const thermalHeatingLoad = coldDelta * peakThermalCoeff;
      // Activity load: daytime higher (+6 kW) than night
      const activityLoad = forecastHour >= 7 && forecastHour <= 21 ? 5.5 : 0.0;

      const predictedDemandKw = Number((baseDemandKw + thermalHeatingLoad + activityLoad).toFixed(1));

      // 5. Prediction uncertainty intervals (P10 / P90 bounds)
      // Lower bound = lower heating, higher efficiency (-9%)
      // Upper bound = spike in thermal demand, harsh blizzard (+13%)
      const lowerDemandKw = Number((predictedDemandKw * 0.91).toFixed(1));
      const upperDemandKw = Number((predictedDemandKw * 1.13).toFixed(1));

      const totalRenewables = solarKw + windKw;
      const netGeneratorKw = Math.max(0, predictedDemandKw - totalRenewables);

      // Fuel consumption: ISO 8528 diesel generator burn curve ~0.26 L/kWh
      const fuelConsumptionRateLph = Number((netGeneratorKw * 0.258).toFixed(1));

      // Net reserve margin (Installed generation capacity - Demand)
      // Maitri: 2x 125 kVA generators = 200 kW max capacity
      // Bharati: 3x 100 kVA generators = 240 kW max capacity
      const totalInstalledCapKw = isMaitri ? 200.0 : 240.0;
      const netReserveKw = Number((totalInstalledCapKw - predictedDemandKw).toFixed(1));

      points.push({
        timestamp: pointTime,
        hourOffset: h,
        predictedDemandKw,
        lowerDemandKw,
        upperDemandKw,
        predictedGenerationKw: Number((totalRenewables + netGeneratorKw).toFixed(1)),
        solarGenerationKw: solarKw,
        windGenerationKw: windKw,
        netReserveKw,
        fuelConsumptionRateLph,
      });
    }

    const assumptions = [
      `Diurnal thermal cycle amplitude: +/-4.0 degC relative to current ambient (${ambientBase.toFixed(1)} degC)`,
      `Renewable contribution modeled with solar arc peak and ${windBase.toFixed(1)} m/s wind baseline`,
      `Specific fuel consumption rate: 0.258 L/kWh at nominal generator operating profile`,
      `Installed capacity headroom: ${isMaitri ? "200 kW (Maitri 2x125kVA)" : "240 kW (Bharati 3x100kVA)"}`,
    ];

    return {
      stationId,
      generatedAt: referenceTime.toISOString(),
      modelVersion: this.modelVersion,
      horizonHours: 24,
      points,
      confidence: 0.92,
      assumptions,
    };
  }
}
