import type {
  TwinState,
  TwinAssetState,
  Station,
  Alert,
  MaintenanceEvent,
  AuditEvent,
  StationIntelligenceSummary,
  ResilienceSimulationResult,
  ResilienceScenarioType,
  SimulationParameters,
  CargoMission,
  CargoRequisition,
  CargoOptimizationResult,
  InventoryTransaction,
  MissionWindowPlan,
  MissionResilienceIndex,
  StationThreshold,
  ThresholdUpdatePayload,
  MissionEvent,
  FastLaneMetrics,
  FastLaneDeltaItem,
  DecisionTraceRecord,
  MultiHazardComposerInput,
  MultiHazardSimulationResult,
} from "@maitri-bharati/shared";
import { getApiBaseUrl } from "./api-config";

export interface DownstreamImpactResponse {
  rootAssetId: string;
  impactedAssetIds: string[];
  paths: string[][];
  maxCriticality: string;
  impactedCount: number;
}

export interface SimulationStatusResponse {
  step: number;
  connectivity: string;
  anomalyPreset: string;
  queueSize: number;
  lastSync: string;
}

export interface CopilotToolTrace {
  toolName: string;
  args: Record<string, unknown>;
  result: {
    success: boolean;
    data: any;
    provenance: {
      source: string;
      dataType: string;
      timestamp: string;
      disclaimer?: string;
    };
    summary?: string;
    error?: string;
  };
  durationMs: number;
}

export interface CopilotApiResponse {
  answer: string;
  toolCalls: CopilotToolTrace[];
  modelInfo: {
    model: string;
    provider: string;
    available: boolean;
  };
  processingMs: number;
}

/**
 * Universal authenticated fetch helper with credentials and unified error parsing
 */
async function authFetch(endpoint: string, init?: RequestInit): Promise<Response> {
  const base = getApiBaseUrl();
  const url = endpoint.startsWith("http") ? endpoint : `${base}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const token = typeof window !== "undefined" ? localStorage.getItem("token_backup") : null;
  const headers = new Headers(init?.headers || {});
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...init,
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    let message = `API request failed with status ${res.status}`;
    try {
      const errJson = await res.json();
      message = errJson.error?.message || errJson.message || message;
    } catch {
      const errText = await res.text().catch(() => "");
      if (errText) message = `${message}: ${errText}`;
    }
    throw new Error(message);
  }

  return res;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const json = await res.json();
  return (json.data !== undefined ? json.data : json) as T;
}

export const twinApi = {
  // ── Digital Twin Endpoints ─────────────────────────────────────────
  async getTwinState(stationId: string): Promise<TwinState> {
    const res = await authFetch(`/twin/${stationId}`);
    return handleResponse<TwinState>(res);
  },

  async getAssetTwin(stationId: string, assetId: string): Promise<TwinAssetState> {
    const res = await authFetch(`/twin/${stationId}/assets/${assetId}`);
    return handleResponse<TwinAssetState>(res);
  },

  async getDownstreamImpact(stationId: string, assetId: string): Promise<DownstreamImpactResponse> {
    const res = await authFetch(`/twin/${stationId}/impact/${assetId}`);
    return handleResponse<DownstreamImpactResponse>(res);
  },

  async createSnapshot(stationId: string): Promise<unknown> {
    const res = await authFetch(`/twin/${stationId}/snapshot`);
    return handleResponse<unknown>(res);
  },

  async getTimeTravelState(stationId: string, timestamp: string): Promise<TwinState> {
    const res = await authFetch(`/twin/${stationId}/time-travel?timestamp=${encodeURIComponent(timestamp)}`);
    return handleResponse<TwinState>(res);
  },

  // ── Stations & Metadata ────────────────────────────────────────────
  async getStations(): Promise<Station[]> {
    const res = await authFetch("/stations");
    return handleResponse<Station[]>(res);
  },

  // ── Alerts & Incidents ─────────────────────────────────────────────
  async getAlerts(stationId?: string): Promise<Alert[]> {
    const path = stationId ? `/stations/${stationId}/alerts` : "/alerts";
    const res = await authFetch(path);
    return handleResponse<Alert[]>(res);
  },

  async acknowledgeAlert(alertId: string, comment?: string): Promise<Alert> {
    const res = await authFetch(`/alerts/${alertId}/acknowledge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment }),
    });
    return handleResponse<Alert>(res);
  },

  async resolveAlert(alertId: string, comment?: string): Promise<Alert> {
    const res = await authFetch(`/alerts/${alertId}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment }),
    });
    return handleResponse<Alert>(res);
  },

  // ── Maintenance & Audits ───────────────────────────────────────────
  async getMaintenanceEvents(stationId?: string): Promise<MaintenanceEvent[]> {
    const path = stationId ? `/maintenance?stationId=${stationId}` : "/maintenance";
    const res = await authFetch(path);
    return handleResponse<MaintenanceEvent[]>(res);
  },

  async getAuditEvents(stationId?: string, limit = 50): Promise<AuditEvent[]> {
    const query = stationId ? `?stationId=${stationId}&limit=${limit}` : `?limit=${limit}`;
    const res = await authFetch(`/audit${query}`);
    return handleResponse<AuditEvent[]>(res);
  },

  async logAuditEvent(event: Partial<AuditEvent>): Promise<AuditEvent> {
    const res = await authFetch("/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
    return handleResponse<AuditEvent>(res);
  },

  // ── Copilot ────────────────────────────────────────────────────────
  async copilotHealth(): Promise<{ available: boolean; model: string; provider: string }> {
    const res = await authFetch("/copilot/health");
    return handleResponse<{ available: boolean; model: string; provider: string }>(res);
  },

  async copilotChat(
    message: string,
    conversationHistory: Array<{ role: string; content: string }> = []
  ): Promise<CopilotApiResponse> {
    const res = await authFetch("/copilot/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, conversationHistory }),
    });
    return handleResponse<CopilotApiResponse>(res);
  },

  // ── Intelligence & Analytics ───────────────────────────────────────
  async getIntelligence(stationId: string): Promise<StationIntelligenceSummary> {
    const res = await authFetch(`/stations/${stationId}/intelligence`);
    return handleResponse<StationIntelligenceSummary>(res);
  },

  async getResilienceIndex(stationId: string): Promise<MissionResilienceIndex> {
    const res = await authFetch(`/stations/${stationId}/intelligence/resilience-index`);
    return handleResponse<MissionResilienceIndex>(res);
  },

  async getDecisionTrace(stationId: string): Promise<DecisionTraceRecord[]> {
    const res = await authFetch(`/stations/${stationId}/intelligence/decision-trace`);
    return handleResponse<DecisionTraceRecord[]>(res);
  },

  // ── Telemetry & Edge Simulator ─────────────────────────────────────
  async getSimulationStatus(): Promise<SimulationStatusResponse> {
    const res = await authFetch("/telemetry/simulate/status");
    const json = await res.json();
    const sim = json.data?.simulator;
    return {
      step: sim?.tickCount ?? 0,
      connectivity: sim?.connectivityState ?? "NORMAL",
      anomalyPreset: sim?.activeAnomalies?.[0]?.type ?? "",
      queueSize: sim?.offlineBufferedCount ?? 0,
      lastSync: sim?.lastSuccessfulSync ?? "",
    };
  },

  async setConnectivity(state: "NORMAL" | "DEGRADED" | "OFFLINE" | "RECOVERY"): Promise<void> {
    await authFetch("/telemetry/simulate/connectivity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state }),
    });
  },

  async triggerAnomalyPreset(preset: string, stationId: string = "station-maitri"): Promise<void> {
    await authFetch("/telemetry/simulate/anomaly/preset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preset, stationId }),
    });
  },

  async getTelemetryHistory(stationId: string, metric = "power_output_kw", limit = 48): Promise<any[]> {
    const res = await authFetch(`/telemetry?stationId=${stationId}&metric=${metric}&limit=${limit}`);
    return handleResponse<any[]>(res);
  },

  async getFastLaneMetrics(stationId: string): Promise<FastLaneMetrics> {
    const res = await authFetch(`/telemetry/fast-lane/metrics?stationId=${stationId}`);
    return handleResponse<FastLaneMetrics>(res);
  },

  async getFastLaneDelta(stationId: string, sinceSequence = 0): Promise<FastLaneDeltaItem[]> {
    const res = await authFetch(`/telemetry/fast-lane?stationId=${stationId}&since=${sinceSequence}`);
    return handleResponse<FastLaneDeltaItem[]>(res);
  },

  // ── Database-Backed Logistics & Cargo ──────────────────────────────
  async getInventory(stationId: string): Promise<any[]> {
    const res = await authFetch(`/stations/${stationId}/inventory`);
    return handleResponse<any[]>(res);
  },

  async getInventoryTransactions(stationId: string): Promise<InventoryTransaction[]> {
    const res = await authFetch(`/stations/${stationId}/inventory/transactions`);
    return handleResponse<InventoryTransaction[]>(res);
  },

  async getCargoMissions(stationId: string): Promise<CargoMission[]> {
    const res = await authFetch(`/stations/${stationId}/cargo/missions`);
    return handleResponse<CargoMission[]>(res);
  },

  async getCargoRequisitions(stationId: string): Promise<CargoRequisition[]> {
    const res = await authFetch(`/stations/${stationId}/cargo/requisitions`);
    return handleResponse<CargoRequisition[]>(res);
  },

  async createRequisition(stationId: string, payload: Partial<CargoRequisition>): Promise<CargoRequisition> {
    const res = await authFetch(`/stations/${stationId}/cargo/requisitions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return handleResponse<CargoRequisition>(res);
  },

  async createCargoRequisition(stationId: string, payload: Partial<CargoRequisition>): Promise<CargoRequisition> {
    return this.createRequisition(stationId, payload);
  },

  async updateRequisitionStatus(
    stationId: string,
    reqId: string,
    status: string,
    missionId?: string
  ): Promise<CargoRequisition> {
    const res = await authFetch(`/stations/${stationId}/cargo/requisitions/${reqId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, missionId }),
    });
    return handleResponse<CargoRequisition>(res);
  },

  async getCargoOptimization(stationId: string): Promise<CargoOptimizationResult> {
    const res = await authFetch(`/stations/${stationId}/cargo/optimize`);
    return handleResponse<CargoOptimizationResult>(res);
  },

  async optimizeCargo(stationId: string): Promise<CargoOptimizationResult> {
    return this.getCargoOptimization(stationId);
  },

  async getMissionWindowPlan(stationId: string): Promise<MissionWindowPlan> {
    const res = await authFetch(`/stations/${stationId}/cargo/mission-windows`);
    return handleResponse<MissionWindowPlan>(res);
  },

  // ── Operational Mission Events ─────────────────────────────────────
  async getMissionEvents(
    stationId: string,
    category?: string,
    severity?: string,
    search?: string,
    limit = 50
  ): Promise<MissionEvent[]> {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (severity) params.set("severity", severity);
    if (search) params.set("search", search);
    params.set("limit", String(limit));
    const res = await authFetch(`/stations/${stationId}/events?${params.toString()}`);
    return handleResponse<MissionEvent[]>(res);
  },

  // ── Station Thresholds & Configuration ─────────────────────────────
  async getStationThresholds(stationId: string): Promise<StationThreshold[]> {
    const res = await authFetch(`/stations/${stationId}/settings/thresholds`);
    return handleResponse<StationThreshold[]>(res);
  },

  async updateStationThreshold(stationId: string, payload: ThresholdUpdatePayload): Promise<StationThreshold> {
    const res = await authFetch(`/stations/${stationId}/settings/thresholds`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return handleResponse<StationThreshold>(res);
  },

  // ── Simulations & Multi-Hazard ─────────────────────────────────────
  async getSupportedScenarios(): Promise<
    Array<{
      type: ResilienceScenarioType;
      title: string;
      category: string;
      description: string;
      defaultParams: Record<string, any>;
    }>
  > {
    const res = await authFetch("/simulations/scenarios/supported");
    return handleResponse<any>(res);
  },

  async runResilienceSimulation(
    stationId: string,
    scenarioType: ResilienceScenarioType,
    parameters?: Partial<SimulationParameters>
  ): Promise<ResilienceSimulationResult> {
    const res = await authFetch("/simulations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stationId, scenarioType, parameters }),
    });
    return handleResponse<ResilienceSimulationResult>(res);
  },

  async runMultiHazardSimulation(input: MultiHazardComposerInput): Promise<MultiHazardSimulationResult> {
    const res = await authFetch("/simulations/multi-hazard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return handleResponse<MultiHazardSimulationResult>(res);
  },

  async getSimulations(stationId?: string, limit = 20): Promise<ResilienceSimulationResult[]> {
    const query = stationId ? `?stationId=${stationId}&limit=${limit}` : `?limit=${limit}`;
    const res = await authFetch(`/simulations${query}`);
    return handleResponse<ResilienceSimulationResult[]>(res);
  },

  async getSimulationById(simulationId: string): Promise<ResilienceSimulationResult> {
    const res = await authFetch(`/simulations/${simulationId}`);
    return handleResponse<ResilienceSimulationResult>(res);
  },
};
