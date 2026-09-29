import type { TelemetryEnvelope, ReplayBatchMetadata } from "@maitri-bharati/shared";
import * as fs from "fs";
import * as path from "path";

export interface BufferedMessage {
  id: string;
  envelope: TelemetryEnvelope;
  topic: string;
  queuedAt: string;
  publishedAt?: string;
  acknowledgedAt?: string;
  retryCount: number;
  replayStatus: "QUEUED" | "REPLAYING" | "ACKNOWLEDGED" | "FAILED";
  batchId?: string;
}

export interface ReplayBatchResult {
  metadata: ReplayBatchMetadata;
  messages: BufferedMessage[];
}

/**
 * Store-and-Forward Edge Buffer with filesystem persistence simulating Antarctic
 * base station edge storage during communications blackouts (blizzards, satellite passes, solar storms).
 * 
 * Flow:
 * telemetry -> edge queue -> persistence -> connectivity recovery -> batch replay -> server acknowledgement -> deduplication -> database
 */
export class OfflineBufferQueue {
  private queue: BufferedMessage[] = [];
  private maxCapacity: number;
  private persistenceFilePath: string;
  private totalBufferedEver = 0;
  private totalAcknowledgedEver = 0;

  constructor(maxCapacity = 10000, persistenceFilePath?: string) {
    this.maxCapacity = maxCapacity;
    this.persistenceFilePath =
      persistenceFilePath ||
      path.resolve(process.cwd(), "data", "edge_offline_buffer.json");
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.persistenceFilePath)) {
        const raw = fs.readFileSync(this.persistenceFilePath, "utf8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.queue = parsed.filter(
            (m) => m && m.replayStatus !== "ACKNOWLEDGED"
          );
        }
      }
    } catch (err) {
      console.warn("[buffer] Could not load persisted buffer from disk, starting empty:", err);
      this.queue = [];
    }
  }

  private saveToDisk(): void {
    try {
      const dir = path.dirname(this.persistenceFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.persistenceFilePath, JSON.stringify(this.queue, null, 2), "utf8");
    } catch (err) {
      // In constrained environments where filesystem is read-only, log warning but keep memory queue intact
      console.warn("[buffer] Could not persist offline buffer to disk:", err);
    }
  }

  enqueue(envelope: TelemetryEnvelope, topic: string): BufferedMessage {
    const queuedAt = new Date().toISOString();
    envelope.queuedAt = queuedAt;

    if (this.queue.length >= this.maxCapacity) {
      // Drop oldest message to prevent unconstrained memory usage in extreme offline scenarios
      this.queue.shift();
    }

    const msg: BufferedMessage = {
      id: `buf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      envelope,
      topic,
      queuedAt,
      retryCount: 0,
      replayStatus: "QUEUED",
    };

    this.queue.push(msg);
    this.totalBufferedEver++;
    this.saveToDisk();
    return msg;
  }

  /**
   * Prepares a batch of queued messages for replay, assigning a batchId and metadata.
   */
  prepareReplayBatch(batchSize = 100): ReplayBatchResult | null {
    const pending = this.queue.filter(
      (m) => m.replayStatus === "QUEUED" || m.replayStatus === "FAILED"
    );

    if (pending.length === 0) {
      return null;
    }

    const selected = pending.slice(0, batchSize);
    const batchId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const publishedAt = new Date().toISOString();

    let minSeq = Number.MAX_SAFE_INTEGER;
    let maxSeq = 0;

    for (const msg of selected) {
      msg.batchId = batchId;
      msg.replayStatus = "REPLAYING";
      msg.publishedAt = publishedAt;
      msg.envelope.publishedAt = publishedAt;
      msg.envelope.retryCount = msg.retryCount;

      const seq = msg.envelope.sequence;
      if (typeof seq === "number") {
        if (seq < minSeq) minSeq = seq;
        if (seq > maxSeq) maxSeq = seq;
      }
    }

    const metadata: ReplayBatchMetadata = {
      batchId,
      queuedAt: selected[0].queuedAt,
      publishedAt,
      retryCount: selected[0].retryCount,
      sequenceRange: [
        minSeq === Number.MAX_SAFE_INTEGER ? 0 : minSeq,
        maxSeq,
      ],
      replayStatus: "REPLAYING",
      totalCount: selected.length,
    };

    this.saveToDisk();
    return { metadata, messages: selected };
  }

  /**
   * Server acknowledgement for a successfully replayed batch.
   * Flushes acknowledged messages from the pending queue.
   */
  acknowledgeBatch(batchId: string): number {
    const ackTime = new Date().toISOString();
    let ackCount = 0;

    for (const msg of this.queue) {
      if (msg.batchId === batchId) {
        msg.replayStatus = "ACKNOWLEDGED";
        msg.acknowledgedAt = ackTime;
        msg.envelope.acknowledgedAt = ackTime;
        ackCount++;
      }
    }

    if (ackCount > 0) {
      this.totalAcknowledgedEver += ackCount;
      // Remove acknowledged messages from the pending queue
      this.queue = this.queue.filter((m) => m.replayStatus !== "ACKNOWLEDGED");
      this.saveToDisk();
    }

    return ackCount;
  }

  /**
   * Revert a failed replay batch so it can be retried.
   */
  failBatch(batchId: string): void {
    for (const msg of this.queue) {
      if (msg.batchId === batchId) {
        msg.retryCount++;
        msg.replayStatus = "FAILED";
      }
    }
    this.saveToDisk();
  }

  peek(): BufferedMessage | undefined {
    return this.queue[0];
  }

  size(): number {
    return this.queue.length;
  }

  getOldestTimestamp(): string | undefined {
    return this.queue[0]?.queuedAt;
  }

  getNewestTimestamp(): string | undefined {
    return this.queue[this.queue.length - 1]?.queuedAt;
  }

  getPendingMessages(): BufferedMessage[] {
    return [...this.queue];
  }

  getStats(): {
    queuedCount: number;
    oldestTimestamp?: string;
    newestTimestamp?: string;
    totalBufferedEver: number;
    totalAcknowledgedEver: number;
  } {
    return {
      queuedCount: this.queue.length,
      oldestTimestamp: this.getOldestTimestamp(),
      newestTimestamp: this.getNewestTimestamp(),
      totalBufferedEver: this.totalBufferedEver,
      totalAcknowledgedEver: this.totalAcknowledgedEver,
    };
  }

  clear(): void {
    this.queue = [];
    this.saveToDisk();
  }
}
