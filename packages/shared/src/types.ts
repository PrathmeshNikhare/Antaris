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
  | "dependency.impact_changed"
  | "intelligence.updated";

export interface TwinWebSocketMessage<T = unknown> {
  type: TwinEventType;
  stationId: string;
  timestamp: string;
  payload: T;
}

// ─── Phase 5: Explainable Operational Intelligence ───────────────

export type AnomalySeverity = "INFO" | "WARNING" | "CRITICAL";

export interface AnomalyEvidence {
  deviationFromBaseline: number;
  deviationUnit: string;
  zScore: number;
  trendDirection: "RISING" | "FALLING" | "STABLE";
  rateOfChange: number; // change per minute
  thresholdCrossing?: {
    threshold: number;
    thresholdType: "WARNING" | "CRITICAL";
    actual: number;
  };
  contributingWindowMinutes: number;
  baselineExpected: number;
  humanReadable: string;
}

export interface AnomalyResult {
  id: string;
  stationId: string;
  assetId: string;
  metric: string;
  score: number; // 0.0 - 1.0 (isolation forest or normalized rule score)
  isAnomaly: boolean;
  severity: AnomalySeverity;
  confidence: number; // 0.0 - 1.0
  detectedAt: string;
  modelVersion: string;
  modelType: "RULE_BASED" | "ISOLATION_FOREST" | "HYBRID";
  evidence: AnomalyEvidence;
  dataQuality: DataQuality;
}

export interface EnergyForecastPoint {
  timestamp: string;
  hourOffset: number; // 1 to 24
  predictedDemandKw: number;
  lowerDemandKw: number; // P10 bound
  upperDemandKw: number; // P90 bound
  predictedGenerationKw: number;
  solarGenerationKw: number;
  windGenerationKw: number;
  netReserveKw: number;
  fuelConsumptionRateLph: number;
}

export interface EnergyForecast {
  stationId: string;
  generatedAt: string;
  modelVersion: string;
  horizonHours: number;
  points: EnergyForecastPoint[];
  confidence: number;
  assumptions: string[];
}

export interface InventoryForecast {
  stationId: string;
  itemCode: string;
  itemName: string;
  category: "FUEL" | "WATER" | "FOOD" | "SPARES";
  currentQuantity: number;
  unit: string;
  dailyBurnRate: number;
  daysRemaining: number;
  depletionDate: string;
  thresholdCrossingDate: string;
  consumptionTrend: "ACCELERATING" | "STEADY" | "DECELERATING";
  leadTimeRisk: "LOW" | "ELEVATED" | "HIGH" | "CRITICAL";
  resupplyUrgency: "ROUTINE" | "ATTENTION" | "URGENT" | "EMERGENCY";
  generatedAt: string;
}

export interface AssetHealthScore {
  assetId: string;
  stationId: string;
  assetName: string;
  assetType: AssetType;
  overallScore: number; // 0 to 100
  status: AssetStatus;
  telemetryPenalty: number;
  anomalyPenalty: number;
  runtimePenalty: number;
  maintenancePenalty: number;
  stressPenalty: number;
  dataConfidencePenalty: number;
  factors: string[];
  disclaimer: string; // "Decision-support indicator, not a guaranteed failure probability"
  evaluatedAt: string;
}

export interface CausalNode {
  id: string;
  domain: "INFRASTRUCTURE" | "ENERGY" | "ENVIRONMENT" | "LOGISTICS";
  label: string;
  severity: "NORMAL" | "WARNING" | "CRITICAL";
  description: string;
  metricValue?: string;
}

export interface CausalLink {
  source: string;
  target: string;
  impact: string;
}

export interface CrossDomainCascade {
  id: string;
  title: string;
  triggerDomain: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  nodes: CausalNode[];
  links: CausalLink[];
  summary: string;
}

export interface CrossDomainRiskAssessment {
  stationId: string;
  overallRiskScore: number; // 0 to 100
  overallLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  cascades: CrossDomainCascade[];
  contributingFactors: string[];
  generatedAt: string;
}

export type SuggestedActionType =
  | "INSPECT_ASSET"
  | "REDUCE_LOAD"
  | "CHECK_SPARES"
  | "MONITOR_TREND"
  | "RUN_SIMULATION";

export interface AdvisoryRecommendation {
  id: string;
  stationId: string;
  title: string;
  description: string;
  domain: "MAINTENANCE" | "ENERGY" | "LOGISTICS" | "OPERATIONS";
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  suggestedAction: SuggestedActionType;
  targetAssetId?: string;
  isAdvisory: boolean; // Always true
  rationale: string;
  createdTimestamp: string;
}

export interface ModelObservabilityRecord {
  id: string;
  modelName: string;
  modelVersion: string;
  task: "ANOMALY_DETECTION" | "ENERGY_FORECAST" | "INVENTORY_FORECAST" | "HEALTH_SCORE" | "RISK_CASCADE";
  generatedAt: string;
  inputSummary: Record<string, unknown>;
  resultSummary: Record<string, unknown>;
  confidence: number;
  executionDurationMs: number;
  evidenceCount: number;
}

export interface StationIntelligenceSummary {
  stationId: string;
  timestamp: string;
  activeAnomalies: AnomalyResult[];
  energyForecast: EnergyForecast;
  inventoryForecasts: InventoryForecast[];
  assetHealthScores: AssetHealthScore[];
  crossDomainRisk: CrossDomainRiskAssessment;
  recommendations: AdvisoryRecommendation[];
  observability: ModelObservabilityRecord[];
}

// ═══════════════════════════════════════════════════════════════════════
// ── PHASE 6: WHAT-IF RESILIENCE SIMULATION ENGINE TYPES ───────────────
// ═══════════════════════════════════════════════════════════════════════

export type ResilienceScenarioType =
  | "GENERATOR_FAILURE"
  | "BATTERY_DEGRADATION"
  | "FUEL_SHORTAGE"
  | "EXTREME_COLD"
  | "HIGH_WIND"
  | "LOAD_REDUCTION"
  | "BACKUP_GEN_ACTIVATION"
  | "COMMUNICATION_OUTAGE";

export interface SimulationParameters {
  scenarioType: ResilienceScenarioType;
  targetAssetId?: string;
  severity?: "WARNING" | "CRITICAL";
  durationHours?: number;
  ambientTempC?: number;
  windSpeedMs?: number;
  loadReductionPct?: number;
  fuelLossLiters?: number;
  batteryDegradationPct?: number;
  deterministicSeed?: number | string;
}

export interface SimulationComparisonItem {
  metric: string;
  unit: string;
  baseline: number | string;
  scenario: number | string;
  absoluteChange: number | string;
  percentageChange: number | string;
  severity: "CRITICAL" | "WARNING" | "IMPROVEMENT" | "NEUTRAL";
  reason: string;
}

export interface ImpactedAssetSummary {
  assetId: string;
  assetName: string;
  assetType: string;
  baselineStatus: string;
  simulatedStatus: string;
  baselineHealth: number;
  simulatedHealth: number;
  failureCause: string;
  criticality: string;
}

export interface BlastRadiusNode {
  id: string;
  label: string;
  domain: "INFRASTRUCTURE" | "ENERGY" | "ENVIRONMENT" | "LOGISTICS" | "LIFE_SUPPORT" | "COMMS";
  severity: "NORMAL" | "WARNING" | "CRITICAL";
  status: string;
  impactDescription: string;
  metricValue?: string;
}

export interface BlastRadiusEdge {
  source: string;
  target: string;
  dependencyType: string;
  impactReason: string;
}

export interface ResilienceSimulationResult {
  simulationId: string;
  stationId: string;
  scenarioType: ResilienceScenarioType;
  title: string;
  label: "SIMULATION"; // Explicit non-measured label
  modelVersion: string;
  deterministicSeed: string;
  createdAt: string;
  snapshotTimestamp: string;
  parameters: SimulationParameters;
  baselineSnapshot: TwinState;
  scenarioState: TwinState;
  explanation: string;
  impactedAssets: ImpactedAssetSummary[];
  blastRadius: {
    nodes: BlastRadiusNode[];
    links: BlastRadiusEdge[];
  };
  comparisons: SimulationComparisonItem[];
  operationalRisk: {
    score: number;
    level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    factors: string[];
  };
  recoveryState: {
    suggestedActions: string[];
    estimatedRecoveryMinutes: number;
  };
}


