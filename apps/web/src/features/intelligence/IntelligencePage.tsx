import React, { useState, useEffect, useCallback } from "react";
import { useStation } from "../../hooks/useStation";
import { twinApi } from "../../services/api";
import type {
  StationIntelligenceSummary,
  AnomalyResult,
  CrossDomainCascade,
  AssetHealthScore,
} from "@maitri-bharati/shared";

export function IntelligencePage(): React.JSX.Element {
  const { stationId } = useStation();

  const [intelligence, setIntelligence] = useState<StationIntelligenceSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<
    "CASCADE" | "FORECASTS" | "ANOMALIES" | "HEALTH" | "RECOMMENDATIONS" | "OBSERVABILITY"
  >("CASCADE");

  const [selectedAnomalyId, setSelectedAnomalyId] = useState<string | null>(null);
  const [selectedCascadeId, setSelectedCascadeId] = useState<string | null>(null);
  const [selectedHealthAssetId, setSelectedHealthAssetId] = useState<string | null>(null);
  const [forecastViewMode, setForecastViewMode] = useState<"FORECAST" | "HISTORY">("FORECAST");
  const [historyPoints, setHistoryPoints] = useState<any[]>([]);
  const [hoveredForecastPoint, setHoveredForecastPoint] = useState<any | null>(null);
  const [acknowledgedRecs, setAcknowledgedRecs] = useState<Record<string, string>>({});

  const toggleAcknowledge = (id: string) => {
    setAcknowledgedRecs((prev) => {
      const next = { ...prev };
      if (next[id]) {
        delete next[id];
      } else {
        next[id] = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      }
      return next;
    });
  };

  // Clear selections when station changes
  useEffect(() => {
    setSelectedCascadeId(null);
    setSelectedHealthAssetId(null);
    setSelectedAnomalyId(null);
  }, [stationId]);

  const loadHistory = useCallback(async () => {
    try {
      const data = await twinApi.getTelemetryHistory(stationId, "power_output_kw", 30);
      setHistoryPoints(Array.isArray(data) ? data.slice().reverse() : []);
    } catch (e) {
      console.warn("Failed to load historical telemetry:", e);
    }
  }, [stationId]);

  const loadIntelligence = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await twinApi.getIntelligence(stationId);
      setIntelligence(data);
      if (data.energyForecast?.points?.length) {
        setHoveredForecastPoint((prev: any) => prev || data.energyForecast.points[0]);
      }
    } catch (err) {
      console.error("[IntelligencePage] Failed to fetch intelligence:", err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [stationId]);

  useEffect(() => {
    void loadIntelligence();
    const interval = setInterval(() => {
      void loadIntelligence();
    }, 10000);
    return () => clearInterval(interval);
  }, [loadIntelligence]);

  if (loading && !intelligence) {
    return (
      <div className="app-content" style={{ padding: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div className="spinner" />
          <span>Evaluating operational intelligence models for {stationId}...</span>
        </div>
      </div>
    );
  }

  if (error && !intelligence) {
    return (
      <div className="app-content" style={{ padding: "2rem" }}>
        <div className="card" style={{ borderColor: "var(--critical)" }}>
          <h2 style={{ color: "var(--critical)" }}>Intelligence Model Evaluation Error</h2>
          <p>{error}</p>
          <button className="btn btn--primary" onClick={loadIntelligence} style={{ marginTop: "1rem" }}>
            Retry Evaluation
          </button>
        </div>
      </div>
    );
  }

  const {
    activeAnomalies = [],
    energyForecast,
    inventoryForecasts = [],
    assetHealthScores = [],
    crossDomainRisk,
    recommendations = [],
    observability = [],
  } = intelligence || {};

  const stationLabel = stationId.toLowerCase().includes("maitri") ? "Maitri Station" : "Bharati Station";
  const overallRisk = crossDomainRisk?.overallLevel || "LOW";
  const riskScore = crossDomainRisk?.overallRiskScore ?? 15;
  const activeCascade =
    (selectedCascadeId && crossDomainRisk?.cascades?.find((c) => c.id === selectedCascadeId)) ||
    crossDomainRisk?.cascades?.[0] ||
    null;

  const selectedAnomaly =
    (selectedAnomalyId && activeAnomalies.find((a) => a.id === selectedAnomalyId)) ||
    activeAnomalies[0] ||
    null;

  const selectedHealth =
    (selectedHealthAssetId && assetHealthScores.find((h) => h.assetId === selectedHealthAssetId)) ||
    null;

  return (
    <div className="app-content">
      {/* ── Page Header & Top Operational KPIs ───────────────────────── */}
      <header className="page-header" style={{ marginBottom: "1.25rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.25rem" }}>
            <h1 className="page-header__title">{stationLabel} Operational Intelligence</h1>
            <span
              className={`badge ${
                overallRisk === "LOW"
                  ? "badge--operational"
                  : overallRisk === "MEDIUM"
                  ? "badge--warning"
                  : "badge--critical"
              }`}
              style={{ fontSize: "0.85rem", padding: "0.35rem 0.75rem" }}
            >
              ● RISK LEVEL: {overallRisk} ({riskScore}/100)
            </span>
            <span className="badge badge--neutral" style={{ fontSize: "0.75rem" }}>
              MODELS: v1.0.0 (RULE-SPC + IFOREST)
            </span>
          </div>
          <p className="page-header__subtitle">
            Explainable telemetry reasoning: Anomaly → Evidence → Forecast → Asset Health → Causal Cascade → Advisory Actions
          </p>
        </div>

        <button className="btn btn--secondary" onClick={loadIntelligence} style={{ fontSize: "0.8rem", padding: "0.4rem 0.8rem" }}>
          🔄 Recalculate Models
        </button>
      </header>

      {/* ── Key Operational Vital Stat Cards ─────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div className="card" style={{ padding: "1rem" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
            Active Detected Anomalies
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, margin: "0.25rem 0", color: activeAnomalies.length > 0 ? "var(--warning)" : "var(--green)" }}>
            {activeAnomalies.length}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            {activeAnomalies.filter((a) => a.severity === "CRITICAL").length} Critical ·{" "}
            {activeAnomalies.filter((a) => a.severity === "WARNING").length} Warning
          </div>
        </div>

        <div className="card" style={{ padding: "1rem" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
            24h Demand Forecast Peak
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, margin: "0.25rem 0", color: "var(--text-primary)" }}>
            {energyForecast?.points ? Math.max(...energyForecast.points.map((p) => p.predictedDemandKw)) : "--"} <span style={{ fontSize: "1rem" }}>kW</span>
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            Reserve Margin: {energyForecast?.points?.[0]?.netReserveKw ?? "--"} kW
          </div>
        </div>

        <div className="card" style={{ padding: "1rem" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
            Polar Fuel Runway
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, margin: "0.25rem 0", color: "var(--text-primary)" }}>
            {inventoryForecasts.find((f) => f.category === "FUEL")?.daysRemaining ?? "--"} <span style={{ fontSize: "1rem" }}>Days</span>
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            Urgency: {inventoryForecasts.find((f) => f.category === "FUEL")?.resupplyUrgency ?? "ROUTINE"}
          </div>
        </div>

        <div className="card" style={{ padding: "1rem" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
            Advisory Actions
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, margin: "0.25rem 0", color: "var(--accent)" }}>
            {recommendations.length}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            {recommendations.filter((r) => r.priority === "CRITICAL" || r.priority === "HIGH").length} High Priority
          </div>
        </div>
      </div>

      {/* ── Feature Navigation Tabs ──────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          borderBottom: "1px solid var(--border)",
          paddingBottom: "0.5rem",
          marginBottom: "1.5rem",
          overflowX: "auto",
        }}
      >
        {[
          { key: "CASCADE", label: "⚡ Causal Cascade Graph", badge: crossDomainRisk?.cascades.length },
          { key: "ANOMALIES", label: "🔍 Anomaly & Evidence", badge: activeAnomalies.length },
          { key: "FORECASTS", label: "📈 24h Energy & Fuel Forecast", badge: "24h" },
          { key: "HEALTH", label: "🩺 Asset Health Matrix", badge: assetHealthScores.length },
          { key: "RECOMMENDATIONS", label: "💡 Advisory Recommendations", badge: recommendations.length },
          { key: "OBSERVABILITY", label: "📊 Model Observability", badge: observability.length },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`btn ${activeTab === tab.key ? "btn--primary" : "btn--secondary"}`}
            style={{
              padding: "0.45rem 0.9rem",
              fontSize: "0.85rem",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            {tab.label}
            {tab.badge !== undefined && (
              <span
                style={{
                  background: activeTab === tab.key ? "rgba(255,255,255,0.25)" : "var(--surface-soft)",
                  padding: "0.1rem 0.4rem",
                  borderRadius: "9999px",
                  fontSize: "0.7rem",
                  fontWeight: "bold",
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 1: THE CAUSAL CHAIN CASCADE VISUALIZER (PRIMARY HERO) ──── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "CASCADE" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Active Cascade Header & Selector */}
          <div className="card">
            <div className="card-header" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <h2 className="card-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span>🕸️ Cross-Domain Causal Impact Chain</span>
                  <span
                    className={`badge ${
                      activeCascade?.riskLevel === "CRITICAL"
                        ? "badge--critical"
                        : activeCascade?.riskLevel === "HIGH"
                        ? "badge--warning"
                        : "badge--operational"
                    }`}
                  >
                    {activeCascade?.riskLevel} RISK
                  </span>
                </h2>
                <span className="card-subtitle">{activeCascade?.summary}</span>
              </div>

              {/* Cascade Switcher */}
              {crossDomainRisk?.cascades && crossDomainRisk.cascades.length > 1 && (
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {crossDomainRisk.cascades.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCascadeId(c.id)}
                      className={`btn ${activeCascade?.id === c.id ? "btn--primary" : "btn--secondary"}`}
                      style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}
                    >
                      {c.title}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Directed Causal Flow Pipeline (Horizontal / Responsive) */}
            <div
              style={{
                marginTop: "1.5rem",
                padding: "1.5rem 1rem",
                background: "var(--surface-soft)",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--border)",
                overflowX: "auto",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  minWidth: "750px",
                  gap: "0.5rem",
                }}
              >
                {activeCascade?.nodes.map((node, index) => {
                  const isLast = index === activeCascade.nodes.length - 1;
                  const link = activeCascade.links[index];

                  const domainColors: Record<string, { bg: string; border: string; text: string }> = {
                    INFRASTRUCTURE: { bg: "rgba(59, 130, 246, 0.12)", border: "#3b82f6", text: "#60a5fa" },
                    ENERGY: { bg: "rgba(245, 158, 11, 0.12)", border: "#f59e0b", text: "#fbbf24" },
                    ENVIRONMENT: { bg: "rgba(20, 184, 166, 0.12)", border: "#14b8a6", text: "#2dd4bf" },
                    LOGISTICS: { bg: "rgba(16, 185, 129, 0.12)", border: "#10b981", text: "#34d399" },
                  };

                  const dColor = domainColors[node.domain] || domainColors.INFRASTRUCTURE;

                  return (
                    <React.Fragment key={node.id}>
                      {/* Node Box */}
                      <div
                        style={{
                          flex: "1 1 0",
                          minWidth: "150px",
                          maxWidth: "200px",
                          background: "var(--surface)",
                          border: `2px solid ${
                            node.severity === "CRITICAL"
                              ? "var(--critical)"
                              : node.severity === "WARNING"
                              ? "var(--warning)"
                              : dColor.border
                          }`,
                          borderRadius: "var(--radius-md)",
                          padding: "1rem",
                          boxShadow:
                            node.severity === "CRITICAL"
                              ? "0 0 15px rgba(239, 68, 68, 0.3)"
                              : node.severity === "WARNING"
                              ? "0 0 12px rgba(245, 158, 11, 0.2)"
                              : "none",
                          position: "relative",
                        }}
                      >
                        {/* Domain Tag */}
                        <div
                          style={{
                            fontSize: "0.65rem",
                            fontWeight: 700,
                            letterSpacing: "0.05em",
                            color: dColor.text,
                            textTransform: "uppercase",
                            marginBottom: "0.35rem",
                          }}
                        >
                          {node.domain}
                        </div>

                        {/* Title & Value */}
                        <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
                          {node.label}
                        </div>

                        {node.metricValue && (
                          <div
                            style={{
                              display: "inline-block",
                              background: dColor.bg,
                              color: dColor.text,
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              padding: "0.15rem 0.4rem",
                              borderRadius: "4px",
                              marginBottom: "0.4rem",
                            }}
                          >
                            {node.metricValue}
                          </div>
                        )}

                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", lineHeight: 1.3 }}>
                          {node.description}
                        </div>
                      </div>

                      {/* Directed Arrow / Impact Link */}
                      {!isLast && (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "0 0.25rem",
                            minWidth: "60px",
                            textAlign: "center",
                          }}
                        >
                          <div style={{ fontSize: "1.25rem", color: "var(--accent)" }}>➔</div>
                          <div
                            style={{
                              fontSize: "0.65rem",
                              color: "var(--text-muted)",
                              lineHeight: 1.1,
                              marginTop: "0.2rem",
                              maxWidth: "80px",
                            }}
                          >
                            {link?.impact ? link.impact.slice(0, 32) + "..." : "propagates"}
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Contributing Factors Ledger */}
            <div style={{ marginTop: "1.5rem" }}>
              <h3 style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.75rem" }}>
                Contributing Root Factors & Telemetry Envelopes:
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {crossDomainRisk?.contributingFactors.map((f, i) => (
                  <div
                    key={i}
                    style={{
                      background: "var(--surface)",
                      padding: "0.65rem 1rem",
                      borderRadius: "var(--radius-sm)",
                      borderLeft: "4px solid var(--accent)",
                      fontSize: "0.8rem",
                    }}
                  >
                    • {f}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 2: ACTIVE ANOMALIES & AUDITABLE EVIDENCE INSPECTOR ──────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "ANOMALIES" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "1.5rem" }}>
          {/* Left Table of Anomalies */}
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">🔍 Detected Subsystem Anomalies</h2>
                <span className="card-subtitle">Hybrid rule-based and Isolation Forest detection</span>
              </div>
              <span className="badge badge--info">{activeAnomalies.length} Active</span>
            </div>

            {activeAnomalies.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--green)" }}>
                ✓ No active anomalies detected. All equipment telemetry is operating within nominal statistical process envelopes.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--border)", color: "var(--text-muted)", fontSize: "0.75rem" }}>
                      <th style={{ padding: "0.5rem", textAlign: "left" }}>ASSET</th>
                      <th style={{ padding: "0.5rem", textAlign: "left" }}>METRIC</th>
                      <th style={{ padding: "0.5rem", textAlign: "center" }}>SEVERITY</th>
                      <th style={{ padding: "0.5rem", textAlign: "center" }}>SCORE</th>
                      <th style={{ padding: "0.5rem", textAlign: "center" }}>CONFIDENCE</th>
                      <th style={{ padding: "0.5rem", textAlign: "right" }}>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeAnomalies.map((a) => (
                      <tr
                        key={a.id}
                        onClick={() => setSelectedAnomalyId(a.id)}
                        style={{
                          borderBottom: "1px solid var(--border)",
                          cursor: "pointer",
                          background: selectedAnomaly?.id === a.id ? "var(--surface-soft)" : "transparent",
                        }}
                      >
                        <td style={{ padding: "0.6rem 0.5rem", fontWeight: 600 }}>{a.assetId}</td>
                        <td style={{ padding: "0.6rem 0.5rem" }}>{a.metric}</td>
                        <td style={{ padding: "0.6rem 0.5rem", textAlign: "center" }}>
                          <span
                            className={`badge ${
                              a.severity === "CRITICAL"
                                ? "badge--critical"
                                : a.severity === "WARNING"
                                ? "badge--warning"
                                : "badge--info"
                            }`}
                          >
                            {a.severity}
                          </span>
                        </td>
                        <td style={{ padding: "0.6rem 0.5rem", textAlign: "center", fontWeight: 700 }}>
                          {(a.score * 100).toFixed(0)}%
                        </td>
                        <td style={{ padding: "0.6rem 0.5rem", textAlign: "center", color: "var(--text-muted)" }}>
                          {(a.confidence * 100).toFixed(0)}%
                        </td>
                        <td style={{ padding: "0.6rem 0.5rem", textAlign: "right" }}>
                          <button
                            className="btn btn--secondary"
                            style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAnomalyId(a.id);
                            }}
                          >
                            Inspect Evidence
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right Evidence Inspector Drawer */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">🔬 Explainable Evidence Dossier</h2>
              <span className="card-subtitle">Transparent audit trail for decision-support</span>
            </div>

            {selectedAnomaly ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem", fontSize: "0.85rem" }}>
                <div style={{ background: "var(--surface-soft)", padding: "0.75rem", borderRadius: "var(--radius-sm)" }}>
                  <div style={{ fontWeight: 600, color: "var(--accent)", marginBottom: "0.25rem" }}>
                    {selectedAnomaly.assetId} · {selectedAnomaly.metric}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    Model: <code>{selectedAnomaly.modelVersion}</code> ({selectedAnomaly.modelType})
                  </div>
                </div>

                {/* Evidence Metrics Breakdown */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div style={{ background: "var(--surface-soft)", padding: "0.6rem", borderRadius: "var(--radius-sm)" }}>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>DEVIATION FROM BASELINE</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--warning)" }}>
                      {selectedAnomaly.evidence.deviationFromBaseline > 0 ? "+" : ""}
                      {selectedAnomaly.evidence.deviationFromBaseline} {selectedAnomaly.evidence.deviationUnit}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                      Z-Score: {selectedAnomaly.evidence.zScore}σ
                    </div>
                  </div>

                  <div style={{ background: "var(--surface-soft)", padding: "0.6rem", borderRadius: "var(--radius-sm)" }}>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>RATE OF CHANGE</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>
                      {selectedAnomaly.evidence.rateOfChange > 0 ? "+" : ""}
                      {selectedAnomaly.evidence.rateOfChange} {selectedAnomaly.evidence.deviationUnit}/min
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                      Trend: {selectedAnomaly.evidence.trendDirection}
                    </div>
                  </div>
                </div>

                {/* Physical Threshold Breach Info */}
                {selectedAnomaly.evidence.thresholdCrossing && (
                  <div
                    style={{
                      background: "rgba(239, 68, 68, 0.1)",
                      border: "1px solid var(--critical)",
                      padding: "0.75rem",
                      borderRadius: "var(--radius-sm)",
                    }}
                  >
                    <div style={{ fontWeight: 600, color: "var(--critical)", fontSize: "0.8rem" }}>
                      ⚠️ Physical Threshold Breached
                    </div>
                    <div style={{ fontSize: "0.75rem", marginTop: "0.2rem" }}>
                      Limit: {selectedAnomaly.evidence.thresholdCrossing.threshold} {selectedAnomaly.evidence.deviationUnit} (
                      {selectedAnomaly.evidence.thresholdCrossing.thresholdType}) · Actual:{" "}
                      <strong>
                        {selectedAnomaly.evidence.thresholdCrossing.actual} {selectedAnomaly.evidence.deviationUnit}
                      </strong>
                    </div>
                  </div>
                )}

                {/* Natural Language Narrative */}
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, marginBottom: "0.3rem" }}>
                    Automated Explanatory Finding
                  </div>
                  <div
                    style={{
                      background: "var(--surface-soft)",
                      padding: "0.75rem",
                      borderRadius: "var(--radius-sm)",
                      borderLeft: "3px solid var(--accent)",
                      lineHeight: 1.4,
                      fontSize: "0.8rem",
                    }}
                  >
                    "{selectedAnomaly.evidence.humanReadable}"
                  </div>
                </div>

                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                  Contributing Telemetry Window: {selectedAnomaly.evidence.contributingWindowMinutes} minutes · Data Quality:{" "}
                  <strong>{selectedAnomaly.dataQuality}</strong>
                </div>
              </div>
            ) : (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                Select an anomaly to inspect evidence, rate of change, and threshold crossings.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 3: 24-HOUR ENERGY & INVENTORY FORECASTS ─────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "FORECASTS" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Energy Forecast Chart */}
          <div className="card">
            <div className="card-header" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <h2 className="card-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span>⚡ {forecastViewMode === "FORECAST" ? "24-Hour Forward Energy Demand & Generation Forecast" : "Past Measured Telemetry History (TimescaleDB)"}</span>
                  <span className="badge badge--operational" style={{ fontSize: "0.7rem" }}>
                    {forecastViewMode === "FORECAST" ? "PREDICTIVE (NEXT 24H)" : "MEASURED HISTORY"}
                  </span>
                </h2>
                <span className="card-subtitle">
                  {forecastViewMode === "FORECAST"
                    ? `Model: ${energyForecast?.modelVersion} · Confidence: ${((energyForecast?.confidence ?? 0.9) * 100).toFixed(0)}% · Horizon: +1h to +24h`
                    : "Actual physical time-series points recorded in TimescaleDB hypertable"}
                </span>
              </div>

              {/* View Switcher: Next 24h Forward vs Past Measured History */}
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <button
                  className={`btn ${forecastViewMode === "FORECAST" ? "btn--primary" : "btn--secondary"}`}
                  style={{ fontSize: "0.75rem", padding: "0.3rem 0.7rem" }}
                  onClick={() => setForecastViewMode("FORECAST")}
                >
                  🔮 Next 24h Forecast
                </button>
                <button
                  className={`btn ${forecastViewMode === "HISTORY" ? "btn--primary" : "btn--secondary"}`}
                  style={{ fontSize: "0.75rem", padding: "0.3rem 0.7rem" }}
                  onClick={() => {
                    setForecastViewMode("HISTORY");
                    void loadHistory();
                  }}
                >
                  📜 Past Telemetry History
                </button>
              </div>
            </div>

            {/* Legend */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", fontSize: "0.75rem", alignItems: "center", marginTop: "0.5rem" }}>
              {forecastViewMode === "FORECAST" ? (
                <>
                  <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                    <span style={{ width: "10px", height: "10px", background: "var(--accent)", borderRadius: "2px" }} />
                    Predicted Demand (kW)
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                    <span style={{ width: "10px", height: "10px", background: "#f59e0b", borderRadius: "2px" }} />
                    P10-P90 Confidence Envelope
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                    <span style={{ width: "10px", height: "10px", background: "#10b981", borderRadius: "2px" }} />
                    Solar/Wind Renewables (kW)
                  </span>
                </>
              ) : (
                <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                  <span style={{ width: "10px", height: "10px", background: "var(--accent)", borderRadius: "2px" }} />
                  Generator Output kW (Recorded)
                </span>
              )}
            </div>

            {/* Active Selected Point Inspector Chip */}
            {forecastViewMode === "FORECAST" && hoveredForecastPoint && (
              <div
                style={{
                  margin: "0.75rem 0",
                  padding: "0.5rem 0.85rem",
                  background: "var(--surface-soft)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  fontSize: "0.8rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                }}
              >
                <div>
                  <strong>📍 Hour +{hoveredForecastPoint.hourOffset}</strong> (Time:{" "}
                  {new Date(hoveredForecastPoint.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}{" "}
                  UTC): Predicted Demand <strong>{hoveredForecastPoint.predictedDemandKw} kW</strong>
                  <span style={{ color: "var(--text-muted)", marginLeft: "0.4rem" }}>
                    (Range: {hoveredForecastPoint.lowerDemandKw} – {hoveredForecastPoint.upperDemandKw} kW)
                  </span>
                </div>
                <div style={{ display: "flex", gap: "1rem" }}>
                  <span>
                    ☀️ Solar/Wind:{" "}
                    <strong>{(hoveredForecastPoint.solarGenerationKw + hoveredForecastPoint.windGenerationKw).toFixed(1)} kW</strong>
                  </span>
                  <span>
                    🛡️ Headroom: <strong>{hoveredForecastPoint.netReserveKw} kW</strong>
                  </span>
                </div>
              </div>
            )}

            {/* SVG Visual Forecast Chart */}
            <div style={{ width: "100%", height: "260px", padding: "0.5rem 0", position: "relative" }}>
              {forecastViewMode === "FORECAST" && energyForecast?.points && (
                <svg viewBox="0 0 800 220" style={{ width: "100%", height: "100%", overflow: "visible" }}>
                  <defs>
                    <linearGradient id="pEnvGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.05" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid Lines */}
                  {[15, 65, 115, 165].map((y) => (
                    <line key={y} x1="45" y1={y} x2="775" y2={y} stroke="var(--border)" strokeDasharray="3 3" opacity="0.6" />
                  ))}

                  {/* Y Axis Labels */}
                  <text x="38" y="18" fill="var(--text-muted)" fontSize="10" textAnchor="end">80 kW</text>
                  <text x="38" y="68" fill="var(--text-muted)" fontSize="10" textAnchor="end">50 kW</text>
                  <text x="38" y="118" fill="var(--text-muted)" fontSize="10" textAnchor="end">25 kW</text>
                  <text x="38" y="168" fill="var(--text-muted)" fontSize="10" textAnchor="end">0 kW</text>

                  {/* Compute Path Points */}
                  {(() => {
                    const pts = energyForecast.points;
                    const maxVal = 85.0;
                    const getY = (val: number) => 165 - (val / maxVal) * 150;
                    const getX = (idx: number) => 55 + (idx / (pts.length - 1)) * 710;

                    // Envelope Polygon
                    const upperPoints = pts.map((p, i) => `${getX(i)},${getY(p.upperDemandKw)}`).join(" ");
                    const lowerPoints = pts
                      .slice()
                      .reverse()
                      .map((p, i) => `${getX(pts.length - 1 - i)},${getY(p.lowerDemandKw)}`)
                      .join(" ");
                    const envPoly = `${upperPoints} ${lowerPoints}`;

                    // Demand Line
                    const demandLine = pts.map((p, i) => `${getX(i)},${getY(p.predictedDemandKw)}`).join(" ");
                    // Renewables Line
                    const renewLine = pts
                      .map((p, i) => `${getX(i)},${getY(p.solarGenerationKw + p.windGenerationKw)}`)
                      .join(" ");

                    return (
                      <>
                        <polygon points={envPoly} fill="url(#pEnvGrad)" />
                        <polyline points={demandLine} fill="none" stroke="var(--accent)" strokeWidth="3" />
                        <polyline points={renewLine} fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="4 2" />

                        {/* Vertical Guide Lines & X-Axis Time Ticks */}
                        {pts.map((p, i) => {
                          if (i % 4 !== 0 && i !== pts.length - 1) return null;
                          const dt = new Date(p.timestamp);
                          const timeStr = `${dt.getUTCHours().toString().padStart(2, "0")}:00`;
                          return (
                            <g key={`tick-${i}`}>
                              <line
                                x1={getX(i)}
                                y1="15"
                                x2={getX(i)}
                                y2="170"
                                stroke="var(--border)"
                                strokeDasharray="2 3"
                                opacity="0.7"
                              />
                              <text x={getX(i)} y="185" fill="var(--text-muted)" fontSize="10" textAnchor="middle">
                                {timeStr}
                              </text>
                              <text x={getX(i)} y="198" fill="var(--accent)" fontSize="9" fontWeight="bold" textAnchor="middle">
                                +{p.hourOffset}h
                              </text>
                            </g>
                          );
                        })}

                        {/* Interactive Circles */}
                        {pts.map((p, i) => (
                          <circle
                            key={i}
                            cx={getX(i)}
                            cy={getY(p.predictedDemandKw)}
                            r={hoveredForecastPoint?.hourOffset === p.hourOffset ? 6 : 3.5}
                            fill={hoveredForecastPoint?.hourOffset === p.hourOffset ? "#f59e0b" : "var(--accent)"}
                            stroke="var(--surface)"
                            strokeWidth="1.5"
                            style={{ cursor: "pointer", transition: "r 0.15s ease" }}
                            onMouseEnter={() => setHoveredForecastPoint(p)}
                            onClick={() => setHoveredForecastPoint(p)}
                          >
                            <title>
                              Hour +{p.hourOffset} ({new Date(p.timestamp).toLocaleTimeString()}): {p.predictedDemandKw} kW
                            </title>
                          </circle>
                        ))}
                      </>
                    );
                  })()}
                </svg>
              )}

              {/* Historical Telemetry View (TimescaleDB) */}
              {forecastViewMode === "HISTORY" && (
                <div style={{ width: "100%", height: "100%" }}>
                  {historyPoints.length === 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "0.5rem" }}>
                      <span>Loading historical telemetry from TimescaleDB hypertable...</span>
                      <button className="btn btn--secondary" onClick={() => void loadHistory()}>
                        Refresh History
                      </button>
                    </div>
                  ) : (
                    <svg viewBox="0 0 800 220" style={{ width: "100%", height: "100%", overflow: "visible" }}>
                      {[15, 65, 115, 165].map((y) => (
                        <line key={y} x1="45" y1={y} x2="775" y2={y} stroke="var(--border)" strokeDasharray="3 3" opacity="0.6" />
                      ))}
                      <text x="38" y="18" fill="var(--text-muted)" fontSize="10" textAnchor="end">150 kW</text>
                      <text x="38" y="68" fill="var(--text-muted)" fontSize="10" textAnchor="end">100 kW</text>
                      <text x="38" y="118" fill="var(--text-muted)" fontSize="10" textAnchor="end">50 kW</text>
                      <text x="38" y="168" fill="var(--text-muted)" fontSize="10" textAnchor="end">0 kW</text>

                      {(() => {
                        const pts = historyPoints;
                        const maxVal = 160.0;
                        const getY = (val: number) => 165 - (val / maxVal) * 150;
                        const getX = (idx: number) => 55 + (idx / Math.max(1, pts.length - 1)) * 710;
                        const line = pts.map((p, i) => `${getX(i)},${getY(Number(p.value) || 0)}`).join(" ");

                        return (
                          <>
                            <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth="2.5" />
                            {pts.map((p, i) => (
                              <circle
                                key={i}
                                cx={getX(i)}
                                cy={getY(Number(p.value) || 0)}
                                r="3"
                                fill="var(--accent)"
                              >
                                <title>
                                  {new Date(p.timestamp).toLocaleTimeString()}: {p.value} {p.unit} ({p.assetId})
                                </title>
                              </circle>
                            ))}
                            {/* X-axis start and end timestamps */}
                            {pts.length > 0 && (
                              <>
                                <text x="55" y="190" fill="var(--text-muted)" fontSize="10" textAnchor="start">
                                  {new Date(pts[0].timestamp).toLocaleTimeString()}
                                </text>
                                <text x="765" y="190" fill="var(--text-muted)" fontSize="10" textAnchor="end">
                                  {new Date(pts[pts.length - 1].timestamp).toLocaleTimeString()} (Latest)
                                </text>
                              </>
                            )}
                          </>
                        );
                      })()}
                    </svg>
                  )}
                </div>
              )}
            </div>

            {/* Assumptions Box */}
            <div style={{ marginTop: "1rem", fontSize: "0.75rem", color: "var(--text-muted)", background: "var(--surface-soft)", padding: "0.75rem", borderRadius: "var(--radius-sm)" }}>
              <strong>Predictive Model Assumptions:</strong>
              <ul style={{ paddingLeft: "1.2rem", margin: "0.3rem 0 0 0" }}>
                {energyForecast?.assumptions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Inventory Depletion Radar */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">📦 Commodity Inventory & Depletion Runway</h2>
              <span className="card-subtitle">Burn rates modeled against polar winter resupply gap (180 days)</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
              {inventoryForecasts.map((inv) => (
                <div
                  key={inv.itemCode}
                  style={{
                    background: "var(--surface-soft)",
                    borderRadius: "var(--radius-md)",
                    padding: "1rem",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--accent)" }}>{inv.category}</span>
                    <span
                      className={`badge ${
                        inv.resupplyUrgency === "EMERGENCY"
                          ? "badge--critical"
                          : inv.resupplyUrgency === "URGENT" || inv.resupplyUrgency === "ATTENTION"
                          ? "badge--warning"
                          : "badge--operational"
                      }`}
                      style={{ fontSize: "0.7rem" }}
                    >
                      {inv.resupplyUrgency}
                    </span>
                  </div>

                  <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.25rem" }}>{inv.itemName}</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)", margin: "0.3rem 0" }}>
                    {inv.daysRemaining} <span style={{ fontSize: "0.85rem", fontWeight: 400 }}>Days Remaining</span>
                  </div>

                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                    <div>Stock: {inv.currentQuantity.toLocaleString()} {inv.unit} · Burn: {inv.dailyBurnRate} {inv.unit}/day</div>
                    <div>Critical 20% Reserve Date: <strong>{new Date(inv.thresholdCrossingDate).toLocaleDateString()}</strong></div>
                    <div>Trend: <strong style={{ color: inv.consumptionTrend === "ACCELERATING" ? "var(--warning)" : "inherit" }}>{inv.consumptionTrend}</strong></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 4: EXPLAINABLE ASSET HEALTH MATRIX ──────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "HEALTH" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "1.5rem" }}>
          {/* Asset Health Grid */}
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">🩺 Subsystem Asset Health Matrix</h2>
                <span className="card-subtitle">Continuous degradation and operational stress scoring</span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
              {assetHealthScores.map((h) => {
                const scoreColor =
                  h.overallScore >= 85 ? "var(--green)" : h.overallScore >= 60 ? "var(--warning)" : "var(--critical)";

                return (
                  <div
                    key={h.assetId}
                    onClick={() => setSelectedHealthAssetId((prev) => (prev === h.assetId ? null : h.assetId))}
                    style={{
                      background: selectedHealth?.assetId === h.assetId ? "var(--surface-soft)" : "var(--surface)",
                      border: `2px solid ${selectedHealth?.assetId === h.assetId ? "var(--accent)" : "var(--border)"}`,
                      borderRadius: "var(--radius-md)",
                      padding: "1rem",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                        {h.assetType}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: "0.85rem", margin: "0.2rem 0" }}>{h.assetName}</div>
                    </div>

                    <div style={{ display: "flex", alignItems: "baseline", gap: "0.4rem", margin: "0.75rem 0" }}>
                      <span style={{ fontSize: "1.8rem", fontWeight: 700, color: scoreColor }}>{h.overallScore}</span>
                      <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>/ 100</span>
                      <span
                        className={`badge ${
                          h.status === "OPERATIONAL"
                            ? "badge--operational"
                            : h.status === "DEGRADED"
                            ? "badge--warning"
                            : "badge--critical"
                        }`}
                        style={{ marginLeft: "auto", fontSize: "0.65rem" }}
                      >
                        {h.status}
                      </span>
                    </div>

                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                      {h.factors.length} active stress factor(s)
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mandatory Disclaimer */}
            <div style={{ marginTop: "1.5rem", fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic", borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>
              ℹ️ {assetHealthScores[0]?.disclaimer || "Decision-support indicator, not a guaranteed failure probability."}
            </div>
          </div>

          {/* Right Penalty Breakdown Inspector */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">📊 Health Penalty Breakdown</h2>
              <span className="card-subtitle">{selectedHealth?.assetName || "Select an asset"}</span>
            </div>

            {selectedHealth ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem", fontSize: "0.85rem" }}>
                <div style={{ background: "var(--surface-soft)", padding: "0.75rem", borderRadius: "var(--radius-sm)" }}>
                  <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>
                    Health Index: {selectedHealth.overallScore} / 100
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>ID: {selectedHealth.assetId}</div>
                </div>

                {/* Penalties bars */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {[
                    { label: "Telemetry Deviation Penalty", val: selectedHealth.telemetryPenalty, max: 25 },
                    { label: "Anomaly History Penalty", val: selectedHealth.anomalyPenalty, max: 30 },
                    { label: "Runtime Duty Cycle Penalty", val: selectedHealth.runtimePenalty, max: 15 },
                    { label: "Maintenance Status Penalty", val: selectedHealth.maintenancePenalty, max: 15 },
                    { label: "Operating Stress Penalty", val: selectedHealth.stressPenalty, max: 15 },
                    { label: "Data Freshness Penalty", val: selectedHealth.dataConfidencePenalty, max: 10 },
                  ].map((p, idx) => (
                    <div key={idx}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: "0.15rem" }}>
                        <span>{p.label}</span>
                        <span style={{ fontWeight: 600, color: p.val > 0 ? "var(--warning)" : "var(--text-muted)" }}>
                          -{p.val} pts
                        </span>
                      </div>
                      <div style={{ height: "6px", background: "var(--surface-soft)", borderRadius: "3px", overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${(p.val / p.max) * 100}%`,
                            height: "100%",
                            background: p.val > 0 ? "var(--warning)" : "transparent",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Factors List */}
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, marginBottom: "0.3rem" }}>
                    Contributing Degradation Factors:
                  </div>
                  <ul style={{ paddingLeft: "1.2rem", margin: 0, fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    {selectedHealth.factors.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                Select an asset from the matrix to view the degradation penalty breakdown.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 5: ADVISORY RECOMMENDATIONS ─────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "RECOMMENDATIONS" && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">💡 Operational Advisory Recommendations</h2>
              <span className="card-subtitle">Transparent, prioritized guidance generated from active intelligence</span>
            </div>
            <span className="badge badge--neutral">ADVISORY ONLY</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {recommendations.map((rec) => {
              const priorityColors: Record<string, string> = {
                CRITICAL: "var(--critical)",
                HIGH: "var(--warning)",
                MEDIUM: "var(--accent)",
                LOW: "var(--green)",
              };

              return (
                <div
                  key={rec.id}
                  style={{
                    background: "var(--surface-soft)",
                    borderRadius: "var(--radius-md)",
                    padding: "1.2rem",
                    borderLeft: `5px solid ${priorityColors[rec.priority] || "var(--accent)"}`,
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "1.5rem",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
                      <span
                        className={`badge ${
                          rec.priority === "CRITICAL"
                            ? "badge--critical"
                            : rec.priority === "HIGH"
                            ? "badge--warning"
                            : "badge--info"
                        }`}
                        style={{ fontSize: "0.7rem" }}
                      >
                        {rec.priority}
                      </span>
                      <span className="badge badge--neutral" style={{ fontSize: "0.7rem" }}>
                        {rec.domain}
                      </span>
                      <span
                        style={{
                          background: "rgba(56, 189, 248, 0.15)",
                          color: "#38bdf8",
                          padding: "0.15rem 0.5rem",
                          borderRadius: "4px",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                        }}
                      >
                        ACTION: {rec.suggestedAction}
                      </span>
                    </div>

                    <div style={{ fontWeight: 600, fontSize: "0.95rem", marginBottom: "0.3rem" }}>{rec.title}</div>
                    <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
                      {rec.description}
                    </div>

                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      <strong>Rationale:</strong> {rec.rationale}
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", minWidth: "140px", alignItems: "flex-end" }}>
                    <button
                      className={`btn ${acknowledgedRecs[rec.id] ? "btn--primary" : "btn--secondary"}`}
                      style={{
                        fontSize: "0.75rem",
                        padding: "0.4rem 0.7rem",
                        background: acknowledgedRecs[rec.id] ? "rgba(16, 185, 129, 0.2)" : undefined,
                        borderColor: acknowledgedRecs[rec.id] ? "var(--green)" : undefined,
                        color: acknowledgedRecs[rec.id] ? "var(--green)" : undefined,
                      }}
                      onClick={() => toggleAcknowledge(rec.id)}
                    >
                      {acknowledgedRecs[rec.id] ? `✓ Ack (${acknowledgedRecs[rec.id]})` : "✓ Acknowledge"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 6: MODEL OBSERVABILITY LEDGER ───────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "OBSERVABILITY" && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">📊 Operational Model Observability & Provenance</h2>
              <span className="card-subtitle">Real-time execution logs, latency tracking, and confidence audits</span>
            </div>
            <span className="badge badge--operational">AUDIT LIVE</span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border)", color: "var(--text-muted)", fontSize: "0.75rem" }}>
                  <th style={{ padding: "0.5rem", textAlign: "left" }}>TASK</th>
                  <th style={{ padding: "0.5rem", textAlign: "left" }}>MODEL</th>
                  <th style={{ padding: "0.5rem", textAlign: "left" }}>VERSION</th>
                  <th style={{ padding: "0.5rem", textAlign: "center" }}>LATENCY</th>
                  <th style={{ padding: "0.5rem", textAlign: "center" }}>CONFIDENCE</th>
                  <th style={{ padding: "0.5rem", textAlign: "right" }}>TIMESTAMP</th>
                </tr>
              </thead>
              <tbody>
                {observability.map((obs) => (
                  <tr key={obs.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.6rem 0.5rem", fontWeight: 600 }}>{obs.task}</td>
                    <td style={{ padding: "0.6rem 0.5rem" }}>{obs.modelName}</td>
                    <td style={{ padding: "0.6rem 0.5rem" }}>
                      <code>{obs.modelVersion}</code>
                    </td>
                    <td style={{ padding: "0.6rem 0.5rem", textAlign: "center" }}>{obs.executionDurationMs} ms</td>
                    <td style={{ padding: "0.6rem 0.5rem", textAlign: "center", color: "var(--green)", fontWeight: 600 }}>
                      {(obs.confidence * 100).toFixed(0)}%
                    </td>
                    <td style={{ padding: "0.6rem 0.5rem", textAlign: "right", color: "var(--text-muted)", fontSize: "0.75rem" }}>
                      {new Date(obs.generatedAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
