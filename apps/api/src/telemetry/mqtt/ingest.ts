import { MqttManager } from "./client";
import { validateTelemetryEnvelope } from "./validator";
import { TelemetryRepository } from "../../repositories";
import type { TelemetryPoint } from "@maitri-bharati/shared";

export interface IngestStats {
  totalReceived: number;
  totalPersisted: number;
  totalSuspect: number;
  totalInvalid: number;
  lastIngestedAt?: Date;
}

export type IngestListener = (point: TelemetryPoint, topic: string) => void;

export class TelemetryIngestService {
  private mqtt: MqttManager;
  private telemRepo: TelemetryRepository;
  private stats: IngestStats = {
    totalReceived: 0,
    totalPersisted: 0,
    totalSuspect: 0,
    totalInvalid: 0,
  };
  private listeners: IngestListener[] = [];
  private isSubscribed = false;

  constructor(mqtt: MqttManager, telemRepo = new TelemetryRepository()) {
    this.mqtt = mqtt;
    this.telemRepo = telemRepo;
  }

  async start(): Promise<boolean> {
    if (this.isSubscribed) return true;

    this.mqtt.onMessage(async (topic, payload) => {
      await this.handleMessage(topic, payload);
    });

    const subscribed = await this.mqtt.subscribe([
      "stations/+/telemetry/#",
      "stations/+/environment",
      "stations/+/energy",
      "stations/+/logistics",
      "stations/+/events",
    ]);

    this.isSubscribed = subscribed;
    return subscribed;
  }

  async handleMessage(topic: string, payload: Buffer): Promise<TelemetryPoint | null> {
    this.stats.totalReceived++;

    try {
      const json = JSON.parse(payload.toString("utf8"));
      const validation = validateTelemetryEnvelope(json);

      if (!validation.valid || !validation.point) {
        this.stats.totalInvalid++;
        console.warn(`[ingest] Invalid telemetry envelope from ${topic}:`, validation.errors);
        return null;
      }

      const point = validation.point;
      if (point.quality === "SUSPECT") {
        this.stats.totalSuspect++;
      }

      // Persist to TimescaleDB
      const persisted = await this.telemRepo.insert(point);
      this.stats.totalPersisted++;
      this.stats.lastIngestedAt = new Date();

      // Notify any registered listeners (e.g. Twin State engine or WebSocket broadcasters)
      for (const listener of this.listeners) {
        try {
          listener(persisted, topic);
        } catch (err) {
          console.error("[ingest] Listener error:", err);
        }
      }

      return persisted;
    } catch (err) {
      this.stats.totalInvalid++;
      console.error(`[ingest] Failed to parse message from ${topic}:`, err);
      return null;
    }
  }

  addListener(listener: IngestListener): void {
    this.listeners.push(listener);
  }

  getStats(): IngestStats {
    return { ...this.stats };
  }
}
