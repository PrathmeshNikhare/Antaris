# Data Model

## Core entities

```text
Station
 ├── Building
 │    └── Asset
 ├── EnergySystem
 ├── InventoryItem
 ├── EnvironmentalSensor
 ├── Alert
 ├── MaintenanceEvent
 └── Telemetry
```

## Station

```ts
Station {
  id: string
  code: "MAITRI" | "BHARATI"
  name: string
  locationLabel: string
  status: StationStatus
  lastSyncAt: Date
  dataMode: "SIMULATED" | "EXTERNAL" | "MEASURED"
}
```

## Asset

```ts
Asset {
  id: string
  stationId: string
  parentAssetId?: string
  code: string
  name: string
  type: AssetType
  status: AssetStatus
  criticality: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  healthScore?: number
}
```

Suggested asset types:

- GENERATOR
- BATTERY
- HVAC
- BUILDING
- WATER_SYSTEM
- COMMUNICATION
- SOLAR
- VEHICLE
- LAB_EQUIPMENT
- OTHER

## Telemetry

```ts
TelemetryPoint {
  id: string
  stationId: string
  assetId?: string
  metric: string
  value: number
  unit: string
  timestamp: Date
  source: "SIMULATOR" | "MQTT" | "API" | "MANUAL"
  quality: "GOOD" | "SUSPECT" | "BAD"
}
```

## Inventory

```ts
InventoryItem {
  id: string
  stationId: string
  category: "FUEL" | "FOOD" | "MEDICAL" | "SPARES" | "SCIENTIFIC"
  name: string
  quantity: number
  unit: string
  minimumThreshold: number
  averageDailyConsumption: number
  leadTimeDays: number
  updatedAt: Date
}
```

## Alert

```ts
Alert {
  id: string
  stationId: string
  assetId?: string
  severity: "INFO" | "WARNING" | "CRITICAL"
  category: "INFRASTRUCTURE" | "ENERGY" | "LOGISTICS" | "ENVIRONMENT" | "SYSTEM"
  title: string
  description: string
  evidence: Record<string, unknown>
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED"
  createdAt: Date
  resolvedAt?: Date
}
```

## Forecast

```ts
Forecast {
  id: string
  stationId: string
  target: string
  horizonHours: number
  predictedValue: number
  lowerBound?: number
  upperBound?: number
  modelVersion: string
  generatedAt: Date
}
```

## Simulation

```ts
SimulationRun {
  id: string
  stationId: string
  scenarioType: string
  inputState: object
  outputState: object
  impacts: object
  createdAt: Date
}
```

## Provenance

Every important value should answer:

- Where did it come from?
- When was it observed?
- Was it measured, external, or simulated?
- Was it transformed?
- Which model produced a prediction?

Never lose provenance.
