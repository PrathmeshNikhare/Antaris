import React from "react";
import { Link } from "react-router-dom";
import { useStation } from "../../hooks/useStation";
import { ResilienceIndexCard } from "../resilience/ResilienceIndexCard";
import { DecisionTracePanel } from "../resilience/DecisionTracePanel";

export function OverviewPage(): React.JSX.Element {
  const { stationId, twinState, loading, error, recentEvents } = useStation();

  if (loading && !twinState) {
    return (
      <div className="app-content">
        <div className="skeleton skeleton-text" style={{ width: "30%", height: "2rem" }} />
        <div className="skeleton skeleton-text" style={{ width: "50%", marginBottom: "2rem" }} />
        <div className="grid-4">
          <div className="skeleton skeleton-tile" />
          <div className="skeleton skeleton-tile" />
          <div className="skeleton skeleton-tile" />
          <div className="skeleton skeleton-tile" />
        </div>
      </div>
    );
  }

  if (error && !twinState) {
    return (
      <div className="app-content">
        <div className="offline-banner">
          <span>⚠️ {error}</span>
          <button className="btn btn--outline" onClick={() => window.location.reload()}>
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!twinState) return <div className="app-content">No station data available.</div>;

  const stationName = stationId === "station-maitri" ? "Maitri Station" : "Bharati Station";
  const { energy, environment, logistics, assets, activeAlerts, operationalRisk, statusAssessment } = twinState;

  const healthyAssets = assets.filter((a) => a.status === "OPERATIONAL").length;
  const degradedAssets = assets.filter((a) => a.status === "DEGRADED").length;
  const failedAssets = assets.filter((a) => a.status === "FAILED").length;

  return (
    <div className="app-content">
      {/* Page Header */}
      <header className="page-header">
        <div>
          <h1 className="page-header__title">{stationName} Operations Command</h1>
          <p className="page-header__subtitle">
            Autonomous Digital Twin state rollup, real-time energy balance, and life-support telemetry.
          </p>
        </div>

        {statusAssessment && (
          <div
            style={{
              padding: "0.5rem 1rem",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              maxWidth: "420px",
              textAlign: "right",
            }}
          >
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>
              EXPLAINABLE STATUS REASON:
            </div>
            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text)" }}>
              {statusAssessment.reason}
            </div>
          </div>
        )}
      </header>

      {/* Antarctic Mission Resilience Index Differentiator Card */}
      <div style={{ marginBottom: "1.25rem" }}>
        <ResilienceIndexCard stationId={stationId} />
      </div>

      {/* 4-Domain KPI Summary Strip */}
      <div className="grid-4">
        {/* Energy KPI */}
        <div className="kpi-tile">
          <div className="kpi-tile__label">
            <span>⚡ Energy Generation & Load</span>
            <span className="badge badge--operational">{energy.gridStatus}</span>
          </div>
          <div className="kpi-tile__value">
            {energy.totalGenerationKw} <span className="kpi-tile__unit">kW gen</span>
          </div>
          <div className="kpi-tile__meta">
            <span>Load: {energy.totalLoadKw} kW</span>
            <span>•</span>
            <span>Net: {energy.netPowerKw >= 0 ? `+${energy.netPowerKw}` : energy.netPowerKw} kW</span>
            <span>•</span>
            <span>Battery: {energy.batterySocPct}%</span>
          </div>
        </div>

        {/* Infrastructure KPI */}
        <div className="kpi-tile">
          <div className="kpi-tile__label">
            <span>⚙ Infrastructure Health</span>
            <span className="badge badge--info">{assets.length} Total</span>
          </div>
          <div className="kpi-tile__value">
            {healthyAssets} <span className="kpi-tile__unit">nominal</span>
          </div>
          <div className="kpi-tile__meta">
            {degradedAssets > 0 && <span style={{ color: "var(--warning)" }}>{degradedAssets} Degraded • </span>}
            {failedAssets > 0 && <span style={{ color: "var(--critical)" }}>{failedAssets} Failed • </span>}
            <span>{activeAlerts.length} Active Alerts</span>
          </div>
        </div>

        {/* Logistics KPI */}
        <div className="kpi-tile">
          <div className="kpi-tile__label">
            <span>📦 Logistics Autonomy</span>
            <span className="badge badge--operational">
              {logistics.daysOfFuelRemaining > 30 ? "SECURE" : "LOW"}
            </span>
          </div>
          <div className="kpi-tile__value">
            {logistics.daysOfFuelRemaining} <span className="kpi-tile__unit">days fuel</span>
          </div>
          <div className="kpi-tile__meta">
            <span>Water: {logistics.daysOfWaterRemaining} days</span>
            <span>•</span>
            <span>Food: {logistics.daysOfFoodRemaining} days</span>
          </div>
        </div>

        {/* Environment KPI */}
        <div className="kpi-tile">
          <div className="kpi-tile__label">
            <span>❄ Meteorological Condition</span>
            <span className={`badge ${environment.condition === "NORMAL" ? "badge--operational" : "badge--warning"}`}>
              {environment.condition}
            </span>
          </div>
          <div className="kpi-tile__value">
            {environment.ambientTempC}° <span className="kpi-tile__unit">C</span>
          </div>
          <div className="kpi-tile__meta">
            <span>Wind: {environment.windSpeedMs} m/s</span>
            <span>•</span>
            <span>Pressure: {environment.atmosphericPressureHpa} hPa</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Twin Preview & Alerts */}
      <div className="grid-main-side">
        {/* Left Column: Digital Twin Plan Preview */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">❖ Digital Twin Operational Topology</h2>
              <span className="card-subtitle">
                Live interactive schematic showing subsystem health rings and dependency cascade links.
              </span>
            </div>
            <Link to="/twin" className="btn btn--outline" style={{ fontSize: "0.75rem" }}>
              Open Full Twin Explorer →
            </Link>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: "0.75rem",
              marginTop: "0.5rem",
            }}
          >
            {assets.slice(0, 8).map((asset) => {
              const isFailed = asset.status === "FAILED";
              const isDegraded = asset.status === "DEGRADED";

              let statusClass = "badge--operational";
              if (isFailed) statusClass = "badge--critical";
              else if (isDegraded) statusClass = "badge--warning";

              return (
                <div
                  key={asset.assetId}
                  style={{
                    background: "var(--surface-soft)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    padding: "0.75rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                      {asset.type}
                    </span>
                    <span className={`badge ${statusClass}`} style={{ fontSize: "0.65rem" }}>
                      {asset.status}
                    </span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: "0.85rem", marginTop: "0.25rem", color: "var(--text)" }}>
                    {asset.name}
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: "0.5rem",
                    }}
                  >
                    <span>Health Score:</span>
                    <strong style={{ color: asset.healthScore < 70 ? "var(--critical)" : "var(--green)" }}>
                      {asset.healthScore}/100
                    </strong>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Operational Risk & Real-time Event Stream */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Operational Risk */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">🛡️ Station Risk Assessment</h2>
              <span
                className={`badge ${
                  operationalRisk.level === "LOW"
                    ? "badge--operational"
                    : operationalRisk.level === "MEDIUM"
                    ? "badge--warning"
                    : "badge--critical"
                }`}
              >
                {operationalRisk.level} RISK ({operationalRisk.score}/100)
              </span>
            </div>
            {operationalRisk.factors.length === 0 ? (
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                No active critical risk factors detected. Life-support systems nominal.
              </p>
            ) : (
              <ul style={{ paddingLeft: "1.2rem", fontSize: "0.8rem", color: "var(--text)" }}>
                {operationalRisk.factors.map((factor, i) => (
                  <li key={i} style={{ marginBottom: "0.3rem" }}>
                    {factor}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Real-time WebSocket Event Stream */}
          <div className="card" style={{ flex: 1 }}>
            <div className="card-header">
              <h2 className="card-title">⚡ Live Operational Events</h2>
              <span className="badge badge--info" style={{ fontSize: "0.65rem" }}>
                WS Stream
              </span>
            </div>
            <div style={{ maxHeight: "280px", overflowY: "auto" }}>
              {recentEvents.length === 0 ? (
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  Listening for live events from edge MQTT & Twin engine...
                </p>
              ) : (
                recentEvents.slice(0, 10).map((evt) => (
                  <div key={evt.id} className="event-item">
                    <span className="event-time">
                      {new Date(evt.timestamp).toLocaleTimeString([], { hour12: false })}
                    </span>
                    <span style={{ fontSize: "0.8rem", color: "var(--text)" }}>{evt.summary}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Active Alerts Console */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">⚠️ Active Alerts & Incident Response Console</h2>
            <span className="card-subtitle">
              Verified operational anomalies requiring operator attention and mitigation.
            </span>
          </div>
          <span className="badge badge--info">{activeAlerts.length} Open</span>
        </div>

        {activeAlerts.length === 0 ? (
          <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
            ✓ No active operational alerts. Station systems operating within nominal safety margins.
          </div>
        ) : (
          <div>
            {activeAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`alert-row ${
                  alert.severity === "CRITICAL" ? "alert-row--critical" : "alert-row--warning"
                }`}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span
                      className={`badge ${
                        alert.severity === "CRITICAL" ? "badge--critical" : "badge--warning"
                      }`}
                    >
                      {alert.severity}
                    </span>
                    <strong style={{ fontSize: "0.85rem" }}>{alert.title}</strong>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      Detected: {new Date(alert.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <p style={{ margin: "0.35rem 0", color: "var(--text)", fontSize: "0.8rem" }}>
                    {alert.description}
                  </p>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", gap: "1rem" }}>
                    <span>
                      Asset: <strong>{alert.assetId}</strong>
                    </span>
                    <span>Confidence: {alert.confidence !== undefined ? `${(alert.confidence * 100).toFixed(0)}%` : "100%"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Decision Trace & Evidence Dossier Flow */}
      <div style={{ marginTop: "1.25rem" }}>
        <DecisionTracePanel stationId={stationId} />
      </div>
    </div>
  );
}
