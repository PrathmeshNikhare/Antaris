import mqtt, { type MqttClient, type IClientOptions } from "mqtt";
import { loadConfig } from "../../config";

export type MessageHandler = (topic: string, payload: Buffer) => Promise<void> | void;

export class MqttManager {
  private client: MqttClient | null = null;
  private messageHandlers: MessageHandler[] = [];
  private connected = false;
  private brokerUrl: string;

  constructor(brokerUrl?: string) {
    const config = loadConfig();
    this.brokerUrl = brokerUrl ?? config.mqttUrl;
  }

  async connect(options?: IClientOptions): Promise<boolean> {
    if (this.client && this.connected) {
      return true;
    }

    return new Promise((resolve) => {
      try {
        const client = mqtt.connect(this.brokerUrl, {
          clientId: `api-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          clean: true,
          connectTimeout: 4000,
          reconnectPeriod: 2000,
          ...options,
        });

        client.on("connect", () => {
          this.connected = true;
          console.log(`[mqtt] Connected to broker at ${this.brokerUrl}`);
          resolve(true);
        });

        client.on("message", (topic, payload) => {
          for (const handler of this.messageHandlers) {
            try {
              handler(topic, payload);
            } catch (err) {
              console.error(`[mqtt] Error in message handler for topic ${topic}:`, err);
            }
          }
        });

        client.on("error", (err) => {
          console.warn(`[mqtt] Broker error: ${err.message}`);
          // Do not reject promise here if reconnecting
        });

        client.on("offline", () => {
          this.connected = false;
        });

        client.on("close", () => {
          this.connected = false;
        });

        this.client = client;

        // Safety timeout to avoid hanging indefinitely if broker is temporarily unreachable
        setTimeout(() => {
          if (!this.connected) {
            resolve(false);
          }
        }, 3000);
      } catch (err) {
        console.error("[mqtt] Failed to initialize MQTT client:", err);
        resolve(false);
      }
    });
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  async subscribe(topics: string | string[]): Promise<boolean> {
    if (!this.client || !this.connected) {
      return false;
    }

    return new Promise((resolve) => {
      this.client!.subscribe(topics, { qos: 1 }, (err) => {
        if (err) {
          console.error(`[mqtt] Failed to subscribe to ${topics}:`, err);
          resolve(false);
        } else {
          console.log(`[mqtt] Subscribed to ${Array.isArray(topics) ? topics.join(", ") : topics}`);
          resolve(true);
        }
      });
    });
  }

  async publish(topic: string, message: unknown, qos: 0 | 1 | 2 = 1): Promise<boolean> {
    if (!this.client || !this.connected) {
      return false;
    }

    const payload = typeof message === "string" ? message : JSON.stringify(message);

    return new Promise((resolve) => {
      this.client!.publish(topic, payload, { qos }, (err) => {
        if (err) {
          console.error(`[mqtt] Publish error to ${topic}:`, err);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      return new Promise((resolve) => {
        this.client!.end(false, {}, () => {
          this.connected = false;
          this.client = null;
          resolve();
        });
      });
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}
