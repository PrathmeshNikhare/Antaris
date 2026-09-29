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

// ─── Asset Dependency ───────────────────────────────────────────
export type DependencyType =
  | "POWER"
  | "THERMAL"
  | "DATA"
  | "FUEL"
  | "WATER"
  | "OPERATIONAL";

export interface AssetDependency {
  id: string;
  fromAssetId: string;
  toAssetId: string;
  dependencyType: DependencyType;
  criticality: Criticality;
  description?: string;
  createdAt: Date;
}

// ─── Metric Definition ──────────────────────────────────────────
export type AggregationStrategy = "AVG" | "LAST" | "MAX" | "SUM";

export interface MetricDefinition {
  id: string;
  metric: string;
  canonicalUnit: string;
  minPlausible: number;
  maxPlausible: number;
  warningThresholdLow?: number;
  warningThresholdHigh?: number;
  criticalThresholdLow?: number;
  criticalThresholdHigh?: number;
  expectedSamplingIntervalSeconds: number;
  aggregationStrategy: AggregationStrategy;
  allowedAssetTypes: AssetType[];
  createdAt: Date;
}

// ─── Telemetry ──────────────────────────────────────────────────
export type TelemetrySource = "SIMULATOR" | "MQTT" | "API" | "MANUAL" | "SIMULATED" | "EXTERNAL" | "MEASURED";

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
  sequence?: number;
  ingestedAt?: Date;
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
  queuedAt?: string;
  publishedAt?: string;
  acknowledgedAt?: string;
  retryCount?: number;
}

export type SimulatorMode = "normal" | "noisy" | "anomaly" | "offline" | "recovery";

export type ConnectivityState = "NORMAL" | "DEGRADED" | "OFFLINE" | "RECOVERY";

export interface ReplayBatchMetadata {
  batchId: string;
  queuedAt: string;
  publishedAt?: string;
  acknowledgedAt?: string;
  retryCount: number;
  sequenceRange: [number, number];
  replayStatus: "QUEUED" | "REPLAYING" | "ACKNOWLEDGED" | "FAILED";
  totalCount: number;
}

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
  connectivityState: ConnectivityState;
  tickCount: number;
  offlineBufferedCount: number;
  oldestBufferedTimestamp?: string;
  lastSuccessfulSync?: string;
  replayProgressPct?: number;
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
  ruleId?: string;
  confidence?: number;
  detectedAt?: Date;
  recommendedAction?: string;
  evidenceWindow?: Record<string, unknown>;
  impactSummary?: string;
  createdAt: Date;
  resolvedAt?: Date;
}

// ─── Maintenance Event ──────────────────────────────────────────
export type MaintenanceType = "PREVENTIVE" | "CORRECTIVE" | "INSPECTION" | "EMERGENCY";

export type MaintenanceResult = "SUCCESS" | "PENDING" | "PARTIAL" | "FAILED";

export interface MaintenanceEvent {
  id: string;
  stationId: string;
  assetId: string;
  maintenanceType: MaintenanceType;
  scheduledAt: Date;
  completedAt?: Date;
  notes?: string;
  partsUsed?: string[];
  result: MaintenanceResult;
  createdAt: Date;
}

// ─── Operator & Roles ───────────────────────────────────────────
export type OperatorRole = "ADMIN" | "OPERATOR" | "ENGINEER" | "LOGISTICS" | "VIEWER";

export interface Operator {
  id: string;
  username: string;
  fullName: string;
  role: OperatorRole;
  stationId?: string;
  createdAt: Date;
}

// ─── Audit Trail ────────────────────────────────────────────────
export interface AuditEvent {
  id: string;
  operatorId?: string;
  action: string;
  targetType: string;
  targetId?: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  result: string;
  correlationId?: string;
  createdAt: Date;
}

// ─── Command Workflow (Simulation & Audit; No physical control) ─
export type CommandStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXECUTED";

export interface CommandRequest {
  id: string;
  commandType: string;
  targetAssetId?: string;
  stationId: string;
  parameters?: Record<string, unknown>;
  requestedBy: string;
  status: CommandStatus;
  createdAt: Date;
}

export interface CommandApproval {
  id: string;
  commandRequestId: string;
  approvedBy: string;
  decision: "APPROVED" | "REJECTED";
  reason?: string;
  createdAt: Date;
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

// ─── Phase 3: Digital Twin State Engine ─────────────────────────

export type FreshnessStatus = "FRESH" | "STALE" | "UNKNOWN";

export interface FreshnessInfo {
  observedAt: string;
  ageSeconds: number;
  status: FreshnessStatus;
}

export interface DataQualitySummary {
  goodCount: number;
  suspectCount: number;
  badCount: number;
  overallQuality: DataQuality;
}

export interface EnergyState {
  totalGenerationKw: number;
  totalLoadKw: number;
  batteryStorageKwh: number;
  batterySocPct: number;
  netPowerKw: number;
  gridStatus: "STABLE" | "DEFICIT" | "SURPLUS" | "EMERGENCY";
  lastUpdate: string;
}

export interface EnvironmentState {
  ambientTempC: number;
  windSpeedMs: number;
  atmosphericPressureHpa: number;
  solarIrradianceWm2: number;
  condition: "NORMAL" | "HIGH_WIND" | "BLIZZARD" | "EXTREME_COLD";
  lastUpdate: string;
}

export interface LogisticsState {
  daysOfFuelRemaining: number;
  daysOfWaterRemaining: number;
  daysOfFoodRemaining: number;
  criticalSuppliesCount: number;
  lastUpdate: string;
}

export interface OperationalRisk {
  score: number; // 0-100
  level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  factors: string[];
}

export interface StationStatusAssessment {
  currentState: StationStatus;
  reason: string;
  contributingAssets: string[];
  contributingAlerts: string[];
}

export interface TwinTelemetryProperty {
  value: number;
  unit: string;
  timestamp: string;
  quality: DataQuality;
  source: TelemetrySource;
  sequence?: number;
  observedAt: string;
  ageSeconds: number;
  freshness: FreshnessStatus;
}

export interface StateTransitionEvent {
  id: string;
  entityType: "STATION" | "ASSET";
  entityId: string;
  previousState: string;
  newState: string;
  reason: string;
  triggerMetric?: string;
  timestamp: string;
}

export interface TwinAssetState {
  assetId: string;
  stationId: string;
  name: string;
  type: AssetType;
  criticality: Criticality;
  currentTelemetry: Record<string, TwinTelemetryProperty>;
  status: AssetStatus;
  healthScore: number;
  lastUpdate: string;
  freshness: FreshnessInfo;
  dataQuality: DataQuality;
  anomalyState: {
    hasActiveAnomaly: boolean;
    details?: string;
  };
  maintenanceState: {
    inMaintenance: boolean;
    lastMaintenanceDate?: string;
    nextScheduled?: string;
  };
  impactedDownstreamAssets?: string[];
}

export interface TwinState {
  stationId: string;
  stationCode: StationCode;
  stationName: string;
  timestamp: string;
  statusAssessment: StationStatusAssessment;
  stationStatus: StationStatus;
  lastSynchronization: string;
  dataFreshness: FreshnessInfo;
  connectivityState: ConnectivityState;
  dataQualitySummary: DataQualitySummary;
  assets: TwinAssetState[];
  energy: EnergyState;
  environment: EnvironmentState;
  logistics: LogisticsState;
  activeAlerts: Alert[];
  operationalRisk: OperationalRisk;
  recentTransitions: StateTransitionEvent[];
}

export interface TwinSnapshot {
  id: string;
  stationId: string;
  snapshotAt: string;
  state: TwinState;
}

export type TwinEventType =
  | "telemetry.updated"
  | "asset.state_changed"
  | "station.state_changed"
  | "alert.created"
  | "alert.updated"
  | "connectivity.changed"
  | "dependency.impact_changed";

export interface TwinWebSocketMessage<T = unknown> {
  type: TwinEventType;
  stationId: string;
  timestamp: string;
  payload: T;
}

