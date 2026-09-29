import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import { closePool } from "../db/pool";
import { runMigrations } from "../db/migrate";
import { runSeeds } from "../db/seed";
import {
  StationRepository,
  AssetRepository,
  InventoryRepository,
  AlertRepository,
  ForecastRepository,
  SimulationRepository,
  AssetDependencyRepository,
  MetricDefinitionRepository,
  MaintenanceRepository,
  OperatorRepository,
  AuditRepository,
  TelemetryRepository,
} from "../repositories";

const app = createApp();

describe("Phase 1: Station Model, Data-Model Hardening & Database", () => {
  beforeAll(async () => {
    await runMigrations();
    await runSeeds();
  }, 30000);

  afterAll(async () => {
    await closePool();
  });

  describe("Exit Criterion 1: Both stations exist", () => {
    it("should retrieve both Maitri and Bharati from the repository", async () => {
      const stationRepo = new StationRepository();
      const stations = await stationRepo.findAll();

      expect(stations.length).toBeGreaterThanOrEqual(2);
      const codes = stations.map((s) => s.code);
      expect(codes).toContain("MAITRI");
      expect(codes).toContain("BHARATI");

      const maitri = stations.find((s) => s.code === "MAITRI");
      expect(maitri?.name).toBe("Maitri Station");
      expect(maitri?.status).toBe("OPERATIONAL");
      expect(maitri?.dataMode).toBe("SIMULATED");

      const bharati = stations.find((s) => s.code === "BHARATI");
      expect(bharati?.name).toBe("Bharati Station");
      expect(bharati?.status).toBe("OPERATIONAL");
    });

    it("GET /api/stations should return both stations via HTTP", async () => {
      const res = await request(app).get("/api/stations");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);

      const codes = res.body.data.map((s: { code: string }) => s.code);
      expect(codes).toContain("MAITRI");
      expect(codes).toContain("BHARATI");
    });
  });

  describe("Exit Criterion 2: Representative assets exist", () => {
    it("should retrieve representative assets for Maitri", async () => {
      const assetRepo = new AssetRepository();
      const maitriAssets = await assetRepo.findByStationId("station-maitri");

      expect(maitriAssets.length).toBeGreaterThanOrEqual(8);
      const assetCodes = maitriAssets.map((a) => a.code);
      expect(assetCodes).toContain("MAITRI-GEN-01");
      expect(assetCodes).toContain("MAITRI-BAT-01");
      expect(assetCodes).toContain("MAITRI-WTR-01");
      expect(assetCodes).toContain("MAITRI-HVAC-01");
      expect(assetCodes).toContain("MAITRI-COM-01");

      const gen1 = maitriAssets.find((a) => a.code === "MAITRI-GEN-01");
      expect(gen1?.type).toBe("GENERATOR");
      expect(gen1?.criticality).toBe("CRITICAL");
      expect(gen1?.healthScore).toBeGreaterThan(0);
    });

    it("should retrieve representative assets for Bharati", async () => {
      const assetRepo = new AssetRepository();
      const bharatiAssets = await assetRepo.findByStationId("station-bharati");

      expect(bharatiAssets.length).toBeGreaterThanOrEqual(8);
      const assetCodes = bharatiAssets.map((a) => a.code);
      expect(assetCodes).toContain("BHARATI-CHP-01");
      expect(assetCodes).toContain("BHARATI-BAT-01");
      expect(assetCodes).toContain("BHARATI-RO-01");
      expect(assetCodes).toContain("BHARATI-SAT-01");

      const sat = bharatiAssets.find((a) => a.code === "BHARATI-SAT-01");
      expect(sat?.type).toBe("COMMUNICATION");
      expect(sat?.criticality).toBe("CRITICAL");
    });

    it("GET /api/stations/:stationId/assets returns assets via HTTP", async () => {
      const res = await request(app).get("/api/stations/station-maitri/assets");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(8);
    });

    it("GET /api/stations/:stationId/summary returns asset summary and alerts", async () => {
      const res = await request(app).get("/api/stations/station-maitri/summary");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("assetSummary");
      expect(res.body.data.assetSummary.total).toBeGreaterThanOrEqual(8);
      expect(res.body.data.assetSummary.operational).toBeGreaterThan(0);
    });
  });

  describe("Exit Criterion 3: Seed data loads across inventory, alerts, forecasts, simulations", () => {
    it("loads inventory items with critical thresholds", async () => {
      const invRepo = new InventoryRepository();
      const items = await invRepo.findByStationId("station-maitri");

      expect(items.length).toBeGreaterThanOrEqual(5);
      const categories = items.map((i) => i.category);
      expect(categories).toContain("FUEL");
      expect(categories).toContain("FOOD");
      expect(categories).toContain("MEDICAL");

      const fuel = items.find((i) => i.category === "FUEL");
      expect(fuel?.quantity).toBeGreaterThan(fuel?.minimumThreshold ?? 0);
    });

    it("loads alerts with extended rule and impact evidence", async () => {
      const alertRepo = new AlertRepository();
      const alerts = await alertRepo.findByStationId("station-maitri");

      expect(alerts.length).toBeGreaterThanOrEqual(1);
      expect(alerts[0].evidence).toBeDefined();
      expect(alerts[0].status).toBe("OPEN");
    });

    it("loads forecasts with model versions and bounds", async () => {
      const forecastRepo = new ForecastRepository();
      const forecasts = await forecastRepo.findByStationId("station-maitri");

      expect(forecasts.length).toBeGreaterThanOrEqual(1);
      expect(forecasts[0].modelVersion).toBeDefined();
      expect(forecasts[0].predictedValue).toBeGreaterThan(0);
    });

    it("loads simulation runs with scenario inputs and impacts", async () => {
      const simRepo = new SimulationRepository();
      const runs = await simRepo.findByStationId("station-maitri");

      expect(runs.length).toBeGreaterThanOrEqual(1);
      expect(runs[0].scenarioType).toBe("GENERATOR_FAILURE");
      expect(runs[0].impacts).toBeDefined();
    });

    it("GET /ready returns database: ok", async () => {
      const res = await request(app).get("/ready");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
      expect(res.body.checks.database.status).toBe("ok");
    });
  });

  describe("Exit Criterion 4: Phase 1 Data-Model Hardening", () => {
    it("loads asset dependency chains and performs downstream impact queries", async () => {
      const depRepo = new AssetDependencyRepository();
      const allDeps = await depRepo.findAll();
      expect(allDeps.length).toBeGreaterThanOrEqual(10);

      // Downstream impact chain for Primary Generator 1
      const downstream = await depRepo.findDownstream("asset-maitri-gen-1");
      expect(downstream.length).toBeGreaterThanOrEqual(3);
      expect(downstream).toContain("asset-maitri-bat-1");
      expect(downstream).toContain("asset-maitri-hvac-1");

      // HTTP endpoint
      const res = await request(app).get("/api/dependencies/downstream/asset-maitri-gen-1");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalImpacted).toBeGreaterThanOrEqual(3);
      expect(res.body.data.downstreamAssetIds).toContain("asset-maitri-bat-1");
    });

    it("loads canonical metric definitions with plausible bounds", async () => {
      const metricRepo = new MetricDefinitionRepository();
      const defs = await metricRepo.findAll();
      expect(defs.length).toBeGreaterThanOrEqual(10);

      const tempDef = await metricRepo.findByMetric("temperature");
      expect(tempDef).toBeDefined();
      expect(tempDef?.canonicalUnit).toBe("degC");
      expect(tempDef?.minPlausible).toBe(-40);
      expect(tempDef?.maxPlausible).toBe(125);

      const res = await request(app).get("/api/metrics");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(10);
    });

    it("loads maintenance events history", async () => {
      const maintRepo = new MaintenanceRepository();
      const events = await maintRepo.findByStationId("station-maitri");
      expect(events.length).toBeGreaterThanOrEqual(1);

      const res = await request(app).get("/api/maintenance?stationId=station-maitri");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it("loads operator role records and audit events", async () => {
      const opRepo = new OperatorRepository();
      const ops = await opRepo.findAll();
      expect(ops.length).toBeGreaterThanOrEqual(4);

      const auditRepo = new AuditRepository();
      const audits = await auditRepo.findAll();
      expect(audits.length).toBeGreaterThanOrEqual(3);

      const resAudit = await request(app).get("/api/audit");
      expect(resAudit.status).toBe(200);
      expect(resAudit.body.success).toBe(true);
      expect(resAudit.body.data.length).toBeGreaterThanOrEqual(3);
    });

    it("persists telemetry sequence and explicit provenance into database", async () => {
      const telemRepo = new TelemetryRepository();
      const testPoint = {
        id: `telem-test-${Date.now()}`,
        stationId: "station-maitri",
        assetId: "asset-maitri-gen-1",
        metric: "test_hardened_metric",
        value: 123.45,
        unit: "kW",
        timestamp: new Date(),
        source: "SIMULATED" as const,
        quality: "GOOD" as const,
        sequence: 9942,
        ingestedAt: new Date(),
      };

      const inserted = await telemRepo.insert(testPoint);
      expect(inserted.sequence).toBe(9942);
      expect(inserted.source).toBe("SIMULATED");
      expect(inserted.ingestedAt).toBeDefined();

      const retrieved = await telemRepo.findRecent({
        stationId: "station-maitri",
        metric: "test_hardened_metric",
        limit: 1,
      });

      expect(retrieved.length).toBe(1);
      expect(retrieved[0].sequence).toBe(9942);
      expect(retrieved[0].source).toBe("SIMULATED");
    });
  });
});
