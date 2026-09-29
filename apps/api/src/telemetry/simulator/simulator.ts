import { BaselineGenerator, SENSOR_DEFINITIONS, SensorConfig } from "./baseline";
import { AnomalyManager, AnomalyDefinition } from "./anomalies";
import { OfflineBufferQueue } from "./buffer";
import type { MqttManager } from "../mqtt/client";
import type { SimulatorMode, SimulatorStatus, TelemetryEnvelope, SimulatorAnomaly } from "@maitri-bharati/shared";

export interface SimulatorOptions {
  intervalMs?: number;
  initialMode?: SimulatorMode;
  seed?: number;
  sensors?: SensorConfig[];
}

export class TelemetrySimulator {
  private mqtt: MqttManager;
  private baselineGen: BaselineGenerator;
  private anomalyMgr: AnomalyManager;
  private bufferQueue: OfflineBufferQueue;
  private sensors: SensorConfig[];

  private mode: SimulatorMode = "normal";
  private running = false;
  private timer: NodeJS.Timeout | null = null;
  private intervalMs: number;
  private tickCount = 0;
  private sequenceMap: Map<string, number> = new Map();
  private lastEmittedAt?: Date;

  constructor(mqtt: MqttManager, options: SimulatorOptions = {}) {
    this.mqtt = mqtt;
    this.intervalMs = options.intervalMs ?? 3000;
    this.mode = options.initialMode ?? "normal";
    this.baselineGen = new BaselineGenerator(options.seed ?? 42);
    this.anomalyMgr = new AnomalyManager();
    this.bufferQueue = new OfflineBufferQueue();
    this.sensors = options.sensors ?? SENSOR_DEFINITIONS;
  }

  start(intervalMs?: number): void {
    if (this.running) return;

    if (intervalMs) {
      this.intervalMs = intervalMs;
    }

    this.running = true;
    console.log(`[simulator] Started telemetry stream (interval: ${this.intervalMs}ms, mode: ${this.mode})`);

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
   * Useful for deterministic testing and reproducible validation.
   */
  async step(simulatedDate = new Date()): Promise<TelemetryEnvelope[]> {
    this.tickCount++;
    const emitted: TelemetryEnvelope[] = [];

    // If recovering from offline mode, drain and publish buffered messages first
    if (this.mode === "recovery") {
      await this.drainBufferToMqtt();
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

      if (this.mode === "offline") {
        // Store in edge buffer during network outage
        this.bufferQueue.enqueue(envelope, topic);
      } else {
        // Publish to MQTT broker
        await this.mqtt.publish(topic, envelope);
      }
    }

    this.lastEmittedAt = simulatedDate;
    return emitted;
  }

  /**
   * Store-and-Forward: drains all buffered offline messages and delivers them to MQTT in order.
   */
  async drainBufferToMqtt(batchSize = 250): Promise<number> {
    const messages = this.bufferQueue.drain(batchSize);
    let drained = 0;

    for (const msg of messages) {
      await this.mqtt.publish(msg.topic, msg.envelope);
      drained++;
    }

    // If buffer is completely drained, transition from recovery back to normal or noisy
    if (this.bufferQueue.size() === 0 && this.mode === "recovery") {
      this.mode = "normal";
      console.log("[simulator] Store-and-forward complete: offline buffer drained, resumed normal mode");
    }

    return drained;
  }

  setMode(mode: SimulatorMode): void {
    const prev = this.mode;
    this.mode = mode;
    console.log(`[simulator] Mode changed: ${prev} -> ${mode}`);

    if (prev === "offline" && mode !== "offline") {
      // Transitioning out of offline triggers store-and-forward recovery
      this.mode = "recovery";
      this.drainBufferToMqtt().catch((err) =>
        console.error("[simulator] Error during store-and-forward drain:", err)
      );
    }
  }

  getMode(): SimulatorMode {
    return this.mode;
  }

  toggleOffline(offline: boolean): void {
    if (offline) {
      this.setMode("offline");
    } else {
      this.setMode("recovery");
    }
  }

  injectAnomaly(def: AnomalyDefinition): SimulatorAnomaly {
    if (this.mode === "normal") {
      this.mode = "anomaly";
    }
    return this.anomalyMgr.inject(def);
  }

  clearAnomalies(): void {
    this.anomalyMgr.clear();
    if (this.mode === "anomaly") {
      this.mode = "normal";
    }
  }

  getActiveAnomalies(): SimulatorAnomaly[] {
    return this.anomalyMgr.listActive();
  }

  getBuffer(): OfflineBufferQueue {
    return this.bufferQueue;
  }

  getStatus(): SimulatorStatus {
    return {
      running: this.running,
      mode: this.mode,
      tickCount: this.tickCount,
      offlineBufferedCount: this.bufferQueue.size(),
      activeAnomalies: this.anomalyMgr.listActive(),
      intervalMs: this.intervalMs,
      mqttConnected: this.mqtt.isConnected(),
      lastEmittedAt: this.lastEmittedAt?.toISOString(),
    };
  }
}
