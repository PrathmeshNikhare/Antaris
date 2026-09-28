import { describe, it, expect } from "vitest";
import type {
  Station,
  Asset,
  TelemetryPoint,
  HealthCheckResult,
  ApiResponse,
} from "../index";

describe("shared types", () => {
  it("should create a valid Station object", () => {
    const station: Station = {
      id: "st-001",
      code: "MAITRI",
      name: "Maitri Station",
      locationLabel: "Schirmacher Oasis, Antarctica",
      status: "OPERATIONAL",
      lastSyncAt: new Date(),
      dataMode: "SIMULATED",
    };

    expect(station.code).toBe("MAITRI");
    expect(station.status).toBe("OPERATIONAL");
  });

  it("should create a valid Asset object", () => {
    const asset: Asset = {
      id: "a-001",
      stationId: "st-001",
      code: "GEN-01",
      name: "Primary Generator",
      type: "GENERATOR",
      status: "OPERATIONAL",
      criticality: "CRITICAL",
      healthScore: 92,
    };

    expect(asset.type).toBe("GENERATOR");
    expect(asset.healthScore).toBe(92);
  });

  it("should create a valid TelemetryPoint object", () => {
    const point: TelemetryPoint = {
      id: "t-001",
      stationId: "st-001",
      assetId: "a-001",
      metric: "temperature",
      value: -15.3,
      unit: "°C",
      timestamp: new Date(),
      source: "SIMULATOR",
      quality: "GOOD",
    };

    expect(point.source).toBe("SIMULATOR");
    expect(point.quality).toBe("GOOD");
  });

  it("should create a valid HealthCheckResult", () => {
    const health: HealthCheckResult = {
      status: "ok",
      version: "0.1.0",
      uptime: 12345,
      timestamp: new Date().toISOString(),
    };

    expect(health.status).toBe("ok");
  });

  it("should create a valid ApiResponse envelope", () => {
    const response: ApiResponse<Station[]> = {
      success: true,
      data: [],
      meta: {
        timestamp: new Date().toISOString(),
        total: 0,
      },
    };

    expect(response.success).toBe(true);
    expect(response.data).toEqual([]);
  });
});
