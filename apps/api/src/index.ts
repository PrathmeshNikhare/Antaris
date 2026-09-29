import { createApp } from "./app";
import { loadConfig } from "./config";
import { initTelemetryPipeline, shutdownTelemetryPipeline } from "./telemetry";

const config = loadConfig();
const app = createApp();

const server = app.listen(config.port, config.host, async () => {
  console.log(
    `[api] Maitri-Bharati API listening on http://${config.host}:${config.port}`
  );
  console.log(`[api] Health: http://${config.host}:${config.port}/health`);
  console.log(`[api] Ready:  http://${config.host}:${config.port}/ready`);
  console.log(`[api] Environment: ${config.nodeEnv}`);

  // Initialize MQTT ingestion pipeline and simulator
  try {
    await initTelemetryPipeline(true);
    console.log("[api] Telemetry pipeline initialized and simulator active");
  } catch (err) {
    console.warn("[api] Telemetry pipeline initialization deferred:", err);
  }
});

// Graceful shutdown handling
process.on("SIGTERM", async () => {
  console.log("[api] Shutting down gracefully...");
  await shutdownTelemetryPipeline();
  server.close();
});
