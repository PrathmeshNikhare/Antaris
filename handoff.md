# Phase 1 & Phase 2 Handoff — Hardened Data Model & Comms-Resilience Layer

## Completed Implementations

### Phase 1: Data-Model Hardening
1. **Preserved Foundations**: Stations, Assets, Telemetry Points, Inventory Items, Alerts, Forecasts, and Simulation entities remained fully intact.
2. **Asset Dependencies (`asset_dependencies` table)**:
   - Stores `fromAssetId`, `toAssetId`, `dependencyType` (`POWER`, `THERMAL`, `WATER`, `DATA`, `MECHANICAL`, `LOGISTIC`), `criticality`, `description`, `createdAt`.
   - Supports dependency chains (e.g. Generator 1 -> Battery / HVAC / Water / Comms -> Main Building).
   - Recursive SQL Common Table Expression (CTE) downstream traversal implemented in [`AssetDependencyRepository.findDownstream()`](file:///c:/Users/Vidhansh/OneDrive/Desktop/sih69/Maitri-Bharti/apps/api/src/repositories/asset-dependency.repository.ts) and exposed via `GET /api/dependencies/downstream/:assetId`.
3. **Canonical Metric Definitions (`metric_definitions` table)**:
   - Stores metric name, canonical unit, min/max plausible bounds, warning thresholds, critical thresholds, sampling interval, aggregation strategy, and allowed asset types.
   - Seeded 11 canonical metrics across energy, thermal, logistics, and atmospheric monitoring.
   - Exposed via `GET /api/metrics` and `GET /api/metrics/:metric`.
4. **Telemetry Sequence & Provenance Persistence**:
   - `telemetry_points` extended with `sequence` and `ingested_at` columns and indexed by `(station_id, asset_id, sequence DESC)`.
   - Strict source preservation (`SIMULATED`, `EXTERNAL`, `MEASURED`, `MQTT`, `API`, `MANUAL`) with zero silent conversion.
5. **Alert Structure Hardening**:
   - `alerts` extended with `rule_id`, `confidence`, `detected_at`, `recommended_action`, `evidence_window` (JSONB), and `impact_summary`.
6. **Maintenance History (`maintenance_events` table)**:
   - Stores station, asset, maintenance type, scheduled/completed timestamps, notes, parts used, and operational result.
   - Seeded maintenance events for both Maitri and Bharati.
7. **Operator RBAC & Audit Trail (`operators`, `audit_events`, `command_requests`, `command_approvals` tables)**:
   - Operators with roles (`ADMIN`, `ENGINEER`, `OPERATOR`, `LOGISTICS`, `VIEWER`).
   - Audit trail capturing operator ID, action, target type/ID, previous/new state diffs, and correlation IDs.
   - Foundational approval workflow tables for simulated policy auditing (physical hardware actuation is strictly prohibited).

### Phase 2: Telemetry & Communications-Resilience Layer
1. **Deterministic PRNG & Baseline Generator**:
   - Mulberry32 PRNG and Box-Muller Gaussian noise generating 100% reproducible diurnal baseline physical curves.
2. **Expanded Sensor Telemetry Model (22+ Canonical Sensors)**:
   - **Environment**: ambient temperature, wind speed, atmospheric pressure, solar irradiance.
   - **Generators & CHP**: power output (kW), fuel consumption (L/h), coolant temperature (°C), oil pressure (bar).
   - **Batteries**: state of charge (%), DC bus voltage (V), charge/discharge rate (kW).
   - **HVAC**: indoor temperature (°C), thermal heating load (kW), airflow circulation (CFM).
   - **Water Systems**: Priyadarshini lake pump flow / RO desalination flow (L/min), potable water storage level (L), water temperature (°C).
   - **Communications**: SNR (dB), packet loss (%), round-trip satellite latency (ms).
   - **Energy Grid & Logistics**: grid load (kW), daily fuel burn rate (L/day), water consumption (L/day).
3. **Strict Validation & Non-Destructive Tagging**:
   - Validates station, asset, metric, unit, timestamp, sequence, and source.
   - Non-matching or invalid provenance source is strictly rejected with an explicit error (never silently coerced to SIMULATOR).
   - Physical boundary violations flag `quality = "SUSPECT"` while preserving the packet for diagnostic review.
4. **Per-Stream Sequence Tracking & Deduplication**:
   - Tracks sequence numbers per stream `(stationId, assetId, metric)`.
   - Detects and records duplicates (deduplicated so duplicate packets are not double-persisted into TimescaleDB).
   - Detects and records sequence gaps (`gapCount`) and out-of-order deliveries (`outOfOrderCount`).
   - Exposes stream states and metrics via `GET /api/telemetry/ingest/stats`.
5. **Real Store-and-Forward Edge Buffering with Persistence**:
   - Buffered packets are held in a FIFO queue and persisted to disk storage (`data/edge_offline_buffer.json`) simulating edge SSD storage.
   - Batch replay mechanism groups buffered messages with unique `batchId`, `sequenceRange`, `queuedAt`, `publishedAt`, and `retryCount`.
   - Real server acknowledgement flushes acknowledged packets upon successful broker ingestion.
6. **4-State Connectivity Degradation Simulation**:
   - `NORMAL`: 100% immediate delivery to MQTT broker.
   - `DEGRADED`: Simulates polar satellite link fade/jitter with 30% packet loss routed to edge buffer.
   - `OFFLINE`: 100% packets held in edge store-and-forward queue.
   - `RECOVERY`: Replays buffered batches chronologically with acknowledgement until queue reaches 0, then automatically transitions back to `NORMAL`.
   - Exposed via `GET /api/telemetry/simulate/status` and `POST /api/telemetry/simulate/connectivity`.
7. **Deterministic Anomaly Demo Controls**:
   - Six interactive presets:
     - `GENERATOR_OVERHEAT`
     - `FUEL_CONSUMPTION_SPIKE`
     - `BATTERY_DISCHARGE`
     - `HVAC_LOAD_SPIKE`
     - `COMMUNICATION_LOSS`
     - `ENVIRONMENTAL_EXTREME`
   - Triggerable via `POST /api/telemetry/simulate/anomaly/preset`.

---

### Phase 3: Operational Digital Twin Engine
1. **In-Memory TwinState Registry (`apps/api/src/twin/registry.ts`)**:
   - Maintains continuous live state in-memory for Maitri and Bharati without round-tripping to TimescaleDB on every packet.
   - Synchronizes directly with `TelemetryIngestService` listener for sub-millisecond updates upon MQTT packet ingestion.
   - Station state fields: `stationStatus` (`OPERATIONAL`, `DEGRADED`, `CRITICAL`, `OFFLINE`), `statusAssessment` (with deterministic reason, contributing assets, and contributing alerts), `lastSync`, `dataFreshness`, `connectivityState`, `dataQualitySummary`, `assets`, `energy`, `environment`, `logistics`, `activeAlerts`, `operationalRisk`, and `recentTransitions`.
2. **Asset Health & Anomaly Evaluation (`apps/api/src/twin/health.ts`)**:
   - `AssetHealthEvaluator` dynamically scores asset health (0–100) based on observed telemetry deviations against canonical `metric_definitions` warning and critical thresholds.
   - Computes deterministic status (`OPERATIONAL`, `WARNING`, `DEGRADED`, `FAILED`, `MAINTENANCE`).
   - Retains active anomaly state (`hasActiveAnomaly`, `type`, `description`, `since`).
3. **Typed Metric $\rightarrow$ Twin Property Mapping**:
   - Ingested telemetry points are typed into canonical `TwinTelemetryProperty` objects containing `value`, `unit`, `timestamp`, `quality`, `source`, `sequence`, `observedAt`, `ageSeconds`, and `freshness`.
   - Prevents UI or frontend components from manually parsing disparate database rows.
4. **Dependency Graph Support & Impact Traversal (`apps/api/src/twin/dependency-graph.ts`)**:
   - `TwinDependencyGraph` maintains directed dependency topology across station assets.
   - Multi-hop recursive DFS traversal (`getDownstreamImpact(assetId)`) determines all cascaded impacted assets, propagation paths, and maximum cascaded criticality.
   - Automatically tags `impactedDownstreamAssets` on the affected parent asset state.
5. **Deterministic Explainable Station Aggregation (`apps/api/src/twin/evaluator.ts`)**:
   - `StationAggregateEvaluator` calculates station status via strictly explainable priority rules:
     - `OFFLINE`: Connectivity state is `OFFLINE` or data freshness is `UNKNOWN`.
     - `CRITICAL`: Any `CRITICAL` asset is `FAILED`, or active `CRITICAL` alerts, or battery SoC <= 20%, or net power deficit without reserve, or days of fuel <= 7.
     - `DEGRADED`: Any `CRITICAL`/`HIGH` asset is `DEGRADED`/`WARNING`, or net power deficit, or battery SoC <= 40%, or active `WARNING` alerts, or extreme weather conditions.
     - `OPERATIONAL`: All primary life-support and energy systems nominal.
   - Aggregates energy grid status (`totalGenerationKw`, `totalLoadKw`, `netPowerKw`, `gridStatus`).
   - Aggregates environmental condition (`NORMAL`, `KATABATIC_WIND`, `BLIZZARD`, `EXTREME_COLD`).
   - Aggregates logistics autonomy (`daysOfFuelRemaining`, `daysOfWaterRemaining`, `daysOfFoodRemaining`).
   - Computes operational risk index (0–100) and identifies risk factors.
6. **Freshness & Provenance Tracking (`apps/api/src/twin/freshness.ts`)**:
   - Freshness classified deterministically: `FRESH` ($\le 30$s), `STALE` (30–300s), `UNKNOWN` ($> 300$s).
   - Provenance retained for every derived state (`SIMULATED`, `EXTERNAL`, `MEASURED`).
7. **WebSocket Live Event Streaming (`apps/api/src/twin/websocket.ts`)**:
   - Attached to the HTTP server at path `/ws`.
   - Supports station-level subscription (`{"type": "subscribe", "stationId": "station-maitri"}`).
   - Broadcasts typed live events:
     - `telemetry.updated`
     - `asset.state_changed`
     - `station.state_changed`
     - `alert.raised` / `alert.cleared`
     - `connectivity.changed`
     - `dependency.impact_changed`
     - `snapshot.created`
8. **Immutable Snapshots & Historical Time-Travel State Reconstruction**:
   - `createSnapshot(stationId)` returns a deep-cloned, `Object.freeze`-protected serializable snapshot ready for simulation branching and archival.
   - `reconstructHistoricalState(stationId, timestamp)` queries TimescaleDB hypertable for telemetry points up to the target timestamp and deterministically replays state evolution to reconstruct the exact historical Twin state.
9. **REST APIs Mounted at `/api/twin`**:
   - `GET /api/twin/:stationId`: Live station twin state
   - `GET /api/twin/:stationId/assets/:assetId`: Specific asset twin state
   - `GET /api/twin/:stationId/impact/:assetId`: Downstream impact analysis
   - `GET /api/twin/:stationId/snapshot`: Immutable serializable snapshot
   - `GET /api/twin/:stationId/time-travel?at=...`: Historical state reconstruction

---

## Verification Results

| Check | Result | Details |
|---|---|---|
| **Typecheck** | **PASS** | `npm run typecheck` across `@maitri-bharati/shared`, `@maitri-bharati/api`, `@maitri-bharati/web` (0 errors) |
| **Lint** | **PASS** | `npm run lint` across all 3 workspaces with Oxlint / ESLint (0 errors, 0 warnings) |
| **Unit & Integration Tests** | **PASS** | 53 passed across 3 workspaces (5 shared, 45 api, 3 web) including 14 Phase 3 specific tests |
| **Database Migrations** | **PASS** | Applied `001_initial_schema.sql` and `002_data_model_hardening.sql` |
| **Database Seeding** | **PASS** | Seeded stations, assets, dependencies, metric definitions, maintenance events, operators, and audit logs |
| **Live API & WebSocket Verification** | **PASS** | Verified live state query at `/api/twin/station-maitri`, downstream impact analysis at `/api/twin/station-maitri/impact/asset-maitri-gen-1`, and WebSocket connection at `ws://localhost:3001/ws` |
| **Production Build** | **PASS** | `npm run build` succeeds across all workspaces |

---

## Key Demonstration

```text
GEN-01 Anomaly Triggered (Generator Overheat / Tripped)
  -> Asset Health Evaluator flags asset-maitri-gen-1 status: FAILED (health score drops)
  -> Twin Dependency Graph identifies downstream cascaded impact:
       - asset-maitri-bat-1 (Battery System)
       - asset-maitri-hvac-1 (Heating & Ventilation)
       - asset-maitri-water-1 (Priyadarshini Lake Water Extraction)
       - asset-maitri-comm-1 (Polar Satellite Terminal)
       - asset-maitri-bld-main (Main Living Module)
  -> Station Aggregate Evaluator triggers Station Status change: OPERATIONAL -> DEGRADED / CRITICAL
  -> WebSocket broadcasts live events:
       - asset.state_changed (assetId: asset-maitri-gen-1, status: FAILED)
       - dependency.impact_changed (impactedCount: 5, maxCriticality: CRITICAL)
       - station.state_changed (stationId: station-maitri, status: DEGRADED)
```

---

### Phase 4: Desktop-First Operations Command Center
1. **Design System & Visual Aesthetics (`apps/web/src/index.css`)**:
   - Built strictly to `ui-ux.md` standards: warm off-white background (`--bg: #f7f8f4`), deep forest green accent (`--green: #146b4a`, `--green-dark: #0b4a35`), white elevated cards (`--surface: #ffffff`), and dark charcoal typography (`--text: #17211b`).
   - Replaced generic AI clichés (no purple gradients, no glassmorphism, no fake marketing banners) with high-density Antarctic remote operations layouts.
2. **Context & Live Navigation Shell**:
   - `Sidebar`: 10 core operational routes (`/`, `/twin`, `/infrastructure`, `/energy`, `/logistics`, `/environment`, `/intelligence`, `/simulations`, `/reports`, `/audit`).
   - `TopBar`: Real-time Station Switcher (Maitri 70°S vs. Bharati 69°S), deterministic Station Status pill, live telemetry age & freshness pill, satellite comms link selector (`NORMAL`, `DEGRADED`, `OFFLINE`, `RECOVERY`), anomaly preset demo injector, and WebSocket link indicator.
3. **Core Operational Features**:
   - **Overview (`/`)**: 4-domain KPI summary (Energy, Infrastructure, Logistics, Environment), mini Digital Twin status grid, explainable status reasoning, active alerts console with severity badges and evidence, operational risk score (0–100), and live incoming WebSocket event stream.
   - **Digital Twin (`/twin`)**: Interactive 2D architectural blueprint layout with asset blocks, dynamic status rings, and health score bars. Selecting any asset docks the Asset Inspector showing live telemetry properties, freshness status, provenance, and triggers real-time **downstream cascade dependency traversal** highlighting impacted assets with animated warning rings.
   - **Infrastructure (`/infrastructure`)**: Hierarchical asset table grouped by subsystem with criticality filters, telemetry count, and maintenance history log (`/api/maintenance`).
   - **Energy Grid (`/energy`)**: Generation vs. load balance meters, net power surplus/deficit, battery storage (BESS) SoC%, fuel burn velocity, and critical dependent loads list.
   - **Logistics (`/logistics`)**: Consumables inventory (Diesel A1, Fresh Water, Rations, Medical Oxygen, Generator Spares), daily burn rate, days of autonomy remaining, resupply urgency, and cross-domain thermal heating trace line dependencies.
   - **Environment (`/environment`)**: Antarctic automated weather station (AWS) console with ambient temperature, wind velocity (m/s and km/h), barometric pressure, chill factors, and katabatic wind/blizzard hazard alert matrix.
   - **Intelligence (`/intelligence`)**: Anomaly matrix, deterministic risk factors, and physical threshold exceedance tracking.
   - **Simulations (`/simulations`)**: Sandbox with live satellite link blackout toggles, store-and-forward edge buffer queue monitor, and deterministic anomaly injection.
   - **Reports (`/reports`)**: Point-in-time immutable Twin state snapshot generator with JSON export.
   - **Audit (`/audit`)**: Verifiable operator action and system event trail from `/api/audit`.
4. **Reactive WebSocket Streaming (`useStation` hook)**:
   - Connects to `ws://localhost:3001/ws`, subscribes to the active station, immutably mutates affected assets upon `telemetry.updated` or `asset.state_changed`, re-syncs state on `station.state_changed`, and streams events into the live event feed.

---

## Verification Results

| Check | Result | Details |
|---|---|---|
| **Typecheck** | **PASS** | `npm run typecheck` across `@maitri-bharati/shared`, `@maitri-bharati/api`, `@maitri-bharati/web` (**0 errors**) |
| **Lint** | **PASS** | `npm run lint` across all 3 workspaces with Oxlint / ESLint (**0 errors, 0 warnings**) |
| **Unit & Integration Tests** | **PASS** | **49 tests passed** across 3 workspaces (45 api, 4 web) |
| **Database Migrations** | **PASS** | Applied `001_initial_schema.sql` and `002_data_model_hardening.sql` |
| **Database Seeding** | **PASS** | Seeded stations, assets, dependencies, metric definitions, maintenance events, operators, and audit logs |
| **Live API & WebSocket Verification** | **PASS** | Verified live state query at `/api/twin/station-maitri`, downstream impact analysis at `/api/twin/station-maitri/impact/asset-maitri-gen-1`, and WebSocket connection at `ws://localhost:3001/ws` |
| **Production Build** | **PASS** | `npm run build` succeeds across all workspaces (**dist/ built in 236ms**) |

---

## Key Demonstration

```text
Operator selects "GEN-01 Overheat & Trip" in TopBar Demo Scenario dropdown
  -> API simulator injects deterministic generator trip
  -> Telemetry Ingest validates & updates TimescaleDB
  -> Digital Twin Engine evaluates Asset Health: GEN-01 drops to FAILED
  -> Dependency Graph traverses cascade: 5 downstream assets tagged (BESS, HVAC, Water, Comms, Habitat)
  -> Station Aggregate transitions: OPERATIONAL -> DEGRADED
  -> WebSocket broadcasts events: asset.state_changed, dependency.impact_changed, station.state_changed
  -> Operations Command Center instantly renders:
       1. TopBar status pill transitions to DEGRADED
       2. Digital Twin blueprint pulses red on GEN-01 and highlights all 5 impacted downstream assets
       3. Inspector Panel reveals cascade propagation paths and critical alert
       4. Live Event Stream displays real-time event logs with millisecond timestamps
```

---

## Phase 5: Explainable Operational Intelligence & AI/ML

### Completed Implementations

1. **Dual-Layer Anomaly Detection (`apps/api/src/intelligence/anomaly/`)**:
   - **Layer 1 (Deterministic Baseline & SPC)**: Evaluates dynamic rolling statistical process control (SPC) bands (moving average $\pm 2.5\sigma$ warning, $\pm 3.5\sigma$ critical), rate-of-change limits ($\Delta v / \Delta t$), and physical limit thresholds from `MetricDefinition`.
   - **Layer 2 (Isolation Forest / iForest)**: Implemented a native TypeScript multi-tree Isolation Forest ensemble evaluated over 4-dimensional normalized feature vectors:
     $$\mathbf{x} = \left[ \frac{x - \mu}{\sigma}, |z|, \frac{\Delta v / \Delta t}{\sigma}, \frac{\sigma^2}{\sigma_{\text{baseline}}^2} \right]$$
     Computes average tree path length $h(x)$ normalized against $c(n)$, returning anomaly scores $[0.00, 1.00]$ with tree-split feature attribution for complete explainability.
   - **Fused Score & Confidence**: Fuses rule scores with iForest outputs and factors in data quality (`GOOD`: 0.94, `SUSPECT`: 0.65, `BAD`: 0.25).

2. **Auditable Evidence Generation (`evidence-builder.ts`)**:
   - Every anomaly produces an auditable `AnomalyEvidence` record containing:
     - `deviationFromBaseline` and unit
     - `zScore` ($\sigma$)
     - `trendDirection` (`RISING`, `FALLING`, `STABLE`)
     - `rateOfChange` per minute
     - `thresholdCrossing` with breached threshold type and actual value
     - `contributingWindowMinutes`
     - Human-readable natural-language explanation string

3. **24-Hour Energy Forecasting Engine (`energy-forecaster.ts`)**:
   - Models polar diurnal physics:
     - Ambient temperature cycle with sine variation ($\pm 4.0^\circ\text{C}$)
     - Solar PV generation arc (peak daylight window)
     - Wind generation from turbine power curves
     - Electrical & heating demand: base load + heating draw ($0.65\text{ kW}$ per degree below $-20^\circ\text{C}$)
     - Net required diesel generator dispatch and fuel burn ($0.258\text{ L/kWh}$)
   - Outputs 24 hourly projections with $P_{10}$ (optimistic) and $P_{90}$ (conservative) confidence envelopes.

4. **Inventory & Fuel Depletion Forecaster (`inventory-forecaster.ts`)**:
   - Tracks 4 mission-critical commodities: Polar Diesel Fuel, Potable Water, Expedition Rations, and Generator Spares.
   - Computes:
     - Days remaining: $\frac{\text{CurrentStock}}{\text{DailyBurnRate}}$
     - Depletion date
     - Date of critical 20% survival reserve breach
     - Dynamic consumption trend (`ACCELERATING` under extreme cold snaps)
     - Resupply urgency (`ROUTINE`, `ATTENTION`, `URGENT`, `EMERGENCY`) calibrated against the 180-day Antarctic winter resupply gap.

5. **Explainable Asset Health Evaluator (`asset-health-evaluator.ts`)**:
   - Computes 0–100 health index per asset with transparent penalty attribution:
     - Telemetry deviation penalty (up to 25 pts)
     - Anomaly history penalty (up to 30 pts)
     - Runtime duty cycle penalty (up to 15 pts)
     - Maintenance penalty (up to 15 pts)
     - Operating stress penalty (up to 15 pts)
     - Telemetry freshness/confidence penalty (up to 10 pts)
   - Prominently labeled with mandatory decision-support disclaimer: *"Decision-support indicator, not a guaranteed failure probability"*.

6. **Cross-Domain Causal Cascade Engine (`cross-domain-risk-engine.ts`)**:
   - Evaluates multi-domain ripple effects across `INFRASTRUCTURE`, `ENERGY`, `ENVIRONMENT`, and `LOGISTICS`.
   - Generates directed Causal Chains:
     $$\text{GEN-01 Thermal Stress} \longrightarrow \text{Engine Efficiency Loss} \longrightarrow \text{Fuel Burn Surge (+22\%)} \longrightarrow \text{Reserve Runway Shortening (-18 Days)} \longrightarrow \text{Logistics Resupply Buffer Risk}$$
   - Exposes causal nodes, directed links, and contributing root factors.

7. **Advisory Recommendation Engine & Model Observability (`recommendation-engine.ts`, `model-registry.ts`)**:
   - Generates structured, advisory actions (`INSPECT_ASSET`, `REDUCE_LOAD`, `CHECK_SPARES`, `MONITOR_TREND`, `RUN_SIMULATION`).
   - Persists execution provenance in `ModelRegistry`: model name, version, task, execution latency ($ms$), confidence, and timestamp.

8. **Operations Command Center UI (`IntelligencePage.tsx`)**:
   - **Hero Causal Cascade Graph**: High-contrast, interactive node-link cascade diagram with domain color tokens, metric delta chips, and impact links.
   - **24-Hour Energy Forecast Chart**: SVG line/area visualization with shaded $P_{10}-P_{90}$ envelope, demand curve, and renewable generation lines.
   - **Inventory Depletion Radar**: Real-time runway countdown, depletion dates, and resupply urgency badges.
   - **Asset Health Matrix**: 0–100 score gauges with expandable penalty breakdowns.
   - **Active Anomaly Inspector**: Real-time evidence dossier with deviation, Z-score, rate of change, and threshold crossings.
   - **Advisory Actions Panel**: Prioritized operator guidance cards.
   - **Model Observability Ledger**: Live audit table of model executions and latencies.

9. **REST API Endpoints & WebSocket Events**:
   - `GET /api/stations/:stationId/intelligence`
   - `GET /api/stations/:stationId/intelligence/anomalies`
   - `GET /api/stations/:stationId/intelligence/forecasts/energy`
   - `GET /api/stations/:stationId/intelligence/forecasts/inventory`
   - `GET /api/stations/:stationId/intelligence/health`
   - `GET /api/stations/:stationId/intelligence/risk`
   - `GET /api/stations/:stationId/intelligence/recommendations`
   - `GET /api/stations/:stationId/intelligence/observability`
   - `POST /api/stations/:stationId/intelligence/anomalies/evaluate`
   - WebSocket event: `"intelligence.updated"`.

---

## Next Steps: Phase 6 (Maitri–Bharati Resilience Simulation Engine)
- Build the simulation engine running against immutable Digital Twin snapshots (`TwinSnapshot`).
- Support what-if stress scenarios: Generator trip, battery degradation, extreme polar blizzard, and fuel leak.
- Deterministic impact calculation comparing baseline state vs scenario state across all 4 domains.
- Provide interactive scenario runner in the Command Center UI.
