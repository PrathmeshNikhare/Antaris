// ─── API Response Envelope ──────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: ApiMeta;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface ApiMeta {
  page?: number;
  pageSize?: number;
  total?: number;
  timestamp: string;
}

// ─── Pagination ─────────────────────────────────────────────────
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

// ─── Health Check ───────────────────────────────────────────────
export interface HealthCheckResult {
  status: "ok" | "degraded" | "error";
  version: string;
  uptime: number;
  timestamp: string;
  checks?: Record<string, ComponentHealth>;
}

export interface ComponentHealth {
  status: "ok" | "error";
  message?: string;
  latencyMs?: number;
}

// ─── WebSocket Events ───────────────────────────────────────────
export type WsEventType =
  | "telemetry:update"
  | "alert:created"
  | "alert:updated"
  | "station:statusChanged"
  | "simulation:completed";

export interface WsEvent<T = unknown> {
  type: WsEventType;
  stationId: string;
  payload: T;
  timestamp: string;
}
