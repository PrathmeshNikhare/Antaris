import React, { useState, useEffect } from "react";
import { twinApi } from "../../services/api";
import type { AuditEvent } from "@maitri-bharati/shared";

export function AuditPage(): React.JSX.Element {
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const loadAudits = async () => {
    setLoading(true);
    try {
      const data = await twinApi.getAuditEvents();
      setAuditEvents(data);
    } catch (err) {
      console.warn("Failed to load audit events:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAudits();
  }, []);

  const handleRecordAction = async () => {
    setSubmitting(true);
    try {
      await twinApi.logAuditEvent({
        operatorId: "op-field-officer",
        action: "MANUAL_SAFETY_INSPECTION",
        targetType: "STATION",
        targetId: "station-maitri",
        result: "VERIFIED_OPERATIONAL",
      });
      await loadAudits();
    } catch (err) {
      console.error("Failed to record audit event:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-content">
      <header className="page-header">
        <div>
          <h1 className="page-header__title">NCPOR Polar Operations Audit Trail</h1>
          <p className="page-header__subtitle">
            Immutable log of all operator interactions, simulated command approvals, and configuration changes.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button
            className="btn btn--primary"
            onClick={handleRecordAction}
            disabled={submitting}
            title="Record an operator inspection action to verify immutable audit logging"
          >
            {submitting ? "Logging..." : "+ Log Operator Action"}
          </button>
          <button className="btn btn--outline" onClick={loadAudits} disabled={loading}>
            ↻ Refresh
          </button>
          <span className="badge badge--info">{auditEvents.length} Events</span>
        </div>
      </header>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">📋 Operator Actions & System Audit Log</h2>
          <span className="card-subtitle">Cryptographically verifiable sequence trail</span>
        </div>

        {loading ? (
          <div className="skeleton skeleton-tile" />
        ) : auditEvents.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", padding: "1rem" }}>
            No audit records found.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border)", color: "var(--text-muted)", fontSize: "0.75rem" }}>
                  <th style={{ padding: "0.6rem" }}>TIMESTAMP</th>
                  <th style={{ padding: "0.6rem" }}>OPERATOR</th>
                  <th style={{ padding: "0.6rem" }}>ACTION</th>
                  <th style={{ padding: "0.6rem" }}>TARGET TYPE</th>
                  <th style={{ padding: "0.6rem" }}>TARGET ID</th>
                  <th style={{ padding: "0.6rem" }}>DETAILS</th>
                </tr>
              </thead>
              <tbody>
                {auditEvents.map((evt) => (
                  <tr key={evt.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.6rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
                      {new Date(evt.createdAt).toLocaleString()}
                    </td>
                    <td style={{ padding: "0.6rem", fontWeight: 600 }}>{evt.operatorId ?? "System"}</td>
                    <td style={{ padding: "0.6rem" }}>
                      <span className="badge badge--info">{evt.action}</span>
                    </td>
                    <td style={{ padding: "0.6rem" }}>{evt.targetType}</td>
                    <td style={{ padding: "0.6rem", fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
                      {evt.targetId ?? "—"}
                    </td>
                    <td style={{ padding: "0.6rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {evt.result || (evt.newState ? JSON.stringify(evt.newState) : "—")}
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
