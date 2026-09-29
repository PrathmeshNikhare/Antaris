import { MqttManager } from "./client";
import { validateTelemetryEnvelope } from "./validator";
import { TelemetryRepository } from "../../repositories";
import type { TelemetryPoint } from "@maitri-bharati/shared";

export interface StreamSequenceState {
  lastSequence: number;
  count: number;
  duplicateCount: number;
  gapCount: number;
  outOfOrderCount: number;
  seenSequences: Set<number>;
}

export interface IngestStats {
  totalReceived: number;
  totalPersisted: number;
  totalSuspect: number;
  totalInvalid: number;
  duplicateCount: number;
  gapCount: number;
  outOfOrderCount: number;
  lastIngestedAt?: Date;
  activeStreamsCount: number;
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
    duplicateCount: 0,
    gapCount: 0,
    outOfOrderCount: 0,
    activeStreamsCount: 0,
  };
  private streamStates: Map<string, StreamSequenceState> = new Map();
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

      // ─── Per-Stream Sequence Handling & Deduplication ─────────
      if (point.sequence !== undefined) {
        const streamKey = `${point.stationId}:${point.assetId || "station"}:${point.metric}`;
        let stream = this.streamStates.get(streamKey);

        if (!stream) {
          stream = {
            lastSequence: point.sequence,
            count: 1,
            duplicateCount: 0,
            gapCount: 0,
            outOfOrderCount: 0,
            seenSequences: new Set([point.sequence]),
          };
          this.streamStates.set(streamKey, stream);
          this.stats.activeStreamsCount = this.streamStates.size;
        } else {
          stream.count++;

          // 1. Duplicate detection
          if (stream.seenSequences.has(point.sequence)) {
            this.stats.duplicateCount++;
            stream.duplicateCount++;
            console.warn(`[ingest] Deduplicated sequence ${point.sequence} on stream ${streamKey}`);
            return null; // Deduplicate: do not persist duplicate packet
          }

          // 2. Out-of-order detection
          if (point.sequence < stream.lastSequence) {
            this.stats.outOfOrderCount++;
            stream.outOfOrderCount++;
            console.warn(
              `[ingest] Out-of-order packet: sequence ${point.sequence} < lastSeen ${stream.lastSequence} on stream ${streamKey}`
            );
          } else if (point.sequence > stream.lastSequence + 1) {
            // 3. Gap detection
            const gap = point.sequence - stream.lastSequence - 1;
            this.stats.gapCount += gap;
            stream.gapCount += gap;
            console.warn(
              `[ingest] Sequence gap of ${gap} missing packets on stream ${streamKey} (${stream.lastSequence} -> ${point.sequence})`
            );
          }

          stream.seenSequences.add(point.sequence);
          if (point.sequence > stream.lastSequence) {
            stream.lastSequence = point.sequence;
          }

          // Keep bounded memory for seen sequence buffer
          if (stream.seenSequences.size > 1000) {
            const arr = Array.from(stream.seenSequences).sort((a, b) => a - b);
            stream.seenSequences = new Set(arr.slice(arr.length - 500));
          }
        }
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

  getStreamStats(): Record<string, Omit<StreamSequenceState, "seenSequences">> {
    const res: Record<string, Omit<StreamSequenceState, "seenSequences">> = {};
    for (const [key, val] of this.streamStates.entries()) {
      res[key] = {
        lastSequence: val.lastSequence,
        count: val.count,
        duplicateCount: val.duplicateCount,
        gapCount: val.gapCount,
        outOfOrderCount: val.outOfOrderCount,
      };
    }
    return res;
  }
}
