import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { TwinWebSocketMessage, TwinEventType } from "@maitri-bharati/shared";

interface ClientSubscription {
  ws: WebSocket;
  stationId?: string;
}

export class TwinWebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Set<ClientSubscription> = new Set();

  init(server: Server): void {
    this.wss = new WebSocketServer({ server, path: "/ws" });

    this.wss.on("connection", (ws: WebSocket) => {
      const clientSub: ClientSubscription = { ws };
      this.clients.add(clientSub);
      console.log(`[twin-ws] Client connected (total active: ${this.clients.size})`);

      ws.on("message", (data: string | Buffer) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (parsed.action === "subscribe" && parsed.stationId) {
            clientSub.stationId = parsed.stationId;
            ws.send(JSON.stringify({ type: "subscribed", stationId: parsed.stationId }));
          }
        } catch {
          // ignore non-json pings
        }
      });

      ws.on("close", () => {
        this.clients.delete(clientSub);
        console.log(`[twin-ws] Client disconnected (total active: ${this.clients.size})`);
      });

      ws.on("error", (err) => {
        console.warn("[twin-ws] WebSocket client error:", err);
      });

      // Send initial welcome message
      ws.send(
        JSON.stringify({
          type: "connected",
          message: "Connected to Maitri-Bharati Digital Twin Live Stream",
          timestamp: new Date().toISOString(),
        })
      );
    });

    console.log("[twin-ws] WebSocket server initialized on path /ws");
  }

  broadcast<T>(type: TwinEventType, stationId: string, payload: T): void {
    const msg: TwinWebSocketMessage<T> = {
      type,
      stationId,
      timestamp: new Date().toISOString(),
      payload,
    };

    const serialized = JSON.stringify(msg);

    for (const sub of this.clients) {
      if (sub.ws.readyState === WebSocket.OPEN) {
        if (!sub.stationId || sub.stationId === stationId) {
          try {
            sub.ws.send(serialized);
          } catch (err) {
            console.warn("[twin-ws] Error sending to client:", err);
          }
        }
      }
    }
  }

  getActiveClientCount(): number {
    return this.clients.size;
  }

  close(): void {
    if (this.wss) {
      for (const client of this.clients) {
        try {
          client.ws.terminate();
        } catch {
          // ignore
        }
      }
      this.clients.clear();
      this.wss.close();
      this.wss = null;
    }
  }
}

export const twinWebSocketManager = new TwinWebSocketManager();
