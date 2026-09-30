import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import {
  RuleDetector,
  IsolationForest,
  EvidenceBuilder,
  AnomalyService,
  EnergyForecaster,
  InventoryForecaster,
  AssetHealthEvaluator,
  CrossDomainRiskEngine,
  RecommendationEngine,
  intelligenceService,
  modelRegistry,
} from "../intelligence";
import type { TelemetryPoint, TwinAssetState } from "@maitri-bharati/shared";

const app = createApp();

describe("Phase 5: Explainable Operational Intelligence & AI/ML", () => {
  beforeEach(() => {
    intelligenceService.anomalyService.clearAnomalies();
    modelRegistry.clear();
  });

  // ────────────────────────────────────────────────────────────────
  // 1. Fixture: Normal Condition (No False Anomalies)
  // ────────────────────────────────────────────────────────────────
  describe("1. Normal Operational Condition", () => {
    it("classifies baseline telemetry as normal with low anomaly scores and no false alarms", () => {
      const detector = new RuleDetector();
      const iforest = new IsolationForest(25, 64);

      // 10 nominal telemetry points for diesel generator coolant temperature (baseline ~82°C)
      const samples = [
        { value: 81.8, timestamp: 1000 },
        { value: 82.1, timestamp: 2000 },
        { value: 82.0, timestamp: 3000 },
        { value: 81.9, timestamp: 4000 },
        { value: 82.3, timestamp: 5000 },
        { value: 82.0, timestamp: 6000 },
        { value: 82.2, timestamp: 7000 },
        { value: 82.1, timestamp: 8000 },
        { value: 81.9, timestamp: 9000 },
        { value: 82.0, timestamp: 10000 },
      ];

      const stats = detector.calculateRollingStats(samples);
      expect(stats.mean).toBeCloseTo(82.03, 1);
      expect(stats.stdDev).toBeLessThan(0.3);

      const nominalPoint: TelemetryPoint = {
        id: "pt-1",
        stationId: "station-maitri",
        assetId: "asset-maitri-gen-1",
        metric: "coolant_temperature",
        value: 82.2,
        unit: "degC",
        timestamp: new Date(),
        source: "SIMULATOR",
        quality: "GOOD",
      };

      const ruleResult = detector.evaluate(nominalPoint, stats, {
        warningHigh: 90.0,
        criticalHigh: 95.0,
      });

      expect(ruleResult.isAnomaly).toBe(false);
      expect(ruleResult.severity).toBe("INFO");
      expect(ruleResult.score).toBeLessThan(0.4);

      const iforestResult = iforest.scorePoint([0.1, ruleResult.zScore, 0.05, 1.0]);
      expect(iforestResult.isAnomaly).toBe(false);
      expect(iforestResult.score).toBeLessThan(0.62);
    });

    it("evaluates asset health as high (>90) under nominal conditions", () => {
      const evaluator = new AssetHealthEvaluator();
      const nominalAsset: TwinAssetState = {
        assetId: "asset-maitri-gen-1",
        stationId: "station-maitri",
        name: "Primary Diesel Generator 1",
        type: "GENERATOR",
        criticality: "CRITICAL",
        currentTelemetry: {
          coolant_temperature: {
            value: 82.0,
            unit: "degC",
            timestamp: new Date().toISOString(),
            quality: "GOOD",
            source: "SIMULATOR",
            observedAt: new Date().toISOString(),
            ageSeconds: 2,
            freshness: "FRESH",
          },
        },
        status: "OPERATIONAL",
        healthScore: 95,
        lastUpdate: new Date().toISOString(),
        freshness: { observedAt: new Date().toISOString(), ageSeconds: 2, status: "FRESH" },
        dataQuality: "GOOD",
        anomalyState: { hasActiveAnomaly: false },
        maintenanceState: { inMaintenance: false },
      };

      const health = evaluator.evaluate(nominalAsset, []);
      expect(health.overallScore).toBeGreaterThanOrEqual(90);
      expect(health.disclaimer).toContain("Decision-support indicator");
      expect(health.telemetryPenalty).toBe(0);
      expect(health.anomalyPenalty).toBe(0);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 2. Fixture: Anomaly Condition & Evidence Generation
  // ────────────────────────────────────────────────────────────────
  describe("2. Anomaly Detection & Evidence Generation", () => {
    it("detects critical overheat anomaly and generates detailed evidence with baseline, rate of change, and threshold breach", () => {
      const service = new AnomalyService();

      // Establish baseline history
      const now = Date.now();
      for (let i = 10; i >= 1; i--) {
        service.recordSample({
          id: `seed-${i}`,
          stationId: "station-maitri",
          assetId: "asset-maitri-gen-1",
          metric: "coolant_temperature",
          value: 82.0 + (Math.random() - 0.5) * 0.4,
          unit: "degC",
          timestamp: new Date(now - i * 60000),
          source: "SIMULATOR",
          quality: "GOOD",
        });
      }

      // Ingest critical anomaly point (97.5°C breaching critical limit of 95°C)
      const anomalyPoint: TelemetryPoint = {
        id: "pt-spike",
        stationId: "station-maitri",
        assetId: "asset-maitri-gen-1",
        metric: "coolant_temperature",
        value: 97.5,
        unit: "degC",
        timestamp: new Date(now),
        source: "SIMULATOR",
        quality: "GOOD",
      };

      const result = service.evaluatePoint(anomalyPoint, {
        warningHigh: 90.0,
        criticalHigh: 95.0,
      });

      // Verify all required fields
      expect(result).toHaveProperty("assetId", "asset-maitri-gen-1");
      expect(result).toHaveProperty("metric", "coolant_temperature");
      expect(result.score).toBeGreaterThan(0.8);
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result).toHaveProperty("detectedAt");
      expect(result).toHaveProperty("modelVersion");
      expect(result).toHaveProperty("evidence");
      expect(result).toHaveProperty("dataQuality", "GOOD");
      expect(result.isAnomaly).toBe(true);
      expect(result.severity).toBe("CRITICAL");

      // Verify Evidence details
      const ev = result.evidence;
      expect(ev.deviationFromBaseline).toBeGreaterThan(10);
      expect(ev.zScore).toBeGreaterThan(3.0);
      expect(ev.trendDirection).toBe("RISING");
      expect(ev.thresholdCrossing).toBeDefined();
      expect(ev.thresholdCrossing?.thresholdType).toBe("CRITICAL");
      expect(ev.thresholdCrossing?.threshold).toBe(95.0);
      expect(ev.thresholdCrossing?.actual).toBe(97.5);
      expect(ev.contributingWindowMinutes).toBeGreaterThanOrEqual(5);
      expect(ev.humanReadable).toContain("Breached critical limit of 95 degC");
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 3. Fixture: 24-Hour Energy Forecasting
  // ────────────────────────────────────────────────────────────────
  describe("3. 24-Hour Energy Forecasting Engine", () => {
    it("generates 24-hour demand, generation, and fuel burn with consistent P10 <= Demand <= P90 bounds", () => {
      const forecaster = new EnergyForecaster();
      const forecast = forecaster.forecast("station-maitri");

      expect(forecast.stationId).toBe("station-maitri");
      expect(forecast.horizonHours).toBe(24);
      expect(forecast.points).toHaveLength(24);
      expect(forecast.confidence).toBeGreaterThan(0.85);
      expect(forecast.modelVersion).toBe("diurnal-polar-reg-v1");
      expect(forecast.assumptions.length).toBeGreaterThan(0);

      // Verify mathematical bounds consistency across all 24 hours
      forecast.points.forEach((pt, idx) => {
        expect(pt.hourOffset).toBe(idx + 1);
        expect(pt.predictedDemandKw).toBeGreaterThan(0);
        expect(pt.lowerDemandKw).toBeLessThanOrEqual(pt.predictedDemandKw);
        expect(pt.upperDemandKw).toBeGreaterThanOrEqual(pt.predictedDemandKw);
        expect(pt.fuelConsumptionRateLph).toBeGreaterThan(0);
        expect(pt.netReserveKw).toBeDefined();
      });

      // Solar generation must be zero during night hours
      const midnightPoint = forecast.points.find((p) => {
        const hour = new Date(p.timestamp).getUTCHours();
        return hour === 1 || hour === 2;
      });
      if (midnightPoint) {
        expect(midnightPoint.solarGenerationKw).toBe(0);
      }
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 4. Fixture: Inventory & Fuel Depletion Forecasting
  // ────────────────────────────────────────────────────────────────
  describe("4. Inventory & Fuel Depletion Forecasting", () => {
    it("calculates fuel, water, and food runway days, depletion dates, and resupply urgency", () => {
      const forecaster = new InventoryForecaster();
      const forecasts = forecaster.forecast("station-maitri");

      expect(forecasts.length).toBeGreaterThanOrEqual(4);

      const fuel = forecasts.find((f) => f.category === "FUEL");
      expect(fuel).toBeDefined();
      expect(fuel!.currentQuantity).toBeGreaterThan(50000);
      expect(fuel!.dailyBurnRate).toBeGreaterThan(500);
      expect(fuel!.daysRemaining).toBeGreaterThan(30);
      expect(new Date(fuel!.depletionDate).getTime()).toBeGreaterThan(Date.now());
      expect(new Date(fuel!.thresholdCrossingDate).getTime()).toBeLessThan(
        new Date(fuel!.depletionDate).getTime()
      );
      expect(["ROUTINE", "ATTENTION", "URGENT", "EMERGENCY"]).toContain(fuel!.resupplyUrgency);
      expect(["LOW", "ELEVATED", "HIGH", "CRITICAL"]).toContain(fuel!.leadTimeRisk);
    });

    it("accelerates fuel consumption trend under extreme cold snap", () => {
      const forecaster = new InventoryForecaster();
      // Cold snap at -35°C
      const coldTwinState = {
        environment: {
          ambientTempC: -35.0,
          windSpeedMs: 25.0,
          atmosphericPressureHpa: 970,
          solarIrradianceWm2: 0,
          condition: "EXTREME_COLD" as const,
          lastUpdate: new Date().toISOString(),
        },
      };

      const forecasts = forecaster.forecast("station-maitri", coldTwinState as any);
      const fuel = forecasts.find((f) => f.category === "FUEL");
      expect(fuel!.consumptionTrend).toBe("ACCELERATING");
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 5. Fixture: Cross-Domain Causal Cascade Engine
  // ────────────────────────────────────────────────────────────────
  describe("5. Cross-Domain Causal Cascade Engine", () => {
    it("propagates generator degradation into efficiency loss, fuel surge, and logistics buffer risk", () => {
      const riskEngine = new CrossDomainRiskEngine();

      // Mock an active generator overheat anomaly
      const activeAnomalies = [
        {
          id: "anom-gen",
          stationId: "station-maitri",
          assetId: "asset-maitri-gen-1",
          metric: "coolant_temperature",
          score: 0.94,
          isAnomaly: true,
          severity: "CRITICAL" as const,
          confidence: 0.95,
          detectedAt: new Date().toISOString(),
          modelVersion: "iforest-v1",
          modelType: "HYBRID" as const,
          evidence: {
            deviationFromBaseline: 18.2,
            deviationUnit: "degC",
            zScore: 4.2,
            trendDirection: "RISING" as const,
            rateOfChange: 2.1,
            contributingWindowMinutes: 30,
            baselineExpected: 82.0,
            humanReadable: "Coolant temperature +18.2°C above baseline",
          },
          dataQuality: "GOOD" as const,
        },
      ];

      const assessment = riskEngine.evaluate(
        "station-maitri",
        undefined,
        activeAnomalies
      );

      expect(assessment.overallRiskScore).toBeGreaterThanOrEqual(50);
      expect(assessment.overallLevel).toBe("HIGH");
      expect(assessment.contributingFactors.length).toBeGreaterThan(0);

      // Verify the Causal Cascade structure
      const genCascade = assessment.cascades.find(
        (c) => c.id === "cascade-gen-degradation"
      );
      expect(genCascade).toBeDefined();
      expect(genCascade!.riskLevel).toBe("CRITICAL");
      expect(genCascade!.nodes).toHaveLength(5);
      expect(genCascade!.links).toHaveLength(4);

      // Check the exact chain nodes
      const labels = genCascade!.nodes.map((n) => n.label);
      expect(labels[0]).toContain("Thermal Stress");
      expect(labels[1]).toContain("Efficiency Degradation");
      expect(labels[2]).toContain("Fuel Consumption Surge");
      expect(labels[3]).toContain("Fuel Reserve Runway Shortening");
      expect(labels[4]).toContain("Logistics Resupply Buffer Risk");
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 6. Advisory Recommendations & Model Observability
  // ────────────────────────────────────────────────────────────────
  describe("6. Advisory Recommendations & Model Observability", () => {
    it("generates advisory recommendations and logs execution provenance", () => {
      const recEngine = new RecommendationEngine();

      const activeAnomalies = [
        {
          id: "anom-gen",
          stationId: "station-maitri",
          assetId: "asset-maitri-gen-1",
          metric: "coolant_temperature",
          score: 0.91,
          isAnomaly: true,
          severity: "CRITICAL" as const,
          confidence: 0.95,
          detectedAt: new Date().toISOString(),
          modelVersion: "iforest-v1",
          modelType: "HYBRID" as const,
          evidence: {
            deviationFromBaseline: 16,
            deviationUnit: "degC",
            zScore: 3.8,
            trendDirection: "RISING" as const,
            rateOfChange: 1.5,
            contributingWindowMinutes: 30,
            baselineExpected: 82.0,
            humanReadable: "High temperature",
          },
          dataQuality: "GOOD" as const,
        },
      ];

      const recs = recEngine.generate("station-maitri", activeAnomalies);
      expect(recs.length).toBeGreaterThan(0);

      recs.forEach((r) => {
        expect(r.isAdvisory).toBe(true);
        expect(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).toContain(r.priority);
        expect([
          "INSPECT_ASSET",
          "REDUCE_LOAD",
          "CHECK_SPARES",
          "MONITOR_TREND",
          "RUN_SIMULATION",
        ]).toContain(r.suggestedAction);
      });

      // Verify Model Observability logging
      modelRegistry.logExecution({
        modelName: "iforest-v1",
        modelVersion: "1.0",
        task: "ANOMALY_DETECTION",
        generatedAt: new Date().toISOString(),
        inputSummary: { metric: "coolant_temperature", value: 97.5 },
        resultSummary: { isAnomaly: true, score: 0.91 },
        confidence: 0.95,
        executionDurationMs: 4,
        evidenceCount: 1,
      });

      const records = modelRegistry.listRecords({ task: "ANOMALY_DETECTION" });
      expect(records).toHaveLength(1);
      expect(records[0].modelName).toBe("iforest-v1");
      expect(records[0].confidence).toBe(0.95);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 7. REST API Endpoints Contract Validation
  // ────────────────────────────────────────────────────────────────
  describe("7. Operational Intelligence REST Endpoints", () => {
    it("GET /api/stations/:stationId/intelligence returns complete intelligence summary", async () => {
      const res = await request(app).get("/api/stations/station-maitri/intelligence");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("stationId", "station-maitri");
      expect(res.body.data).toHaveProperty("activeAnomalies");
      expect(res.body.data).toHaveProperty("energyForecast");
      expect(res.body.data).toHaveProperty("inventoryForecasts");
      expect(res.body.data).toHaveProperty("assetHealthScores");
      expect(res.body.data).toHaveProperty("crossDomainRisk");
      expect(res.body.data).toHaveProperty("recommendations");
      expect(res.body.data).toHaveProperty("observability");
    });

    it("GET /api/stations/:stationId/intelligence/forecasts/energy returns 24h forecast", async () => {
      const res = await request(app).get(
        "/api/stations/station-maitri/intelligence/forecasts/energy"
      );
      expect(res.status).toBe(200);
      expect(res.body.data.points).toHaveLength(24);
      expect(res.body.data.horizonHours).toBe(24);
    });

    it("GET /api/stations/:stationId/intelligence/risk returns cross-domain cascades", async () => {
      const res = await request(app).get(
        "/api/stations/station-maitri/intelligence/risk"
      );
      expect(res.status).toBe(200);
      expect(res.body.data.cascades.length).toBeGreaterThan(0);
      expect(res.body.data).toHaveProperty("overallRiskScore");
    });

    it("POST /api/stations/:stationId/intelligence/anomalies/evaluate evaluates point", async () => {
      const res = await request(app)
        .post("/api/stations/station-maitri/intelligence/anomalies/evaluate")
        .send({
          metric: "coolant_temperature",
          value: 99.2,
          unit: "degC",
          quality: "GOOD",
          timestamp: new Date().toISOString(),
          thresholds: { criticalHigh: 95.0 },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isAnomaly).toBe(true);
      expect(res.body.data.evidence).toBeDefined();
    });
  });
});
