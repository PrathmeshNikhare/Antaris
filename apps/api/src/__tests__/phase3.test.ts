import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import http from "http";
import WebSocket from "ws";
import { createApp } from "../app";
import { closePool } from "../db/pool";
import { runMigrations } from "../db/migrate";
import { runSeeds } from "../db/seed";
import {
  initTwinEngine,
  getTwinRegistry,
  computeFreshness,
  AssetHealthEvaluator,
  TwinDependencyGraph,
  StationAggregateEvaluator,
  twinWebSocketManager,
} from "../twin";
import type { TelemetryPoint } from "@maitri-bharati/shared";

const app = createApp();

describe("Phase 3: Operational Digital Twin Engine", () => {
  let server: http.Server;
  let wsPort: number;

  beforeAll(async () => {
    await runMigrations();
    await runSeeds();

    // Start HTTP server on dynamic port for WebSocket testing
    await new Promise<void>((resolve) => {
      server = app.listen(0, async () => {
        const addr = server.address();
        wsPort = typeof addr === "object" && addr ? addr.port : 3001;
        await initTwinEngine(server);
        resolve();
      });
    });
  }, 30000);

  afterAll(async () => {
    twinWebSocketManager.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await closePool();
  });

  describe("1. TwinState Registry & Station Exposure", () => {
    it("maintains in-memory live operational Twin state for both Maitri and Bharati", async () => {
      const registry = getTwinRegistry();
      await registry.init();

      const maitri = registry.getTwinState("station-maitri");
      expect(maitri).toBeDefined();
      expect(maitri?.stationCode).toBe("MAITRI");
      expect(maitri?.stationName).toBe("Maitri Station");
      expect(maitri?.stationStatus).toBeDefined();
      expect(maitri?.lastSynchronization).toBeDefined();
      expect(maitri?.dataFreshness).toBeDefined();
      expect(maitri?.connectivityState).toBe("NORMAL");
      expect(maitri?.dataQualitySummary).toBeDefined();
      expect(maitri?.assets.length).toBeGreaterThanOrEqual(8);
      expect(maitri?.energy).toBeDefined();
      expect(maitri?.environment).toBeDefined();
      expect(maitri?.logistics).toBeDefined();
      expect(maitri?.operationalRisk).toBeDefined();

      const bharati = registry.getTwinState("station-bharati");
      expect(bharati).toBeDefined();
      expect(bharati?.stationCode).toBe("BHARATI");
      expect(bharati?.assets.length).toBeGreaterThanOrEqual(8);
    });

    it("GET /api/twin/:stationId returns the full operational Twin state via HTTP", async () => {
      const res = await request(app).get("/api/twin/station-maitri");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.stationId).toBe("station-maitri");
      expect(res.body.data.assets.length).toBeGreaterThanOrEqual(8);
      expect(res.body.data.energy.totalLoadKw).toBeGreaterThan(0);
      expect(res.body.data.environment.ambientTempC).toBeDefined();
    });
  });

  describe("2. TwinAssetState & Freshness Calculation", () => {
    it("exposes granular asset properties, health score, and freshness", () => {
      const registry = getTwinRegistry();
      const maitri = registry.getTwinState("station-maitri");
      const gen1 = maitri?.assets.find((a) => a.assetId === "asset-maitri-gen-1");

      expect(gen1).toBeDefined();
      expect(gen1?.name).toBe("Primary Diesel Generator 125 kVA");
      expect(gen1?.type).toBe("GENERATOR");
      expect(gen1?.criticality).toBe("CRITICAL");
      expect(gen1?.healthScore).toBeGreaterThanOrEqual(0);
      expect(gen1?.freshness.status).toBeDefined();
    });

    it("correctly evaluates FreshnessInfo (FRESH, STALE, UNKNOWN)", () => {
      const now = new Date();

      // Recent (10s ago) -> FRESH
      const recent = new Date(now.getTime() - 10 * 1000);
      const f1 = computeFreshness(recent, now);
      expect(f1.status).toBe("FRESH");
      expect(f1.ageSeconds).toBe(10);

      // 60s ago -> STALE
      const stale = new Date(now.getTime() - 60 * 1000);
      const f2 = computeFreshness(stale, now);
      expect(f2.status).toBe("STALE");
      expect(f2.ageSeconds).toBe(60);

      // 600s ago -> UNKNOWN
      const old = new Date(now.getTime() - 600 * 1000);
      const f3 = computeFreshness(old, now);
      expect(f3.status).toBe("UNKNOWN");

      // null -> UNKNOWN
      const f4 = computeFreshness(null, now);
      expect(f4.status).toBe("UNKNOWN");
    });
  });

  describe("3. Telemetry -> Twin Property Mapping & Provenance", () => {
    it("maps incoming telemetry point to asset Twin property retaining provenance", () => {
      const registry = getTwinRegistry();
      const testPoint: TelemetryPoint = {
        id: `telem-test-twin-1`,
        stationId: "station-maitri",
        assetId: "asset-maitri-gen-1",
        metric: "power_output_kw",
        value: 112.5,
        unit: "kW",
        timestamp: new Date(),
        source: "SIMULATED",
        quality: "GOOD",
        sequence: 881,
      };

      registry.handleTelemetryPoint(testPoint);

      const state = registry.getTwinState("station-maitri");
      const gen1 = state?.assets.find((a) => a.assetId === "asset-maitri-gen-1");
      const prop = gen1?.currentTelemetry.power_output_kw;

      expect(prop).toBeDefined();
      expect(prop?.value).toBe(112.5);
      expect(prop?.unit).toBe("kW");
      expect(prop?.source).toBe("SIMULATED");
      expect(prop?.quality).toBe("GOOD");
      expect(prop?.sequence).toBe(881);
      expect(prop?.freshness).toBe("FRESH");
    });
  });

  describe("4. Key Demonstration: GEN-01 Anomaly -> Twin State Changes -> Downstream Impact", () => {
    it("evaluates health score degradation, records state transition, and flags downstream impact chain", () => {
      const registry = getTwinRegistry();

      // Send critical overheating point: 104°C on Primary Diesel Generator 1
      const criticalPoint: TelemetryPoint = {
        id: `telem-crit-gen1`,
        stationId: "station-maitri",
        assetId: "asset-maitri-gen-1",
        metric: "temperature",
        value: 104.0, // Critical high threshold breach
        unit: "degC",
        timestamp: new Date(),
        source: "SIMULATED",
        quality: "GOOD",
        sequence: 991,
      };

      registry.handleTelemetryPoint(criticalPoint);

      const state = registry.getTwinState("station-maitri");
      const gen1 = state?.assets.find((a) => a.assetId === "asset-maitri-gen-1");

      // 1. Health score degraded
      expect(gen1?.healthScore).toBeLessThanOrEqual(50);
      expect(gen1?.status).toBe("FAILED");
      expect(gen1?.anomalyState.hasActiveAnomaly).toBe(true);

      // 2. Downstream impacted assets identified through dependency graph
      expect(gen1?.impactedDownstreamAssets).toBeDefined();
      expect(gen1?.impactedDownstreamAssets?.length).toBeGreaterThanOrEqual(3);
      expect(gen1?.impactedDownstreamAssets).toContain("asset-maitri-bat-1");
      expect(gen1?.impactedDownstreamAssets).toContain("asset-maitri-hvac-1");

      // 3. Station status assessment reflects critical condition
      expect(["OFFLINE", "DEGRADED"]).toContain(state?.stationStatus);
      expect(state?.statusAssessment.reason).toContain("Critical failure condition");
      expect(state?.statusAssessment.contributingAssets.length).toBeGreaterThan(0);

      // 4. State transition recorded
      const transitions = state?.recentTransitions;
      expect(transitions?.length).toBeGreaterThan(0);
      const assetTransition = transitions?.find((t) => t.entityId === "asset-maitri-gen-1");
      expect(assetTransition).toBeDefined();
      expect(assetTransition?.newState).toBe("FAILED");
    });

    it("GET /api/twin/:stationId/impact/:assetId returns downstream traversal via HTTP", async () => {
      const res = await request(app).get("/api/twin/station-maitri/impact/asset-maitri-gen-1");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rootAssetId).toBe("asset-maitri-gen-1");
      expect(res.body.data.impactedCount).toBeGreaterThanOrEqual(3);
      expect(res.body.data.impactedAssetIds).toContain("asset-maitri-bat-1");
      expect(res.body.data.maxCriticality).toBe("CRITICAL");
    });
  });

  describe("5. Dependency Graph & Traversal", () => {
    it("correctly models multi-hop dependency paths", () => {
      const graph = new TwinDependencyGraph([
        {
          id: "dep-1",
          fromAssetId: "gen-01",
          toAssetId: "energy-bus",
          dependencyType: "POWER",
          criticality: "CRITICAL",
          createdAt: new Date(),
        },
        {
          id: "dep-2",
          fromAssetId: "energy-bus",
          toAssetId: "hvac-01",
          dependencyType: "POWER",
          criticality: "HIGH",
          createdAt: new Date(),
        },
        {
          id: "dep-3",
          fromAssetId: "hvac-01",
          toAssetId: "living-quarters",
          dependencyType: "THERMAL",
          criticality: "HIGH",
          createdAt: new Date(),
        },
      ]);

      const impact = graph.getDownstreamImpact("gen-01");
      expect(impact.impactedCount).toBe(3);
      expect(impact.impactedAssetIds).toEqual(["energy-bus", "hvac-01", "living-quarters"]);
      expect(impact.maxCriticality).toBe("CRITICAL");
      expect(impact.paths.length).toBe(3);
    });
  });

  describe("6. Deterministic Station-Level Status & Risk Evaluation", () => {
    it("evaluates operational risk score and contributing factors based on environmental extremes", () => {
      const evaluator = new StationAggregateEvaluator();
      const assets = [
        {
          assetId: "a1",
          stationId: "station-maitri",
          name: "Main Complex",
          type: "BUILDING" as const,
          criticality: "CRITICAL" as const,
          currentTelemetry: {
            wind_speed: {
              value: 36.5, // Katabatic storm wind speed
              unit: "m/s",
              timestamp: new Date().toISOString(),
              quality: "GOOD" as const,
              source: "SIMULATED" as const,
              observedAt: new Date().toISOString(),
              ageSeconds: 0,
              freshness: "FRESH" as const,
            },
            ambient_temperature: {
              value: -38.0,
              unit: "degC",
              timestamp: new Date().toISOString(),
              quality: "GOOD" as const,
              source: "SIMULATED" as const,
              observedAt: new Date().toISOString(),
              ageSeconds: 0,
              freshness: "FRESH" as const,
            },
          },
          status: "OPERATIONAL" as const,
          healthScore: 92,
          lastUpdate: new Date().toISOString(),
          freshness: computeFreshness(new Date()),
          dataQuality: "GOOD" as const,
          anomalyState: { hasActiveAnomaly: false },
          maintenanceState: { inMaintenance: false },
        },
      ];

      const env = evaluator.evaluateEnvironmentState(assets);
      expect(env.condition).toBe("BLIZZARD");

      const energy = evaluator.evaluateEnergyState(assets);
      const logistics = evaluator.evaluateLogisticsState(assets);
      const risk = evaluator.evaluateOperationalRisk("OPERATIONAL", env, energy, logistics);

      expect(risk.score).toBeGreaterThanOrEqual(40);
      expect(["MEDIUM", "HIGH", "CRITICAL"]).toContain(risk.level);
      expect(risk.factors.some((f) => f.includes("blizzard"))).toBe(true);
    });
  });

  describe("7. Twin Snapshots & Immutability", () => {
    it("creates immutable, serializable snapshot that preserves state without mutation", () => {
      const registry = getTwinRegistry();
      const snapshot = registry.createSnapshot("station-maitri");

      expect(snapshot).toBeDefined();
      expect(snapshot.id).toMatch(/^snap-/);
      expect(snapshot.stationId).toBe("station-maitri");
      expect(snapshot.snapshotAt).toBeDefined();
      expect(snapshot.state.stationId).toBe("station-maitri");
      expect(Object.isFrozen(snapshot)).toBe(true);
      expect(Object.isFrozen(snapshot.state)).toBe(true);

      // Verify serialization / deserialization roundtrip
      const serialized = JSON.stringify(snapshot);
      const parsed = JSON.parse(serialized);
      expect(parsed.stationId).toBe("station-maitri");
    });

    it("GET /api/twin/:stationId/snapshot returns immutable snapshot via HTTP", async () => {
      const res = await request(app).get("/api/twin/station-maitri/snapshot");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toMatch(/^snap-/);
      expect(res.body.data.state.assets.length).toBeGreaterThanOrEqual(8);
    });
  });

  describe("8. Historical State Reconstruction (Time-Travel)", () => {
    it("reconstructs historical Twin state at a target timestamp", async () => {
      const registry = getTwinRegistry();
      const targetTime = new Date();

      const reconstructed = await registry.reconstructStateAt("station-maitri", targetTime);
      expect(reconstructed).toBeDefined();
      expect(reconstructed.stationId).toBe("station-maitri");
      expect(reconstructed.state).toBeDefined();
    });

    it("GET /api/twin/:stationId/time-travel queries historical reconstruction via HTTP", async () => {
      const targetTime = new Date().toISOString();
      const res = await request(app).get(`/api/twin/station-maitri/time-travel?at=${encodeURIComponent(targetTime)}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.stationId).toBe("station-maitri");
    });
  });

  describe("9. WebSocket Live Event Streaming", () => {
    it("broadcasts typed events to connected WebSocket clients", async () => {
      const wsUrl = `ws://localhost:${wsPort}/ws`;
      const client = new WebSocket(wsUrl);

      const receivedMessages: Array<{ type: string; stationId?: string }> = [];

      await new Promise<void>((resolve, reject) => {
        client.on("open", () => {
          client.send(JSON.stringify({ action: "subscribe", stationId: "station-maitri" }));
          resolve();
        });
        client.on("error", reject);
      });

      client.on("message", (raw) => {
        try {
          const parsed = JSON.parse(raw.toString());
          receivedMessages.push(parsed);
        } catch {
          // ignore
        }
      });

      // Broadcast an event through TwinWebSocketManager
      twinWebSocketManager.broadcast("telemetry.updated", "station-maitri", {
        metric: "test_ws_metric",
        value: 42.0,
      });

      // Give client brief moment to receive message
      await new Promise((resolve) => setTimeout(resolve, 300));

      client.close();

      const found = receivedMessages.find((m) => m.type === "telemetry.updated");
      expect(found).toBeDefined();
      expect(found?.stationId).toBe("station-maitri");
    });
  });
});
