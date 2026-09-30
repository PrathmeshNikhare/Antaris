import type {
  TwinState,
  TwinAssetState,
  Station,
  Alert,
  MaintenanceEvent,
  AuditEvent,
  StationIntelligenceSummary,
} from "@maitri-bharati/shared";

const API_BASE = "http://localhost:3001/api";

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

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API error ${res.status}: ${errorText || res.statusText}`);
  }
  const json = await res.json();
  return json.data ?? json;
}

export const twinApi = {
  async getTwinState(stationId: string): Promise<TwinState> {
    const res = await fetch(`${API_BASE}/twin/${stationId}`);
    return handleResponse<TwinState>(res);
  },

  async getAssetTwin(stationId: string, assetId: string): Promise<TwinAssetState> {
    const res = await fetch(`${API_BASE}/twin/${stationId}/assets/${assetId}`);
    return handleResponse<TwinAssetState>(res);
  },

  async getDownstreamImpact(stationId: string, assetId: string): Promise<DownstreamImpactResponse> {
    const res = await fetch(`${API_BASE}/twin/${stationId}/impact/${assetId}`);
    return handleResponse<DownstreamImpactResponse>(res);
  },

  async getStations(): Promise<Station[]> {
    const res = await fetch(`${API_BASE}/stations`);
    return handleResponse<Station[]>(res);
  },

  async getStationAlerts(stationId: string): Promise<Alert[]> {
    const res = await fetch(`${API_BASE}/stations/${stationId}/alerts`);
    return handleResponse<Alert[]>(res);
  },

  async acknowledgeAlert(alertId: string): Promise<Alert> {
    const res = await fetch(`${API_BASE}/alerts/${alertId}/acknowledge`, {
      method: "POST",
    });
    return handleResponse<Alert>(res);
  },

  async getMaintenanceEvents(): Promise<MaintenanceEvent[]> {
    const res = await fetch(`${API_BASE}/maintenance`);
    return handleResponse<MaintenanceEvent[]>(res);
  },

  async getAuditEvents(): Promise<AuditEvent[]> {
    const res = await fetch(`${API_BASE}/audit`);
    return handleResponse<AuditEvent[]>(res);
  },

  async logAuditEvent(event: {
    operatorId?: string;
    action: string;
    targetType: string;
    targetId?: string;
    result?: string;
  }): Promise<AuditEvent> {
    const res = await fetch(`${API_BASE}/audit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
    return handleResponse<AuditEvent>(res);
  },

  async getSimulationStatus(): Promise<SimulationStatusResponse> {
    const res = await fetch(`${API_BASE}/telemetry/simulate/status`);
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`API error ${res.status}: ${errorText || res.statusText}`);
    }
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
    await fetch(`${API_BASE}/telemetry/simulate/connectivity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state }),
    });
  },

  async triggerAnomalyPreset(preset: string, stationId = "station-maitri"): Promise<void> {
    await fetch(`${API_BASE}/telemetry/simulate/anomaly/preset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preset, stationId }),
    });
  },

  async createSnapshot(stationId: string): Promise<unknown> {
    const res = await fetch(`${API_BASE}/twin/${stationId}/snapshot`);
    return handleResponse<unknown>(res);
  },

  async getIntelligence(stationId: string): Promise<StationIntelligenceSummary> {
    const res = await fetch(`${API_BASE}/stations/${stationId}/intelligence`);
    return handleResponse<StationIntelligenceSummary>(res);
  },

  async getTelemetryHistory(stationId: string, metric = "power_output_kw", limit = 48): Promise<any[]> {
    const res = await fetch(`${API_BASE}/telemetry?stationId=${stationId}&metric=${metric}&limit=${limit}`);
    return handleResponse<any[]>(res);
  },
};
