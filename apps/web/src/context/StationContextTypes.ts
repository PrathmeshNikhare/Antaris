import { createContext } from "react";
import type { TwinState } from "@maitri-bharati/shared";
import type { SimulationStatusResponse } from "../services/api";

export interface LiveEventItem {
  id: string;
  type: string;
  stationId: string;
  timestamp: string;
  summary: string;
}

export interface StationContextType {
  stationId: string;
  setStationId: (id: string) => void;
  twinState: TwinState | null;
  loading: boolean;
  error: string | null;
  wsConnected: boolean;
  recentEvents: LiveEventItem[];
  simulationStatus: SimulationStatusResponse | null;
  refreshState: () => Promise<void>;
  triggerAnomaly: (preset: string) => Promise<void>;
  changeConnectivity: (state: "NORMAL" | "DEGRADED" | "OFFLINE" | "RECOVERY") => Promise<void>;
}

export const StationContext = createContext<StationContextType | undefined>(undefined);
