import React from "react";
import { useStation } from "../../hooks/useStation";

export function IntelligencePage(): React.JSX.Element {
  const { stationId, twinState } = useStation();

  if (!twinState) return <div className="app-content">Operational intelligence data unavailable.</div>;

  const { operationalRisk, assets } = twinState;
  const anomalies = assets.filter((a) => a.anomalyState.hasActiveAnomaly);

  return (
    <div className="app-content">
      <header className="page-header">
        <div>
          <h1 className="page-header__title">
            {stationId === "station-maitri" ? "Maitri" : "Bharati"} Explainable Operational Intelligence
          </h1>
          <p className="page-header__subtitle">
            Cross-domain risk evaluation, multi-sensor anomaly correlation, and early warning vectors.
          </p>
        </div>

        <span
          className={`badge ${
            operationalRisk.level === "LOW"
              ? "badge--operational"
              : operationalRisk.level === "MEDIUM"
              ? "badge--warning"
              : "badge--critical"
          }`}
          style={{ fontSize: "0.85rem", padding: "0.35rem 0.75rem" }}
        >
          ● RISK SCORE: {operationalRisk.score}/100 ({operationalRisk.level})
        </span>
      </header>

      {/* Risk Vectors */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div className="card-header">
          <h2 className="card-title">🛡️ Identified Operational Risk Factors</h2>
          <span className="card-subtitle">Deterministic rule-based risk evaluation</span>
        </div>

        {operationalRisk.factors.length === 0 ? (
          <p style={{ color: "var(--green)", fontSize: "0.85rem" }}>
            ✓ No active operational risks identified. All critical subsystems within normal bounds.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {operationalRisk.factors.map((factor, i) => (
              <div
                key={i}
                style={{
                  background: "var(--surface-soft)",
                  padding: "0.75rem 1rem",
                  borderRadius: "var(--radius-md)",
                  borderLeft: "4px solid var(--warning)",
                  fontSize: "0.85rem",
                  fontWeight: 500,
                }}
              >
                ⚠ {factor}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Anomaly Vector Table */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">🔍 Active Anomaly Tracking Matrix</h2>
            <span className="card-subtitle">Deviations from canonical thresholds</span>
          </div>
          <span className="badge badge--info">{anomalies.length} Detected</span>
        </div>

        {anomalies.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
            No anomalies currently detected across station sensor streams.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border)", color: "var(--text-muted)", fontSize: "0.75rem" }}>
                  <th style={{ padding: "0.5rem" }}>ASSET</th>
                  <th style={{ padding: "0.5rem" }}>CRITICALITY</th>
                  <th style={{ padding: "0.5rem" }}>DETAILS</th>
                  <th style={{ padding: "0.5rem" }}>HEALTH</th>
                  <th style={{ padding: "0.5rem" }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {anomalies.map((a) => (
                  <tr key={a.assetId} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.6rem 0.5rem", fontWeight: 600 }}>{a.name}</td>
                    <td style={{ padding: "0.6rem 0.5rem" }}>
                      <span className="badge badge--critical">{a.criticality}</span>
                    </td>
                    <td style={{ padding: "0.6rem 0.5rem" }}>{a.anomalyState.details ?? "Physical operating limit breached"}</td>
                    <td style={{ padding: "0.6rem 0.5rem", fontWeight: 700, color: "var(--critical)" }}>
                      {a.healthScore}/100
                    </td>
                    <td style={{ padding: "0.6rem 0.5rem" }}>
                      <span className="badge badge--critical">{a.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
