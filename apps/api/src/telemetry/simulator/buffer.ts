import type { TelemetryEnvelope } from "@maitri-bharati/shared";

export interface BufferedMessage {
  envelope: TelemetryEnvelope;
  topic: string;
  enqueuedAt: Date;
  retryCount: number;
}

/**
 * In-memory Store-and-Forward FIFO queue simulating edge telemetry buffering
 * during Antarctic communications blackouts (blizzards, satellite passes, solar storms).
 */
export class OfflineBufferQueue {
  private queue: BufferedMessage[] = [];
  private maxCapacity: number;

  constructor(maxCapacity = 10000) {
    this.maxCapacity = maxCapacity;
  }

  enqueue(envelope: TelemetryEnvelope, topic: string): boolean {
    if (this.queue.length >= this.maxCapacity) {
      // Drop oldest message to prevent unconstrained memory usage in extreme offline scenarios
      this.queue.shift();
    }
    this.queue.push({
      envelope,
      topic,
      enqueuedAt: new Date(),
      retryCount: 0,
    });
    return true;
  }

  drain(batchSize = 100): BufferedMessage[] {
    const batch = this.queue.splice(0, batchSize);
    return batch;
  }

  drainAll(): BufferedMessage[] {
    const all = [...this.queue];
    this.queue = [];
    return all;
  }

  peek(): BufferedMessage | undefined {
    return this.queue[0];
  }

  size(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
  }
}
