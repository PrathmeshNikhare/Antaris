import type { Server } from "http";
import { getTwinRegistry, TwinStateRegistry } from "./registry";
import { twinWebSocketManager } from "./websocket";
import type { TelemetryIngestService } from "../telemetry";

export * from "./freshness";
export * from "./health";
export * from "./dependency-graph";
export * from "./evaluator";
export * from "./registry";
export * from "./websocket";

let engineInitialized = false;

export async function initTwinEngine(
  server?: Server,
  ingest?: TelemetryIngestService
): Promise<{ registry: TwinStateRegistry }> {
  const registry = getTwinRegistry();

  if (!engineInitialized) {
    await registry.init();

    // Attach WebSocket server if HTTP server is provided
    if (server) {
      twinWebSocketManager.init(server);
    }

    // Attach live telemetry listener from MQTT Ingest
    if (ingest) {
      ingest.addListener((point) => {
        registry.handleTelemetryPoint(point);
      });
      console.log("[twin-engine] Subscribed to live telemetry ingest stream");
    }

    engineInitialized = true;
    console.log("[twin-engine] Operational Digital Twin Engine active");
  }

  return { registry };
}
