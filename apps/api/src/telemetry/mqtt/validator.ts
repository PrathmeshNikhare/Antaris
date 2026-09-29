import type { TelemetryEnvelope, TelemetryPoint, DataQuality, TelemetrySource } from "@maitri-bharati/shared";

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  point?: TelemetryPoint;
}

// Plausible physical ranges for sanity validation
const METRIC_BOUNDS: Record<string, { min: number; max: number }> = {
  temperature: { min: -50, max: 130 },
  ambient_temperature: { min: -75, max: 25 },
  wind_speed: { min: 0, max: 100 },
  atmospheric_pressure: { min: 850, max: 1100 },
  power_output_kw: { min: 0, max: 600 },
  fuel_consumption_lph: { min: 0, max: 150 },
  state_of_charge_pct: { min: 0, max: 100 },
  voltage: { min: 0, max: 650 },
  water_temperature: { min: -10, max: 80 },
  flow_rate_lpm: { min: 0, max: 300 },
  indoor_temperature: { min: 0, max: 40 },
  solar_irradiance: { min: 0, max: 1400 },
  solar_generation_kw: { min: 0, max: 100 },
  salinity_ppm: { min: 0, max: 1000 },
};

const VALID_SOURCES: TelemetrySource[] = ["SIMULATOR", "MQTT", "API", "MANUAL"];

/**
 * Validates canonical telemetry envelope per telemetry.md.
 * If plausible bounds are breached, it flags quality = "SUSPECT" rather than dropping the message.
 */
export function validateTelemetryEnvelope(payload: unknown): ValidationResult {
  const errors: string[] = [];

  if (!payload || typeof payload !== "object") {
    return { valid: false, errors: ["Payload must be a non-null JSON object"] };
  }

  const p = payload as Partial<TelemetryEnvelope>;

  if (!p.stationId || typeof p.stationId !== "string") {
    errors.push("Missing or invalid required field: stationId");
  }

  if (!p.metric || typeof p.metric !== "string") {
    errors.push("Missing or invalid required field: metric");
  }

  if (typeof p.value !== "number" || Number.isNaN(p.value)) {
    errors.push("Missing or invalid required numeric field: value");
  }

  if (!p.unit || typeof p.unit !== "string") {
    errors.push("Missing or invalid required field: unit");
  }

  if (!p.timestamp) {
    errors.push("Missing required field: timestamp");
  }

  const date = new Date(p.timestamp as string);
  if (Number.isNaN(date.getTime())) {
    errors.push("Invalid timestamp format");
  } else {
    // Timestamp sanity check: not in the distant future or distant past
    const now = Date.now();
    const diffHours = (date.getTime() - now) / (1000 * 60 * 60);
    if (diffHours > 24) {
      errors.push("Timestamp is more than 24 hours in the future");
    } else if (diffHours < -365 * 24) {
      errors.push("Timestamp is more than 1 year in the past");
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Range validation: do not discard silently; flag as SUSPECT
  let quality: DataQuality = (p.quality as DataQuality) || "GOOD";
  const bounds = METRIC_BOUNDS[p.metric!];
  if (bounds) {
    if (p.value! < bounds.min || p.value! > bounds.max) {
      quality = "SUSPECT";
    }
  }

  const source: TelemetrySource = VALID_SOURCES.includes(p.source as TelemetrySource)
    ? (p.source as TelemetrySource)
    : "SIMULATOR";

  const ASSET_ID_ALIASES: Record<string, string> = {
    "maitri-gen-01": "asset-maitri-gen-1",
    "MAITRI-GEN-01": "asset-maitri-gen-1",
    "maitri-gen-02": "asset-maitri-gen-2",
    "MAITRI-GEN-02": "asset-maitri-gen-2",
    "maitri-bat-01": "asset-maitri-bat-1",
    "MAITRI-BAT-01": "asset-maitri-bat-1",
    "maitri-wtr-01": "asset-maitri-water-1",
    "MAITRI-WTR-01": "asset-maitri-water-1",
    "maitri-hvac-01": "asset-maitri-hvac-1",
    "MAITRI-HVAC-01": "asset-maitri-hvac-1",
    "maitri-sol-01": "asset-maitri-sol-1",
    "MAITRI-SOL-01": "asset-maitri-sol-1",
    "maitri-com-01": "asset-maitri-comm-1",
    "MAITRI-COM-01": "asset-maitri-comm-1",

    "bharati-chp-01": "asset-bharati-chp-1",
    "BHARATI-CHP-01": "asset-bharati-chp-1",
    "bharati-chp-02": "asset-bharati-chp-2",
    "BHARATI-CHP-02": "asset-bharati-chp-2",
    "bharati-bat-01": "asset-bharati-bat-1",
    "BHARATI-BAT-01": "asset-bharati-bat-1",
    "bharati-ro-01": "asset-bharati-ro-1",
    "BHARATI-RO-01": "asset-bharati-ro-1",
    "bharati-hvac-01": "asset-bharati-hvac-1",
    "bharati-hvac-mod": "asset-bharati-hvac-1",
    "BHARATI-HVAC-01": "asset-bharati-hvac-1",
    "bharati-sol-01": "asset-bharati-wnd-1",
    "bharati-wnd-01": "asset-bharati-wnd-1",
    "BHARATI-WND-01": "asset-bharati-wnd-1",
    "bharati-sat-01": "asset-bharati-ground-1",
    "BHARATI-SAT-01": "asset-bharati-ground-1",
  };

  const normalizedStationId =
    p.stationId === "MAITRI"
      ? "station-maitri"
      : p.stationId === "BHARATI"
        ? "station-bharati"
        : p.stationId!;

  const normalizedAssetId = p.assetId
    ? ASSET_ID_ALIASES[p.assetId] || p.assetId
    : undefined;

  const point: TelemetryPoint = {
    id: `telem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    stationId: normalizedStationId,
    assetId: normalizedAssetId,
    metric: p.metric!,
    value: p.value!,
    unit: p.unit!,
    timestamp: date,
    source,
    quality,
  };

  return { valid: true, point };
}
