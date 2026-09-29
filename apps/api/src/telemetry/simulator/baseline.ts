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
  // ══════════════════════════════════════════════════════════════════
  // ─── MAITRI STATION SENSORS ───────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════

  // 1. Environment
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
    minPlausible: 850.0,
    maxPlausible: 1100.0,
  },

  // 2. Primary Diesel Generator (125 kVA)
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
    baseValue: 105.0,
    noiseStdDev: 3.5,
    diurnalAmplitude: 12.0,
    minPlausible: 0.0,
    maxPlausible: 150.0,
  },
  {
    stationId: "station-maitri",
    assetId: "asset-maitri-gen-1",
    metric: "fuel_consumption_lph",
    unit: "L/h",
    topic: "stations/station-maitri/energy",
    baseValue: 28.5,
    noiseStdDev: 0.9,
    minPlausible: 0.0,
    maxPlausible: 60.0,
  },
  {
    stationId: "station-maitri",
    assetId: "asset-maitri-gen-1",
    metric: "oil_pressure_bar",
    unit: "bar",
    topic: "stations/station-maitri/telemetry/asset-maitri-gen-1",
    baseValue: 4.6,
    noiseStdDev: 0.15,
    minPlausible: 0.0,
    maxPlausible: 10.0,
  },

  // 3. Battery System (150 kWh)
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
    assetId: "asset-maitri-bat-1",
    metric: "charge_rate_kw",
    unit: "kW",
    topic: "stations/station-maitri/energy",
    baseValue: 8.5,
    noiseStdDev: 1.0,
    minPlausible: -60.0,
    maxPlausible: 60.0,
  },

  // 4. HVAC
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
  {
    stationId: "station-maitri",
    assetId: "asset-maitri-hvac-1",
    metric: "thermal_load_kw",
    unit: "kW",
    topic: "stations/station-maitri/telemetry/asset-maitri-hvac-1",
    baseValue: 42.0,
    noiseStdDev: 2.0,
    diurnalAmplitude: 5.0,
    minPlausible: 0.0,
    maxPlausible: 120.0,
  },
  {
    stationId: "station-maitri",
    assetId: "asset-maitri-hvac-1",
    metric: "airflow_cfm",
    unit: "CFM",
    topic: "stations/station-maitri/telemetry/asset-maitri-hvac-1",
    baseValue: 3450.0,
    noiseStdDev: 50.0,
    minPlausible: 500.0,
    maxPlausible: 7000.0,
  },

  // 5. Water System (Priyadarshini Lake pump & storage)
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
    maxPlausible: 150.0,
  },
  {
    stationId: "station-maitri",
    assetId: "asset-maitri-water-1",
    metric: "storage_level_liters",
    unit: "L",
    topic: "stations/station-maitri/telemetry/asset-maitri-water-1",
    baseValue: 12400.0,
    noiseStdDev: 80.0,
    minPlausible: 0.0,
    maxPlausible: 20000.0,
  },

  // 6. Communications (Satellite Terminal)
  {
    stationId: "station-maitri",
    assetId: "asset-maitri-comm-1",
    metric: "snr_db",
    unit: "dB",
    topic: "stations/station-maitri/telemetry/asset-maitri-comm-1",
    baseValue: 16.4,
    noiseStdDev: 0.6,
    minPlausible: 0.0,
    maxPlausible: 35.0,
  },
  {
    stationId: "station-maitri",
    assetId: "asset-maitri-comm-1",
    metric: "packet_loss_pct",
    unit: "%",
    topic: "stations/station-maitri/telemetry/asset-maitri-comm-1",
    baseValue: 1.2,
    noiseStdDev: 0.4,
    minPlausible: 0.0,
    maxPlausible: 100.0,
  },
  {
    stationId: "station-maitri",
    assetId: "asset-maitri-comm-1",
    metric: "latency_ms",
    unit: "ms",
    topic: "stations/station-maitri/telemetry/asset-maitri-comm-1",
    baseValue: 680.0,
    noiseStdDev: 25.0,
    minPlausible: 100.0,
    maxPlausible: 3000.0,
  },

  // 7. Energy Grid Load & Logistics
  {
    stationId: "station-maitri",
    metric: "grid_load_kw",
    unit: "kW",
    topic: "stations/station-maitri/energy",
    baseValue: 94.5,
    noiseStdDev: 3.0,
    diurnalAmplitude: 14.0,
    minPlausible: 10.0,
    maxPlausible: 250.0,
  },
  {
    stationId: "station-maitri",
    metric: "daily_fuel_burn_liters",
    unit: "L",
    topic: "stations/station-maitri/logistics",
    baseValue: 680.0,
    noiseStdDev: 15.0,
    minPlausible: 100.0,
    maxPlausible: 1500.0,
  },
  {
    stationId: "station-maitri",
    metric: "water_consumption_lpd",
    unit: "L/day",
    topic: "stations/station-maitri/logistics",
    baseValue: 1180.0,
    noiseStdDev: 25.0,
    minPlausible: 200.0,
    maxPlausible: 3000.0,
  },

  // 8. Solar PV Array (30 kW)
  {
    stationId: "station-maitri",
    assetId: "asset-maitri-sol-1",
    metric: "power_output_kw",
    unit: "kW",
    topic: "stations/station-maitri/energy",
    baseValue: 18.0,
    noiseStdDev: 1.5,
    diurnalAmplitude: 12.0,
    minPlausible: 0.0,
    maxPlausible: 40.0,
  },

  // 9. Standby Generator (125 kVA)
  {
    stationId: "station-maitri",
    assetId: "asset-maitri-gen-2",
    metric: "power_output_kw",
    unit: "kW",
    topic: "stations/station-maitri/energy",
    baseValue: 0.0,
    noiseStdDev: 0.0,
    minPlausible: 0.0,
    maxPlausible: 150.0,
  },
  {
    stationId: "station-maitri",
    assetId: "asset-maitri-gen-2",
    metric: "temperature",
    unit: "degC",
    topic: "stations/station-maitri/telemetry/asset-maitri-gen-2",
    baseValue: 42.0,
    noiseStdDev: 0.5,
    minPlausible: 0.0,
    maxPlausible: 120.0,
  },

  // ══════════════════════════════════════════════════════════════════
  // ─── BHARATI STATION SENSORS ──────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════

  // 1. Environment
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

  // 2. CHP Unit 1 & Micro-Wind
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
    baseValue: 135.0,
    noiseStdDev: 4.0,
    diurnalAmplitude: 15.0,
    minPlausible: 0.0,
    maxPlausible: 200.0,
  },
  {
    stationId: "station-bharati",
    assetId: "asset-bharati-chp-1",
    metric: "fuel_consumption_lph",
    unit: "L/h",
    topic: "stations/station-bharati/energy",
    baseValue: 34.0,
    noiseStdDev: 1.1,
    minPlausible: 0.0,
    maxPlausible: 75.0,
  },
  {
    stationId: "station-bharati",
    assetId: "asset-bharati-chp-1",
    metric: "oil_pressure_bar",
    unit: "bar",
    topic: "stations/station-bharati/telemetry/asset-bharati-chp-1",
    baseValue: 5.1,
    noiseStdDev: 0.12,
    minPlausible: 0.0,
    maxPlausible: 10.0,
  },
  {
    stationId: "station-bharati",
    assetId: "asset-bharati-chp-2",
    metric: "power_output_kw",
    unit: "kW",
    topic: "stations/station-bharati/energy",
    baseValue: 0.0,
    noiseStdDev: 0.0,
    minPlausible: 0.0,
    maxPlausible: 200.0,
  },
  {
    stationId: "station-bharati",
    assetId: "asset-bharati-chp-2",
    metric: "temperature",
    unit: "degC",
    topic: "stations/station-bharati/telemetry/asset-bharati-chp-2",
    baseValue: 42.0,
    noiseStdDev: 0.5,
    minPlausible: 0.0,
    maxPlausible: 120.0,
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
    maxPlausible: 35.0,
  },

  // 3. Battery System (200 kWh LiFePO4)
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
    assetId: "asset-bharati-bat-1",
    metric: "voltage",
    unit: "V",
    topic: "stations/station-bharati/energy",
    baseValue: 412.0,
    noiseStdDev: 1.2,
    minPlausible: 0.0,
    maxPlausible: 600.0,
  },
  {
    stationId: "station-bharati",
    assetId: "asset-bharati-bat-1",
    metric: "charge_rate_kw",
    unit: "kW",
    topic: "stations/station-bharati/energy",
    baseValue: 12.0,
    noiseStdDev: 1.2,
    minPlausible: -80.0,
    maxPlausible: 80.0,
  },

  // 4. Reverse Osmosis Desalination
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
    maxPlausible: 150.0,
  },
  {
    stationId: "station-bharati",
    assetId: "asset-bharati-ro-1",
    metric: "storage_level_liters",
    unit: "L",
    topic: "stations/station-bharati/telemetry/asset-bharati-ro-1",
    baseValue: 18200.0,
    noiseStdDev: 110.0,
    minPlausible: 0.0,
    maxPlausible: 25000.0,
  },

  // 5. HVAC
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
  {
    stationId: "station-bharati",
    assetId: "asset-bharati-hvac-1",
    metric: "thermal_load_kw",
    unit: "kW",
    topic: "stations/station-bharati/telemetry/asset-bharati-hvac-1",
    baseValue: 48.0,
    noiseStdDev: 2.2,
    diurnalAmplitude: 6.0,
    minPlausible: 0.0,
    maxPlausible: 140.0,
  },
  {
    stationId: "station-bharati",
    assetId: "asset-bharati-hvac-1",
    metric: "airflow_cfm",
    unit: "CFM",
    topic: "stations/station-bharati/telemetry/asset-bharati-hvac-1",
    baseValue: 3950.0,
    noiseStdDev: 60.0,
    minPlausible: 500.0,
    maxPlausible: 8000.0,
  },

  // 6. Communications (Polar Ground Station)
  {
    stationId: "station-bharati",
    assetId: "asset-bharati-ground-1",
    metric: "snr_db",
    unit: "dB",
    topic: "stations/station-bharati/telemetry/asset-bharati-ground-1",
    baseValue: 18.2,
    noiseStdDev: 0.5,
    minPlausible: 0.0,
    maxPlausible: 35.0,
  },
  {
    stationId: "station-bharati",
    assetId: "asset-bharati-ground-1",
    metric: "packet_loss_pct",
    unit: "%",
    topic: "stations/station-bharati/telemetry/asset-bharati-ground-1",
    baseValue: 0.8,
    noiseStdDev: 0.3,
    minPlausible: 0.0,
    maxPlausible: 100.0,
  },
  {
    stationId: "station-bharati",
    assetId: "asset-bharati-ground-1",
    metric: "latency_ms",
    unit: "ms",
    topic: "stations/station-bharati/telemetry/asset-bharati-ground-1",
    baseValue: 620.0,
    noiseStdDev: 20.0,
    minPlausible: 100.0,
    maxPlausible: 3000.0,
  },

  // 7. Grid Load & Logistics
  {
    stationId: "station-bharati",
    metric: "grid_load_kw",
    unit: "kW",
    topic: "stations/station-bharati/energy",
    baseValue: 108.0,
    noiseStdDev: 3.5,
    diurnalAmplitude: 16.0,
    minPlausible: 15.0,
    maxPlausible: 300.0,
  },
  {
    stationId: "station-bharati",
    metric: "daily_fuel_burn_liters",
    unit: "L",
    topic: "stations/station-bharati/logistics",
    baseValue: 740.0,
    noiseStdDev: 18.0,
    minPlausible: 100.0,
    maxPlausible: 1800.0,
  },
  {
    stationId: "station-bharati",
    metric: "water_consumption_lpd",
    unit: "L/day",
    topic: "stations/station-bharati/logistics",
    baseValue: 1350.0,
    noiseStdDev: 30.0,
    minPlausible: 200.0,
    maxPlausible: 3500.0,
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

    // Explicitly labeled provenance: SIMULATED (never presented as actual station measurements)
    const envelope: TelemetryEnvelope = {
      stationId: sensor.stationId,
      assetId: sensor.assetId,
      metric: sensor.metric,
      value,
      unit: sensor.unit,
      timestamp: simulatedDate.toISOString(),
      source: "SIMULATED" as TelemetrySource,
      quality,
      sequence,
    };

    return { envelope, topic: sensor.topic };
  }
}
