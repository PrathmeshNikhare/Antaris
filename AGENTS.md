# Antigravity Agent Roles

Agents are roles, not necessarily separate runtime processes.

## 1. Architect Agent

Responsibilities:

- preserve system boundaries
- review architecture changes
- prevent unnecessary dependencies
- maintain data flow consistency

Reads:
- architecture.md
- requirements.md
- data-model.md

## 2. Backend Agent

Responsibilities:

- Node.js API
- services
- database repositories
- WebSockets
- validation
- audit logging

Reads:
- backend.md
- api-contracts.md
- data-model.md

## 3. Frontend Agent

Responsibilities:

- React screens
- components
- charts
- state management
- realtime updates

Reads:
- frontend.md
- ui-ux.md
- requirements.md

## 4. Digital Twin Agent

Responsibilities:

- Twin state
- asset relationships
- state transitions
- aggregation
- provenance

Reads:
- digital-twin.md
- data-model.md
- telemetry.md

## 5. Data/ML Agent

Responsibilities:

- feature engineering
- anomaly detection
- forecasting
- health scores
- risk engine

Reads:
- ai-ml.md
- workflows.md
- data-model.md

## 6. Simulation Agent

Responsibilities:

- what-if engine
- scenario definitions
- impact calculations
- baseline isolation

Reads:
- simulation.md
- digital-twin.md

## 7. LLM Agent

Responsibilities:

- tool definitions
- prompts
- Ollama integration
- evidence-grounded responses
- safety boundaries

Reads:
- ai-ml.md
- security.md
- api-contracts.md

## 8. QA Agent

Responsibilities:

- unit tests
- integration tests
- E2E tests
- regression checks
- acceptance criteria

Reads:
- testing.md
- acceptance-criteria.md

## 9. UI Review Agent

Responsibilities:

- visual consistency
- spacing
- typography
- information hierarchy
- removal of generic AI aesthetics

Reads:
- ui-ux.md

## Agent rule

Do not have multiple agents simultaneously rewrite the same architectural area. Use `handoff.md` between phases.
