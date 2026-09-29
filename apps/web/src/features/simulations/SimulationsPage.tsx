import React from "react";
import { useStation } from "../../hooks/useStation";

export function SimulationsPage(): React.JSX.Element {
  const { simulationStatus, triggerAnomaly, changeConnectivity, refreshState } = useStation();

  const connectivity = simulationStatus?.connectivity ?? "NORMAL";
  const queueSize = simulationStatus?.queueSize ?? 0;

  return (
    <div className="app-content">
      <header className="page-header">
        <div>
          <h1 className="page-header__title">Antarctic Communications & Telemetry Simulation Sandbox</h1>
          <p className="page-header__subtitle">
            Inject deterministic physical anomalies, simulate polar satellite link fades, and inspect store-and-forward edge buffering.
          </p>
        </div>

        <button className="btn btn--outline" onClick={refreshState}>
          ↻ Refresh Status
        </button>
      </header>

      {/* Simulator Status Overview */}
      <div className="grid-3">
        <div className="kpi-tile">
          <div className="kpi-tile__label">Satellite Link State</div>
          <div className="kpi-tile__value">
            <span
              className={`badge ${
                connectivity === "NORMAL"
                  ? "badge--operational"
                  : connectivity === "OFFLINE"
                  ? "badge--critical"
                  : "badge--warning"
              }`}
              style={{ fontSize: "1.1rem", padding: "0.3rem 0.6rem" }}
            >
              {connectivity}
            </span>
          </div>
          <div className="kpi-tile__meta">Simulating Polar satellite link availability</div>
        </div>

        <div className="kpi-tile">
          <div className="kpi-tile__label">Edge SSD Store-and-Forward Buffer</div>
          <div className="kpi-tile__value">
            {queueSize} <span className="kpi-tile__unit">packets</span>
          </div>
          <div className="kpi-tile__meta">
            {queueSize > 0 ? "Queued during link blackout" : "Buffer empty (100% ingested)"}
          </div>
        </div>

        <div className="kpi-tile">
          <div className="kpi-tile__label">Simulation Engine Step</div>
          <div className="kpi-tile__value">
            #{simulationStatus?.step ?? 0}
          </div>
          <div className="kpi-tile__meta">Last synced at {simulationStatus?.lastSync ? new Date(simulationStatus.lastSync).toLocaleTimeString() : "Live"}</div>
        </div>
      </div>

      {/* Interactive Controls */}
      <div className="grid-2">
        {/* Link Connectivity Control */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">📡 Satellite Link Connectivity Simulation</h2>
            <span className="card-subtitle">Simulate real polar communications disruptions</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.5rem" }}>
            <button
              className={`btn ${connectivity === "NORMAL" ? "btn--primary" : "btn--outline"}`}
              onClick={() => changeConnectivity("NORMAL")}
            >
              ● NORMAL: 100% immediate delivery to MQTT broker
            </button>
            <button
              className={`btn ${connectivity === "DEGRADED" ? "btn--primary" : "btn--outline"}`}
              onClick={() => changeConnectivity("DEGRADED")}
            >
              ▲ DEGRADED: 30% packet loss routed to edge buffer
            </button>
            <button
              className={`btn ${connectivity === "OFFLINE" ? "btn--danger" : "btn--outline"}`}
              onClick={() => changeConnectivity("OFFLINE")}
            >
              ■ OFFLINE: Total satellite blackout, 100% stored in edge buffer
            </button>
            <button
              className={`btn ${connectivity === "RECOVERY" ? "btn--primary" : "btn--outline"}`}
              onClick={() => changeConnectivity("RECOVERY")}
            >
              ↺ RECOVERY: Batch replay buffered packets with server acknowledgement
            </button>
          </div>
        </div>

        {/* Anomaly Preset Injection */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">⚡ Deterministic Anomaly Injections</h2>
            <span className="card-subtitle">Demo failure cascades for the Digital Twin</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginTop: "0.5rem" }}>
            <button
              className="btn btn--outline"
              onClick={() => triggerAnomaly("NORMAL")}
            >
              ✓ Nominal Reset
            </button>
            <button
              className="btn btn--danger"
              onClick={() => triggerAnomaly("GENERATOR_OVERHEAT")}
            >
              🔥 GEN-01 Overheat
            </button>
            <button
              className="btn btn--outline"
              onClick={() => triggerAnomaly("COMMUNICATION_LOSS")}
            >
              📡 Satellite Outage
            </button>
            <button
              className="btn btn--outline"
              onClick={() => triggerAnomaly("BATTERY_DISCHARGE")}
            >
              🔋 Battery Rapid Drop
            </button>
            <button
              className="btn btn--outline"
              onClick={() => triggerAnomaly("HVAC_LOAD_SPIKE")}
            >
              ❄️ HVAC Load Spike
            </button>
            <button
              className="btn btn--outline"
              onClick={() => triggerAnomaly("ENVIRONMENTAL_EXTREME")}
            >
              🌪️ 140 km/h Blizzard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
