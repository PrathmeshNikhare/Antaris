import React, { useState, useEffect } from "react";
import { twinApi } from "../../services/api";
import type { MissionResilienceIndex } from "@maitri-bharati/shared";

interface ResilienceIndexCardProps {
  stationId: string;
  compact?: boolean;
}

export function ResilienceIndexCard({ stationId, compact = false }: ResilienceIndexCardProps): React.JSX.Element {
  const [indexData, setIndexData] = useState<MissionResilienceIndex | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [expandedFactor, setExpandedFactor] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    twinApi
      .getResilienceIndex(stationId)
      .then((data) => {
        if (isMounted) setIndexData(data);
      })
      .catch((err) => console.warn("Failed to load resilience index:", err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [stationId]);

  if (loading && !indexData) {
    return (
      <div style={{ padding: "1.25rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px" }}>
        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Evaluating Antarctic Mission Resilience Index...</div>
      </div>
    );
  }

  if (!indexData) return <></>;

  const score = indexData.overallScore;
  const isOptimal = score >= 85;
  const isStable = score >= 65 && score < 85;
  const isDegraded = score >= 45 && score < 65;
  const scoreColor = isOptimal ? "var(--green)" : isStable ? "#2563eb" : isDegraded ? "var(--warning)" : "var(--critical)";

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderLeft: `4px solid ${scoreColor}`,
        borderRadius: "8px",
        padding: compact ? "1rem" : "1.25rem",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      {/* Header Banner */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.85rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.05em" }}>
              COMPUTED OPERATIONAL DECISION-SUPPORT • 8-FACTOR MODEL
            </span>
            <span
              style={{
                fontSize: "0.6rem",
                padding: "0.15rem 0.4rem",
                borderRadius: "3px",
                background: "rgba(11, 74, 53, 0.1)",
                color: "var(--green)",
                fontWeight: 600,
              }}
            >
              {indexData.modelVersion}
            </span>
          </div>
          <h3 style={{ margin: "0.2rem 0", fontSize: compact ? "1.05rem" : "1.2rem", fontWeight: 700, color: "var(--text)" }}>
            Antarctic Mission Resilience Index (AMRI)
          </h3>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            Confidence: <strong>{indexData.confidencePct}%</strong> • Data Quality: <strong>{indexData.dataQuality}</strong> • Evaluated: {new Date(indexData.timestamp).toLocaleTimeString()}
          </div>
        </div>

        {/* Score Stamp */}
        <div style={{ textAlign: "right" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "flex-end", gap: "0.25rem" }}>
            <span style={{ fontSize: compact ? "1.8rem" : "2.4rem", fontWeight: 900, color: scoreColor, lineHeight: 1 }}>
              {score}
            </span>
            <span style={{ fontSize: "0.9rem", color: "var(--text-muted)", fontWeight: 600 }}>/100</span>
          </div>
          <span
            className={`badge ${isOptimal ? "badge--operational" : isStable ? "badge--info" : isDegraded ? "badge--warning" : "badge--critical"}`}
            style={{ fontSize: "0.65rem", marginTop: "0.2rem" }}
          >
            {indexData.status}
          </span>
        </div>
      </div>

      {/* Top Degradation Drivers Alert if any */}
      {indexData.topDegradationDrivers.length > 0 && indexData.topDegradationDrivers[0] !== "None - All systems within optimal margins" && (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            padding: "0.5rem 0.75rem",
            borderRadius: "6px",
            marginBottom: "0.85rem",
            fontSize: "0.75rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span style={{ color: "var(--critical)", fontWeight: 700 }}>Top Degradation Drivers:</span>
          <span style={{ color: "var(--text)" }}>{indexData.topDegradationDrivers.join(" • ")}</span>
        </div>
      )}

      {/* 8-Factor Breakdown Grid */}
      <div style={{ marginTop: "0.75rem" }}>
        <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: "0.5rem" }}>
          EXPLAINABLE FACTOR BREAKDOWN (CLICK TO INSPECT FORMULA & PENALTY):
        </div>

        <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr 1fr" : "repeat(4, 1fr)", gap: "0.6rem" }}>
          {indexData.factors.map((f) => {
            const isFExpanded = expandedFactor === f.factor;
            const fColor =
              f.status === "OPTIMAL"
                ? "var(--green)"
                : f.status === "NOMINAL"
                ? "#2563eb"
                : f.status === "DEGRADED"
                ? "var(--warning)"
                : "var(--critical)";

            return (
              <div
                key={f.factor}
                onClick={() => setExpandedFactor(isFExpanded ? null : f.factor)}
                style={{
                  background: isFExpanded ? "var(--surface-soft)" : "var(--surface)",
                  border: `1px solid ${isFExpanded ? fColor : "var(--border)"}`,
                  borderRadius: "6px",
                  padding: "0.6rem",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.2rem" }}>
                  <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text)" }}>
                    {f.factor}
                  </span>
                  <span style={{ fontSize: "0.7rem", fontWeight: 800, color: fColor }}>
                    {f.score}
                  </span>
                </div>

                {/* Progress Mini Bar */}
                <div style={{ width: "100%", height: "4px", background: "var(--border)", borderRadius: "2px", overflow: "hidden", margin: "0.3rem 0" }}>
                  <div style={{ width: `${f.score}%`, height: "100%", background: fColor }} />
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.65rem", color: "var(--text-muted)" }}>
                  <span>Weight: {f.weightPct}%</span>
                  <span>{f.rawMetricValue}</span>
                </div>

                {isFExpanded && (
                  <div style={{ marginTop: "0.5rem", paddingTop: "0.4rem", borderTop: "1px dashed var(--border)", fontSize: "0.7rem", color: "var(--text)" }}>
                    <div style={{ color: f.penaltyPoints > 0 ? "var(--critical)" : "var(--green)", fontWeight: 600, marginBottom: "0.2rem" }}>
                      {f.penaltyPoints > 0 ? `-${f.penaltyPoints} Penalty Points` : "0 Penalties Applied"}
                    </div>
                    <div style={{ color: "var(--text-muted)", lineHeight: 1.3 }}>{f.explanation}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: "0.85rem", fontSize: "0.65rem", color: "var(--text-muted)", fontStyle: "italic", textAlign: "right" }}>
        {indexData.disclaimer} • Formula: Weighted Sum of 8 Mission Pillars
      </div>
    </div>
  );
}
