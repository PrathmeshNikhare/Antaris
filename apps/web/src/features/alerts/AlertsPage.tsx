import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useStation } from "../../hooks/useStation";
import { useAuth } from "../../context/AuthContext";
import { twinApi } from "../../services/api";
import type { Alert, AlertStatus, AlertSeverity } from "@maitri-bharati/shared";

type TriageLevel = "ALL" | "CRITICAL" | "WARNING" | "NOMINAL";

export function AlertsPage(): React.JSX.Element {
  const navigate = useNavigate();
  const { stationId } = useStation();
  const { user, hasRole } = useAuth();

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<AlertStatus | "ALL">("ALL");
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | "ALL">("ALL");
  const [triageFilter, setTriageFilter] = useState<TriageLevel>("ALL");
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  // Policy / Command Proposal Execution Modal
  const [proposalModal, setProposalModal] = useState<{
    type: "STORM_LOCKDOWN" | "EMERGENCY_POWER" | "LOAD_SHEDDING" | "GEN_FAILOVER" | "COMMS_RECOVERY";
    title: string;
    impactSummary: string;
  } | null>(null);
  const [proposalStatus, setProposalStatus] = useState<string | null>(null);
  const [isExecutingProposal, setIsExecutingProposal] = useState<boolean>(false);

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await twinApi.getAlerts(stationId);
      setAlerts(data);
      if (data.length > 0 && !selectedAlert) {
        setSelectedAlert(data[0]);
      }
    } catch (err) {
      console.warn("Failed to load alerts:", err);
    } finally {
      setLoading(false);
    }
  }, [stationId, selectedAlert]);

  useEffect(() => {
    void fetchAlerts();
    const interval = setInterval(fetchAlerts, 5000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  const handleAcknowledge = async (alertId: string) => {
    try {
      const updated = await twinApi.acknowledgeAlert(alertId);
      setAlerts((prev) => prev.map((a) => (a.id === alertId ? updated : a)));
      if (selectedAlert?.id === alertId) setSelectedAlert(updated);
    } catch (err) {
      alert(`Failed to acknowledge alert: ${(err as Error).message}`);
    }
  };

  const handleResolve = async (alertId: string) => {
    if (!hasRole("ADMIN", "OPERATOR", "ENGINEER")) {
      alert("Unauthorized: Only authorized officers or engineers may resolve critical operational incidents.");
      return;
    }
    try {
      const updated = await twinApi.resolveAlert(alertId);
      setAlerts((prev) => prev.map((a) => (a.id === alertId ? updated : a)));
      if (selectedAlert?.id === alertId) setSelectedAlert(updated);
    } catch (err) {
      alert(`Failed to resolve alert: ${(err as Error).message}`);
    }
  };

  const handleLocateInTwin = (assetId?: string) => {
    if (assetId) {
      navigate(`/twin?assetId=${assetId}`);
    } else {
      navigate("/twin");
    }
  };

  const handleExecuteProposal = async () => {
    if (!proposalModal) return;
    setIsExecutingProposal(true);
    setProposalStatus("Validating simulated policy parameters...");

    try {
      await new Promise((r) => setTimeout(r, 800));
      // Log audit action
      await twinApi.logAuditEvent({
        operatorId: user?.id || "op-field",
        action: `POLICY_PROPOSAL_${proposalModal.type}`,
        targetType: "STATION",
        targetId: stationId,
        previousState: { proposalType: proposalModal.type },
        newState: { executed: true, simulated: true, mode: "DEMO_REVERSIBLE" },
        result: "SIMULATION_SUCCESS",
      });

      setProposalStatus("✅ Simulated policy proposal executed and verified in digital twin.");
      setTimeout(() => {
        setProposalModal(null);
        setProposalStatus(null);
      }, 1500);
    } catch (err) {
      setProposalStatus(`❌ Failed to execute proposal: ${(err as Error).message}`);
    } finally {
      setIsExecutingProposal(false);
    }
  };

  // Filtered Alerts
  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (statusFilter !== "ALL" && a.status !== statusFilter) return false;
      if (severityFilter !== "ALL" && a.severity !== severityFilter) return false;
      if (triageFilter === "CRITICAL" && a.severity !== "CRITICAL") return false;
      if (triageFilter === "WARNING" && a.severity !== "WARNING") return false;
      if (triageFilter === "NOMINAL" && a.severity !== "INFO") return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = a.title.toLowerCase().includes(query);
        const matchesDesc = (a.description || "").toLowerCase().includes(query);
        const matchesAsset = (a.assetId || "").toLowerCase().includes(query);
        if (!matchesTitle && !matchesDesc && !matchesAsset) return false;
      }
      return true;
    });
  }, [alerts, statusFilter, severityFilter, triageFilter, searchQuery]);

  const criticalCount = alerts.filter((a) => a.severity === "CRITICAL" && a.status === "OPEN").length;
  const warningCount = alerts.filter((a) => a.severity === "WARNING" && a.status === "OPEN").length;
  const ackCount = alerts.filter((a) => a.status === "ACKNOWLEDGED").length;
  const resolvedCount = alerts.filter((a) => a.status === "RESOLVED").length;

  return (
    <div className="app-content">
      <header className="page-header" style={{ marginBottom: "1rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                fontSize: "0.7rem",
                fontWeight: 700,
                color: "var(--critical)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              INCIDENT RESPONSE • OPERATIONAL TRIAGE
            </span>
          </div>
          <h1 className="page-header__title">
            {stationId === "station-maitri" ? "Maitri" : "Bharati"} Incident Command Center
          </h1>
          <p className="page-header__subtitle">
            Real-time anomaly triage, evidence correlation, root-cause causal trees, and simulated policy proposals.
          </p>
        </div>

        {/* Triage & Simulated Policy Proposals Actions */}
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            className="button button--ghost"
            style={{ fontSize: "0.75rem", border: "1px solid var(--border)" }}
            onClick={() =>
              setProposalModal({
                type: "STORM_LOCKDOWN",
                title: "Storm Lockdown Protocol",
                impactSummary:
                  "Curtails exterior sensor feeds, locks turbine mechanical yaw, derates ventilation dampers to recirculate internal air, and reserves battery buffer for essential life support.",
              })
            }
          >
            🛡️ Storm Lockdown
          </button>
          <button
            type="button"
            className="button button--ghost"
            style={{ fontSize: "0.75rem", border: "1px solid var(--border)" }}
            onClick={() =>
              setProposalModal({
                type: "LOAD_SHEDDING",
                title: "Non-Critical Load Shedding",
                impactSummary:
                  "Sheds 24 kW of non-essential research laboratory equipment and secondary galley heaters, reducing fuel burn by 18% and extending diesel autonomy by 12 days.",
              })
            }
          >
            ⚡ Load Shedding
          </button>
          <button
            type="button"
            className="button button--ghost"
            style={{ fontSize: "0.75rem", border: "1px solid var(--border)" }}
            onClick={() =>
              setProposalModal({
                type: "GEN_FAILOVER",
                title: "Generator Standby Failover",
                impactSummary:
                  "Issues start command to secondary generator GEN-02, synchronizes bus voltage across 415V switchgear, and offloads degraded primary unit GEN-01 for maintenance.",
              })
            }
          >
            ↺ Gen Failover
          </button>
        </div>
      </header>

      {/* KPI Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "1.25rem" }}>
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderLeft: "4px solid var(--critical)",
            padding: "1rem",
            borderRadius: "6px",
          }}
        >
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>CRITICAL INCIDENTS</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--critical)", marginTop: "0.2rem" }}>
            {criticalCount}
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>Immediate operator attention required</div>
        </div>

        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderLeft: "4px solid var(--warning)",
            padding: "1rem",
            borderRadius: "6px",
          }}
        >
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>ACTIVE WARNINGS</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--warning)", marginTop: "0.2rem" }}>
            {warningCount}
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>Threshold deviations under monitor</div>
        </div>

        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderLeft: "4px solid #3b82f6",
            padding: "1rem",
            borderRadius: "6px",
          }}
        >
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>ACKNOWLEDGED</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#3b82f6", marginTop: "0.2rem" }}>
            {ackCount}
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>Officer investigation in progress</div>
        </div>

        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderLeft: "4px solid var(--green)",
            padding: "1rem",
            borderRadius: "6px",
          }}
        >
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>RESOLVED (24H)</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--green)", marginTop: "0.2rem" }}>
            {resolvedCount}
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>Verified nominal telemetry</div>
        </div>
      </div>

      {/* Filter and Triage Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          padding: "0.75rem 1rem",
          borderRadius: "6px",
          marginBottom: "1rem",
        }}
      >
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flex: 1 }}>
          <input
            type="text"
            placeholder="Search incident title, description, or asset ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: "0.4rem 0.75rem",
              fontSize: "0.8rem",
              borderRadius: "4px",
              border: "1px solid var(--border)",
              minWidth: "280px",
              background: "#ffffff",
            }}
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="select-control"
            style={{ padding: "0.4rem 0.6rem", fontSize: "0.8rem" }}
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open Only</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
            <option value="RESOLVED">Resolved</option>
          </select>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as any)}
            className="select-control"
            style={{ padding: "0.4rem 0.6rem", fontSize: "0.8rem" }}
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical Only</option>
            <option value="WARNING">Warning Only</option>
            <option value="INFO">Info Only</option>
          </select>
        </div>

        {/* Operational Triage Tabs */}
        <div style={{ display: "flex", gap: "0.3rem" }}>
          {(["ALL", "CRITICAL", "WARNING", "NOMINAL"] as TriageLevel[]).map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setTriageFilter(lvl)}
              style={{
                padding: "0.35rem 0.65rem",
                fontSize: "0.75rem",
                fontWeight: 600,
                borderRadius: "4px",
                border: triageFilter === lvl ? "1px solid var(--green)" : "1px solid var(--border)",
                background: triageFilter === lvl ? "var(--green)" : "var(--surface)",
                color: triageFilter === lvl ? "#ffffff" : "var(--text)",
                cursor: "pointer",
              }}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Main Workspace Layout: Incidents List (Left) + Evidence Dossier & Root Cause (Right) */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "1rem" }}>
        {/* Left Column: Incidents List */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "0.75rem 1rem",
              background: "var(--surface-soft)",
              borderBottom: "1px solid var(--border)",
              fontSize: "0.8rem",
              fontWeight: 700,
              color: "var(--text)",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>ACTIVE INCIDENTS ({filteredAlerts.length})</span>
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
              Auto-refreshed every 5s
            </span>
          </div>

          <div style={{ maxHeight: "640px", overflowY: "auto" }}>
            {filteredAlerts.length === 0 ? (
              <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                {loading ? "Loading incident feeds..." : "No incidents match the active filter criteria."}
              </div>
            ) : (
              filteredAlerts.map((alert) => {
                const isSelected = selectedAlert?.id === alert.id;
                const isCrit = alert.severity === "CRITICAL";

                return (
                  <div
                    key={alert.id}
                    onClick={() => setSelectedAlert(alert)}
                    style={{
                      padding: "0.85rem 1rem",
                      borderBottom: "1px solid var(--border)",
                      borderLeft: isSelected ? "4px solid var(--green)" : isCrit ? "4px solid var(--critical)" : "4px solid transparent",
                      background: isSelected ? "var(--surface-soft)" : "#ffffff",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.3rem" }}>
                      <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                        <span
                          className={`badge ${
                            alert.severity === "CRITICAL"
                              ? "badge--critical"
                              : alert.severity === "WARNING"
                              ? "badge--warning"
                              : "badge--info"
                          }`}
                          style={{ fontSize: "0.65rem" }}
                        >
                          {alert.severity}
                        </span>
                        <span
                          style={{
                            fontSize: "0.85rem",
                            fontWeight: 700,
                            color: "var(--text)",
                          }}
                        >
                          {alert.title}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: "0.65rem",
                          fontWeight: 600,
                          color:
                            alert.status === "OPEN"
                              ? "var(--critical)"
                              : alert.status === "ACKNOWLEDGED"
                              ? "#3b82f6"
                              : "var(--green)",
                          textTransform: "uppercase",
                        }}
                      >
                        [{alert.status}]
                      </span>
                    </div>

                    <p style={{ margin: "0.2rem 0 0.5rem", fontSize: "0.75rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                      {alert.description}
                    </p>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.7rem", color: "var(--text-muted)" }}>
                      <span>
                        Asset: <strong style={{ color: "var(--text)" }}>{alert.assetId || "Station Complex"}</strong>
                      </span>
                      <span>{new Date(alert.createdAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Incident Evidence Dossier, Causal Chain & Actions */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          {selectedAlert ? (
            <>
              {/* Header */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      color: selectedAlert.severity === "CRITICAL" ? "var(--critical)" : "var(--warning)",
                    }}
                  >
                    INCIDENT DOSSIER • {selectedAlert.id}
                  </span>
                  <span
                    style={{
                      fontSize: "0.65rem",
                      fontWeight: 600,
                      background: "rgba(11, 74, 53, 0.08)",
                      color: "var(--green)",
                      padding: "2px 6px",
                      borderRadius: "4px",
                    }}
                  >
                    PROVENANCE: {((selectedAlert.evidence as any)?.provenanceType as string) || "SIMULATED / ML"}
                  </span>
                </div>
                <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0.35rem 0", color: "var(--text)" }}>
                  {selectedAlert.title}
                </h2>
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.4rem" }}>
                  <span className="badge badge--critical">{selectedAlert.severity}</span>
                  <span className="badge badge--warning">STATUS: {selectedAlert.status}</span>
                  <span className="badge badge--info">STATION: {selectedAlert.stationId}</span>
                </div>
              </div>

              {/* Evidence Dossier Box */}
              <div
                style={{
                  background: "var(--surface-soft)",
                  padding: "0.85rem",
                  borderRadius: "6px",
                  fontSize: "0.75rem",
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: "0.4rem" }}>
                  🔍 Anomaly Evidence & Telemetry Observation:
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>Target Asset:</span>{" "}
                    <strong>{selectedAlert.assetId || "Station System"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>Trigger Metric:</span>{" "}
                    <strong>{((selectedAlert.evidence as any)?.metric as string) || "Physical Anomaly"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>Trigger Value:</span>{" "}
                    <strong style={{ color: "var(--critical)" }}>
                      {((selectedAlert.evidence as any)?.value as string) ?? "Out of Normal Bounds"}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>Anomaly Score:</span>{" "}
                    <strong style={{ color: "var(--critical)" }}>0.94 (Isolation Forest)</strong>
                  </div>
                </div>
              </div>

              {/* Causal Chain Visualization */}
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  padding: "0.85rem",
                }}
              >
                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text)", marginBottom: "0.5rem" }}>
                  ⛓️ Root-Cause & Cascade Impact Chain:
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", fontSize: "0.75rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ width: "20px", textAlign: "center" }}>1️⃣</span>
                    <span style={{ color: "var(--critical)", fontWeight: 600 }}>Root Cause:</span>
                    <span>{selectedAlert.description}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ width: "20px", textAlign: "center" }}>2️⃣</span>
                    <span style={{ color: "var(--warning)", fontWeight: 600 }}>First-Order Cascade:</span>
                    <span>Secondary equipment loading increased by +35%</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ width: "20px", textAlign: "center" }}>3️⃣</span>
                    <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Station Vulnerability:</span>
                    <span>Emergency diesel autonomy runway reduced to 48 days</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "auto" }}>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    type="button"
                    className="button button--primary"
                    style={{ flex: 1, padding: "0.5rem", fontSize: "0.8rem" }}
                    onClick={() => handleLocateInTwin(selectedAlert.assetId)}
                  >
                    📍 Locate in 3D Digital Twin
                  </button>

                  {selectedAlert.status === "OPEN" && (
                    <button
                      type="button"
                      className="button button--ghost"
                      style={{ padding: "0.5rem 0.85rem", fontSize: "0.8rem", border: "1px solid var(--border)" }}
                      onClick={() => handleAcknowledge(selectedAlert.id)}
                    >
                      ✓ Acknowledge
                    </button>
                  )}

                  {selectedAlert.status !== "RESOLVED" && (
                    <button
                      type="button"
                      className="button button--ghost"
                      style={{
                        padding: "0.5rem 0.85rem",
                        fontSize: "0.8rem",
                        border: "1px solid var(--green)",
                        color: "var(--green)",
                      }}
                      onClick={() => handleResolve(selectedAlert.id)}
                    >
                      ✓ Resolve Incident
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  className="button button--ghost"
                  style={{
                    padding: "0.45rem",
                    fontSize: "0.75rem",
                    textAlign: "center",
                    border: "1px dashed var(--border)",
                  }}
                  onClick={() =>
                    navigate(
                      `/simulations?targetAsset=${selectedAlert.assetId || ""}&scenario=GENERATOR_FAILURE`
                    )
                  }
                >
                  🧪 Test What-If Scenario with this Failure →
                </button>
              </div>
            </>
          ) : (
            <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
              Select an incident from the queue to view full telemetry evidence and root cause.
            </div>
          )}
        </div>
      </div>

      {/* Policy Proposal Confirmation Modal */}
      {proposalModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "1rem",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "8px",
              maxWidth: "520px",
              width: "100%",
              padding: "1.5rem",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, color: "var(--text)" }}>
                ⚠️ Propose Simulated Policy: {proposalModal.title}
              </h3>
              <button
                type="button"
                style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer" }}
                onClick={() => setProposalModal(null)}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.5, marginBottom: "1rem" }}>
              {proposalModal.impactSummary}
            </p>

            <div
              style={{
                background: "var(--surface-soft)",
                padding: "0.75rem",
                borderRadius: "4px",
                fontSize: "0.75rem",
                marginBottom: "1.25rem",
                border: "1px solid var(--border)",
              }}
            >
              <div><strong>Station Target:</strong> {stationId}</div>
              <div><strong>Authenticated Operator:</strong> {user?.username} ({user?.role})</div>
              <div><strong>Execution Mode:</strong> SIMULATED DEMO COMMAND (Zero physical actuation)</div>
            </div>

            {proposalStatus && (
              <div style={{ marginBottom: "1rem", fontSize: "0.8rem", fontWeight: 600, color: "var(--green)" }}>
                {proposalStatus}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setProposalModal(null)}
                disabled={isExecutingProposal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button--primary"
                onClick={handleExecuteProposal}
                disabled={isExecutingProposal}
              >
                {isExecutingProposal ? "Executing..." : "Confirm Simulated Execution →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
