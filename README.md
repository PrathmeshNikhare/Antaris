# Maitri–Bharati Digital Twin — Antigravity Build Harness

## Purpose

This repository is the implementation harness for the SIH project:

> Develop a Digital Twin framework for Maitri and Bharati stations integrating infrastructure, energy, logistics and environmental monitoring for efficient remote management.

The system is a **decision-support Digital Twin**, not merely a dashboard. It maintains a live virtual state of both stations, stores historical telemetry, detects anomalies, forecasts important variables, evaluates scenarios, and presents actionable information to remote operators.

## Build philosophy

1. Build the data model before polishing UI.
2. Build the simulator before depending on unavailable physical station sensors.
3. Keep real/external data and simulated data explicitly labeled.
4. Keep the Digital Twin deterministic and inspectable.
5. Put ML around the Twin for anomaly detection, forecasting and risk.
6. Put an LLM behind tool/API boundaries; never let the LLM directly control physical equipment.
7. Prefer explainable rules and optimization for safety-critical decisions.
8. Build an excellent desktop command-center UI, not a generic AI SaaS dashboard.
9. Every phase must leave the application runnable.
10. Never fabricate real Maitri/Bharati telemetry and present it as measured data.

## Reference UI direction

The supplied UI references establish the visual direction: a refined operations/productivity dashboard with an off-white canvas, deep forest-green accents, dark text, generous whitespace, compact left navigation, rounded but restrained cards, small status chips, simple charts, and a strong information hierarchy.

Do **not** clone the reference literally. Evolve it into a polar-station operations console with its own visual identity.

## Recommended stack

- Frontend: React + TypeScript + Vite
- Styling: Tailwind CSS or CSS modules; use a small design-token layer
- Charts: Recharts or Apache ECharts
- Maps/2D twin: SVG/Canvas
- Optional 3D: Three.js / React Three Fiber
- Backend: Node.js + TypeScript + Express
- Database: PostgreSQL + TimescaleDB
- Messaging: MQTT
- Realtime UI: WebSocket or Socket.IO
- ML service: Python + FastAPI + scikit-learn/XGBoost initially
- LLM: Ollama-compatible local model through a tool-calling service
- Dev environment: Docker Compose
- Testing: Vitest/Jest, Supertest, Playwright

## Harness files

- `requirements.md` — scope and requirements
- `architecture.md` — technical architecture
- `data-model.md` — entities and database design
- `telemetry.md` — telemetry contract and simulator
- `workflows.md` — end-to-end operational workflows
- `phases.md` — implementation roadmap
- `agents.md` — Antigravity agent roles
- `handoff.md` — phase handoff protocol
- `ui-ux.md` — visual system and UI rules
- `frontend.md` — frontend implementation contract
- `backend.md` — backend implementation contract
- `digital-twin.md` — Twin state engine
- `ai-ml.md` — AI/ML plan
- `simulation.md` — what-if simulation
- `api-contracts.md` — API/WebSocket contracts
- `security.md` — security and safety boundaries
- `testing.md` — test strategy
- `deployment.md` — local/demo deployment
- `demo.md` — SIH demonstration story
- `acceptance-criteria.md` — definition of done
- `coding-standards.md` — coding conventions
- `progress.md` — implementation log
- `phase-prompts.md` — copy/paste prompts for each phase
- `AGENTS.md` — top-level agent instructions

## Start here

Read in this order:

1. `AGENTS.md`
2. `requirements.md`
3. `architecture.md`
4. `data-model.md`
5. `telemetry.md`
6. `ui-ux.md`
7. `phases.md`
8. `phase-prompts.md`

Then execute Phase 1 only. Do not jump directly into the full UI.
