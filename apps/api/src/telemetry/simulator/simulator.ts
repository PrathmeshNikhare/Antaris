import { BaselineGenerator, SENSOR_DEFINITIONS, SensorConfig } from "./baseline";
import { AnomalyManager, AnomalyDefinition } from "./anomalies";
import { OfflineBufferQueue, ReplayBatchResult } from "./buffer";
import type { MqttManager } from "../mqtt/client";
import type {
  SimulatorMode,
  SimulatorStatus,
  ConnectivityState,
  TelemetryEnvelope,
  SimulatorAnomaly,
} from "@maitri-bharati/shared";

export interface SimulatorOptions {
  intervalMs?: number;
  initialMode?: SimulatorMode;
  initialConnectivity?: ConnectivityState;
  seed?: number;
  sensors?: SensorConfig[];
  bufferPersistencePath?: string;
}

export class TelemetrySimulator {
  private mqtt: MqttManager;
  private baselineGen: BaselineGenerator;
  private anomalyMgr: AnomalyManager;
  private bufferQueue: OfflineBufferQueue;
  private sensors: SensorConfig[];

  private mode: SimulatorMode = "normal";
  private connectivityState: ConnectivityState = "NORMAL";
  private running = false;
  private timer: NodeJS.Timeout | null = null;
  private intervalMs: number;
  private tickCount = 0;
  private sequenceMap: Map<string, number> = new Map();
  private lastEmittedAt?: Date;
  private lastSuccessfulSync?: Date;
  private totalToReplayAtRecoveryStart = 0;

  constructor(mqtt: MqttManager, options: SimulatorOptions = {}) {
    this.mqtt = mqtt;
    this.intervalMs = options.intervalMs ?? 3000;
    this.mode = options.initialMode ?? "normal";
    this.connectivityState = options.initialConnectivity ?? "NORMAL";
    this.baselineGen = new BaselineGenerator(options.seed ?? 42);
    this.anomalyMgr = new AnomalyManager();
    this.bufferQueue = new OfflineBufferQueue(10000, options.bufferPersistencePath);
    this.sensors = options.sensors ?? SENSOR_DEFINITIONS;
  }

  start(intervalMs?: number): void {
    if (this.running) return;

    if (intervalMs) {
      this.intervalMs = intervalMs;
    }

    this.running = true;
    console.log(
      `[simulator] Started telemetry stream (interval: ${this.intervalMs}ms, mode: ${this.mode}, connectivity: ${this.connectivityState})`
    );

    this.timer = setInterval(async () => {
      try {
        await this.step();
      } catch (err) {
        console.error("[simulator] Error during simulation step:", err);
      }
    }, this.intervalMs);
  }

  stop(): void {
    if (!this.running) return;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.running = false;
    console.log("[simulator] Stopped telemetry stream");
  }

  /**
   * Performs a single discrete simulation step across all configured sensors.
   * Reproducible and deterministic from seed.
   */
  async step(simulatedDate = new Date()): Promise<TelemetryEnvelope[]> {
    this.tickCount++;
    const emitted: TelemetryEnvelope[] = [];

    // If in recovery state, replay pending store-and-forward batches
    if (this.connectivityState === "RECOVERY" || this.mode === "recovery") {
      await this.replayStoreAndForwardBatches(100);
    }

    for (const sensor of this.sensors) {
      const key = `${sensor.stationId}:${sensor.assetId ?? "*"}:${sensor.metric}`;
      const seq = (this.sequenceMap.get(key) ?? 0) + 1;
      this.sequenceMap.set(key, seq);

      const { envelope, topic } = this.baselineGen.generatePoint(
        sensor,
        this.tickCount,
        this.mode,
        this.anomalyMgr,
        seq,
        simulatedDate
      );

      emitted.push(envelope);

      // Handle based on connectivity state
      if (this.connectivityState === "OFFLINE") {
        // Enqueue to persistent offline buffer
        this.bufferQueue.enqueue(envelope, topic);
      } else if (this.connectivityState === "DEGRADED") {
        // In degraded mode, simulate polar satellite link packet drops and burst delays
        // 70% chance of immediate delivery, 30% routed to edge buffer for later sync
        const dropped = Math.random() < 0.3;
        if (dropped) {
          this.bufferQueue.enqueue(envelope, topic);
        } else {
          await this.mqtt.publish(topic, envelope);
          this.lastSuccessfulSync = simulatedDate;
        }
      } else {
        // NORMAL or RECOVERY: publish directly to MQTT broker
        await this.mqtt.publish(topic, envelope);
        this.lastSuccessfulSync = simulatedDate;
      }
    }

    this.lastEmittedAt = simulatedDate;
    return emitted;
  }

  private isReplaying = false;

  /**
   * Replays queued store-and-forward messages in batches with acknowledgement metadata.
   */
  async replayStoreAndForwardBatches(batchSize = 100): Promise<ReplayBatchResult | null> {
    if (this.isReplaying) return null;
    this.isReplaying = true;
    try {
      const batch = this.bufferQueue.prepareReplayBatch(batchSize);
      if (!batch) {
        // Buffer is fully replayed
        if (this.connectivityState === "RECOVERY" || this.mode === "recovery") {
          this.connectivityState = "NORMAL";
          this.mode = "normal";
          this.totalToReplayAtRecoveryStart = 0;
          console.log(
            "[simulator] Store-and-forward replay complete: offline buffer cleared, resumed NORMAL connectivity"
          );
        }
        return null;
      }

      // Publish batch messages to MQTT broker
      for (const msg of batch.messages) {
        await this.mqtt.publish(msg.topic, msg.envelope);
      }

      // Simulate server acknowledgement upon successful broker ingestion
      this.bufferQueue.acknowledgeBatch(batch.metadata.batchId);
      batch.metadata.acknowledgedAt = new Date().toISOString();
      batch.metadata.replayStatus = "ACKNOWLEDGED";
      this.lastSuccessfulSync = new Date();

      if (this.bufferQueue.size() === 0) {
        this.connectivityState = "NORMAL";
        this.mode = "normal";
        this.totalToReplayAtRecoveryStart = 0;
      }

      console.log(
        `[simulator] Replayed batch ${batch.metadata.batchId} (${batch.messages.length} messages, seq ${batch.metadata.sequenceRange[0]}-${batch.metadata.sequenceRange[1]})`
      );

      return batch;
    } finally {
      this.isReplaying = false;
    }
  }

  setConnectivityState(state: ConnectivityState): void {
    const prev = this.connectivityState;
    this.connectivityState = state;
    console.log(`[simulator] Connectivity changed: ${prev} -> ${state}`);

    if (state === "OFFLINE") {
      this.mode = "offline";
    } else if (state === "RECOVERY") {
      this.mode = "recovery";
      this.totalToReplayAtRecoveryStart = this.bufferQueue.size();
    } else if (state === "NORMAL") {
      this.mode = "normal";
      this.bufferQueue.clear();
      this.totalToReplayAtRecoveryStart = 0;
    } else if (state === "DEGRADED") {
      this.mode = "noisy";
    }
  }

  getConnectivityState(): ConnectivityState {
    return this.connectivityState;
  }

  setMode(mode: SimulatorMode): void {
    const prev = this.mode;
    this.mode = mode;
    console.log(`[simulator] Mode changed: ${prev} -> ${mode}`);

    if (mode === "offline") {
      this.connectivityState = "OFFLINE";
    } else if (mode === "recovery") {
      this.connectivityState = "RECOVERY";
      this.totalToReplayAtRecoveryStart = this.bufferQueue.size();
    } else if (mode === "normal") {
      this.connectivityState = "NORMAL";
      this.bufferQueue.clear();
      this.totalToReplayAtRecoveryStart = 0;
    }
  }

  toggleOffline(offline: boolean): void {
    if (offline) {
      this.setConnectivityState("OFFLINE");
    } else {
      this.setConnectivityState("NORMAL");
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // ─── ANOMALY CONTROLS (Phase 2 Requirement 8) ────────────────────
  // ══════════════════════════════════════════════════════════════════

  injectAnomaly(def: AnomalyDefinition): SimulatorAnomaly {
    if (this.mode === "normal") {
      this.mode = "anomaly";
    }
    return this.anomalyMgr.inject(def);
  }

  injectGeneratorOverheating(stationId: "station-maitri" | "station-bharati" = "station-maitri"): SimulatorAnomaly {
    const assetId = stationId === "station-maitri" ? "asset-maitri-gen-1" : "asset-bharati-chp-1";
    return this.injectAnomaly({
      type: "GENERATOR_OVERHEAT",
      stationId,
      assetId,
      metric: "temperature",
      targetValue: 98.5,
      durationSeconds: 300,
    });
  }

  injectFuelConsumptionSpike(stationId: "station-maitri" | "station-bharati" = "station-maitri"): SimulatorAnomaly {
    const assetId = stationId === "station-maitri" ? "asset-maitri-gen-1" : "asset-bharati-chp-1";
    return this.injectAnomaly({
      type: "FUEL_CONSUMPTION_SPIKE",
      stationId,
      assetId,
      metric: "fuel_consumption_lph",
      multiplier: 2.2,
      durationSeconds: 300,
    });
  }

  injectBatteryDischarge(stationId: "station-maitri" | "station-bharati" = "station-maitri"): SimulatorAnomaly {
    const assetId = stationId === "station-maitri" ? "asset-maitri-bat-1" : "asset-bharati-bat-1";
    return this.injectAnomaly({
      type: "BATTERY_DISCHARGE",
      stationId,
      assetId,
      metric: "state_of_charge_pct",
      targetValue: 14.5,
      durationSeconds: 300,
    });
  }

  injectHvacLoadSpike(stationId: "station-maitri" | "station-bharati" = "station-maitri"): SimulatorAnomaly {
    const assetId = stationId === "station-maitri" ? "asset-maitri-hvac-1" : "asset-bharati-hvac-1";
    return this.injectAnomaly({
      type: "HVAC_LOAD_SPIKE",
      stationId,
      assetId,
      metric: "thermal_load_kw",
      targetValue: 92.0,
      durationSeconds: 300,
    });
  }

  injectCommunicationLoss(stationId: "station-maitri" | "station-bharati" = "station-maitri"): SimulatorAnomaly {
    const assetId = stationId === "station-maitri" ? "asset-maitri-comm-1" : "asset-bharati-ground-1";
    return this.injectAnomaly({
      type: "COMMUNICATION_LOSS",
      stationId,
      assetId,
      metric: "packet_loss_pct",
      targetValue: 78.0,
      durationSeconds: 300,
    });
  }

  injectEnvironmentalExtreme(stationId: "station-maitri" | "station-bharati" = "station-maitri"): SimulatorAnomaly {
    return this.injectAnomaly({
      type: "ENVIRONMENTAL_EXTREME",
      stationId,
      metric: "wind_speed",
      targetValue: 46.5,
      durationSeconds: 300,
    });
  }

  clearAnomalies(): void {
    this.anomalyMgr.clear();
    this.mode = "normal";
    this.connectivityState = "NORMAL";
    this.bufferQueue.clear();
    this.totalToReplayAtRecoveryStart = 0;
  }

  getActiveAnomalies(): SimulatorAnomaly[] {
    return this.anomalyMgr.listActive();
  }

  getBuffer(): OfflineBufferQueue {
    return this.bufferQueue;
  }

  getStatus(): SimulatorStatus {
    const queuedCount = this.bufferQueue.size();
    let replayProgressPct: number | undefined;

    if (this.connectivityState === "RECOVERY" && this.totalToReplayAtRecoveryStart > 0) {
      const remaining = queuedCount;
      const done = this.totalToReplayAtRecoveryStart - remaining;
      replayProgressPct = Math.round((done / this.totalToReplayAtRecoveryStart) * 100);
    }

    return {
      running: this.running,
      mode: this.mode,
      connectivityState: this.connectivityState,
      tickCount: this.tickCount,
      offlineBufferedCount: queuedCount,
      oldestBufferedTimestamp: this.bufferQueue.getOldestTimestamp(),
      lastSuccessfulSync: this.lastSuccessfulSync?.toISOString(),
      replayProgressPct,
      activeAnomalies: this.anomalyMgr.listActive(),
      intervalMs: this.intervalMs,
      mqttConnected: this.mqtt.isConnected(),
      lastEmittedAt: this.lastEmittedAt?.toISOString(),
    };
  }
}
