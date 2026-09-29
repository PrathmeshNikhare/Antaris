import React, { useState } from "react";
import { useStation } from "../../hooks/useStation";
import { twinApi } from "../../services/api";

export function ReportsPage(): React.JSX.Element {
  const { stationId } = useStation();
  const [snapshot, setSnapshot] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const generateSnapshot = async () => {
    setLoading(true);
    try {
      const data = await twinApi.createSnapshot(stationId);
      setSnapshot(data);
    } catch (err) {
      console.error("Failed to generate snapshot:", err);
    } finally {
      setLoading(false);
    }
  };

  const downloadJson = () => {
    if (!snapshot) return;
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `twin-snapshot-${stationId}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app-content">
      <header className="page-header">
        <div>
          <h1 className="page-header__title">Twin State Archival Snapshots & Reports</h1>
          <p className="page-header__subtitle">
            Generate immutable, serializable point-in-time snapshots of station operational state for simulation branching and regulatory compliance.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn btn--primary" onClick={generateSnapshot} disabled={loading}>
            {loading ? "Capturing..." : "📷 Capture Immutable Snapshot"}
          </button>
          {snapshot && (
            <button className="btn btn--outline" onClick={downloadJson}>
              💾 Export JSON
            </button>
          )}
        </div>
      </header>

      {snapshot ? (
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">📦 Immutable Snapshot Captured: {snapshot.snapshotId}</h2>
              <span className="card-subtitle">Timestamp: {new Date(snapshot.timestamp).toLocaleString()}</span>
            </div>
            <span className="badge badge--operational">FROZEN & IMMUTABLE</span>
          </div>

          <div className="grid-4" style={{ marginTop: "1rem" }}>
            <div className="kpi-tile">
              <div className="kpi-tile__label">Station Status</div>
              <div className="kpi-tile__value" style={{ fontSize: "1.2rem" }}>
                {snapshot.state?.stationStatus}
              </div>
            </div>
            <div className="kpi-tile">
              <div className="kpi-tile__label">Active Assets</div>
              <div className="kpi-tile__value" style={{ fontSize: "1.2rem" }}>
                {snapshot.state?.assets?.length ?? 0}
              </div>
            </div>
            <div className="kpi-tile">
              <div className="kpi-tile__label">Net Grid Power</div>
              <div className="kpi-tile__value" style={{ fontSize: "1.2rem" }}>
                {snapshot.state?.energy?.netPowerKw} kW
              </div>
            </div>
            <div className="kpi-tile">
              <div className="kpi-tile__label">Fuel Autonomy</div>
              <div className="kpi-tile__value" style={{ fontSize: "1.2rem" }}>
                {snapshot.state?.logistics?.daysOfFuelRemaining} days
              </div>
            </div>
          </div>

          <div style={{ marginTop: "1rem" }}>
            <div style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.4rem", color: "var(--text-muted)" }}>
              RAW SNAPSHOT JSON PAYLOAD:
            </div>
            <pre
              style={{
                background: "var(--surface-soft)",
                padding: "1rem",
                borderRadius: "var(--radius-md)",
                maxHeight: "350px",
                overflowY: "auto",
                fontFamily: "var(--font-mono)",
                fontSize: "0.75rem",
                color: "var(--text)",
              }}
            >
              {JSON.stringify(snapshot, null, 2)}
            </pre>
          </div>
        </div>
      ) : (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
            Click <strong>"Capture Immutable Snapshot"</strong> to generate a point-in-time state artifact.
          </p>
        </div>
      )}
    </div>
  );
}
