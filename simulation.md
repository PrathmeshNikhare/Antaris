# What-If Simulation Engine

## Purpose

Allow operators to evaluate possible events without modifying live station state.

## Architecture

```text
Live Twin
   ↓
Immutable snapshot
   ↓
Scenario mutation
   ↓
Simulation calculations
   ↓
Scenario result
   ↓
Comparison
```

## Scenarios

### Generator failure

Inputs:
- failed generator
- current loads
- backup capacity
- battery state

Outputs:
- generation deficit
- battery discharge
- estimated reserve duration
- affected loads
- risk

### Fuel shortage

Outputs:
- days remaining
- impacted generators
- operational risk
- resupply urgency

### Extreme cold

Inputs:
- temperature delta
- duration

Outputs:
- heating demand
- energy impact
- fuel impact

### High wind

Outputs:
- environmental risk
- logistics risk
- optional operational restrictions

### Load reduction

Inputs:
- percentage reduction
- affected non-critical loads

Outputs:
- energy saved
- reserve extension

## Deterministic first

The core simulation should be deterministic and testable.

AI can summarize or rank scenario risk after the simulation.

## UI

Show:

```text
BASELINE              SCENARIO
Energy reserve 72%    Energy reserve 41%
Fuel            61%   Fuel            54%
Risk            Low   Risk            High
```

Include a clear "simulation" label.
