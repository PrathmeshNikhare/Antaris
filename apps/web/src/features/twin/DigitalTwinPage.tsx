import React, { useState, useEffect } from "react";
import { useStation } from "../../hooks/useStation";
import { twinApi, type DownstreamImpactResponse } from "../../services/api";
import type { TwinAssetState } from "@maitri-bharati/shared";

export function DigitalTwinPage(): React.JSX.Element {
  const { stationId, twinState, loading } = useStation();
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [impactData, setImpactData] = useState<DownstreamImpactResponse | null>(null);

  const activeAssetId = selectedAssetId || (twinState?.assets[0]?.assetId ?? null);

  // Fetch downstream impact when active asset changes
  useEffect(() => {
    if (!activeAssetId) return;

    let isMounted = true;

    twinApi
      .getDownstreamImpact(stationId, activeAssetId)
      .then((data) => {
        if (isMounted) setImpactData(data);
      })
      .catch((err) => {
        console.warn("Failed to fetch downstream impact:", err);
        if (isMounted) setImpactData(null);
      });

    return () => {
      isMounted = false;
    };
  }, [stationId, activeAssetId]);

  if (loading && !twinState) {
    return (
      <div className="app-content">
        <div className="skeleton skeleton-text" style={{ width: "30%", height: "2rem" }} />
        <div className="skeleton skeleton-tile" style={{ height: "400px" }} />
      </div>
    );
  }

  if (!twinState) return <div className="app-content">Twin State unavailable.</div>;

  const assets = twinState.assets;
  const selectedAsset: TwinAssetState | undefined = assets.find((a) => a.assetId === activeAssetId);
  const impactedIds = new Set(impactData?.impactedAssetIds ?? []);

  return (
    <div className="app-content">
      <header className="page-header">
        <div>
          <h1 className="page-header__title">
            {stationId === "station-maitri" ? "Maitri" : "Bharati"} Digital Twin Schematics
          </h1>
          <p className="page-header__subtitle">
            Interactive physical topology with deterministic health evaluation and downstream cascade traversal.
          </p>
        </div>
      </header>

      {/* Main 2-column layout: Canvas + Inspector */}
      <div className="twin-container">
        {/* Left: Station Blueprint Canvas */}
        <div className="station-canvas">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text)" }}>
              🏛️ Physical Layout & Subsystems
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              Select any asset to inspect telemetry & downstream dependency impact
            </div>
          </div>

          {/* Blueprint Grid */}
          <div className="station-canvas__blueprint">
            {assets.map((asset) => {
              const isSelected = asset.assetId === activeAssetId;
              const isImpacted = impactedIds.has(asset.assetId);

              let statusClass = "badge--operational";
              if (asset.status === "FAILED") statusClass = "badge--critical";
              else if (asset.status === "DEGRADED") statusClass = "badge--warning";

              const healthColor =
                asset.healthScore > 85 ? "var(--green)" : asset.healthScore > 65 ? "var(--warning)" : "var(--critical)";

              return (
                <div
                  key={asset.assetId}
                  className={`asset-block ${isSelected ? "asset-block--selected" : ""} ${
                    isImpacted ? "asset-block--impacted" : ""
                  }`}
                  onClick={() => setSelectedAssetId(asset.assetId)}
                >
                  <div className="asset-block__header">
                    <span className="asset-block__type">{asset.type}</span>
                    <span className={`badge ${statusClass}`} style={{ fontSize: "0.65rem" }}>
                      {asset.status}
                    </span>
                  </div>

                  <div>
                    <div className="asset-block__name">{asset.name}</div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                      ID: {asset.assetId}
                    </div>
                  </div>

                  {isImpacted && (
                    <div
                      style={{
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        color: "var(--critical)",
                        marginTop: "0.4rem",
                        background: "rgba(179, 58, 58, 0.1)",
                        padding: "0.15rem 0.35rem",
                        borderRadius: "2px",
                      }}
                    >
                      ⚠ CASCADE IMPACTED
                    </div>
                  )}

                  <div className="asset-block__health-bar">
                    <div
                      className="asset-block__health-fill"
                      style={{ width: `${asset.healthScore}%`, backgroundColor: healthColor }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Impact Cascade Notification Banner */}
          {impactData && impactData.impactedCount > 0 && (
            <div
              style={{
                marginTop: "1.5rem",
                padding: "0.85rem 1rem",
                background: "var(--critical-soft)",
                border: "1px solid var(--critical)",
                borderRadius: "var(--radius-md)",
                fontSize: "0.8rem",
              }}
            >
              <div style={{ fontWeight: 700, color: "var(--critical)" }}>
                ⚡ Cascade Impact Analysis for {selectedAsset?.name}:
              </div>
              <p style={{ margin: "0.3rem 0", color: "var(--text)" }}>
                A failure in this asset directly propagates downstream to{" "}
                <strong>{impactData.impactedCount} dependent assets</strong> with maximum criticality level{" "}
                <strong>{impactData.maxCriticality}</strong>.
              </p>
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.4rem" }}>
                {impactData.impactedAssetIds.map((id) => (
                  <span
                    key={id}
                    className="badge badge--critical"
                    style={{ cursor: "pointer", fontSize: "0.65rem" }}
                    onClick={() => setSelectedAssetId(id)}
                  >
                    → {id}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Asset Inspector Panel */}
        <aside className="inspector-panel">
          {selectedAsset ? (
            <div>
              <div className="inspector-panel__header">
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                  ASSET INSPECTOR
                </div>
                <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginTop: "0.2rem" }}>
                  {selectedAsset.name}
                </h3>
                <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.4rem" }}>
                  <span className="badge badge--info">{selectedAsset.type}</span>
                  <span className="badge badge--warning">{selectedAsset.criticality} CRITICALITY</span>
                </div>
              </div>

              {/* Health Score Gauge */}
              <div style={{ background: "var(--surface-soft)", padding: "0.75rem", borderRadius: "var(--radius-md)", marginBottom: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", fontWeight: 600 }}>
                  <span>Health Score</span>
                  <span style={{ color: selectedAsset.healthScore < 70 ? "var(--critical)" : "var(--green)" }}>
                    {selectedAsset.healthScore} / 100
                  </span>
                </div>
                <div className="asset-block__health-bar" style={{ height: "8px", marginTop: "0.4rem" }}>
                  <div
                    className="asset-block__health-fill"
                    style={{
                      width: `${selectedAsset.healthScore}%`,
                      backgroundColor:
                        selectedAsset.healthScore > 85 ? "var(--green)" : selectedAsset.healthScore > 65 ? "var(--warning)" : "var(--critical)",
                    }}
                  />
                </div>
              </div>

              {/* Metadata Details */}
              <div style={{ marginBottom: "1rem" }}>
                <div className="inspector-property">
                  <span className="inspector-property__key">Status</span>
                  <span className="inspector-property__val">{selectedAsset.status}</span>
                </div>
                <div className="inspector-property">
                  <span className="inspector-property__key">Data Freshness</span>
                  <span className="inspector-property__val">
                    {selectedAsset.freshness.status} ({selectedAsset.freshness.ageSeconds}s ago)
                  </span>
                </div>
                <div className="inspector-property">
                  <span className="inspector-property__key">Data Quality</span>
                  <span className="inspector-property__val">{selectedAsset.dataQuality}</span>
                </div>
                <div className="inspector-property">
                  <span className="inspector-property__key">Maintenance</span>
                  <span className="inspector-property__val">
                    {selectedAsset.maintenanceState.inMaintenance ? "IN MAINTENANCE" : "NOMINAL"}
                  </span>
                </div>
                <div className="inspector-property">
                  <span className="inspector-property__key">Anomaly Active</span>
                  <span className="inspector-property__val">
                    {selectedAsset.anomalyState.hasActiveAnomaly ? "YES (DETECTED)" : "NONE"}
                  </span>
                </div>
              </div>

              {/* Live Telemetry Properties */}
              <div>
                <div style={{ fontSize: "0.8rem", fontWeight: 700, marginBottom: "0.5rem", color: "var(--text)" }}>
                  📡 Live Telemetry Properties ({Object.keys(selectedAsset.currentTelemetry).length})
                </div>
                {Object.keys(selectedAsset.currentTelemetry).length === 0 ? (
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    No telemetry sensor points mapped directly to this asset.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    {Object.entries(selectedAsset.currentTelemetry).map(([metric, prop]) => (
                      <div
                        key={metric}
                        style={{
                          background: "var(--surface-soft)",
                          padding: "0.45rem 0.6rem",
                          borderRadius: "var(--radius-sm)",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontSize: "0.75rem",
                        }}
                      >
                        <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>{metric}</span>
                        <div style={{ textAlign: "right" }}>
                          <span style={{ fontWeight: 700, fontFamily: "var(--font-mono)" }}>
                            {prop.value} {prop.unit}
                          </span>
                          <span
                            style={{
                              marginLeft: "0.4rem",
                              fontSize: "0.65rem",
                              color: prop.quality === "GOOD" ? "var(--green)" : "var(--warning)",
                            }}
                          >
                            [{prop.quality}]
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)", fontSize: "0.85rem" }}>
              Select an asset on the blueprint to inspect.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
