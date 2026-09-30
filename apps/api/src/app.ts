import express from "express";
import cors from "cors";
import type { HealthCheckResult } from "@maitri-bharati/shared";
import { checkDbConnection } from "./db/pool";
import {
  createStationsRouter,
  createAssetsRouter,
  createDependenciesRouter,
  createMetricsRouter,
  createTelemetryRouter,
  createInventoryRouter,
  createAlertsRouter,
  createMaintenanceRouter,
  createOperatorsRouter,
  createAuditRouter,
  createForecastsRouter,
  createSimulationsRouter,
  createTwinRouter,
  createIntelligenceRouter,
} from "./routes";

const startTime = Date.now();

export function createApp(): express.Application {
  const app = express();

  // ── Middleware ──────────────────────────────────────────────────
  app.use(cors());
  app.use(express.json());

  // ── Root landing page (Command Center portal & API Directory) ──────
  app.get("/", (_req, res) => {
    // If request accepts HTML, render a modern status portal
    if (_req.accepts("html")) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Maitri–Bharati Digital Twin Backend</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b0f19; color: #e2e8f0; margin: 0; padding: 2rem; }
    .card { background: #131b2e; border: 1px solid #1e293b; border-radius: 12px; padding: 2rem; max-width: 800px; margin: 0 auto; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    h1 { color: #38bdf8; margin-top: 0; font-size: 1.6rem; display: flex; align-items: center; gap: 0.5rem; }
    .badge { display: inline-block; padding: 0.25rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: bold; background: #064e3b; color: #34d399; }
    .cta-btn { display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 0.75rem 1.25rem; border-radius: 8px; font-weight: 600; margin: 1rem 0; transition: background 0.2s; }
    .cta-btn:hover { background: #1d4ed8; }
    ul { list-style: none; padding: 0; }
    li { margin: 0.5rem 0; }
    a { color: #38bdf8; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .ws-box { background: #070a13; border: 1px solid #334155; border-radius: 8px; padding: 1rem; margin-top: 1.5rem; font-family: monospace; font-size: 0.85rem; }
    #ws-log { max-height: 180px; overflow-y: auto; color: #a5f3fc; white-space: pre-wrap; margin-top: 0.5rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Maitri–Bharati Antarctic Digital Twin <span class="badge">API ONLINE</span></h1>
    <p>You have reached the <strong>Express Backend API Server</strong> running on port <code>3001</code>.</p>
    
    <div style="background: rgba(37,99,235,0.1); border-left: 4px solid #38bdf8; padding: 1rem; border-radius: 4px; margin: 1rem 0;">
      <strong>Looking for the Visual User Interface?</strong><br>
      The React Command Center Frontend is running on port <strong>5173</strong>:<br>
      <a class="cta-btn" href="http://localhost:5173" target="_blank">🚀 Open Web Dashboard (http://localhost:5173)</a>
    </div>

    <h3>⚡ Live Digital Twin REST Endpoints:</h3>
    <ul>
      <li>📡 <strong>Maitri Station Twin State:</strong> <a href="/api/twin/station-maitri" target="_blank">/api/twin/station-maitri</a></li>
      <li>📡 <strong>Bharati Station Twin State:</strong> <a href="/api/twin/station-bharati" target="_blank">/api/twin/station-bharati</a></li>
      <li>⚡ <strong>GEN-01 Cascade Impact Analysis:</strong> <a href="/api/twin/station-maitri/impact/asset-maitri-gen-1" target="_blank">/api/twin/station-maitri/impact/asset-maitri-gen-1</a></li>
      <li>🧊 <strong>Telemetry Stream Status:</strong> <a href="/api/telemetry/simulate/status" target="_blank">/api/telemetry/simulate/status</a></li>
      <li>📊 <strong>Ingest & Deduplication Stats:</strong> <a href="/api/telemetry/ingest/stats" target="_blank">/api/telemetry/ingest/stats</a></li>
      <li>🩺 <strong>System Liveness:</strong> <a href="/health" target="_blank">/health</a> | <a href="/ready" target="_blank">/ready</a></li>
    </ul>

    <div class="ws-box">
      <strong>🔌 WebSocket Streaming Service:</strong><br>
      Protocol URL: <code>ws://localhost:3001/ws</code> <em>(Note: ws:// cannot be opened directly in a browser URL bar)</em><br>
      <button id="ws-btn" style="margin-top: 0.5rem; padding: 0.4rem 0.8rem; background: #0284c7; color: white; border: none; border-radius: 4px; cursor: pointer;">Connect & Test WebSocket</button>
      <div id="ws-log">Click "Connect & Test WebSocket" to verify real-time stream...</div>
    </div>
  </div>

  <script>
    document.getElementById("ws-btn").onclick = function() {
      const log = document.getElementById("ws-log");
      log.textContent = "Connecting to ws://" + window.location.host + "/ws ...\\n";
      try {
        const ws = new WebSocket("ws://" + window.location.host + "/ws");
        ws.onopen = function() {
          log.textContent += "✅ WebSocket connected successfully! Subscribing to station-maitri...\\n";
          ws.send(JSON.stringify({ action: "subscribe", stationId: "station-maitri" }));
        };
        ws.onmessage = function(e) {
          const data = JSON.parse(e.data);
          log.textContent = "📥 Event: " + data.type + " @ " + new Date().toLocaleTimeString() + "\\n" + JSON.stringify(data, null, 2);
        };
        ws.onerror = function(err) {
          log.textContent += "❌ WebSocket error: " + err + "\\n";
        };
        ws.onclose = function() {
          log.textContent += "ℹ️ WebSocket closed\\n";
        };
      } catch (err) {
        log.textContent += "❌ Failed to connect: " + err + "\\n";
      }
    };
  </script>
</body>
</html>`);
    }

    return res.json({
      name: "Maitri-Bharati Digital Twin API",
      status: "online",
      frontendUrl: "http://localhost:5173",
      endpoints: "/api",
      health: "/health",
      websocket: "ws://localhost:3001/ws",
    });
  });

  // ── HTTP fallback for /ws GET ──────────────────────────────────
  app.get("/ws", (_req, res) => {
    if (_req.accepts("html")) {
      return res.redirect("/");
    }
    return res.status(426).json({
      error: "Upgrade Required",
      message: "This endpoint requires a WebSocket connection via ws://localhost:3001/ws. Visit http://localhost:3001 in your browser for an interactive tester or http://localhost:5173 for the dashboard.",
    });
  });

  // ── Health endpoint (liveness) ──────────────────────────────────
  app.get("/health", (_req, res) => {
    const result: HealthCheckResult = {
      status: "ok",
      version: "0.2.0",
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
      version: "0.2.0",
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
        version: "0.2.0",
        endpoints: [
          "/api/stations",
          "/api/stations/:stationId/summary",
          "/api/stations/:stationId/assets",
          "/api/assets/:assetId",
          "/api/assets/:assetId/telemetry",
          "/api/dependencies",
          "/api/dependencies/downstream/:assetId",
          "/api/metrics",
          "/api/metrics/:metric",
          "/api/telemetry",
          "/api/telemetry/simulate/status",
          "/api/telemetry/ingest/stats",
          "/api/stations/:stationId/inventory",
          "/api/stations/:stationId/alerts",
          "/api/alerts/:alertId/acknowledge",
          "/api/alerts/:alertId/resolve",
          "/api/maintenance",
          "/api/operators",
          "/api/audit",
          "/api/twin/:stationId",
          "/api/twin/:stationId/assets/:assetId",
          "/api/twin/:stationId/impact/:assetId",
          "/api/twin/:stationId/snapshot",
          "/api/twin/:stationId/time-travel",
          "/api/stations/:stationId/forecasts",
          "/api/stations/:stationId/simulations",
          "/api/stations/:stationId/intelligence",
          "/api/stations/:stationId/intelligence/anomalies",
          "/api/stations/:stationId/intelligence/forecasts/energy",
          "/api/stations/:stationId/intelligence/forecasts/inventory",
          "/api/stations/:stationId/intelligence/health",
          "/api/stations/:stationId/intelligence/risk",
          "/api/stations/:stationId/intelligence/recommendations",
          "/api/stations/:stationId/intelligence/observability",
        ],
      },
    });
  });

  // ── API Domain Routers ─────────────────────────────────────────
  app.use("/api/stations", createStationsRouter());
  app.use("/api/stations", createInventoryRouter());
  app.use("/api/stations", createForecastsRouter());
  app.use("/api/stations", createIntelligenceRouter());
  app.use("/api/intelligence", createIntelligenceRouter());
  app.use("/api/assets", createAssetsRouter());
  app.use("/api/dependencies", createDependenciesRouter());
  app.use("/api/metrics", createMetricsRouter());
  app.use("/api/telemetry", createTelemetryRouter());
  app.use("/api/maintenance", createMaintenanceRouter());
  app.use("/api/operators", createOperatorsRouter());
  app.use("/api/audit", createAuditRouter());
  app.use("/api/twin", createTwinRouter());
  app.use("/api", createAlertsRouter());
  app.use("/api/simulations", createSimulationsRouter());

  return app;
}
