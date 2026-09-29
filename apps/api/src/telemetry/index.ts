import { MqttManager } from "./mqtt/client";
import { TelemetryIngestService } from "./mqtt/ingest";
import { TelemetrySimulator } from "./simulator/simulator";

let mqttManagerInstance: MqttManager | null = null;
let ingestServiceInstance: TelemetryIngestService | null = null;
let simulatorInstance: TelemetrySimulator | null = null;

export async function initTelemetryPipeline(autoStartSimulator = true): Promise<{
  mqtt: MqttManager;
  ingest: TelemetryIngestService;
  simulator: TelemetrySimulator;
}> {
  if (!mqttManagerInstance) {
    mqttManagerInstance = new MqttManager();
  }

  // Connect to MQTT broker
  const connected = await mqttManagerInstance.connect();
  if (connected) {
    console.log("[telemetry] MQTT manager connected successfully");
  } else {
    console.warn("[telemetry] MQTT manager could not connect to broker immediately; will retry in background");
  }

  if (!ingestServiceInstance) {
    ingestServiceInstance = new TelemetryIngestService(mqttManagerInstance);
    await ingestServiceInstance.start();
  }

  if (!simulatorInstance) {
    simulatorInstance = new TelemetrySimulator(mqttManagerInstance);
    if (autoStartSimulator) {
      simulatorInstance.start();
    }
  }

  return {
    mqtt: mqttManagerInstance,
    ingest: ingestServiceInstance,
    simulator: simulatorInstance,
  };
}

export function getTelemetryPipeline(): {
  mqtt: MqttManager;
  ingest: TelemetryIngestService;
  simulator: TelemetrySimulator;
} {
  if (!mqttManagerInstance) {
    mqttManagerInstance = new MqttManager();
  }
  if (!ingestServiceInstance) {
    ingestServiceInstance = new TelemetryIngestService(mqttManagerInstance);
  }
  if (!simulatorInstance) {
    simulatorInstance = new TelemetrySimulator(mqttManagerInstance);
  }

  return {
    mqtt: mqttManagerInstance,
    ingest: ingestServiceInstance,
    simulator: simulatorInstance,
  };
}

export async function shutdownTelemetryPipeline(): Promise<void> {
  if (simulatorInstance) {
    simulatorInstance.stop();
  }
  if (mqttManagerInstance) {
    await mqttManagerInstance.disconnect();
  }
}

export * from "./simulator/prng";
export * from "./simulator/baseline";
export * from "./simulator/anomalies";
export * from "./simulator/buffer";
export * from "./simulator/simulator";
export * from "./mqtt/client";
export * from "./mqtt/validator";
export * from "./mqtt/ingest";
