import React, { useState, useEffect } from "react";
import { twinApi } from "../../services/api";
import type { DecisionTraceRecord } from "@maitri-bharati/shared";

interface DecisionTracePanelProps {
  stationId: string;
}

export function DecisionTracePanel({ stationId }: DecisionTracePanelProps): React.JSX.Element {
  const [traces, setTraces] = useState<DecisionTraceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    twinApi
      .getDecisionTrace(stationId)
      .then((data) => {
        if (isMounted) {
          setTraces(data);
          if (data.length > 0 && !selectedTraceId) {
            setSelectedTraceId(data[0].correlationId);
          }
        }
      })
      .catch((err) => console.warn("Failed to load decision traces:", err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [stationId, selectedTraceId]);

  if (loading && traces.length === 0) {
    return (
      <div style={{ padding: "1rem", color: "var(--text-muted)", fontSize: "0.8rem" }}>
        Loading explainable decision traces...
      </div>
    );
  }

  const selectedTrace = traces.find((t) => t.correlationId === selectedTraceId) || traces[0];

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      <div
        style={{
          padding: "0.75rem 1rem",
          background: "var(--surface-soft)",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--green)", textTransform: "uppercase" }}>
            EXPLAINABLE AI • CROSS-DOMAIN CAUSAL CHAIN
          </span>
          <h3 style={{ margin: "0.1rem 0", fontSize: "1rem", fontWeight: 700, color: "var(--text)" }}>
            Decision Trace & Evidence Audit Trail
          </h3>
        </div>
        <span className="badge badge--info" style={{ fontSize: "0.65rem" }}>
          {traces.length} Recorded Traces
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", minHeight: "360px" }}>
        {/* Left Traces List */}
        <div style={{ borderRight: "1px solid var(--border)", background: "var(--surface-soft)", overflowY: "auto", maxHeight: "450px" }}>
          {traces.map((trace) => {
            const isSel = trace.correlationId === selectedTrace?.correlationId;
            return (
              <div
                key={trace.correlationId}
                onClick={() => setSelectedTraceId(trace.correlationId)}
                style={{
                  padding: "0.75rem 1rem",
                  borderBottom: "1px solid var(--border)",
                  background: isSel ? "var(--surface)" : "transparent",
                  borderLeft: isSel ? "3px solid var(--green)" : "3px solid transparent",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text)" }}>
                    {trace.inputTelemetry.metric}
                  </span>
                  <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>
                    {new Date(trace.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                  Asset: <strong>{trace.inputTelemetry.assetId}</strong>
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--critical)", fontWeight: 600 }}>
                  {trace.evidenceDossier.deviation}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Trace Flow Visualization */}
        {selectedTrace ? (
          <div style={{ padding: "1.25rem", overflowY: "auto", maxHeight: "450px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
              <div>
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>CORRELATION ID:</span>{" "}
                <strong style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>
                  {selectedTrace.correlationId}
                </strong>
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Timestamp: <strong>{new Date(selectedTrace.timestamp).toLocaleString()}</strong>
              </div>
            </div>

            {/* Stepper Flow Cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {/* Step 1: Input Telemetry */}
              <div style={{ background: "var(--surface-soft)", padding: "0.75rem", borderRadius: "6px", borderLeft: "3px solid #6b7280" }}>
                <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                  1. SENSOR TELEMETRY INPUT
                </div>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text)", marginTop: "0.2rem" }}>
                  {selectedTrace.inputTelemetry.assetId} • {selectedTrace.inputTelemetry.metric} = {selectedTrace.inputTelemetry.value} {selectedTrace.inputTelemetry.unit}
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.1rem" }}>
                  Source: <strong>{selectedTrace.inputTelemetry.source}</strong> (Physical Telemetry Stream)
                </div>
              </div>

              {/* Step 2: Evidence Dossier */}
              <div style={{ background: "var(--surface-soft)", padding: "0.75rem", borderRadius: "6px", borderLeft: "3px solid var(--critical)" }}>
                <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--critical)", textTransform: "uppercase" }}>
                  2. STATISTICAL & RULE-BASED EVIDENCE
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--text)", marginTop: "0.2rem" }}>
                  Deviation: <strong>{selectedTrace.evidenceDossier.deviation}</strong> (Z-Score: <strong>{selectedTrace.evidenceDossier.zScore}</strong>)
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.1rem" }}>
                  Threshold Breach: {selectedTrace.evidenceDossier.thresholdBreached}
                </div>
              </div>

              {/* Step 3: Model & Propagated Cascade */}
              <div style={{ background: "var(--surface-soft)", padding: "0.75rem", borderRadius: "6px", borderLeft: "3px solid var(--warning)" }}>
                <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--warning)", textTransform: "uppercase" }}>
                  3. RULE/MODEL & DOWNSTREAM CAUSAL PROPAGATION
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                  Model Version: <strong style={{ color: "var(--text)" }}>{selectedTrace.ruleOrModelVersion}</strong>
                </div>
                <ul style={{ margin: "0.4rem 0 0", paddingLeft: "1.2rem", fontSize: "0.75rem", color: "var(--text)", lineHeight: 1.4 }}>
                  {selectedTrace.propagatedCascade.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>

              {/* Step 4: Recommendation & Operator Action */}
              <div style={{ background: "rgba(11, 74, 53, 0.06)", padding: "0.75rem", borderRadius: "6px", borderLeft: "3px solid var(--green)" }}>
                <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--green)", textTransform: "uppercase" }}>
                  4. COMPUTED ADVISORY & OPERATOR ACTION
                </div>
                <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text)", marginTop: "0.2rem" }}>
                  {selectedTrace.recommendation}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--green)", marginTop: "0.3rem", fontWeight: 600 }}>
                  Action Taken: {selectedTrace.operatorActionTaken || "Pending operator assessment"}
                </div>
                {selectedTrace.auditRefId && (
                  <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                    Audit Reference: <span style={{ fontFamily: "var(--font-mono)" }}>{selectedTrace.auditRefId}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: "2rem", color: "var(--text-muted)", textAlign: "center" }}>
            Select a trace from the left panel to inspect evidence flow.
          </div>
        )}
      </div>
    </div>
  );
}
