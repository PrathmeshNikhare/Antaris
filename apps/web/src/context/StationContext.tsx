import React, { useEffect, useState, useCallback, useRef } from "react";
import type { TwinState, TwinWebSocketMessage } from "@maitri-bharati/shared";
import { twinApi, type SimulationStatusResponse } from "../services/api";
import { StationContext, type LiveEventItem } from "./StationContextTypes";

export function StationProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [stationId, setStationId] = useState<string>("station-maitri");
  const [twinState, setTwinState] = useState<TwinState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [recentEvents, setRecentEvents] = useState<LiveEventItem[]>([]);
  const [simulationStatus, setSimulationStatus] = useState<SimulationStatusResponse | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  // Fetch complete twin state from API
  const refreshState = useCallback(async () => {
    try {
      const data = await twinApi.getTwinState(stationId);
      setTwinState(data);
      setError(null);
      try {
        const sim = await twinApi.getSimulationStatus();
        setSimulationStatus(sim);
      } catch {
        // simulation status is non-blocking
      }
    } catch (err) {
      console.error("Failed to fetch Twin state:", err);
      setError(err instanceof Error ? err.message : "Failed to load station twin data");
    } finally {
      setLoading(false);
    }
  }, [stationId]);

  // Initial load and station change
  useEffect(() => {
    let active = true;
    twinApi
      .getTwinState(stationId)
      .then((data) => {
        if (!active) return;
        setTwinState(data);
        setError(null);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load station twin data");
        setLoading(false);
      });

    twinApi
      .getSimulationStatus()
      .then((sim) => {
        if (active) setSimulationStatus(sim);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [stationId]);

  // Live WebSocket stream connection
  useEffect(() => {
    const wsUrl = "ws://localhost:3001/ws";
    let isSubscribed = true;

    function connect() {
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isSubscribed) return;
          setWsConnected(true);
          // Subscribe to active station
          ws.send(JSON.stringify({ action: "subscribe", stationId }));
        };

        ws.onmessage = (event) => {
          if (!isSubscribed) return;
          try {
            const msg: TwinWebSocketMessage<unknown> = JSON.parse(event.data);
            
            // If the message is for our current station, handle real-time state mutation
            if (msg.stationId === stationId) {
              const eventItem: LiveEventItem = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                type: msg.type,
                stationId: msg.stationId,
                timestamp: msg.timestamp,
                summary: formatEventSummary(msg),
              };

              setRecentEvents((prev) => [eventItem, ...prev.slice(0, 49)]);

              // Update twin state reactively without full page re-render
              if (msg.type === "telemetry.updated" || msg.type === "asset.state_changed") {
                setTwinState((prev) => {
                  if (!prev) return prev;
                  if (msg.type === "asset.state_changed" && msg.payload) {
                    const updatedAsset = msg.payload as any;
                    const assets = prev.assets.map((a) =>
                      a.assetId === updatedAsset.assetId ? { ...a, ...updatedAsset } : a
                    );
                    return { ...prev, assets, lastSync: msg.timestamp };
                  }
                  return prev;
                });
              } else if (msg.type === "station.state_changed" || msg.type === "dependency.impact_changed") {
                void refreshState();
              }
            }
          } catch {
            // non-json or ping
          }
        };

        ws.onclose = () => {
          if (!isSubscribed) return;
          setWsConnected(false);
          // Auto reconnect after 3 seconds
          setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          setWsConnected(false);
        };
      } catch {
        setWsConnected(false);
      }
    }

    connect();

    return () => {
      isSubscribed = false;
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [stationId, refreshState]);

  // Periodic polling fallback every 6 seconds to ensure data stays fresh
  useEffect(() => {
    const timer = setInterval(() => {
      void refreshState();
    }, 6000);
    return () => clearInterval(timer);
  }, [refreshState]);

  const triggerAnomaly = async (preset: string) => {
    try {
      await twinApi.triggerAnomalyPreset(preset, stationId);
      await refreshState();
    } catch (err) {
      console.error("Failed to trigger anomaly preset:", err);
    }
  };

  const changeConnectivity = async (state: "NORMAL" | "DEGRADED" | "OFFLINE" | "RECOVERY") => {
    try {
      await twinApi.setConnectivity(state);
      await refreshState();
    } catch (err) {
      console.error("Failed to change connectivity:", err);
    }
  };

  return (
    <StationContext.Provider
      value={{
        stationId,
        setStationId,
        twinState,
        loading,
        error,
        wsConnected,
        recentEvents,
        simulationStatus,
        refreshState,
        triggerAnomaly,
        changeConnectivity,
      }}
    >
      {children}
    </StationContext.Provider>
  );
}

function formatEventSummary(msg: TwinWebSocketMessage<any>): string {
  switch (msg.type) {
    case "asset.state_changed":
      return `Asset ${msg.payload?.assetId ?? "Unknown"} state changed to ${msg.payload?.status ?? "UPDATED"}`;
    case "station.state_changed":
      return `Station status transitioned to ${msg.payload?.status ?? "UPDATED"}`;
    case "dependency.impact_changed":
      return `Downstream cascade: ${msg.payload?.impactedCount ?? 0} assets impacted by ${msg.payload?.rootAssetId}`;
    case "telemetry.updated":
      return `Telemetry packet received for ${msg.payload?.assetId ?? "asset"}`;
    case "alert.created":
      return `Alert created: ${msg.payload?.title ?? "System Alert"}`;
    case "alert.updated":
      return `Alert updated: ${msg.payload?.title ?? "System Alert"}`;
    case "connectivity.changed":
      return `Satellite connectivity switched to ${msg.payload?.state ?? "NORMAL"}`;
    default:
      return `Event received: ${msg.type}`;
  }
}
