// ─── Station ────────────────────────────────────────────────────
export type StationCode = "MAITRI" | "BHARATI";

export type StationStatus = "OPERATIONAL" | "DEGRADED" | "OFFLINE" | "MAINTENANCE";

export type DataMode = "SIMULATED" | "EXTERNAL" | "MEASURED";

export interface Station {
  id: string;
  code: StationCode;
  name: string;
  locationLabel: string;
  status: StationStatus;
  lastSyncAt: Date;
  dataMode: DataMode;
}

// ─── Asset ──────────────────────────────────────────────────────
export type AssetType =
  | "GENERATOR"
  | "BATTERY"
  | "HVAC"
  | "BUILDING"
  | "WATER_SYSTEM"
  | "COMMUNICATION"
  | "SOLAR"
  | "VEHICLE"
  | "LAB_EQUIPMENT"
  | "OTHER";

export type AssetStatus = "OPERATIONAL" | "DEGRADED" | "FAILED" | "MAINTENANCE" | "OFFLINE";

export type Criticality = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface Asset {
  id: string;
  stationId: string;
  parentAssetId?: string;
  code: string;
  name: string;
  type: AssetType;
  status: AssetStatus;
  criticality: Criticality;
  healthScore?: number;
}

// ─── Telemetry ──────────────────────────────────────────────────
export type TelemetrySource = "SIMULATOR" | "MQTT" | "API" | "MANUAL";

export type DataQuality = "GOOD" | "SUSPECT" | "BAD";

export interface TelemetryPoint {
  id: string;
  stationId: string;
  assetId?: string;
  metric: string;
  value: number;
  unit: string;
  timestamp: Date;
  source: TelemetrySource;
  quality: DataQuality;
}

export interface TelemetryEnvelope {
  stationId: string;
  assetId?: string;
  metric: string;
  value: number;
  unit: string;
  timestamp: string;
  source: TelemetrySource;
  quality: DataQuality;
  sequence: number;
}

export type SimulatorMode = "normal" | "noisy" | "anomaly" | "offline" | "recovery";

export interface SimulatorAnomaly {
  id: string;
  stationId: string;
  assetId?: string;
  metric: string;
  type: string;
  targetValue?: number;
  multiplier?: number;
  durationSeconds?: number;
  startedAt: string;
}

export interface SimulatorStatus {
  running: boolean;
  mode: SimulatorMode;
  tickCount: number;
  offlineBufferedCount: number;
  activeAnomalies: SimulatorAnomaly[];
  intervalMs: number;
  mqttConnected: boolean;
  lastEmittedAt?: string;
}

// ─── Inventory ──────────────────────────────────────────────────
export type InventoryCategory = "FUEL" | "FOOD" | "MEDICAL" | "SPARES" | "SCIENTIFIC";

export interface InventoryItem {
  id: string;
  stationId: string;
  category: InventoryCategory;
  name: string;
  quantity: number;
  unit: string;
  minimumThreshold: number;
  averageDailyConsumption: number;
  leadTimeDays: number;
  updatedAt: Date;
}

// ─── Alert ──────────────────────────────────────────────────────
export type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";

export type AlertCategory =
  | "INFRASTRUCTURE"
  | "ENERGY"
  | "LOGISTICS"
  | "ENVIRONMENT"
  | "SYSTEM";

export type AlertStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED";

export interface Alert {
  id: string;
  stationId: string;
  assetId?: string;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  status: AlertStatus;
  createdAt: Date;
  resolvedAt?: Date;
}

// ─── Forecast ───────────────────────────────────────────────────
export interface Forecast {
  id: string;
  stationId: string;
  target: string;
  horizonHours: number;
  predictedValue: number;
  lowerBound?: number;
  upperBound?: number;
  modelVersion: string;
  generatedAt: Date;
}

// ─── Simulation ─────────────────────────────────────────────────
export interface SimulationRun {
  id: string;
  stationId: string;
  scenarioType: string;
  inputState: Record<string, unknown>;
  outputState: Record<string, unknown>;
  impacts: Record<string, unknown>;
  createdAt: Date;
}
