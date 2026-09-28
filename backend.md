# Backend Implementation Contract

## Suggested structure

```text
apps/api/
  src/
    config/
    routes/
    controllers/
    services/
    repositories/
    domain/
      stations/
      assets/
      telemetry/
      energy/
      logistics/
      environment/
      alerts/
      simulations/
    realtime/
    middleware/
    validation/
```

## Layers

```text
Route
 ↓
Controller
 ↓
Service
 ↓
Repository
 ↓
Database
```

Domain logic should live in services/domain modules.

## API principles

- JSON
- typed request/response contracts
- consistent errors
- validation at boundaries
- pagination for history endpoints
- station-scoped authorization

## Realtime

Use WebSocket/Socket.IO for:

- telemetry update
- alert created
- alert updated
- station status changed
- simulation completed

## Background jobs

Use a simple worker/cron approach initially for:

- forecast refresh
- anomaly evaluation
- inventory depletion calculations
- daily reports

Do not introduce a job orchestration platform unless required.
