import React, { useState } from "react";
import { useStation } from "../hooks/useStation";
import { useAuth } from "../context/AuthContext";
import { JudgeModeModal } from "./JudgeModeModal";

export function TopBar(): React.JSX.Element {
  const { user, logout } = useAuth();
  const [judgeModeOpen, setJudgeModeOpen] = useState(false);
  const {
    stationId,
    setStationId,
    twinState,
    wsConnected,
    simulationStatus,
    triggerAnomaly,
    changeConnectivity,
  } = useStation();

  const stationStatus = twinState?.stationStatus ?? "UNKNOWN";
  const freshness = twinState?.dataFreshness.status ?? "UNKNOWN";
  const ageSeconds = twinState?.dataFreshness.ageSeconds ?? 0;
  const currentConnectivity = simulationStatus?.connectivity ?? "NORMAL";

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "OPERATIONAL":
        return "badge--operational";
      case "DEGRADED":
        return "badge--degraded";
      case "CRITICAL":
        return "badge--critical";
      default:
        return "badge--offline";
    }
  };

  const getFreshnessBadgeClass = (fresh: string) => {
    switch (fresh) {
      case "FRESH":
        return "badge--operational";
      case "STALE":
        return "badge--warning";
      default:
        return "badge--offline";
    }
  };

  return (
    <>
      <header className="top-bar">
        <div className="top-bar__left">
          {/* Station Selector */}
          <div className="station-select-group">
            <button
              type="button"
              className={`station-btn ${stationId === "station-maitri" ? "station-btn--active" : ""}`}
              onClick={() => setStationId("station-maitri")}
            >
              <span>🇮🇳 Maitri</span>
              <small style={{ fontSize: "0.65rem", opacity: 0.7 }}>70°S Schirmacher</small>
            </button>
            <button
              type="button"
              className={`station-btn ${stationId === "station-bharati" ? "station-btn--active" : ""}`}
              onClick={() => setStationId("station-bharati")}
            >
              <span>🇮🇳 Bharati</span>
              <small style={{ fontSize: "0.65rem", opacity: 0.7 }}>69°S Larsemann</small>
            </button>
          </div>

          {/* Station Status Pill */}
          <div className="top-bar__status-group">
            <span className={`badge ${getStatusBadgeClass(stationStatus)}`}>
              <span className="badge-dot" />
              {stationStatus}
            </span>

            {/* Freshness Indicator */}
            <span className={`badge ${getFreshnessBadgeClass(freshness)}`} title={`Last telemetry age: ${ageSeconds}s`}>
              <span className="badge-dot" />
              {freshness} ({ageSeconds}s)
            </span>
          </div>
        </div>

        <div className="top-bar__right">
          {/* Interactive Judge Mode Walkthrough Trigger */}
          <button
            type="button"
            onClick={() => setJudgeModeOpen(true)}
            style={{
              backgroundColor: "var(--green)",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              padding: "0.25rem 0.65rem",
              fontSize: "0.75rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
            }}
            title="Open interactive 18-step SIH Judge Demonstration Walkthrough"
            id="btn-open-judge-mode"
          >
            <span>🎯</span>
            <span>Judge Mode</span>
          </button>

          {/* Comms Link Simulation Control (Admin & Engineer only) */}
          {(user?.role === "ADMIN" || user?.role === "ENGINEER") && (
            <div className="header-actions">
              <label htmlFor="comms-select" style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>
                Comms:
              </label>
              <select
                id="comms-select"
                className="select-control"
                value={currentConnectivity}
                onChange={(e) => changeConnectivity(e.target.value as any)}
                title="Simulate Antarctic satellite link degradation or blackout"
              >
                <option value="NORMAL">● Normal (100% Link)</option>
                <option value="DEGRADED">▲ Degraded (30% Loss)</option>
                <option value="OFFLINE">■ Offline Blackout (Edge Buffer)</option>
                <option value="RECOVERY">↺ Recovery (Batch Replay)</option>
              </select>
            </div>
          )}

          {/* Anomaly Demo Trigger (Admin & Engineer only) */}
          {(user?.role === "ADMIN" || user?.role === "ENGINEER") && (
            <div className="header-actions">
              <label htmlFor="anomaly-select" style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>
                Demo Anomaly:
              </label>
              <select
                id="anomaly-select"
                className="select-control"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    triggerAnomaly(e.target.value);
                    e.target.value = "";
                  }
                }}
                title="Inject deterministic failure cascade into Digital Twin"
              >
                <option value="" disabled>
                  ⚡ Inject Scenario...
                </option>
                <option value="NORMAL">✓ Nominal Conditions</option>
                <option value="GENERATOR_OVERHEAT">🔥 GEN-01 Overheat & Trip (Cascade)</option>
                <option value="COMMUNICATION_LOSS">📡 Satellite Link Severed</option>
                <option value="BATTERY_DISCHARGE">🔋 Battery ESS Rapid Discharge</option>
                <option value="HVAC_LOAD_SPIKE">❄️ HVAC Thermal Load Spike</option>
                <option value="FUEL_CONSUMPTION_SPIKE">⛽ Fuel Leak / Burn Rate Spike</option>
                <option value="ENVIRONMENTAL_EXTREME">🌪️ Katabatic Blizzard (140 km/h)</option>
              </select>
            </div>
          )}

          {/* WebSocket Stream Indicator */}
          <span
            className={`badge ${wsConnected ? "badge--operational" : "badge--offline"}`}
            title={wsConnected ? "WebSocket live stream active" : "Reconnecting WebSocket stream..."}
          >
            <span className="badge-dot" />
            {wsConnected ? "WS LIVE" : "WS SYNC"}
          </span>

          {/* Authenticated Operator Profile & Logout */}
          {user ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginLeft: "0.5rem" }}>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "var(--text)",
                  background: "var(--surface-soft, #f0f3ed)",
                  padding: "0.25rem 0.6rem",
                  borderRadius: "4px",
                  border: "1px solid var(--border)",
                }}
                title={`Logged in as ${user.username} (${user.role})`}
              >
                👤 {user.username} <small style={{ color: "var(--green)", fontWeight: 700 }}>[{user.role}]</small>
              </span>
              <button
                type="button"
                onClick={() => void logout()}
                style={{
                  background: "none",
                  border: "1px solid var(--border)",
                  borderRadius: "4px",
                  padding: "0.25rem 0.5rem",
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                }}
                title="Sign out of operations terminal"
              >
                Exit
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {/* Interactive Judge Mode Walkthrough Modal */}
      <JudgeModeModal
        isOpen={judgeModeOpen}
        onClose={() => setJudgeModeOpen(false)}
      />
    </>
  );
}
