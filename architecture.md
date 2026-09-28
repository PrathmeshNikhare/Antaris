# System Architecture

## 1. High-level architecture

```text
┌───────────────────────────────────────────────────────────────┐
│                    REMOTE OPERATIONS UI                      │
│ Overview │ Twin │ Energy │ Infrastructure │ Logistics │ Env │
└──────────────────────────┬────────────────────────────────────┘
                           │ REST + WebSocket
                           ▼
┌───────────────────────────────────────────────────────────────┐
│                    NODE.JS API LAYER                         │
│ Auth │ Stations │ Assets │ Telemetry │ Alerts │ Simulation  │
└──────────────┬───────────────────────────┬────────────────────┘
               │                           │
               ▼                           ▼
┌─────────────────────────┐     ┌──────────────────────────────┐
│     DIGITAL TWIN        │     │       AI/ANALYTICS           │
│ State registry          │     │ Anomaly detection            │
│ Asset relationships     │     │ Forecasting                  │
│ State transitions       │     │ Health scoring               │
│ Provenance              │     │ Risk engine                  │
└──────────────┬──────────┘     │ Optimization                 │
               │                └──────────────┬───────────────┘
               │                               │
               ▼                               ▼
┌───────────────────────────────────────────────────────────────┐
│                         DATA LAYER                            │
│ PostgreSQL + TimescaleDB + object/file storage               │
└──────────────────────────┬────────────────────────────────────┘
                           ▲
                           │
                MQTT / REST / Batch
                           │
┌──────────────────────────┴────────────────────────────────────┐
│                    EDGE / DATA INGESTION                       │
│ Validation │ buffering │ normalization │ source tagging       │
└──────────────────────────┬────────────────────────────────────┘
                           ▲
                           │
              Sensors / systems / simulator
```

## 2. Deployment units

### Frontend
React TypeScript application.

### API
Node.js TypeScript service.

### Twin service
Can initially live inside the backend as a module. Extract into a service only when necessary.

### ML service
Python FastAPI service exposing model inference endpoints.

### MQTT broker
Mosquitto for local development/demo.

### Database
PostgreSQL with TimescaleDB extension.

## 3. Data flow

1. Simulator or external source emits telemetry.
2. MQTT/API ingestion receives data.
3. Validator checks schema and physical ranges.
4. Normalizer converts units.
5. Telemetry is persisted.
6. Twin state is updated.
7. Analytics workers consume the new state.
8. Alerts are created if conditions are met.
9. WebSocket broadcasts state changes.
10. UI updates without page reload.

## 4. Reliability model

The edge design should support:

```text
ONLINE
  ↓
normal sync

DEGRADED
  ↓
local buffer
  ↓
retry

OFFLINE
  ↓
local operation continues
  ↓
store-and-forward
  ↓
resync
```

The prototype can simulate this with a "Connectivity" control.

## 5. Security boundaries

```text
UI
 ↓
Authenticated API
 ↓
RBAC
 ↓
Validated service
 ↓
Twin / data / simulation
```

The LLM sits behind an API tool layer and has no direct database write access.

## 6. Architecture rule

Avoid microservices until the prototype actually needs them. A modular monolith is preferred for the first release.
