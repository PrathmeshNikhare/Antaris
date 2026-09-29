import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import App from "../App";

// Mock TwinState
const mockTwinState = {
  stationId: "station-maitri",
  stationStatus: "OPERATIONAL",
  statusAssessment: {
    status: "OPERATIONAL",
    reason: "All primary life-support systems nominal",
    contributingAssets: [],
    contributingAlerts: [],
  },
  lastSync: new Date().toISOString(),
  dataFreshness: {
    observedAt: new Date().toISOString(),
    ageSeconds: 2,
    status: "FRESH",
  },
  connectivityState: "NORMAL",
  dataQualitySummary: {
    goodCount: 45,
    suspectCount: 0,
    badCount: 0,
    overallQuality: "GOOD",
  },
  assets: [
    {
      assetId: "asset-maitri-gen-1",
      stationId: "station-maitri",
      name: "Primary Diesel Generator 125 kVA",
      type: "GENERATOR",
      criticality: "CRITICAL",
      currentTelemetry: {
        power_output_kw: {
          value: 116.2,
          unit: "kW",
          timestamp: new Date().toISOString(),
          quality: "GOOD",
          source: "SIMULATED",
          sequence: 10,
          observedAt: new Date().toISOString(),
          ageSeconds: 2,
          freshness: "FRESH",
        },
      },
      status: "OPERATIONAL",
      healthScore: 92,
      lastUpdate: new Date().toISOString(),
      freshness: {
        observedAt: new Date().toISOString(),
        ageSeconds: 2,
        status: "FRESH",
      },
      dataQuality: "GOOD",
      anomalyState: { hasActiveAnomaly: false },
      maintenanceState: { inMaintenance: false },
      impactedDownstreamAssets: [],
    },
  ],
  energy: {
    totalGenerationKw: 116.2,
    totalLoadKw: 107.6,
    batteryStorageKwh: 150,
    batterySocPct: 84,
    netPowerKw: 8.6,
    gridStatus: "STABLE",
    lastUpdate: new Date().toISOString(),
  },
  environment: {
    ambientTempC: -17.8,
    windSpeedMs: 16.8,
    atmosphericPressureHpa: 985,
    solarIrradianceWm2: 0,
    condition: "NORMAL",
    lastUpdate: new Date().toISOString(),
  },
  logistics: {
    daysOfFuelRemaining: 66,
    daysOfWaterRemaining: 11,
    daysOfFoodRemaining: 120,
    criticalSuppliesCount: 5,
    lastUpdate: new Date().toISOString(),
  },
  activeAlerts: [],
  operationalRisk: {
    score: 15,
    level: "LOW",
    factors: [],
  },
  recentTransitions: [],
};

describe("App Command Center Shell", () => {
  beforeEach(() => {
    // Mock global fetch
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/twin/")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: mockTwinState }),
        });
      }
      if (url.includes("/api/maintenance") || url.includes("/api/audit")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [] }),
        });
      }
      if (url.includes("/api/telemetry/simulate/status")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                step: 10,
                connectivity: "NORMAL",
                anomalyPreset: "NORMAL",
                queueSize: 0,
                lastSync: new Date().toISOString(),
              },
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: {} }),
      });
    }) as any;

    // Mock WebSocket
    class MockWebSocket {
      onopen: (() => void) | null = null;
      onmessage: ((ev: any) => void) | null = null;
      onclose: (() => void) | null = null;
      onerror: ((ev: any) => void) | null = null;
      send = vi.fn();
      close = vi.fn();
      constructor() {
        setTimeout(() => {
          if (this.onopen) this.onopen();
        }, 10);
      }
    }
    (globalThis as any).WebSocket = MockWebSocket;
  });

  it("renders the sidebar brand and title", () => {
    render(<App />);
    expect(screen.getByText("Antarctic Twin")).toBeInTheDocument();
  });

  it("renders all 10 Phase 4 navigation links", () => {
    render(<App />);
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Digital Twin")).toBeInTheDocument();
    expect(screen.getByText("Infrastructure")).toBeInTheDocument();
    expect(screen.getByText("Energy Grid")).toBeInTheDocument();
    expect(screen.getByText("Logistics")).toBeInTheDocument();
    expect(screen.getByText("Environment")).toBeInTheDocument();
    expect(screen.getByText("Intelligence")).toBeInTheDocument();
    expect(screen.getByText("Simulations")).toBeInTheDocument();
    expect(screen.getByText("Snapshots & Reports")).toBeInTheDocument();
    expect(screen.getByText("Audit Log")).toBeInTheDocument();
  });

  it("renders station switcher buttons in TopBar", () => {
    render(<App />);
    expect(screen.getByText("🇮🇳 Maitri")).toBeInTheDocument();
    expect(screen.getByText("🇮🇳 Bharati")).toBeInTheDocument();
  });

  it("renders the Overview page with live data after fetch", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/Maitri Station Operations Command/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Energy Generation & Load/i)).toBeInTheDocument();
    expect(screen.getByText(/Logistics Autonomy/i)).toBeInTheDocument();
  });
});
