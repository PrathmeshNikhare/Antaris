import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { StationProvider } from "../context/StationContext";
import { IntelligencePage } from "../features/intelligence/IntelligencePage";
import { twinApi } from "../services/api";
import type { StationIntelligenceSummary } from "@maitri-bharati/shared";

// Mock twinApi
vi.mock("../services/api", () => ({
  twinApi: {
    getIntelligence: vi.fn(),
    getTwinState: vi.fn().mockResolvedValue({
      stationId: "station-maitri",
      stationStatus: "OPERATIONAL",
      statusAssessment: { status: "OPERATIONAL", reason: "Nominal" },
      dataFreshness: { status: "FRESH" },
      connectivityState: "NORMAL",
      dataQualitySummary: { goodCount: 10, suspectCount: 0, badCount: 0, overallQuality: "GOOD" },
      assets: [],
      energy: { totalGenerationKw: 55, totalLoadKw: 42, batteryStorageKwh: 120, batterySocPct: 90, netPowerKw: 13, gridStatus: "SURPLUS", lastUpdate: new Date().toISOString() },
      environment: { ambientTempC: -22, windSpeedMs: 14, atmosphericPressureHpa: 985, solarIrradianceWm2: 240, condition: "NORMAL", lastUpdate: new Date().toISOString() },
      logistics: { daysOfFuelRemaining: 144, daysOfWaterRemaining: 59, daysOfFoodRemaining: 288, criticalSuppliesCount: 4, lastUpdate: new Date().toISOString() },
      activeAlerts: [],
      operationalRisk: { score: 15, level: "LOW", factors: [] },
      recentTransitions: [],
    }),
    getSimulationStatus: vi.fn().mockResolvedValue({
      step: 1,
      connectivity: "NORMAL",
      anomalyPreset: "",
      queueSize: 0,
      lastSync: new Date().toISOString(),
    }),
  },
}));

const mockSummary: StationIntelligenceSummary = {
  stationId: "station-maitri",
  timestamp: new Date().toISOString(),
  activeAnomalies: [
    {
      id: "anom-1",
      stationId: "station-maitri",
      assetId: "asset-maitri-gen-1",
      metric: "coolant_temperature",
      score: 0.94,
      isAnomaly: true,
      severity: "CRITICAL",
      confidence: 0.95,
      detectedAt: new Date().toISOString(),
      modelVersion: "iforest-v1",
      modelType: "HYBRID",
      evidence: {
        deviationFromBaseline: 18.2,
        deviationUnit: "degC",
        zScore: 4.2,
        trendDirection: "RISING",
        rateOfChange: 2.1,
        contributingWindowMinutes: 30,
        baselineExpected: 82.0,
        humanReadable: "Coolant temperature +18.2 degC above baseline",
      },
      dataQuality: "GOOD",
    },
  ],
  energyForecast: {
    stationId: "station-maitri",
    generatedAt: new Date().toISOString(),
    modelVersion: "diurnal-polar-reg-v1",
    horizonHours: 24,
    points: Array.from({ length: 24 }, (_, i) => ({
      timestamp: new Date(Date.now() + i * 3600000).toISOString(),
      hourOffset: i + 1,
      predictedDemandKw: 55.0,
      lowerDemandKw: 50.0,
      upperDemandKw: 62.0,
      predictedGenerationKw: 65.0,
      solarGenerationKw: 10.0,
      windGenerationKw: 8.0,
      netReserveKw: 145.0,
      fuelConsumptionRateLph: 12.5,
    })),
    confidence: 0.92,
    assumptions: ["Diurnal cycle modeled"],
  },
  inventoryForecasts: [
    {
      stationId: "station-maitri",
      itemCode: "INV-FUEL-DIESEL",
      itemName: "Polar Jet A-1 / Winter Diesel Fuel",
      category: "FUEL",
      currentQuantity: 118500,
      unit: "L",
      dailyBurnRate: 820,
      daysRemaining: 144.5,
      depletionDate: new Date(Date.now() + 144.5 * 86400000).toISOString(),
      thresholdCrossingDate: new Date(Date.now() + 108 * 86400000).toISOString(),
      consumptionTrend: "STEADY",
      leadTimeRisk: "LOW",
      resupplyUrgency: "ROUTINE",
      generatedAt: new Date().toISOString(),
    },
  ],
  assetHealthScores: [
    {
      assetId: "asset-maitri-gen-1",
      stationId: "station-maitri",
      assetName: "Primary Diesel Generator 1",
      assetType: "GENERATOR",
      overallScore: 68,
      status: "DEGRADED",
      telemetryPenalty: 12,
      anomalyPenalty: 20,
      runtimePenalty: 0,
      maintenancePenalty: 0,
      stressPenalty: 0,
      dataConfidencePenalty: 0,
      factors: ["Active overheat anomaly detected"],
      disclaimer: "Decision-support indicator, not a guaranteed failure probability",
      evaluatedAt: new Date().toISOString(),
    },
    {
      assetId: "asset-maitri-battery-1",
      stationId: "station-maitri",
      assetName: "Battery Storage Bank 1",
      assetType: "BATTERY",
      overallScore: 88,
      status: "OPERATIONAL",
      telemetryPenalty: 0,
      anomalyPenalty: 0,
      runtimePenalty: 4,
      maintenancePenalty: 0,
      stressPenalty: 3,
      dataConfidencePenalty: 0,
      factors: ["Sub-zero cold charge/discharge cycle stress (-3 pts)"],
      disclaimer: "Decision-support indicator, not a guaranteed failure probability",
      evaluatedAt: new Date().toISOString(),
    },
  ],
  crossDomainRisk: {
    stationId: "station-maitri",
    overallRiskScore: 65,
    overallLevel: "HIGH",
    cascades: [
      {
        id: "cascade-gen-degradation",
        title: "Generator Thermal Degradation Cascade",
        triggerDomain: "INFRASTRUCTURE",
        riskLevel: "HIGH",
        nodes: [
          {
            id: "c1-node-1",
            domain: "INFRASTRUCTURE",
            label: "GEN-01 Thermal Stress",
            severity: "CRITICAL",
            description: "High coolant temp",
            metricValue: "+18.2 degC",
          },
          {
            id: "c1-node-2",
            domain: "ENERGY",
            label: "Engine Efficiency Loss",
            severity: "WARNING",
            description: "Derating",
            metricValue: "-14% Eff",
          },
        ],
        links: [
          {
            source: "c1-node-1",
            target: "c1-node-2",
            impact: "High heat causes derating",
          },
        ],
        summary: "Generator degradation triggers cascading efficiency loss",
      },
      {
        id: "cascade-weather-overload",
        title: "Environmental Blizzard & Grid Surge Cascade",
        triggerDomain: "ENVIRONMENT",
        riskLevel: "CRITICAL",
        nodes: [
          {
            id: "c2-node-1",
            domain: "ENVIRONMENT",
            label: "Polar Blizzard / Cold Extreme",
            severity: "CRITICAL",
            description: "High wind chill",
            metricValue: "-34°C / 31m/s",
          },
          {
            id: "c2-node-2",
            domain: "INFRASTRUCTURE",
            label: "Habitat Heat Loss",
            severity: "WARNING",
            description: "Trace heating triggered",
            metricValue: "+16 kW Thermal",
          },
        ],
        links: [
          {
            source: "c2-node-1",
            target: "c2-node-2",
            impact: "Severe cold forces heating draw",
          },
        ],
        summary: "Blizzard forces peak heating draw",
      },
    ],
    contributingFactors: ["Generator overheat", "Harsh polar wind/cold"],
    generatedAt: new Date().toISOString(),
  },
  recommendations: [
    {
      id: "rec-1",
      stationId: "station-maitri",
      title: "Inspect Primary Generator Cooling Radiator",
      description: "Visual inspection recommended",
      domain: "MAINTENANCE",
      priority: "HIGH",
      suggestedAction: "INSPECT_ASSET",
      targetAssetId: "asset-maitri-gen-1",
      isAdvisory: true,
      rationale: "Overheat anomaly detected",
      createdTimestamp: new Date().toISOString(),
    },
  ],
  observability: [
    {
      id: "obs-1",
      modelName: "iforest-v1",
      modelVersion: "1.0",
      task: "ANOMALY_DETECTION",
      generatedAt: new Date().toISOString(),
      inputSummary: { metric: "coolant_temperature" },
      resultSummary: { isAnomaly: true },
      confidence: 0.95,
      executionDurationMs: 4,
      evidenceCount: 1,
    },
  ],
};

describe("IntelligencePage UI Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (twinApi.getIntelligence as any).mockResolvedValue(mockSummary);
  });

  it("renders page header and causal cascade graph", async () => {
    render(
      <BrowserRouter>
        <StationProvider>
          <IntelligencePage />
        </StationProvider>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Maitri Station Operational Intelligence/i)
      ).toBeInTheDocument();
    });

    expect(screen.getByText(/RISK LEVEL: HIGH/i)).toBeInTheDocument();
    expect(screen.getByText(/Causal Impact Chain/i)).toBeInTheDocument();
    expect(screen.getByText(/GEN-01 Thermal Stress/i)).toBeInTheDocument();
    expect(screen.getByText(/Engine Efficiency Loss/i)).toBeInTheDocument();
  });

  it("renders navigation tabs for intelligence features", async () => {
    render(
      <BrowserRouter>
        <StationProvider>
          <IntelligencePage />
        </StationProvider>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Anomaly & Evidence/i)).toBeInTheDocument();
      expect(screen.getByText(/24h Energy & Fuel Forecast/i)).toBeInTheDocument();
      expect(screen.getByText(/Asset Health Matrix/i)).toBeInTheDocument();
      expect(screen.getByText(/Advisory Recommendations/i)).toBeInTheDocument();
      expect(screen.getByText(/Model Observability/i)).toBeInTheDocument();
    });
  });

  it("preserves user-selected cascade when background data updates occur", async () => {
    const { fireEvent } = await import("@testing-library/react");
    render(
      <BrowserRouter>
        <StationProvider>
          <IntelligencePage />
        </StationProvider>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Generator Thermal Degradation Cascade/i)).toBeInTheDocument();
      expect(screen.getByText(/Environmental Blizzard & Grid Surge Cascade/i)).toBeInTheDocument();
    });

    // Switch to Blizzard cascade
    const blizzardBtn = screen.getByRole("button", { name: /Environmental Blizzard & Grid Surge Cascade/i });
    fireEvent.click(blizzardBtn);

    // Verify blizzard nodes are visible
    expect(screen.getByText(/Polar Blizzard \/ Cold Extreme/i)).toBeInTheDocument();
    expect(screen.getByText(/Habitat Heat Loss/i)).toBeInTheDocument();

    // Trigger recalculate models (simulating background data refresh)
    const recalcBtn = screen.getByRole("button", { name: /Recalculate Models/i });
    fireEvent.click(recalcBtn);

    await waitFor(() => {
      expect(twinApi.getIntelligence).toHaveBeenCalledTimes(2);
    });

    // Verify Blizzard cascade remains selected and has NOT flipped back to Generator Thermal cascade
    expect(screen.getByText(/Polar Blizzard \/ Cold Extreme/i)).toBeInTheDocument();
    expect(screen.getByText(/Habitat Heat Loss/i)).toBeInTheDocument();
  });

  it("does not automatically open asset inspector in Asset Health Matrix, preserves user selection, and allows closing", async () => {
    const { fireEvent } = await import("@testing-library/react");
    render(
      <BrowserRouter>
        <StationProvider>
          <IntelligencePage />
        </StationProvider>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Asset Health Matrix/i)).toBeInTheDocument();
    });

    // Switch to HEALTH tab
    const healthTabBtn = screen.getByRole("button", { name: /Asset Health Matrix/i });
    fireEvent.click(healthTabBtn);

    // Verify initial state: no block opened without clicking
    expect(
      screen.getByText(/Select an asset from the matrix to view the degradation penalty breakdown/i)
    ).toBeInTheDocument();

    // Click on Battery Storage Bank 1 card
    const batteryCard = screen.getByText(/Battery Storage Bank 1/i);
    fireEvent.click(batteryCard);

    // Verify Battery details are displayed
    expect(screen.getByText(/ID: asset-maitri-battery-1/i)).toBeInTheDocument();
    expect(screen.getByText(/Sub-zero cold charge\/discharge cycle stress/i)).toBeInTheDocument();

    // Trigger recalculate models (simulating telemetry update)
    const recalcBtn = screen.getByRole("button", { name: /Recalculate Models/i });
    fireEvent.click(recalcBtn);

    await waitFor(() => {
      expect(twinApi.getIntelligence).toHaveBeenCalledTimes(2);
    });

    // Still on Battery Storage Bank 1, NOT automatically switched to Generator 1!
    expect(screen.getByText(/ID: asset-maitri-battery-1/i)).toBeInTheDocument();

    // Clicking the same card again deselects / closes it
    fireEvent.click(batteryCard);
    expect(
      screen.getByText(/Select an asset from the matrix to view the degradation penalty breakdown/i)
    ).toBeInTheDocument();
  });
});

