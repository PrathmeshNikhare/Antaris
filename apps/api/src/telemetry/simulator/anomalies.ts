import type { SimulatorAnomaly } from "@maitri-bharati/shared";

export type AnomalyType =
  | "GENERATOR_OVERHEAT"
  | "BATTERY_DEGRADATION"
  | "FUEL_LEAK"
  | "WATER_FREEZE_RISK"
  | "HIGH_WIND_BLIZZARD"
  | "CUSTOM";

export interface AnomalyDefinition {
  type: AnomalyType;
  stationId: string;
  assetId?: string;
  metric: string;
  targetValue?: number;
  multiplier?: number;
  durationSeconds?: number;
}

export class AnomalyManager {
  private activeAnomalies: Map<string, SimulatorAnomaly> = new Map();

  inject(def: AnomalyDefinition): SimulatorAnomaly {
    const id = `anom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const anomaly: SimulatorAnomaly = {
      id,
      stationId: def.stationId,
      assetId: def.assetId,
      metric: def.metric,
      type: def.type,
      targetValue: def.targetValue,
      multiplier: def.multiplier,
      durationSeconds: def.durationSeconds,
      startedAt: new Date().toISOString(),
    };

    // Use composite key so multiple anomalies on different metrics can co-exist
    const key = `${def.stationId}:${def.assetId ?? "*"}:${def.metric}`;
    this.activeAnomalies.set(key, anomaly);
    return anomaly;
  }

  getActive(stationId: string, assetId: string | undefined, metric: string): SimulatorAnomaly | undefined {
    // Check specific asset match first, then station-wide wildcard
    const specificKey = `${stationId}:${assetId ?? "*"}:${metric}`;
    const wildcardKey = `${stationId}:*:${metric}`;
    const anomaly = this.activeAnomalies.get(specificKey) ?? this.activeAnomalies.get(wildcardKey);

    if (!anomaly) return undefined;

    // Check expiration if duration was specified
    if (anomaly.durationSeconds) {
      const elapsed = (Date.now() - new Date(anomaly.startedAt).getTime()) / 1000;
      if (elapsed > anomaly.durationSeconds) {
        this.activeAnomalies.delete(specificKey);
        this.activeAnomalies.delete(wildcardKey);
        return undefined;
      }
    }

    return anomaly;
  }

  listActive(): SimulatorAnomaly[] {
    // Clean up expired ones
    const now = Date.now();
    for (const [key, anom] of this.activeAnomalies.entries()) {
      if (anom.durationSeconds) {
        const elapsed = (now - new Date(anom.startedAt).getTime()) / 1000;
        if (elapsed > anom.durationSeconds) {
          this.activeAnomalies.delete(key);
        }
      }
    }
    return Array.from(this.activeAnomalies.values());
  }

  remove(id: string): boolean {
    for (const [key, anom] of this.activeAnomalies.entries()) {
      if (anom.id === id) {
        this.activeAnomalies.delete(key);
        return true;
      }
    }
    return false;
  }

  clear(): void {
    this.activeAnomalies.clear();
  }
}
