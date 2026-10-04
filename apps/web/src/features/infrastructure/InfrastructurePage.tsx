import React, { useState, useEffect } from "react";
import { useStation } from "../../hooks/useStation";
import { twinApi } from "../../services/api";
import type { MaintenanceEvent } from "@maitri-bharati/shared";

export function InfrastructurePage(): React.JSX.Element {
  const { stationId, twinState } = useStation();
  const [maintenanceEvents, setMaintenanceEvents] = useState<MaintenanceEvent[]>([]);
  const [selectedSubsystem, setSelectedSubsystem] = useState<string>("ALL");

  useEffect(() => {
    twinApi
      .getMaintenanceEvents()
      .then((events) => {
        setMaintenanceEvents(events.filter((e) => e.stationId === stationId));
      })
      .catch((err) => console.warn("Failed to load maintenance events:", err));
  }, [stationId]);

  if (!twinState) return <div className="app-content">Infrastructure state unavailable.</div>;

  const assets = twinState.assets;
  const filteredAssets =
    selectedSubsystem === "ALL"
      ? assets
      : assets.filter((a) => a.type.toLowerCase().includes(selectedSubsystem.toLowerCase()));

  const subsystems = ["ALL", "GENERATOR", "BATTERY", "HVAC", "WATER_SYSTEM", "COMMUNICATION", "BUILDING"];

  return (
    <div className="app-content">
      <header className="page-header">
        <div>
          <h1 className="page-header__title">Infrastructure Subsystem Hierarchy</h1>
          <p className="page-header__subtitle">
            Station physical asset hierarchy, maintenance records, and operational criticality index.
          </p>
        </div>

        {/* Subsystem Filter */}
        <div style={{ display: "flex", gap: "0.3rem", background: "var(--surface)", padding: "0.2rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
          {subsystems.map((sub) => (
            <button
              key={sub}
              type="button"
              className={`station-btn ${selectedSubsystem === sub ? "station-btn--active" : ""}`}
              onClick={() => setSelectedSubsystem(sub)}
              style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
            >
              {sub}
            </button>
          ))}
        </div>
      </header>

      {/* Asset Hierarchy Table */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div className="card-header">
          <h2 className="card-title">Subsystem Assets ({filteredAssets.length})</h2>
          <span className="card-subtitle">Real-time health telemetry & threshold adherence</span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border)", color: "var(--text-muted)", fontSize: "0.75rem" }}>
                <th style={{ padding: "0.6rem" }}>ASSET</th>
                <th style={{ padding: "0.6rem" }}>TYPE</th>
                <th style={{ padding: "0.6rem" }}>CRITICALITY</th>
                <th style={{ padding: "0.6rem" }}>STATUS</th>
                <th style={{ padding: "0.6rem" }}>HEALTH SCORE</th>
                <th style={{ padding: "0.6rem" }}>FRESHNESS</th>
                <th style={{ padding: "0.6rem" }}>TELEMETRY SENSORS</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.map((asset) => {
                let statusClass = "badge--operational";
                if (asset.status === "FAILED") statusClass = "badge--critical";
                else if (asset.status === "DEGRADED") statusClass = "badge--warning";

                return (
                  <tr key={asset.assetId} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.75rem 0.6rem", fontWeight: 600 }}>
                      <div>{asset.name}</div>
                      <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                        {asset.assetId}
                      </span>
                    </td>
                    <td style={{ padding: "0.75rem 0.6rem" }}>
                      <span className="badge badge--info">{asset.type}</span>
                    </td>
                    <td style={{ padding: "0.75rem 0.6rem" }}>
                      <span
                        className={`badge ${
                          asset.criticality === "CRITICAL"
                            ? "badge--critical"
                            : asset.criticality === "HIGH"
                            ? "badge--warning"
                            : "badge--info"
                        }`}
                      >
                        {asset.criticality}
                      </span>
                    </td>
                    <td style={{ padding: "0.75rem 0.6rem" }}>
                      <span className={`badge ${statusClass}`}>{asset.status}</span>
                    </td>
                    <td style={{ padding: "0.75rem 0.6rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <div style={{ width: "60px", background: "var(--surface-soft)", height: "6px", borderRadius: "999px", overflow: "hidden" }}>
                          <div
                            style={{
                              width: `${asset.healthScore}%`,
                              height: "100%",
                              background: asset.healthScore < 70 ? "var(--critical)" : "var(--green)",
                            }}
                          />
                        </div>
                        <span style={{ fontWeight: 600, fontSize: "0.8rem" }}>{asset.healthScore}%</span>
                      </div>
                    </td>
                    <td style={{ padding: "0.75rem 0.6rem" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {asset.freshness.status} ({asset.freshness.ageSeconds}s)
                      </span>
                    </td>
                    <td style={{ padding: "0.75rem 0.6rem" }}>
                      <span style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)" }}>
                        {Object.keys(asset.currentTelemetry).length} points
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Maintenance History */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Maintenance Log & Overhaul Records</h2>
            <span className="card-subtitle">Scheduled and completed physical maintenance events</span>
          </div>
          <span className="badge badge--info">{maintenanceEvents.length} Recorded</span>
        </div>

        {maintenanceEvents.length === 0 ? (
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            No recent maintenance events recorded for this station.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border)", color: "var(--text-muted)", fontSize: "0.75rem" }}>
                  <th style={{ padding: "0.5rem" }}>TYPE</th>
                  <th style={{ padding: "0.5rem" }}>ASSET</th>
                  <th style={{ padding: "0.5rem" }}>SCHEDULED</th>
                  <th style={{ padding: "0.5rem" }}>COMPLETED</th>
                  <th style={{ padding: "0.5rem" }}>PARTS USED</th>
                  <th style={{ padding: "0.5rem" }}>RESULT</th>
                </tr>
              </thead>
              <tbody>
                {maintenanceEvents.map((event) => (
                  <tr key={event.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.6rem 0.5rem", fontWeight: 600 }}>{event.maintenanceType}</td>
                    <td style={{ padding: "0.6rem 0.5rem" }}>{event.assetId}</td>
                    <td style={{ padding: "0.6rem 0.5rem", color: "var(--text-muted)" }}>
                      {new Date(event.scheduledAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: "0.6rem 0.5rem", color: "var(--text-muted)" }}>
                      {event.completedAt ? new Date(event.completedAt).toLocaleDateString() : "Pending"}
                    </td>
                    <td style={{ padding: "0.6rem 0.5rem", fontSize: "0.75rem" }}>
                      {event.partsUsed?.join(", ") || "None"}
                    </td>
                    <td style={{ padding: "0.6rem 0.5rem" }}>
                      <span className="badge badge--operational">{event.result ?? "Nominal"}</span>
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
