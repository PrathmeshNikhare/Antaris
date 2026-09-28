# Operational Workflows

## Workflow 1 — Normal telemetry

```text
Simulator/Sensor
  → MQTT
  → Ingestion
  → Validation
  → Database
  → Twin update
  → WebSocket
  → Dashboard
```

## Workflow 2 — Equipment anomaly

```text
Telemetry
  → feature extraction
  → anomaly model
  → anomaly score
  → evidence collection
  → alert
  → operator notification
  → acknowledgement
```

The alert must show evidence, not only a score.

## Workflow 3 — Energy forecast

```text
Historical energy
+ environmental context
+ operational load
      ↓
forecast model
      ↓
next 24h demand
      ↓
confidence interval
      ↓
energy risk
```

## Workflow 4 — Inventory depletion

```text
Current inventory
+ historical consumption
+ forecast consumption
+ logistics lead time
      ↓
estimated depletion
      ↓
resupply priority
```

## Workflow 5 — Cross-domain risk

Example:

```text
Extreme cold forecast
      ↓
heating demand increases
      ↓
energy consumption forecast increases
      ↓
generator/fuel demand increases
      ↓
fuel depletion date moves earlier
      ↓
logistics risk increases
      ↓
operator alert
```

## Workflow 6 — What-if simulation

```text
Current Twin snapshot
      ↓
Scenario selected
      ↓
Clone state
      ↓
Apply scenario
      ↓
Run deterministic calculations
      ↓
Optional AI risk estimation
      ↓
Compare baseline vs scenario
      ↓
Display impacts
```

## Workflow 7 — LLM operations question

```text
Operator question
      ↓
LLM intent detection
      ↓
Approved tool call
      ↓
Digital Twin API
      ↓
Structured result
      ↓
LLM explanation
      ↓
Answer with evidence timestamp
```

## Workflow 8 — Simulated command

```text
Operator
  → select action
  → show impact preview
  → confirmation
  → simulation/command service
  → audit log
  → Twin state update
```

Never silently execute a physical command.
