# Requirements

## 1. Problem statement

Develop a Digital Twin framework for Maitri and Bharati stations integrating infrastructure, energy, logistics and environmental monitoring for efficient remote management.

## 2. Primary users

### Remote Operations Officer
Needs a quick view of station health, alerts, resources and risks.

### Engineering/Maintenance Operator
Needs asset-level telemetry, anomaly history, equipment health and maintenance indicators.

### Logistics Operator
Needs inventory levels, consumption rates, depletion forecasts and resupply priorities.

### Energy Operator
Needs generation, consumption, battery/fuel state, load patterns and energy forecasts.

### Scientific/Station Manager
Needs environmental context and cross-domain operational summaries.

## 3. Functional requirements

### Station management
- Support Maitri and Bharati.
- Switch between stations.
- Show overall station status.
- Show last synchronization time.
- Show data source/status.

### Infrastructure
- Asset hierarchy.
- Asset status.
- Telemetry history.
- Health indicators.
- Maintenance events.
- Anomaly state.

### Energy
- Generation.
- Consumption.
- Battery state of charge.
- Fuel level.
- Load breakdown.
- Energy forecast.
- Energy risk.

### Logistics
- Inventory.
- Current quantity.
- Daily consumption.
- Minimum threshold.
- Estimated days remaining.
- Resupply priority.
- Inventory history.

### Environment
- Temperature.
- Wind speed/direction.
- Pressure.
- Humidity where available.
- Visibility.
- Snow/ice indicator where available.
- Environmental trend.

### Digital Twin
- Current state for every modeled asset.
- Historical state.
- State update timestamps.
- State transitions.
- Health/status calculation.
- Data provenance.

### AI
- Anomaly detection.
- Energy forecasting.
- Fuel/inventory forecasting.
- Asset health scoring.
- Cross-domain risk scoring.
- Recommendation generation.
- Natural-language operational assistant.

### Simulation
- Generator failure.
- Battery degradation.
- Fuel shortage.
- Extreme-weather scenario.
- Load reduction.
- Backup-generator activation.
- Compare baseline vs scenario.

### Remote management
- Alert acknowledgement.
- Operator notes.
- Simulated command submission.
- Command audit trail.
- Explicit confirmation before any state-changing simulation.

## 4. Non-functional requirements

- Desktop-first command-center layout.
- Responsive down to tablet.
- Clear visual status without relying on color alone.
- Fast initial dashboard render.
- WebSocket updates should not require full-page refresh.
- Offline/edge buffering must be represented in the architecture.
- All telemetry has provenance.
- Audit logs for operator actions.
- No direct physical control in prototype.

## 5. MVP scope

The first usable release must include:

1. Maitri and Bharati station switcher.
2. Simulated telemetry.
3. PostgreSQL/TimescaleDB persistence.
4. Digital Twin state service.
5. Infrastructure overview.
6. Energy dashboard.
7. Environment dashboard.
8. Logistics dashboard.
9. Alerts.
10. One anomaly detector.
11. One energy forecast.
12. One inventory/fuel forecast.
13. LLM read-only operations assistant.
14. One what-if scenario.

## 6. Explicitly out of scope for MVP

- Real station control.
- Unverified real sensor integration.
- Autonomous actuation.
- Fully accurate 3D reconstruction of the stations.
- Complex reinforcement learning.
- Full computer vision pipeline.
- Production-grade satellite communication stack.

## 7. Success criteria

The demo should show a complete chain:

`simulated telemetry → Twin update → anomaly/forecast → cross-domain impact → operator insight → scenario simulation`.
