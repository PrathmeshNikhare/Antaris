import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { StationProvider } from "../context/StationContext";
import { SimulationsPage } from "../features/simulations/SimulationsPage";
import { twinApi } from "../services/api";
import type { ResilienceSimulationResult } from "@maitri-bharati/shared";

// Mock twinApi
vi.mock("../services/api", () => ({
  twinApi: {
    getSimulations: vi.fn(),
    runResilienceSimulation: vi.fn(),
    getSupportedScenarios: vi.fn(),
    getTwinState: vi.fn().mockResolvedValue({
      stationId: "station-maitri",
      stationStatus: "OPERATIONAL",
      statusAssessment: { currentState: "OPERATIONAL", reason: "Nominal" },
      dataFreshness: { status: "FRESH" },
      connectivityState: "NORMAL",
      dataQualitySummary: { goodCount: 10, suspectCount: 0, badCount: 0, overallQuality: "GOOD" },
      assets: [],
      energy: {
        totalGenerationKw: 55,
        totalLoadKw: 42,
        batteryStorageKwh: 120,
        batterySocPct: 90,
        netPowerKw: 13,
        gridStatus: "SURPLUS",
        lastUpdate: new Date().toISOString(),
      },
      environment: {
        ambientTempC: -22,
        windSpeedMs: 14,
        atmosphericPressureHpa: 985,
        solarIrradianceWm2: 240,
        condition: "NORMAL",
        lastUpdate: new Date().toISOString(),
      },
      logistics: {
        daysOfFuelRemaining: 144,
        daysOfWaterRemaining: 59,
        daysOfFoodRemaining: 288,
        criticalSuppliesCount: 4,
        lastUpdate: new Date().toISOString(),
      },
      activeAlerts: [],
      operationalRisk: { score: 15, level: "LOW", factors: [] },
      recentTransitions: [],
    }),
    getSimulationStatus: vi.fn().mockResolvedValue({
      step: 42,
      connectivity: "NORMAL",
      anomalyPreset: "",
      queueSize: 0,
      lastSync: new Date().toISOString(),
    }),
    setConnectivity: vi.fn().mockResolvedValue(undefined),
    triggerAnomalyPreset: vi.fn().mockResolvedValue(undefined),
  },
}));

const mockSimulationResult: ResilienceSimulationResult = {
  simulationId: "sim-test-12345",
  stationId: "station-maitri",
  scenarioType: "GENERATOR_FAILURE",
  title: "Primary Generator Trip & Rapid Discharge",
  label: "SIMULATION",
  modelVersion: "resilience-sim-v1.0.0",
  deterministicSeed: "42",
  createdAt: new Date().toISOString(),
  snapshotTimestamp: new Date().toISOString(),
  parameters: {
    scenarioType: "GENERATOR_FAILURE",
    durationHours: 2,
    severity: "CRITICAL",
  },
  baselineSnapshot: {} as any,
  scenarioState: {} as any,
  explanation:
    "Primary diesel generator GEN-01 experienced sudden mechanical shutdown. Microgrid battery sustains critical station load while water intake trace heating derates.",
  impactedAssets: [
    {
      assetId: "asset-maitri-gen-1",
      assetName: "Primary Diesel Generator 125 kVA",
      assetType: "GENERATOR",
      baselineStatus: "OPERATIONAL",
      simulatedStatus: "FAILED",
      baselineHealth: 89,
      simulatedHealth: 12,
      failureCause: "Catastrophic mechanical trip",
      criticality: "CRITICAL",
    },
    {
      assetId: "asset-maitri-bat-1",
      assetName: "Central Lithium Battery Storage 60 kWh",
      assetType: "BATTERY",
      baselineStatus: "OPERATIONAL",
      simulatedStatus: "DEGRADED",
      baselineHealth: 94,
      simulatedHealth: 40,
      failureCause: "Emergency rapid discharge",
      criticality: "HIGH",
    },
  ],
  blastRadius: {
    nodes: [
      {
        id: "asset-maitri-gen-1",
        label: "GEN-01 Primary Diesel Generator",
        domain: "INFRASTRUCTURE",
        severity: "CRITICAL",
        status: "FAILED",
        impactDescription: "0 kW generation; electrical bus offline",
        metricValue: "0 kW",
      },
      {
        id: "asset-maitri-bat-1",
        label: "Station Microgrid Battery Bank",
        domain: "ENERGY",
        severity: "WARNING",
        status: "DEGRADED",
        impactDescription: "Emergency deep discharge sustaining base load",
        metricValue: "-42 kW drain",
      },
    ],
    links: [
      {
        source: "asset-maitri-gen-1",
        target: "asset-maitri-bat-1",
        dependencyType: "POWER",
        impactReason: "Battery discharges to cover generation deficit",
      },
    ],
  },
  comparisons: [
    {
      metric: "Total Active Generation",
      unit: "kW",
      baseline: "55.0 kW",
      scenario: "0.0 kW",
      absoluteChange: "-55.0 kW",
      percentageChange: "-100%",
      severity: "CRITICAL",
      reason: "Generator offline",
    },
    {
      metric: "Battery State of Charge (SoC)",
      unit: "%",
      baseline: "90%",
      scenario: "20%",
      absoluteChange: "-70%",
      percentageChange: "-78%",
      severity: "CRITICAL",
      reason: "Rapid discharge to sustain life support loads",
    },
  ],
  operationalRisk: {
    score: 95,
    level: "CRITICAL",
    factors: [
      "Catastrophic primary generator loss induces immediate deficit",
      "Station battery discharging rapidly",
    ],
  },
  recoveryState: {
    suggestedActions: [
      "Switch ATS transfer switch to GEN-02 standby unit immediately",
      "Shed non-critical science loads at switchboard",
    ],
    estimatedRecoveryMinutes: 45,
  },
};

function renderComponent() {
  return render(
    <BrowserRouter>
      <StationProvider>
        <SimulationsPage />
      </StationProvider>
    </BrowserRouter>
  );
}

describe("Phase 6: SimulationsPage Web Feature", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(twinApi.getSimulations).mockResolvedValue([mockSimulationResult]);
    vi.mocked(twinApi.runResilienceSimulation).mockResolvedValue(mockSimulationResult);
  });

  it("renders page header, SIMULATION non-measured banner, and tab controls", async () => {
    renderComponent();

    expect(screen.getByText(/What-If Resilience Simulation Engine/i)).toBeInTheDocument();
    expect(screen.getAllByText(/SIMULATION/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/COUNTERFACTUAL PROJECTION MODE/i)).toBeInTheDocument();

    expect(screen.getByText(/⚡ What-If Resilience Engine/i)).toBeInTheDocument();
    expect(screen.getByText(/📡 Comms & Anomaly Sandbox/i)).toBeInTheDocument();
  });

  it("renders all 8 counterfactual scenario selection cards", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Primary Generator Trip & Rapid Discharge/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Battery Sub-Zero Degradation/i)).toBeInTheDocument();
    expect(screen.getByText(/Polar Diesel Storage Shortage/i)).toBeInTheDocument();
    expect(screen.getByText(/Polar Chill Vortex \(-45°C\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Category 5 Blizzard \(>48 m\/s\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Demand Response & Load Shedding/i)).toBeInTheDocument();
    expect(screen.getByText(/Standby Generator Synchronization/i)).toBeInTheDocument();
    expect(screen.getByText(/Satellite Blackout & Edge Store-and-Forward/i)).toBeInTheDocument();
  });

  it("renders Baseline vs. Counterfactual Comparison Matrix", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Baseline vs. Counterfactual Comparison Matrix/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Total Active Generation/i)).toBeInTheDocument();
    expect(screen.getByText(/-55.0 kW/i)).toBeInTheDocument();
    expect(screen.getByText(/Battery State of Charge \(SoC\)/i)).toBeInTheDocument();
    expect(screen.getByText(/-70%/i)).toBeInTheDocument();
  });

  it("renders blast radius dependency nodes and cascade vectors", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Dependency Blast-Radius & Cascading Impact Propagation/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/GEN-01 Primary Diesel Generator/i)).toBeInTheDocument();
    expect(screen.getByText(/Station Microgrid Battery Bank/i)).toBeInTheDocument();
    expect(screen.getByText(/Active Cascade Vectors/i)).toBeInTheDocument();
    expect(screen.getByText(/➔ \[POWER\] ➔/i)).toBeInTheDocument();
  });

  it("renders plain-language causal narrative and recovery actions", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Plain-Language Causal Narrative Dossier/i)).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Primary diesel generator GEN-01 experienced sudden mechanical shutdown/i)
    ).toBeInTheDocument();

    expect(screen.getByText(/Actionable Mitigation & Recovery Protocol/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Switch ATS transfer switch to GEN-02 standby unit immediately/i)
    ).toBeInTheDocument();
  });

  it("triggers new simulation run on button click", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Run Counterfactual Simulation/i })).toBeInTheDocument();
    });

    const runButton = screen.getByRole("button", { name: /Run Counterfactual Simulation/i });
    fireEvent.click(runButton);

    await waitFor(() => {
      expect(twinApi.runResilienceSimulation).toHaveBeenCalled();
    });
  });

  it("switches to Phase 2 Comms & Telemetry Sandbox tab smoothly", async () => {
    renderComponent();

    const sandboxTab = screen.getByText(/📡 Comms & Anomaly Sandbox/i);
    fireEvent.click(sandboxTab);

    expect(screen.getByText(/Satellite Link Connectivity Simulation/i)).toBeInTheDocument();
    expect(screen.getByText(/Synthetic Anomaly Preset Injections/i)).toBeInTheDocument();
    expect(screen.getByText(/Edge SSD Store-and-Forward Buffer/i)).toBeInTheDocument();
  });
});
