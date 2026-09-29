# Implementation Phases

## Phase 0 — Repository and foundation

Deliver:

- monorepo/folder structure
- frontend shell
- backend shell
- shared types
- Docker Compose
- environment configuration
- lint/typecheck/test setup

Exit criteria:
- frontend and backend start
- database starts
- health endpoint works

## Phase 1

```text
Read:
- AGENTS.md
- requirements.md
- architecture.md
- data-model.md
- telemetry.md
- security.md
- current progress.md
- current git state

The current repository already contains the Maitri-Bharati foundation and telemetry work. Do NOT rewrite previous phases.

Implement only the data-model hardening required to make the Digital Twin operationally stronger than a simple monitoring dashboard.

GOALS:

1. Preserve the existing Station, Asset, Telemetry, Inventory, Alert, Forecast and Simulation models.

2. Add asset dependency relationships.

Create an AssetDependency model/table supporting:
- fromAssetId
- toAssetId
- dependencyType
- criticality
- description
- createdAt

This must support dependency chains such as:

GENERATOR
  -> ENERGY SYSTEM
  -> HVAC / WATER / COMMUNICATION
  -> LOGISTICS RISK

3. Add a MetricDefinition model/table.

It must support:
- metric name
- canonical unit
- min plausible value
- max plausible value
- warning threshold
- critical threshold
- expected sampling interval
- aggregation strategy
- allowed asset types

4. Extend Telemetry persistence.

Persist:
- sequence number
- ingestion timestamp
- source
- quality

Do not silently lose provenance.

5. Improve Alert structure.

Add fields where appropriate for:
- ruleId
- confidence
- detectedAt
- recommendedAction
- evidenceWindow
- impactSummary

6. Add MaintenanceEvent.

Support:
- asset
- maintenance type
- scheduled/completed time
- notes
- parts used
- result

7. Add operator/audit domain foundations.

Create types and database structures for:
- Operator
- OperatorRole
- AuditEvent
- CommandRequest
- CommandApproval

Physical control is NOT being implemented.

8. Make provenance explicit everywhere.

Every derived value must be able to identify:
- source
- observation time
- data quality
- simulated/external/measured mode
- model version when applicable

9. Add seed data for:
- realistic asset dependencies
- metric definitions
- maintenance history
- audit examples

Do not fabricate real measured station data. All seed operational values must remain explicitly SIMULATED.

10. Add migrations and tests.

Acceptance tests must verify:
- dependency relationships exist
- metric definitions exist
- telemetry sequence is persisted
- provenance is retained
- maintenance events exist
- audit records can be stored
- both stations still seed correctly

Do not implement:
- dashboard redesign
- AI
- LLM
- 3D UI
- physical control

After implementation:
- run migrations
- run seed
- run typecheck
- run lint
- run tests
- update progress.md
- update handoff.md
```

## Phase 2 

```text
Read:
- AGENTS.md
- requirements.md
- telemetry.md
- data-model.md
- architecture.md
- security.md
- current progress.md
- current implementation

Implement Phase 2 only.

The goal is a credible Antarctic telemetry and communications-resilience layer.

Do NOT build AI, dashboard redesign, LLM or simulation yet.

1. Preserve the existing deterministic telemetry simulator.

It must remain reproducible from a seed.

Support:
- normal
- noisy
- anomaly
- offline
- recovery

2. Expand the telemetry model.

Generate telemetry for:
- environment
- generators
- batteries
- HVAC
- water systems
- communications
- energy
- logistics-related consumption

Ensure metric/unit consistency.

Do not create physically contradictory values relative to seeded asset capacities.

3. Improve validation.

Validate:
- station
- asset
- metric
- unit
- timestamp
- sequence
- plausible range
- source
- quality

Do not silently convert an invalid source into SIMULATOR.

Invalid provenance must be rejected or explicitly marked invalid/suspect.

4. Implement sequence handling.

Track per-stream sequence numbers.

Detect:
- duplicates
- gaps
- out-of-order packets

Expose ingestion statistics.

5. Implement real store-and-forward semantics.

Offline flow:

telemetry
 -> edge queue
 -> persistence
 -> connectivity recovery
 -> batch replay
 -> server acknowledgement
 -> deduplication
 -> database

Do not use localStorage as the source of truth.

6. Add acknowledgement and replay metadata.

Track:
- queuedAt
- publishedAt
- acknowledgedAt
- retry count
- sequence range
- replay status

7. Add connectivity degradation simulation.

Support:
- normal
- degraded
- offline
- recovery

Expose:
- connected/disconnected
- queued count
- oldest buffered message
- last successful sync
- replay progress

8. Add deterministic anomaly injection.

Provide demo controls for:
- generator overheating
- fuel consumption spike
- battery discharge
- HVAC load spike
- communication loss
- environmental extreme

9. Keep all telemetry source-labeled.

The UI/API must clearly distinguish:
- SIMULATED
- EXTERNAL
- MEASURED

Never present simulator values as actual station measurements.

10. Tests.

Verify:
- deterministic replay
- validation
- duplicate handling
- sequence gaps
- offline buffering
- recovery replay
- persistence
- provenance

The Phase 2 exit criterion is:

telemetry -> MQTT -> validate -> persist -> recover -> replay -> query

After implementation:
- run tests
- typecheck
- lint
- verify Docker startup
- update progress.md
- create handoff.md
```

## Phase 3

```text
Read:
- AGENTS.md
- architecture.md
- digital-twin.md
- telemetry.md
- data-model.md
- requirements.md
- security.md
- current progress.md
- current implementation

Implement Phase 3 only.

Build the Operational Digital Twin Engine.

The Digital Twin must not be a database wrapper.

It must maintain the live operational state and relationships of Maitri and Bharati.

1. Build a TwinState registry.

Each station must expose:
- station status
- last synchronization
- data freshness
- connectivity state
- data quality summary
- assets
- energy state
- environment state
- logistics state
- active alerts
- operational risk

2. Build TwinAssetState.

Each asset should expose:
- current telemetry values
- status
- health score
- criticality
- last update
- freshness
- data quality
- anomaly state
- maintenance state

3. Build metric -> Twin property mapping.

Telemetry should update Twin state through a typed mapping layer.

Do not allow the dashboard to manually reconstruct Twin state from raw database rows.

4. Build dependency graph support.

The Twin must understand:

Asset A depends on Asset B

and calculate affected downstream nodes.

Expose an impact traversal function.

Example:

GEN-01 failure
 -> energy bus
 -> HVAC
 -> water
 -> communications
 -> logistics

5. Implement state transitions.

Examples:
OPERATIONAL -> WARNING
WARNING -> DEGRADED
DEGRADED -> FAILED
FAILED -> RECOVERING
RECOVERING -> OPERATIONAL

Store transition information.

6. Implement station-level status calculation.

Use deterministic explainable rules.

Station status must include:
- current state
- reason
- contributing assets
- contributing alerts

7. Implement freshness.

Every important Twin value should expose:
- observedAt
- ageSeconds
- freshness status

Support:
FRESH
STALE
UNKNOWN

8. Implement provenance.

Every derived Twin property must retain source information.

9. Build WebSocket events.

Support typed events:
- telemetry update
- asset state changed
- station state changed
- alert created
- alert updated
- connectivity changed
- dependency impact changed

The frontend should consume Twin events, not read the database directly for realtime updates.

10. Add Twin snapshots.

A snapshot must be serializable and immutable.

It will later be used by the simulation engine.

11. Add Twin replay/time-travel foundations.

Support loading historical snapshots or reconstructing state from historical telemetry.

Do not build the final replay UI yet.

12. Tests.

Test:
- telemetry causes Twin state changes
- status transitions
- dependency traversal
- freshness
- provenance
- station aggregates
- WebSocket events
- immutable snapshots

The key demonstration after this phase should be:

GEN-01 anomaly
 -> Twin state changes
 -> downstream impacted assets identified

Do not build:
- AI
- LLM
- full dashboard redesign
- 3D
- autonomous actions

Update progress.md and handoff.md.
```

## Phase 4

```text
Read:
- AGENTS.md
- ui-ux.md
- frontend.md
- requirements.md
- digital-twin.md
- architecture.md
- current progress.md

Implement Phase 4 only.

Build the desktop-first Maitri-Bharati Operations Command Center.

Important:
The application must look like a high-end remote operations product, not a generic AI dashboard.

Use the visual strengths of the supplied Antarctic reference:
- compact navigation
- information-dense command center
- interactive twin/plan
- inspector panel
- alert center
- event stream
- clear station context

But do NOT clone the reference.

Do NOT use:
- purple gradients
- glassmorphism
- excessive pills
- futuristic backgrounds
- glowing particles
- giant marketing hero sections
- fake AI branding

Main navigation:
- Overview
- Digital Twin
- Infrastructure
- Energy
- Logistics
- Environment
- Intelligence
- Simulations
- Reports
- Audit

Overview must show:
- active station
- station status
- last synchronization
- connectivity
- data mode
- data quality
- energy summary
- infrastructure summary
- logistics summary
- environment summary
- digital twin preview
- active alerts
- current operational risks
- recent operator events

Digital Twin screen:
- station plan/diagram
- asset markers
- health/status
- dependency highlighting
- selection inspector
- telemetry trend
- freshness
- provenance
- active anomalies
- maintenance status

Infrastructure:
- asset hierarchy
- asset health
- criticality
- anomaly history
- maintenance

Energy:
- generation
- consumption
- battery state
- fuel
- energy reserve
- forecast
- risk
- affected loads

Logistics:
- inventory
- daily consumption
- days remaining
- threshold
- lead time
- resupply urgency
- dependency on energy/risk

Environment:
- temperature
- wind
- pressure
- humidity
- environmental trend
- environmental risk

Alerts:
Every alert must show:
- severity
- source
- timestamp
- freshness
- evidence
- contributing metric(s)
- affected asset
- downstream impact
- recommended inspection/action

Use real API/Twin data.

Realtime updates must use WebSocket events.

Do NOT reconstruct operational state in React from arbitrary raw telemetry.

Add:
- loading states
- empty states
- error states
- stale-data states
- offline connectivity indicator

Status must never rely on color alone.

Do not implement AI yet.

After implementation:
- test all routes
- verify station switching
- verify realtime update rendering
- verify stale/offline states
- run typecheck
- lint
- tests
- update progress.md
- produce handoff.md
```

## Phase 5

```text
Read:
- AGENTS.md
- ai-ml.md
- digital-twin.md
- workflows.md
- data-model.md
- requirements.md
- current progress.md

Implement Phase 5 only.

Build the Explainable Operational Intelligence layer.

Do NOT begin with an LLM.

The goal is to transform telemetry into:
anomaly -> evidence -> forecast -> asset health -> cross-domain risk -> recommendation

1. Anomaly detection

Implement:
- deterministic baseline/rule detection
- Isolation Forest or equivalent explainable initial model

Inputs may include:
- current value
- rolling mean
- rolling std
- rate of change
- deviation from expected range
- related environmental context

Every anomaly result must contain:
- assetId
- metric
- score
- confidence
- detectedAt
- modelVersion
- evidence
- dataQuality

2. Evidence generation

Do not show only an anomaly score.

Generate evidence such as:
- deviation from baseline
- trend direction
- threshold crossing
- rate of change
- contributing telemetry window

3. Energy forecasting

Forecast:
- next 24h demand
- generation
- reserve
- fuel consumption where supported

Include:
- predicted value
- lower bound
- upper bound
- model version
- generated timestamp
- confidence/evidence

4. Inventory/fuel forecasting

Calculate:
- days remaining
- depletion date
- threshold crossing date
- consumption trend
- lead-time risk
- resupply urgency

5. Asset health score

Build an explainable health score from:
- telemetry deviations
- anomaly history
- runtime
- maintenance age
- operating stress
- data confidence

Clearly label it as a decision-support indicator, not a guaranteed failure probability.

6. Cross-domain risk engine

Build transparent deterministic logic.

Example:

generator degradation
 -> efficiency loss
 -> fuel increase
 -> reserve reduction
 -> logistics risk

Each risk result must expose contributing factors.

7. Recommendation engine

Generate structured recommendations such as:
- inspect asset
- reduce non-critical load
- inspect spare availability
- monitor trend
- run simulation

Recommendations must be advisory.

8. Model observability

Persist:
- model name/version
- generatedAt
- input summary
- result
- confidence
- evidence

9. UI

Create an Intelligence experience showing:
- active anomalies
- evidence
- forecasts
- asset health
- cross-domain risk
- recommendations
- model metadata

The most important visual is the causal chain.

Example:

GEN-01 thermal degradation
        ↓
efficiency loss
        ↓
fuel consumption rises
        ↓
reserve runway shortens
        ↓
logistics risk rises

10. Tests

Create fixtures for:
- normal condition
- anomaly
- forecast
- inventory depletion
- cross-domain cascade

Do not add an LLM in this phase.

Update progress.md and handoff.md.
```

## Phase 6

```text
Read:
- AGENTS.md
- simulation.md
- digital-twin.md
- data-model.md
- ai-ml.md
- workflows.md
- current progress.md

Implement Phase 6 only.

Build the Maitri-Bharati Resilience Simulation Engine.

The simulator must run against an immutable Twin snapshot.

Never mutate live Twin state.

SUPPORTED SCENARIOS:

1. Generator failure
2. Battery degradation
3. Fuel shortage
4. Extreme cold
5. High wind
6. Load reduction
7. Backup generator activation
8. Communication outage

Each scenario must have:
- scenario parameters
- deterministic seed where randomness is used
- baseline snapshot
- scenario state
- impacted assets
- energy impact
- logistics impact
- environmental impact
- operational risk
- recovery state where applicable

Implement dependency-aware cascading impacts.

Example:

GEN-01 failure
 -> generation deficit
 -> battery discharge
 -> affected loads
 -> HVAC impact
 -> water impact
 -> fuel/reserve impact
 -> logistics risk

Add baseline vs scenario comparison.

Display:
- metric
- baseline
- scenario
- absolute change
- percentage change
- reason

Add scenario explanation.

Example:
"Generator failure causes battery discharge because available generation falls below current station load."

Add blast-radius visualization using the Twin dependency graph.

Add simulation history.

Every result must contain:
- simulationId
- snapshot timestamp
- scenario type
- parameters
- model version
- deterministic seed if applicable
- createdAt
- explicit SIMULATION label

Tests must prove:
- reproducibility
- baseline immutability
- dependency propagation
- scenario persistence

Do not implement LLM features yet.

Update progress.md and handoff.md.
```

## Phase 7

```text
Read:
- AGENTS.md
- ai-ml.md
- security.md
- api-contracts.md
- requirements.md
- current progress.md

Implement Phase 7 only.

Build an Ollama-compatible local Operations Copilot.

The LLM is a reasoning and explanation layer, not the source of station facts.

ARCHITECTURE:

Operator question
    ↓
LLM intent detection
    ↓
approved typed tool
    ↓
Digital Twin/API
    ↓
structured result
    ↓
LLM explanation
    ↓
evidence-backed answer

READ-ONLY TOOLS:

- get_station_summary
- get_asset_status
- get_asset_history
- get_alerts
- get_energy_state
- get_energy_forecast
- get_inventory_status
- get_environment_summary
- get_dependency_impact
- get_simulation_result
- get_recent_operator_actions

The LLM must NOT:
- directly access the database
- write to the database
- execute shell commands
- access arbitrary files
- control physical hardware
- invent telemetry
- present simulated values as measured
- claim unsupported causation

Every answer should distinguish:
- measured/external/simulated
- observed vs predicted
- current vs historical vs simulated

Where appropriate, show:
- timestamp
- asset
- metric
- model version
- evidence

Add tool trace visibility in the UI.

Example operator questions:

"What is happening at Maitri?"

"Why is GEN-01 at risk?"

"What assets are affected if GEN-01 fails?"

"How long will current fuel last?"

"What happens if we lose GEN-01 for 90 minutes?"

"Why is energy risk increasing?"

The answer should rely on tool results.

Add graceful fallback:
If Ollama is unavailable, the dashboard remains fully operational and clearly indicates that the copilot is unavailable.

Test:
- correct tool routing
- tool-only factual answers
- no unsupported values
- no direct writes
- simulation results clearly labeled

Update progress.md and handoff.md.
```

## Phase 8 

```text
Read:
- AGENTS.md
- testing.md
- deployment.md
- demo.md
- acceptance-criteria.md
- security.md
- architecture.md
- current progress.md

Implement Phase 8 only.

Harden the complete Maitri-Bharati application for a reliable SIH demonstration.

GOALS:

1. Authentication and authorization foundations.

Support roles:
- ADMIN
- OPERATOR
- ENGINEER
- LOGISTICS
- VIEWER

Enforce authorization server-side.

2. Audit trail.

Record:
- user
- timestamp
- action
- target
- previous state
- new state
- result
- correlationId

3. Command workflow.

Physical control remains out of scope.

Implement simulated command workflow:

request
 -> policy validation
 -> impact preview
 -> confirmation
 -> approval workflow
 -> simulated execution
 -> audit event

Never imply physical actuation.

4. Provenance everywhere.

Major values must expose:
- source
- timestamp
- quality
- simulated/external/measured
- model version where applicable

5. Connectivity resilience.

Make connectivity state visible.

Show:
- online
- degraded
- offline
- buffered
- replaying
- synchronized

6. Twin time-travel/demo replay.

Provide a controlled demo mode allowing the operator to replay a known anomaly storyline.

7. One-click scenario reset.

The entire demo must be repeatable.

8. Demo control panel.

Provide admin/demo-only controls for:
- inject generator anomaly
- battery degradation
- fuel reduction
- extreme cold
- high wind
- communication outage
- restore normal state

9. Operational evidence view.

For every major alert/risk show:
- evidence
- telemetry
- Twin transition
- dependency impact
- forecast
- recommendation
- simulation where available

10. Failure handling.

Add:
- loading state
- API unavailable
- MQTT unavailable
- database unavailable
- LLM unavailable
- stale telemetry
- empty dataset

Do not hide failures.

11. Presentation mode.

Create a clean SIH demo flow:

Normal Maitri
 -> generator anomaly
 -> Twin state transition
 -> anomaly explanation
 -> cross-domain impact
 -> energy/fuel forecast
 -> logistics risk
 -> what-if simulation
 -> copilot explanation
 -> communication outage
 -> store-and-forward
 -> recovery
 -> audit

12. Automated acceptance tests.

Verify the complete flow end-to-end.

13. Performance and reliability.

Avoid unnecessary full-page refetches.

Realtime changes should update only affected UI state.

14. Security hygiene.

Verify:
- no secrets committed
- env example complete
- server-side validation
- safe error messages
- LLM tool restrictions

15. Final SIH readiness checklist.

Document:
- architecture
- demo flow
- known limitations
- simulated-data disclosure
- reproducible startup
- test results

Do not introduce a major new architecture unless needed to fix an actual blocker.

Update progress.md and produce the final handoff.
```
