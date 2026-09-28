# Digital Twin Engine

## Definition

A Digital Twin is the software representation of the operational state of a physical station and its assets.

It is not simply a 3D model.

## Twin state

```ts
TwinState {
  stationId: string
  timestamp: Date
  stationStatus: StationStatus
  assets: TwinAssetState[]
  energy: EnergyState
  environment: EnvironmentState
  logistics: LogisticsState
  alerts: AlertSummary
}
```

## State update

```text
Telemetry event
  ↓
Validate
  ↓
Normalize
  ↓
Persist
  ↓
Map metric → Twin property
  ↓
Recalculate affected aggregate
  ↓
Evaluate status
  ↓
Emit TwinStateChanged
```

## Asset state

Each asset should expose:

- current values
- status
- health score
- last update
- data quality
- recent anomaly
- maintenance status

## Aggregate station status

Suggested deterministic rule:

```text
if critical alert exists → CRITICAL
else if warning alert exists → WARNING
else if connectivity degraded → DEGRADED
else → OPERATIONAL
```

Document any changes to this rule.

## Provenance

Twin properties must retain:

- source
- timestamp
- quality
- simulated/external/measured status

## Twin snapshot

Every simulation begins from an immutable snapshot.

Never mutate the live Twin merely to run a what-if scenario.
