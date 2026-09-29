import { PRNG } from "./prng";
import type { AnomalyManager } from "./anomalies";
import type { TelemetryEnvelope, TelemetrySource, DataQuality, SimulatorMode } from "@maitri-bharati/shared";

export interface SensorConfig {
  stationId: string;
  assetId?: string;
  metric: string;
  unit: string;
  topic: string;
  baseValue: number;
  noiseStdDev: number;
  diurnalAmplitude?: number; // Sine wave amplitude over 24-hour cycle
  minPlausible: number;
  maxPlausible: number;
}

export const SENSOR_DEFINITIONS: SensorConfig[] = [
  // ─── Maitri Station Sensors ──────────────────────────────────────
  {
    stationId: "station-maitri",
    metric: "ambient_temperature",
    unit: "degC",
    topic: "stations/station-maitri/environment",
    baseValue: -22.0,
    noiseStdDev: 0.8,
    diurnalAmplitude: 4.5,
    minPlausible: -70.0,
    maxPlausible: 15.0,
  },
  {
    stationId: "station-maitri",
    metric: "wind_speed",
    unit: "m/s",
    topic: "stations/station-maitri/environment",
    baseValue: 14.0,
    noiseStdDev: 2.5,
    diurnalAmplitude: 3.0,
    minPlausible: 0.0,
    maxPlausible: 90.0,
  },
  {
    stationId: "station-maitri",
    metric: "atmospheric_pressure",
    unit: "hPa",
    topic: "stations/station-maitri/environment",
    baseValue: 985.0,
    noiseStdDev: 1.2,
    minPlausible: 900.0,
    maxPlausible: 1050.0,
  },
  {
    stationId: "station-maitri",
    assetId: "asset-maitri-gen-1",
    metric: "temperature",
    unit: "degC",
    topic: "stations/station-maitri/telemetry/asset-maitri-gen-1",
    baseValue: 73.5,
    noiseStdDev: 1.2,
    minPlausible: -40.0,
    maxPlausible: 120.0,
  },
  {
    stationId: "station-maitri",
    assetId: "asset-maitri-gen-1",
    metric: "power_output_kw",
    unit: "kW",
    topic: "stations/station-maitri/energy",
    baseValue: 145.0,
    noiseStdDev: 4.0,
    diurnalAmplitude: 15.0,
    minPlausible: 0.0,
    maxPlausible: 500.0,
  },
  {
    stationId: "station-maitri",
    assetId: "asset-maitri-gen-1",
    metric: "fuel_consumption_lph",
    unit: "L/h",
    topic: "stations/station-maitri/energy",
    baseValue: 31.0,
    noiseStdDev: 1.0,
    minPlausible: 0.0,
    maxPlausible: 120.0,
  },
  {
    stationId: "station-maitri",
    assetId: "asset-maitri-bat-1",
    metric: "state_of_charge_pct",
    unit: "%",
    topic: "stations/station-maitri/energy",
    baseValue: 84.0,
    noiseStdDev: 0.5,
    minPlausible: 0.0,
    maxPlausible: 100.0,
  },
  {
    stationId: "station-maitri",
    assetId: "asset-maitri-bat-1",
    metric: "voltage",
    unit: "V",
    topic: "stations/station-maitri/energy",
    baseValue: 402.0,
    noiseStdDev: 1.5,
    minPlausible: 0.0,
    maxPlausible: 600.0,
  },
  {
    stationId: "station-maitri",
    assetId: "asset-maitri-water-1",
    metric: "water_temperature",
    unit: "degC",
    topic: "stations/station-maitri/telemetry/asset-maitri-water-1",
    baseValue: 4.8,
    noiseStdDev: 0.3,
    minPlausible: -5.0,
    maxPlausible: 40.0,
  },
  {
    stationId: "station-maitri",
    assetId: "asset-maitri-water-1",
    metric: "flow_rate_lpm",
    unit: "L/min",
    topic: "stations/station-maitri/telemetry/asset-maitri-water-1",
    baseValue: 42.0,
    noiseStdDev: 1.8,
    minPlausible: 0.0,
    maxPlausible: 200.0,
  },
  {
    stationId: "station-maitri",
    assetId: "asset-maitri-hvac-1",
    metric: "indoor_temperature",
    unit: "degC",
    topic: "stations/station-maitri/telemetry/asset-maitri-hvac-1",
    baseValue: 21.2,
    noiseStdDev: 0.4,
    minPlausible: 5.0,
    maxPlausible: 35.0,
  },

  // ─── Bharati Station Sensors ─────────────────────────────────────
  {
    stationId: "station-bharati",
    metric: "ambient_temperature",
    unit: "degC",
    topic: "stations/station-bharati/environment",
    baseValue: -26.5,
    noiseStdDev: 0.9,
    diurnalAmplitude: 5.0,
    minPlausible: -70.0,
    maxPlausible: 15.0,
  },
  {
    stationId: "station-bharati",
    metric: "wind_speed",
    unit: "m/s",
    topic: "stations/station-bharati/environment",
    baseValue: 18.5,
    noiseStdDev: 3.0,
    diurnalAmplitude: 4.0,
    minPlausible: 0.0,
    maxPlausible: 90.0,
  },
  {
    stationId: "station-bharati",
    metric: "solar_irradiance",
    unit: "W/m2",
    topic: "stations/station-bharati/environment",
    baseValue: 180.0,
    noiseStdDev: 5.0,
    diurnalAmplitude: 160.0,
    minPlausible: 0.0,
    maxPlausible: 1200.0,
  },
  {
    stationId: "station-bharati",
    assetId: "asset-bharati-chp-1",
    metric: "temperature",
    unit: "degC",
    topic: "stations/station-bharati/telemetry/asset-bharati-chp-1",
    baseValue: 75.0,
    noiseStdDev: 1.0,
    minPlausible: -40.0,
    maxPlausible: 120.0,
  },
  {
    stationId: "station-bharati",
    assetId: "asset-bharati-chp-1",
    metric: "power_output_kw",
    unit: "kW",
    topic: "stations/station-bharati/energy",
    baseValue: 155.0,
    noiseStdDev: 4.5,
    diurnalAmplitude: 18.0,
    minPlausible: 0.0,
    maxPlausible: 500.0,
  },
  {
    stationId: "station-bharati",
    assetId: "asset-bharati-wnd-1",
    metric: "power_output_kw",
    unit: "kW",
    topic: "stations/station-bharati/energy",
    baseValue: 16.0,
    noiseStdDev: 1.5,
    diurnalAmplitude: 6.0,
    minPlausible: 0.0,
    maxPlausible: 80.0,
  },
  {
    stationId: "station-bharati",
    assetId: "asset-bharati-bat-1",
    metric: "state_of_charge_pct",
    unit: "%",
    topic: "stations/station-bharati/energy",
    baseValue: 88.0,
    noiseStdDev: 0.6,
    minPlausible: 0.0,
    maxPlausible: 100.0,
  },
  {
    stationId: "station-bharati",
    assetId: "asset-bharati-ro-1",
    metric: "water_temperature",
    unit: "degC",
    topic: "stations/station-bharati/telemetry/asset-bharati-ro-1",
    baseValue: 6.5,
    noiseStdDev: 0.4,
    minPlausible: -5.0,
    maxPlausible: 40.0,
  },
  {
    stationId: "station-bharati",
    assetId: "asset-bharati-ro-1",
    metric: "flow_rate_lpm",
    unit: "L/min",
    topic: "stations/station-bharati/telemetry/asset-bharati-ro-1",
    baseValue: 48.0,
    noiseStdDev: 2.0,
    minPlausible: 0.0,
    maxPlausible: 200.0,
  },
  {
    stationId: "station-bharati",
    assetId: "asset-bharati-hvac-1",
    metric: "indoor_temperature",
    unit: "degC",
    topic: "stations/station-bharati/telemetry/asset-bharati-hvac-1",
    baseValue: 21.8,
    noiseStdDev: 0.3,
    minPlausible: 5.0,
    maxPlausible: 35.0,
  },
];

export class BaselineGenerator {
  private prng: PRNG;

  constructor(seed = 42) {
    this.prng = new PRNG(seed);
  }

  generatePoint(
    sensor: SensorConfig,
    _tick: number,
    mode: SimulatorMode,
    anomalyMgr: AnomalyManager,
    sequence: number,
    simulatedDate: Date = new Date()
  ): { envelope: TelemetryEnvelope; topic: string } {
    // 1. Calculate deterministic diurnal cycle (24-hour cycle)
    const hour = simulatedDate.getUTCHours() + simulatedDate.getUTCMinutes() / 60;
    const diurnalPhase = (hour / 24) * 2 * Math.PI;
    const diurnalComponent = sensor.diurnalAmplitude
      ? sensor.diurnalAmplitude * Math.sin(diurnalPhase)
      : 0;

    let value = sensor.baseValue + diurnalComponent;

    // 2. Add noise if mode is "noisy", "anomaly", "offline", "recovery"
    if (mode !== "normal") {
      const noise = this.prng.gaussian(0, sensor.noiseStdDev);
      value += noise;
    }

    // 3. Apply active anomalies if any
    let quality: DataQuality = "GOOD";
    const anomaly = anomalyMgr.getActive(sensor.stationId, sensor.assetId, sensor.metric);
    if (anomaly) {
      if (anomaly.targetValue !== undefined) {
        value = anomaly.targetValue + this.prng.gaussian(0, sensor.noiseStdDev * 0.5);
      } else if (anomaly.multiplier !== undefined) {
        value *= anomaly.multiplier;
      }

      // Check if value breached plausible boundary
      if (value < sensor.minPlausible || value > sensor.maxPlausible) {
        quality = "SUSPECT";
      }
    }

    // Round to 2 decimal places for clean sensor output
    value = Math.round(value * 100) / 100;

    const envelope: TelemetryEnvelope = {
      stationId: sensor.stationId,
      assetId: sensor.assetId,
      metric: sensor.metric,
      value,
      unit: sensor.unit,
      timestamp: simulatedDate.toISOString(),
      source: "SIMULATOR" as TelemetrySource,
      quality,
      sequence,
    };

    return { envelope, topic: sensor.topic };
  }
}
