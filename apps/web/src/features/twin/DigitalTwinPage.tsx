import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useStation } from "../../hooks/useStation";
import { twinApi, type DownstreamImpactResponse } from "../../services/api";
import type { TwinAssetState } from "@maitri-bharati/shared";
import { Station3DCanvas, type TwinVisualMode } from "./Station3DCanvas";

export function DigitalTwinPage(): React.JSX.Element {
  const navigate = useNavigate();
  const { stationId, twinState, loading } = useStation();
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [impactData, setImpactData] = useState<DownstreamImpactResponse | null>(null);

  // 3D Visual Modes & Environmental Controls
  const [visualMode, setVisualMode] = useState<TwinVisualMode>("NORMAL");
  const [viewFormat, setViewFormat] = useState<"3D" | "2D">("3D");
  const [isDaytime, setIsDaytime] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [replayStep, setReplayStep] = useState<number>(100);
  const [isReplayPlaying, setIsReplayPlaying] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);

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

  // Replay playback interval
  useEffect(() => {
    if (!isReplayPlaying) return;
    const interval = setInterval(() => {
      setReplayStep((prev) => {
        if (prev >= 100) return 0;
        return prev + 5;
      });
    }, 600);
    return () => clearInterval(interval);
  }, [isReplayPlaying]);

  const handleAskTwin = (questionText: string) => {
    sessionStorage.setItem("copilot_prefill_prompt", questionText);
    navigate("/copilot");
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      void containerRef.current.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      void document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  if (loading && !twinState) {
    return (
      <div className="app-content">
        <div className="skeleton skeleton-text" style={{ width: "30%", height: "2rem" }} />
        <div className="skeleton skeleton-tile" style={{ height: "480px" }} />
      </div>
    );
  }

  if (!twinState) return <div className="app-content">Twin State unavailable.</div>;

  const assets = twinState.assets;
  const selectedAsset: TwinAssetState | undefined = assets.find((a) => a.assetId === activeAssetId);
  const impactedIds = new Set(impactData?.impactedAssetIds ?? []);
  const windSpeed = twinState.environment?.windSpeedMs ?? 14.5;

  return (
    <div className="app-content" ref={containerRef}>
      <header className="page-header" style={{ marginBottom: "1rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                fontSize: "0.7rem",
                fontWeight: 700,
                color: "var(--green)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              PHYSICAL DIGITAL TWIN • 3D SPATIAL TELEMETRY
            </span>
          </div>
          <h1 className="page-header__title">
            {stationId === "station-maitri" ? "🇮🇳 Maitri Station" : "🇮🇳 Bharati Station"} 3D Digital Twin
          </h1>
          <p className="page-header__subtitle">
            Interactive WebGL physical telemetry twin with multi-mode x-ray, dependency topology, and downstream impact tracking.
          </p>
        </div>

        {/* View Switcher: 3D WebGL vs 2D Fallback */}
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <div className="button-group" style={{ display: "inline-flex", background: "var(--surface-soft)", padding: "2px", borderRadius: "6px" }}>
            <button
              type="button"
              className={`button ${viewFormat === "3D" ? "button--primary" : "button--ghost"}`}
              style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem" }}
              onClick={() => setViewFormat("3D")}
            >
              🌐 3D Interactive WebGL
            </button>
            <button
              type="button"
              className={`button ${viewFormat === "2D" ? "button--primary" : "button--ghost"}`}
              style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem" }}
              onClick={() => setViewFormat("2D")}
            >
              📐 2D Blueprint Schematic
            </button>
          </div>

          <button
            type="button"
            className="button button--ghost"
            style={{ padding: "0.35rem 0.65rem", fontSize: "0.75rem" }}
            onClick={() => setIsDaytime((d) => !d)}
            title="Toggle polar daylight / polar night lighting"
          >
            {isDaytime ? "☀️ Solar High Noon" : "🌌 Polar Night"}
          </button>

          <button
            type="button"
            className="button button--ghost"
            style={{ padding: "0.35rem 0.65rem", fontSize: "0.75rem" }}
            onClick={toggleFullscreen}
            title="Toggle Fullscreen Twin Mode"
          >
            {isFullscreen ? "🗗 Exit Fullscreen" : "⛶ Fullscreen"}
          </button>
        </div>
      </header>

      {/* 6 Visual Modes Toolbar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "6px",
          padding: "0.5rem 0.85rem",
          marginBottom: "1rem",
        }}
      >
        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", marginRight: "0.4rem" }}>
            TWIN MODES:
          </span>
          {(["NORMAL", "X-RAY", "SYSTEM", "HEAT MAP", "FORECAST", "REPLAY"] as TwinVisualMode[]).map((mode) => {
            const isActive = visualMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setVisualMode(mode)}
                style={{
                  padding: "0.3rem 0.65rem",
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  borderRadius: "4px",
                  border: isActive ? "1px solid var(--green)" : "1px solid var(--border)",
                  background: isActive ? "var(--green)" : "var(--surface)",
                  color: isActive ? "#ffffff" : "var(--text)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {mode === "NORMAL" && "● "}
                {mode === "X-RAY" && "👁 "}
                {mode === "SYSTEM" && "⚡ "}
                {mode === "HEAT MAP" && "🔥 "}
                {mode === "FORECAST" && "📈 "}
                {mode === "REPLAY" && "⏪ "}
                {mode}
              </button>
            );
          })}
        </div>

        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          {visualMode === "NORMAL" && "Realistic PBR physical structure and status indicators"}
          {visualMode === "X-RAY" && "Translucent structural shell revealing internal machinery"}
          {visualMode === "SYSTEM" && "Real-time energy and fluid dependency flow topology"}
          {visualMode === "HEAT MAP" && "Thermal dissipation and risk severity gradient"}
          {visualMode === "FORECAST" && "Predicted +2h electrical stress and thermal headroom"}
          {visualMode === "REPLAY" && "Time-travel telemetry playback controls active"}
        </div>
      </div>

      {/* Replay Controls Banner (when REPLAY mode active) */}
      {visualMode === "REPLAY" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            background: "rgba(11, 74, 53, 0.08)",
            border: "1px solid var(--green)",
            borderRadius: "6px",
            padding: "0.6rem 1rem",
            marginBottom: "1rem",
          }}
        >
          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--green)" }}>
            ⏪ Historical Replay Timeline:
          </span>
          <button
            type="button"
            className="button button--ghost"
            style={{ padding: "0.2rem 0.6rem", fontSize: "0.75rem" }}
            onClick={() => setIsReplayPlaying((p) => !p)}
          >
            {isReplayPlaying ? "⏸ Pause" : "▶ Play"}
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={replayStep}
            onChange={(e) => setReplayStep(Number(e.target.value))}
            style={{ flex: 1, accentColor: "var(--green)", cursor: "pointer" }}
          />
          <span style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--text)" }}>
            T-{Math.round((100 - replayStep) * 0.24)}h ({replayStep}%)
          </span>
          <button
            type="button"
            className="button button--ghost"
            style={{ padding: "0.2rem 0.5rem", fontSize: "0.7rem" }}
            onClick={() => setReplayStep(100)}
          >
            Live Now
          </button>
        </div>
      )}

      {/* Main 2-column layout: Canvas + Inspector */}
      <div className="twin-container" style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "1rem" }}>
        {/* Left: 3D WebGL Canvas or 2D Blueprint Fallback */}
        <div
          className="station-canvas"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {viewFormat === "3D" ? (
            <div style={{ flex: 1, minHeight: "520px", position: "relative" }}>
              <Station3DCanvas
                stationId={stationId}
                twinState={twinState}
                selectedAssetId={activeAssetId}
                onSelectAsset={(id) => setSelectedAssetId(id)}
                visualMode={visualMode}
                isDaytime={isDaytime}
                replayStep={replayStep}
                windSpeedMs={windSpeed}
              />
            </div>
          ) : (
            <div style={{ padding: "1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text)" }}>
                  📐 2D Physical Blueprint Schematic
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
            </div>
          )}

          {/* Impact Cascade Notification Banner */}
          {impactData && impactData.impactedCount > 0 && (
            <div
              style={{
                margin: "1rem",
                padding: "0.85rem 1rem",
                background: "var(--critical-soft, #fdf2f2)",
                border: "1px solid var(--critical, #b33a3a)",
                borderRadius: "var(--radius-md, 6px)",
                fontSize: "0.8rem",
              }}
            >
              <div style={{ fontWeight: 700, color: "var(--critical, #b33a3a)" }}>
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

        {/* Right: Asset Inspector Panel + Ask the Twin */}
        <aside className="inspector-panel" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {selectedAsset ? (
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                padding: "1.25rem",
              }}
            >
              <div className="inspector-panel__header" style={{ marginBottom: "1rem" }}>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                  ASSET INSPECTOR
                </div>
                <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginTop: "0.2rem", color: "var(--text)" }}>
                  {selectedAsset.name}
                </h3>
                <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.4rem" }}>
                  <span className="badge badge--info">{selectedAsset.type}</span>
                  <span className="badge badge--warning">{selectedAsset.criticality} CRITICALITY</span>
                </div>
              </div>

              {/* Health Score Gauge */}
              <div
                style={{
                  background: "var(--surface-soft, #f0f3ed)",
                  padding: "0.75rem",
                  borderRadius: "var(--radius-md, 6px)",
                  marginBottom: "1rem",
                }}
              >
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
                        selectedAsset.healthScore > 85
                          ? "var(--green)"
                          : selectedAsset.healthScore > 65
                          ? "var(--warning)"
                          : "var(--critical)",
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
              <div style={{ marginBottom: "1.25rem" }}>
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
                          background: "var(--surface-soft, #f0f3ed)",
                          padding: "0.45rem 0.6rem",
                          borderRadius: "4px",
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

              {/* ── Ask the Twin Section ─────────────────────────────── */}
              <div
                style={{
                  background: "var(--surface-soft, #f0f3ed)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  padding: "0.85rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.5rem" }}>
                  <span style={{ fontSize: "0.9rem" }}>🤖</span>
                  <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--green)" }}>
                    Ask the Twin Copilot
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <button
                    type="button"
                    className="button button--ghost"
                    style={{
                      textAlign: "left",
                      fontSize: "0.75rem",
                      padding: "0.4rem 0.6rem",
                      justifyContent: "flex-start",
                      background: "#ffffff",
                    }}
                    onClick={() =>
                      handleAskTwin(
                        `What is the current health status and operational risk of ${selectedAsset.name} (${selectedAsset.assetId})?`
                      )
                    }
                  >
                    💬 "Why is {selectedAsset.name} health at {selectedAsset.healthScore}%?"
                  </button>
                  <button
                    type="button"
                    className="button button--ghost"
                    style={{
                      textAlign: "left",
                      fontSize: "0.75rem",
                      padding: "0.4rem 0.6rem",
                      justifyContent: "flex-start",
                      background: "#ffffff",
                    }}
                    onClick={() =>
                      handleAskTwin(
                        `What cascade failures would occur if ${selectedAsset.name} (${selectedAsset.assetId}) suffers complete shutdown?`
                      )
                    }
                  >
                    ⚡ "What if this asset fails right now?"
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                padding: "2rem",
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: "0.85rem",
              }}
            >
              Select an asset in the 3D scene to inspect telemetry and cascade topology.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
