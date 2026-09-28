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

## Phase 1 — Station model and database

Build:

- Station
- Asset
- Telemetry
- Inventory
- Alert
- Forecast
- Simulation

Deliver migrations/seeds for Maitri and Bharati.

Exit criteria:
- both stations exist
- representative assets exist
- seed data loads successfully

## Phase 2 — Telemetry simulator

Build:

- deterministic baseline telemetry
- realistic noise
- anomaly injection
- MQTT publishing
- offline buffering simulation

Exit criteria:
- live telemetry enters database
- timestamps and provenance are correct

## Phase 3 — Digital Twin engine

Build:

- current state registry
- asset status
- health calculations
- station aggregate status
- state transitions
- WebSocket events

Exit criteria:
- changing telemetry changes Twin state
- dashboard can consume state without reading the database directly

## Phase 4 — Operations dashboard

Build:

- Overview
- station switcher
- alerts
- infrastructure
- energy
- logistics
- environment

Exit criteria:
- UI is useful with no AI enabled
- visual design follows `ui-ux.md`

## Phase 5 — AI/analytics

Build in this order:

1. anomaly detection
2. energy forecast
3. fuel/inventory forecast
4. asset health
5. cross-domain risk

Exit criteria:
- each model has input/output contract
- model outputs contain model version and timestamp
- UI explains evidence

## Phase 6 — Simulation

Build:

- generator failure
- battery degradation
- fuel shortage
- extreme cold/high wind
- load reduction
- compare baseline vs scenario

Exit criteria:
- scenario does not mutate baseline state
- results are reproducible

## Phase 7 — LLM operations assistant

Build:

- read-only tool layer
- station summary tool
- alert tool
- telemetry trend tool
- energy forecast tool
- inventory tool
- simulation summary tool

Exit criteria:
- assistant answers from tools
- no unsupported claims
- no direct write capability

## Phase 8 — Hardening and SIH demo

Build:

- error states
- loading states
- offline state
- audit log
- tests
- Docker deployment
- seeded demo scenario
- presentation mode

Exit criteria:
- clean end-to-end demo
- repeatable from fresh setup
