# Telemetry and Edge Ingestion

## Canonical telemetry envelope

```json
{
  "stationId": "MAITRI",
  "assetId": "GEN-01",
  "metric": "temperature",
  "value": 72.4,
  "unit": "degC",
  "timestamp": "2026-09-28T16:00:00Z",
  "source": "SIMULATOR",
  "quality": "GOOD",
  "sequence": 10291
}
```

## MQTT topics

```text
stations/{stationId}/telemetry/{assetId}
stations/{stationId}/environment
stations/{stationId}/energy
stations/{stationId}/logistics
stations/{stationId}/events
```

## Validation

Validate:

- required fields
- data types
- timestamp sanity
- unit
- allowed metric
- plausible range
- source
- sequence number

Do not discard suspicious values silently. Store them with `quality = SUSPECT`.

## Simulator

The simulator should support:

- normal mode
- noisy mode
- anomaly mode
- offline mode
- recovery mode
- scenario injection

Example anomaly:

```text
GEN-01 temperature
Normal: 68–78°C
Injected anomaly: 92–100°C
```

## Simulation controls

Expose internal controls only in demo/admin mode:

- Pause stream
- Increase generator temperature
- Reduce fuel
- Increase HVAC load
- Trigger high wind
- Drop network connection
- Restore network

## Store-and-forward

When connectivity is unavailable:

```text
telemetry → local queue → retry → central ingestion
```

The demo should show a visible but subtle connectivity state.
