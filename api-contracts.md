# API Contracts

## Stations

```http
GET /api/stations
GET /api/stations/:stationId
GET /api/stations/:stationId/summary
```

## Twin

```http
GET /api/stations/:stationId/twin
GET /api/stations/:stationId/twin/snapshot
```

## Assets

```http
GET /api/stations/:stationId/assets
GET /api/assets/:assetId
GET /api/assets/:assetId/telemetry
```

## Telemetry

```http
GET /api/stations/:stationId/telemetry
GET /api/assets/:assetId/telemetry
```

Query:

```text
from
to
metric
interval
```

## Energy

```http
GET /api/stations/:stationId/energy/summary
GET /api/stations/:stationId/energy/history
GET /api/stations/:stationId/energy/forecast
```

## Logistics

```http
GET /api/stations/:stationId/inventory
GET /api/stations/:stationId/inventory/forecast
```

## Environment

```http
GET /api/stations/:stationId/environment/current
GET /api/stations/:stationId/environment/history
```

## Alerts

```http
GET /api/stations/:stationId/alerts
POST /api/alerts/:alertId/acknowledge
POST /api/alerts/:alertId/resolve
```

## Simulation

```http
POST /api/simulations
GET /api/simulations/:simulationId
```

## LLM tools

Expose internal typed functions rather than raw SQL:

```text
get_station_summary(stationId)
get_alerts(stationId)
get_asset_status(assetId)
get_energy_summary(stationId)
get_energy_forecast(stationId)
get_inventory_status(stationId)
get_environment_summary(stationId)
run_simulation(input)
```

## WebSocket events

```text
telemetry.updated
twin.updated
alert.created
alert.updated
simulation.completed
connectivity.changed
```
