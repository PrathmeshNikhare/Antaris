import express from "express";
import cors from "cors";
import type { HealthCheckResult } from "@maitri-bharati/shared";
import { checkDbConnection } from "./db/pool";
import {
  createStationsRouter,
  createAssetsRouter,
  createTelemetryRouter,
  createInventoryRouter,
  createAlertsRouter,
  createForecastsRouter,
  createSimulationsRouter,
} from "./routes";

const startTime = Date.now();

export function createApp(): express.Application {
  const app = express();

  // ── Middleware ──────────────────────────────────────────────────
  app.use(cors());
  app.use(express.json());

  // ── Health endpoint (liveness) ──────────────────────────────────
  app.get("/health", (_req, res) => {
    const result: HealthCheckResult = {
      status: "ok",
      version: "0.1.0",
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
    };
    res.json(result);
  });

  // ── Readiness endpoint (dependencies) ───────────────────────────
  app.get("/ready", async (_req, res) => {
    const dbHealthy = await checkDbConnection();
    const result: HealthCheckResult = {
      status: dbHealthy ? "ok" : "degraded",
      version: "0.1.0",
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
      checks: {
        api: { status: "ok" },
        database: { status: dbHealthy ? "ok" : "error" },
      },
    };
    res.status(dbHealthy ? 200 : 503).json(result);
  });

  // ── API root discovery ─────────────────────────────────────────
  app.get("/api", (_req, res) => {
    res.json({
      success: true,
      data: {
        name: "Maitri-Bharati Digital Twin API",
        version: "0.1.0",
        endpoints: [
          "/api/stations",
          "/api/stations/:stationId/summary",
          "/api/stations/:stationId/assets",
          "/api/assets/:assetId",
          "/api/assets/:assetId/telemetry",
          "/api/telemetry",
          "/api/stations/:stationId/inventory",
          "/api/stations/:stationId/alerts",
          "/api/alerts/:alertId/acknowledge",
          "/api/alerts/:alertId/resolve",
          "/api/stations/:stationId/forecasts",
          "/api/stations/:stationId/simulations",
        ],
      },
    });
  });

  // ── API Domain Routers ─────────────────────────────────────────
  app.use("/api/stations", createStationsRouter());
  app.use("/api/stations", createInventoryRouter());
  app.use("/api/stations", createForecastsRouter());
  app.use("/api/assets", createAssetsRouter());
  app.use("/api/telemetry", createTelemetryRouter());
  app.use("/api", createAlertsRouter());
  app.use("/api", createSimulationsRouter());

  return app;
}
