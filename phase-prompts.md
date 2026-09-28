# Antigravity Phase Prompts

Use one prompt at a time. Do not ask the agent to build all phases in one turn.

## Phase 0

```text
Read AGENTS.md, requirements.md, architecture.md, coding-standards.md and phases.md.

Implement Phase 0 only.

Create the repository foundation for the Maitri–Bharati Digital Twin:
- React + TypeScript frontend
- Node.js + TypeScript backend
- shared types
- Docker Compose
- PostgreSQL/TimescaleDB
- MQTT broker
- lint/typecheck/test configuration

Do not build the full UI or AI yet.

After implementation:
1. run tests
2. run typecheck
3. run lint
4. verify startup
5. update progress.md
6. create the Phase 0 handoff according to handoff.md
```

## Phase 1

```text
Read the harness first.

Implement Phase 1 only: station and database model.

Create migrations and seed data for Maitri and Bharati with representative infrastructure, energy, logistics and environmental assets.

Use the exact domain model in data-model.md.

Do not implement AI or full dashboard.

Verify migrations, seed data, types and tests.
Update progress.md and provide a handoff.
```

## Phase 2

```text
Read telemetry.md, data-model.md, workflows.md and handoff.md.

Implement Phase 2 only.

Build a realistic deterministic telemetry simulator that publishes MQTT messages for Maitri and Bharati.

Include:
- normal telemetry
- noise
- anomaly injection
- offline buffering simulation
- provenance/source tagging

Do not add AI yet.

Verify that telemetry reaches the database and can be queried.
Update progress.md and provide a handoff.
```

## Phase 3

```text
Read digital-twin.md, telemetry.md, architecture.md and current progress.

Implement Phase 3 only.

Build the Digital Twin state engine:
- current asset state
- station aggregates
- status calculation
- provenance
- state transitions
- WebSocket events

Do not redesign the UI.

Write unit/integration tests for state updates.
Update progress.md and provide a handoff.
```

## Phase 4

```text
Read ui-ux.md, frontend.md, requirements.md and architecture.md.

Implement Phase 4 only.

Build the desktop-first remote operations dashboard.

The visual direction must be inspired by the supplied references:
- warm off-white background
- forest-green accents
- dark charcoal text
- compact left sidebar
- white cards
- moderate radius
- clean charts
- strong information hierarchy

Do not make it look like a generic AI-generated dashboard.
Avoid purple gradients, glassmorphism, excessive pills, sparkles, futuristic backgrounds and identical card grids.

Build:
- Overview
- Twin preview
- Infrastructure
- Energy
- Logistics
- Environment
- Alerts

Use real API data and realistic loading/error states.
Update progress.md and provide a handoff.
```

## Phase 5

```text
Read ai-ml.md, workflows.md, data-model.md and current implementation.

Implement Phase 5 only.

Build:
1. anomaly detection
2. energy forecast
3. fuel/inventory forecast
4. asset health score
5. cross-domain risk engine

Start with simple explainable methods.

Every output must contain timestamp/model version/evidence where applicable.

Do not add an LLM yet.
Update progress.md and provide a handoff.
```

## Phase 6

```text
Read simulation.md and digital-twin.md.

Implement Phase 6 only.

Build a deterministic what-if simulation engine.

Support:
- generator failure
- fuel shortage
- extreme cold
- high wind
- load reduction

Every simulation must run against an immutable Twin snapshot and must not modify live state.

Build UI for baseline vs scenario comparison.
Update progress.md and provide a handoff.
```

## Phase 7

```text
Read ai-ml.md, security.md, api-contracts.md and requirements.md.

Implement Phase 7 only.

Add an Ollama-compatible local LLM operations assistant.

Use read-only typed tools:
- station summary
- alerts
- asset status
- energy
- environment
- inventory
- forecast
- simulation results

The LLM must not have direct database write access or physical control capability.

Gracefully degrade when Ollama is unavailable.

Update progress.md and provide a handoff.
```

## Phase 8

```text
Read testing.md, deployment.md, demo.md and acceptance-criteria.md.

Implement Phase 8 only.

Harden the entire application for SIH demonstration:
- tests
- loading/error states
- audit logs
- Docker startup
- demo seed scenario
- connectivity simulation
- polished UI
- reliable end-to-end story

Run the complete acceptance checklist.

Do not introduce large architectural changes unless required to fix a blocker.
Update progress.md and produce the final handoff.
