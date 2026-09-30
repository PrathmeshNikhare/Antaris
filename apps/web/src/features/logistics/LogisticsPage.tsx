import React, { useState, useEffect, useCallback } from "react";
import { useStation } from "../../hooks/useStation";
import { useAuth } from "../../context/AuthContext";
import { twinApi } from "../../services/api";
import type {
  CargoMission,
  CargoRequisition,
  CargoRequisitionPriority,
  CargoOptimizationResult,
  MissionWindowPlan,
} from "@maitri-bharati/shared";

type LogisticsTab = "INVENTORY" | "REQUISITIONS" | "OPTIMIZER" | "MISSION_WINDOWS" | "TRANSACTIONS";

export function LogisticsPage(): React.JSX.Element {
  const { stationId, refreshState } = useStation();
  const { hasRole } = useAuth();

  const [activeTab, setActiveTab] = useState<LogisticsTab>("INVENTORY");
  const [inventory, setInventory] = useState<any[]>([]);
  const [missions, setMissions] = useState<CargoMission[]>([]);
  const [requisitions, setRequisitions] = useState<CargoRequisition[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [optimization, setOptimization] = useState<CargoOptimizationResult | null>(null);
  const [windowPlan, setWindowPlan] = useState<MissionWindowPlan | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // New Requisition Modal
  const [showNewReqModal, setShowNewReqModal] = useState<boolean>(false);
  const [reqItemId, setReqItemId] = useState<string>("");
  const [reqQty, setReqQty] = useState<string>("");
  const [reqPriority, setReqPriority] = useState<CargoRequisitionPriority>("MEDIUM");
  const [reqReason, setReqReason] = useState<string>("");

  const isMaitri = stationId === "station-maitri";

  const fetchLogisticsData = useCallback(async () => {
    try {
      const [invData, missionData, reqData, txData] = await Promise.all([
        twinApi.getInventory(stationId),
        twinApi.getCargoMissions(stationId),
        twinApi.getCargoRequisitions(stationId),
        twinApi.getInventoryTransactions(stationId),
      ]);
      setInventory(invData);
      setMissions(missionData);
      setRequisitions(reqData);
      setTransactions(txData);

      if (invData.length > 0 && !reqItemId) {
        setReqItemId(invData[0].id);
      }
    } catch (err) {
      console.warn("Failed to fetch database-backed logistics:", err);
    } finally {
      setLoading(false);
    }
  }, [stationId, reqItemId]);

  useEffect(() => {
    void fetchLogisticsData();
  }, [fetchLogisticsData]);

  // Load optimizer or window plan on tab switch
  useEffect(() => {
    if (activeTab === "OPTIMIZER" && !optimization) {
      twinApi.optimizeCargo(stationId).then(setOptimization).catch(console.warn);
    }
    if (activeTab === "MISSION_WINDOWS" && !windowPlan) {
      twinApi.getMissionWindowPlan(stationId).then(setWindowPlan).catch(console.warn);
    }
  }, [activeTab, stationId, optimization, windowPlan]);

  // Handle Requisition Status Transitions (REQUESTED -> AUTHORITY_APPROVED -> PROCESSING -> IN_TRANSIT -> DELIVERED)
  const handleTransitionStatus = async (
    reqId: string,
    newStatus: "AUTHORITY_APPROVED" | "PROCESSING" | "IN_TRANSIT" | "DELIVERED" | "REJECTED"
  ) => {
    if (newStatus === "AUTHORITY_APPROVED" && !hasRole("ADMIN", "LOGISTICS")) {
      alert("Unauthorized: Only expedition logistics officers or administrators may grant authority approval.");
      return;
    }

    setIsSubmitting(true);
    setActionStatus(`Transitioning requisition ${reqId} to ${newStatus}...`);

    try {
      const updated = await twinApi.updateRequisitionStatus(stationId, reqId, newStatus);
      setRequisitions((prev) => prev.map((r) => (r.id === reqId ? updated : r)));

      // If DELIVERED, refresh live inventory and Twin state!
      if (newStatus === "DELIVERED") {
        const [updatedInv, updatedTx] = await Promise.all([
          twinApi.getInventory(stationId),
          twinApi.getInventoryTransactions(stationId),
        ]);
        setInventory(updatedInv);
        setTransactions(updatedTx);
        await refreshState();
        setActionStatus("✅ Cargo intake verified: Inventory updated atomically in PostgreSQL.");
      } else {
        setActionStatus(`✅ Requisition updated to ${newStatus}`);
      }

      setTimeout(() => setActionStatus(null), 2500);
    } catch (err) {
      setActionStatus(`❌ Failed to update status: ${(err as Error).message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateRequisition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqItemId || !reqQty) return;

    const selectedInvItem = inventory.find((i) => i.id === reqItemId);
    setIsSubmitting(true);

    try {
      const newReq = await twinApi.createCargoRequisition(stationId, {
        itemId: reqItemId,
        itemName: selectedInvItem?.name || reqItemId,
        category: selectedInvItem?.category || "GENERAL",
        requestedQuantity: Number(reqQty),
        unit: selectedInvItem?.unit || "Units",
        priority: reqPriority,
        reason: reqReason.trim() || "Station consumption replenish",
      });

      setRequisitions((prev) => [newReq, ...prev]);
      setShowNewReqModal(false);
      setReqQty("");
      setReqReason("");
      setActionStatus("✅ Cargo requisition submitted with REQUESTED status.");
      setTimeout(() => setActionStatus(null), 2500);
    } catch (err) {
      alert(`Failed to create requisition: ${(err as Error).message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Primary Metrics
  const fuelItem = inventory.find((i) => i.category === "FUEL");
  const waterItem = inventory.find((i) => i.category === "WATER" || i.category === "WATER_SYSTEM");

  const criticalStockCount = inventory.filter((i) => i.stockStatus === "CRITICAL").length;
  const pendingApprovalCount = requisitions.filter((r) => r.status === "REQUESTED").length;

  return (
    <div className="app-content">
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
              LOGISTICS • DATABASE-BACKED POLAR RESUPPLY
            </span>
          </div>
          <h1 className="page-header__title">
            {isMaitri ? "Maitri" : "Bharati"} Consumables & Cargo Operations
          </h1>
          <p className="page-header__subtitle">
            Durable inventory ledgers, cargo requisition lifecycle, greedy resupply optimization, and mission window planning.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            className="button button--primary"
            style={{ fontSize: "0.8rem" }}
            onClick={() => setShowNewReqModal(true)}
          >
            + Create Resupply Requisition
          </button>
        </div>
      </header>

      {/* KPI Tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "1.25rem" }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "1rem", borderRadius: "6px" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>POLAR DIESEL AUTONOMY</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text)", marginTop: "0.2rem" }}>
            {fuelItem ? `${fuelItem.daysRemaining} Days` : "66 Days"}
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
            Current Stock: <strong>{fuelItem ? Number(fuelItem.quantity).toLocaleString() : "45,000"} L</strong>
          </div>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "1rem", borderRadius: "6px" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>POTABLE WATER BUFFER</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text)", marginTop: "0.2rem" }}>
            {waterItem ? `${waterItem.daysRemaining} Days` : "14 Days"}
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
            Current Stock: <strong>{waterItem ? Number(waterItem.quantity).toLocaleString() : "16,500"} L</strong>
          </div>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderLeft: criticalStockCount > 0 ? "4px solid var(--critical)" : "4px solid var(--green)", padding: "1rem", borderRadius: "6px" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>CRITICAL STOCK DEFICITS</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, color: criticalStockCount > 0 ? "var(--critical)" : "var(--green)", marginTop: "0.2rem" }}>
            {criticalStockCount}
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>Below winter minimum reserve threshold</div>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderLeft: pendingApprovalCount > 0 ? "4px solid var(--warning)" : "4px solid var(--border)", padding: "1rem", borderRadius: "6px" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>PENDING REQUISITIONS</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, color: pendingApprovalCount > 0 ? "var(--warning)" : "var(--text)", marginTop: "0.2rem" }}>
            {pendingApprovalCount}
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>Awaiting logistics authority approval</div>
        </div>
      </div>

      {actionStatus && (
        <div
          style={{
            padding: "0.6rem 1rem",
            background: "rgba(11, 74, 53, 0.08)",
            border: "1px solid var(--green)",
            borderRadius: "6px",
            fontSize: "0.8rem",
            fontWeight: 600,
            marginBottom: "1rem",
            color: "var(--green)",
          }}
        >
          {actionStatus}
        </div>
      )}

      {/* Logistics Subsystem Navigation Tabs */}
      <div
        style={{
          display: "flex",
          gap: "0.4rem",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          padding: "0.4rem 0.6rem",
          borderRadius: "6px",
          marginBottom: "1.25rem",
        }}
      >
        <button
          type="button"
          className={`button ${activeTab === "INVENTORY" ? "button--primary" : "button--ghost"}`}
          style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem" }}
          onClick={() => setActiveTab("INVENTORY")}
        >
          📦 Database Inventory Ledger
        </button>
        <button
          type="button"
          className={`button ${activeTab === "REQUISITIONS" ? "button--primary" : "button--ghost"}`}
          style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem" }}
          onClick={() => setActiveTab("REQUISITIONS")}
        >
          📝 Requisitions & Cargo Manifest ({requisitions.length})
        </button>
        <button
          type="button"
          className={`button ${activeTab === "OPTIMIZER" ? "button--primary" : "button--ghost"}`}
          style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem" }}
          onClick={() => setActiveTab("OPTIMIZER")}
        >
          ⚙️ Resupply Optimizer (Section 11)
        </button>
        <button
          type="button"
          className={`button ${activeTab === "MISSION_WINDOWS" ? "button--primary" : "button--ghost"}`}
          style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem" }}
          onClick={() => setActiveTab("MISSION_WINDOWS")}
        >
          🧭 Mission Window Planner (Section 12)
        </button>
        <button
          type="button"
          className={`button ${activeTab === "TRANSACTIONS" ? "button--primary" : "button--ghost"}`}
          style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem" }}
          onClick={() => setActiveTab("TRANSACTIONS")}
        >
          📑 Audit History Ledgers
        </button>
      </div>

      {/* ── TAB 1: INVENTORY TABLE ─────────────────────────────────── */}
      {activeTab === "INVENTORY" && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", overflow: "hidden" }}>
          <div style={{ padding: "0.75rem 1rem", background: "var(--surface-soft)", borderBottom: "1px solid var(--border)", fontSize: "0.85rem", fontWeight: 700, display: "flex", justifyContent: "space-between" }}>
            <span>ACTIVE CONSUMABLES LEDGER ({inventory.length} ITEMS)</span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>
              Persisted in PostgreSQL • Atomic Transactions
            </span>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "var(--surface-soft)", borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}>
                <th style={{ padding: "0.75rem 1rem" }}>Consumable Item</th>
                <th style={{ padding: "0.75rem 1rem" }}>Category</th>
                <th style={{ padding: "0.75rem 1rem" }}>Current Stock</th>
                <th style={{ padding: "0.75rem 1rem" }}>Daily Burn</th>
                <th style={{ padding: "0.75rem 1rem" }}>Runway Coverage</th>
                <th style={{ padding: "0.75rem 1rem" }}>Minimum Floor</th>
                <th style={{ padding: "0.75rem 1rem" }}>Lead Time</th>
                <th style={{ padding: "0.75rem 1rem" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {inventory.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                    {loading ? "Loading inventory ledgers..." : "No inventory records found."}
                  </td>
                </tr>
              ) : (
                inventory.map((item) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <div style={{ fontWeight: 600, color: "var(--text)" }}>{item.name}</div>
                      <div style={{ fontSize: "0.65rem", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                        ID: {item.id}
                      </div>
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <span className="badge badge--info" style={{ fontSize: "0.65rem" }}>{item.category}</span>
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <span style={{ fontWeight: 700, fontFamily: "var(--font-mono)" }}>
                        {Number(item.quantity).toLocaleString()}
                      </span>{" "}
                      <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>{item.unit}</span>
                    </td>
                    <td style={{ padding: "0.75rem 1rem", fontFamily: "var(--font-mono)" }}>
                      {item.averageDailyConsumption} {item.unit}/day
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <span
                        style={{
                          fontWeight: 700,
                          color: item.daysRemaining < 30 ? "var(--critical)" : item.daysRemaining < 60 ? "var(--warning)" : "var(--green)",
                        }}
                      >
                        {item.daysRemaining} Days
                      </span>
                    </td>
                    <td style={{ padding: "0.75rem 1rem", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                      {Number(item.minimumThreshold).toLocaleString()} {item.unit}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {item.leadTimeDays} Days
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <span
                        className={`badge ${
                          item.stockStatus === "CRITICAL"
                            ? "badge--critical"
                            : item.stockStatus === "LOW"
                            ? "badge--warning"
                            : "badge--operational"
                        }`}
                        style={{ fontSize: "0.65rem" }}
                      >
                        {item.stockStatus}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TAB 2: REQUISITIONS & CARGO MANIFEST ─────────────────────── */}
      {activeTab === "REQUISITIONS" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Incoming Cargo Sortie Overview */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "1rem" }}>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.75rem", color: "var(--text)" }}>
              🚢 Incoming Polar Cargo Missions ({missions.length})
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
              {missions.map((m) => (
                <div
                  key={m.id}
                  style={{
                    background: "var(--surface-soft)",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    padding: "0.85rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                    <span style={{ fontWeight: 700, color: "var(--text)" }}>{m.code || m.missionCode || m.id}</span>
                    <span className="badge badge--info" style={{ fontSize: "0.65rem" }}>{m.status}</span>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.4rem" }}>
                    Vessel/Carrier: <strong>{m.vesselOrAircraft || m.vesselOrFlight || "Transport"}</strong> ({m.transportMode || "SEA"})
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem", fontSize: "0.7rem" }}>
                    <div>ETA: <strong>{new Date(m.eta).toLocaleDateString()}</strong></div>
                    <div>Confidence: <strong>{Math.round((m.etaConfidencePct ?? ((m.etaConfidence || 0.8) * 100)))}%</strong></div>
                    <div>Capacity: <strong>{Number(m.maxPayloadKg || m.capacityKg || 25000).toLocaleString()} kg</strong></div>
                    <div>Weather Risk: <strong>{typeof m.weatherRisk === "string" ? m.weatherRisk : `${Math.round(((m.weatherRiskIndex as any) || 0.3) * 100)}%`}</strong></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Requisitions Lifecycle Queue */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", overflow: "hidden" }}>
            <div style={{ padding: "0.75rem 1rem", background: "var(--surface-soft)", borderBottom: "1px solid var(--border)", fontSize: "0.85rem", fontWeight: 700 }}>
              REQUISITION WORKFLOW & APPROVAL QUEUE
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "var(--surface-soft)", borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}>
                  <th style={{ padding: "0.75rem 1rem" }}>Requisition ID / Item</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Quantity</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Priority</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Lifecycle Status</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Requested By</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Authorized By</th>
                  <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>Workflow Action</th>
                </tr>
              </thead>
              <tbody>
                {requisitions.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                      No requisitions found. Click "+ Create Resupply Requisition" above to order supplies.
                    </td>
                  </tr>
                ) : (
                  requisitions.map((req) => (
                    <tr key={req.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <div style={{ fontWeight: 600, color: "var(--text)" }}>{req.itemName}</div>
                        <div style={{ fontSize: "0.65rem", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                          {req.id}
                        </div>
                      </td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <span style={{ fontWeight: 700, fontFamily: "var(--font-mono)" }}>
                          {Number(req.requestedQuantity).toLocaleString()}
                        </span>{" "}
                        {req.unit}
                      </td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <span
                          className={`badge ${
                            req.priority === "CRITICAL"
                              ? "badge--critical"
                              : req.priority === "HIGH"
                              ? "badge--warning"
                              : "badge--info"
                          }`}
                          style={{ fontSize: "0.65rem" }}
                        >
                          {req.priority}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: "0.75rem",
                            color:
                              req.status === "DELIVERED"
                                ? "var(--green)"
                                : req.status === "IN_TRANSIT"
                                ? "#0284c7"
                                : req.status === "AUTHORITY_APPROVED"
                                ? "#3b82f6"
                                : req.status === "PROCESSING"
                                ? "#8b5cf6"
                                : "var(--warning)",
                          }}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem 1rem", fontSize: "0.75rem" }}>{req.requestedBy}</td>
                      <td style={{ padding: "0.75rem 1rem", fontSize: "0.75rem" }}>{req.approvedBy || "—"}</td>
                      <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                        {req.status === "REQUESTED" && (
                          <div style={{ display: "inline-flex", gap: "0.3rem" }}>
                            <button
                              type="button"
                              className="button button--primary"
                              style={{ padding: "0.25rem 0.55rem", fontSize: "0.7rem" }}
                              onClick={() => handleTransitionStatus(req.id, "AUTHORITY_APPROVED")}
                              disabled={isSubmitting}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="button button--ghost"
                              style={{ padding: "0.25rem 0.55rem", fontSize: "0.7rem" }}
                              onClick={() => handleTransitionStatus(req.id, "REJECTED")}
                              disabled={isSubmitting}
                            >
                              Reject
                            </button>
                          </div>
                        )}

                        {req.status === "AUTHORITY_APPROVED" && (
                          <button
                            type="button"
                            className="button button--ghost"
                            style={{ padding: "0.25rem 0.55rem", fontSize: "0.7rem", border: "1px solid var(--border)" }}
                            onClick={() => handleTransitionStatus(req.id, "PROCESSING")}
                            disabled={isSubmitting}
                          >
                            Mark Processing →
                          </button>
                        )}

                        {req.status === "PROCESSING" && (
                          <button
                            type="button"
                            className="button button--ghost"
                            style={{ padding: "0.25rem 0.55rem", fontSize: "0.7rem", border: "1px solid var(--border)" }}
                            onClick={() => handleTransitionStatus(req.id, "IN_TRANSIT")}
                            disabled={isSubmitting}
                          >
                            Load & Transit →
                          </button>
                        )}

                        {req.status === "IN_TRANSIT" && (
                          <button
                            type="button"
                            className="button button--primary"
                            style={{ padding: "0.25rem 0.55rem", fontSize: "0.7rem", background: "var(--green)" }}
                            onClick={() => handleTransitionStatus(req.id, "DELIVERED")}
                            disabled={isSubmitting}
                            title="Complete delivery intake and atomically increment inventory quantity"
                          >
                            ✓ Receive Delivery
                          </button>
                        )}

                        {req.status === "DELIVERED" && (
                          <span style={{ fontSize: "0.7rem", color: "var(--green)", fontWeight: 600 }}>
                            Intake Complete
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: RESUPPLY OPTIMIZER (Section 11) ───────────────────── */}
      {activeTab === "OPTIMIZER" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {optimization ? (
            <>
              {/* Optimizer Summary Card */}
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "1.25rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                  <div>
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--green)", textTransform: "uppercase" }}>
                      DETERMINISTIC HEURISTIC OPTIMIZATION • KNAPSACK MODEL
                    </span>
                    <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0.25rem 0", color: "var(--text)" }}>
                      Optimal Cargo Allocation for Mission {optimization.missionCode || optimization.missionId || "PRIMARY"}
                    </h2>
                  </div>
                  <span className="badge badge--operational" style={{ fontSize: "0.75rem" }}>
                    Payload Utilization: {optimization.payloadUtilizationPct}%
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", fontSize: "0.8rem", marginBottom: "1rem" }}>
                  <div>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>TOTAL ALLOCATED WEIGHT</span>
                    <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>
                      {(optimization.totalAllocatedWeightKg ?? optimization.totalPayloadKg ?? 0).toLocaleString()} kg
                    </div>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>MAX PAYLOAD CEILING</span>
                    <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>
                      {(optimization.maxPayloadKg ?? optimization.maxPayloadCapacityKg ?? 0).toLocaleString()} kg
                    </div>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>POST-DELIVERY COVERAGE</span>
                    <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--green)" }}>
                      {optimization.expectedMeanCoverageDays ?? 90} Mean Days
                    </div>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>RECOMMENDED SAFETY BUFFER</span>
                    <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>
                      {optimization.recommendedSafetyBufferDays ?? optimization.winterSurvivalBufferDays ?? 30} Days
                    </div>
                  </div>
                </div>

                {/* Assumptions Inspector */}
                <div style={{ background: "var(--surface-soft)", padding: "0.75rem", borderRadius: "6px", fontSize: "0.75rem" }}>
                  <div style={{ fontWeight: 700, marginBottom: "0.3rem" }}>📋 Explicit Optimization Assumptions:</div>
                  <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                    {(optimization.assumptions || []).map((asm: string, idx: number) => (
                      <li key={idx}>{asm}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Recommended Cargo Manifest Table */}
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", overflow: "hidden" }}>
                <div style={{ padding: "0.75rem 1rem", background: "var(--surface-soft)", borderBottom: "1px solid var(--border)", fontSize: "0.85rem", fontWeight: 700 }}>
                  RECOMMENDED ITEMS TO LOAD & POST-DELIVERY AUTONOMY
                </div>

                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "var(--surface-soft)", borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}>
                      <th style={{ padding: "0.75rem 1rem" }}>Item Name</th>
                      <th style={{ padding: "0.75rem 1rem" }}>Category</th>
                      <th style={{ padding: "0.75rem 1rem" }}>Allocated Quantity</th>
                      <th style={{ padding: "0.75rem 1rem" }}>Weight (kg)</th>
                      <th style={{ padding: "0.75rem 1rem" }}>Priority</th>
                      <th style={{ padding: "0.75rem 1rem" }}>Post-Delivery Coverage</th>
                      <th style={{ padding: "0.75rem 1rem" }}>Engineering Rationale</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(optimization.itemsToLoad || optimization.items || []).map((item: any) => (
                      <tr key={item.itemId} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>{item.itemName || item.name}</td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <span className="badge badge--info" style={{ fontSize: "0.65rem" }}>{item.category}</span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem", fontWeight: 700, fontFamily: "var(--font-mono)" }}>
                          {Number(item.allocatedQuantity ?? item.recommendedLoadQuantity ?? 0).toLocaleString()} {item.unit}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", fontFamily: "var(--font-mono)" }}>
                          {Number(item.estimatedWeightKg ?? item.allocationWeightKg ?? 0).toLocaleString()} kg
                        </td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <span
                            className={`badge ${
                              (item.priority || item.urgency) === "CRITICAL"
                                ? "badge--critical"
                                : (item.priority || item.urgency) === "HIGH"
                                ? "badge--warning"
                                : "badge--info"
                            }`}
                            style={{ fontSize: "0.65rem" }}
                          >
                            {item.priority || item.urgency}
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem", fontWeight: 700, color: "var(--green)" }}>
                          {item.expectedPostDeliveryCoverageDays} Days
                        </td>
                        <td style={{ padding: "0.75rem 1rem", fontSize: "0.75rem", color: "var(--text-muted)", maxWidth: "260px" }}>
                          {item.rationale}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
              Running cargo allocation optimization model...
            </div>
          )}
        </div>
      )}

      {/* ── TAB 4: MISSION WINDOW PLANNER (Section 12) ────────────────── */}
      {activeTab === "MISSION_WINDOWS" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {windowPlan ? (
            <>
              {/* Window Planner Header */}
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "1.25rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                  <div>
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--green)", textTransform: "uppercase" }}>
                      ENVIRONMENTAL CONSTRAINTS & METEOROLOGICAL WINDOWING
                    </span>
                    <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0.25rem 0", color: "var(--text)" }}>
                      Computed Mission & Resupply Windows
                    </h2>
                  </div>
                  <span
                    style={{
                      fontSize: "0.65rem",
                      fontWeight: 700,
                      background: "rgba(11, 74, 53, 0.08)",
                      color: "var(--green)",
                      padding: "4px 8px",
                      borderRadius: "4px",
                    }}
                  >
                    {windowPlan.label}
                  </span>
                </div>

                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                  Overall Flight Corridor Assessment:{" "}
                  <strong style={{ color: (windowPlan.overallRiskAssessment || "LOW") === "LOW" ? "var(--green)" : "var(--warning)" }}>
                    {windowPlan.overallRiskAssessment || "LOW"} RISK
                  </strong>
                </div>

                <div style={{ background: "var(--surface-soft)", padding: "0.75rem", borderRadius: "6px", fontSize: "0.75rem" }}>
                  <div style={{ fontWeight: 700, marginBottom: "0.2rem" }}>Assumptions & Limitations:</div>
                  <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                    {(windowPlan.assumptions || []).map((a: string, i: number) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Proposed Windows Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1rem" }}>
                {(windowPlan.proposedWindows || []).map((win: any) => {
                  const isOpt = win.riskBand === "OPTIMAL";
                  const isFav = win.riskBand === "FAVORABLE";
                  const borderCol = isOpt ? "var(--green)" : isFav ? "#3b82f6" : "var(--warning)";

                  return (
                    <div
                      key={win.id}
                      style={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderLeft: `4px solid ${borderCol}`,
                        borderRadius: "8px",
                        padding: "1.25rem",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                        <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text)" }}>
                          {win.vehicleDesignator}
                        </span>
                        <span
                          className={`badge ${isOpt ? "badge--operational" : isFav ? "badge--info" : "badge--warning"}`}
                          style={{ fontSize: "0.65rem" }}
                        >
                          {win.riskBand} ({win.confidenceScore}%)
                        </span>
                      </div>

                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.6rem" }}>
                        Corridor: <strong>{new Date(win.windowStart).toLocaleDateString()}</strong> →{" "}
                        <strong>{new Date(win.windowEnd).toLocaleDateString()}</strong>
                      </div>

                      <div style={{ fontSize: "0.75rem", marginBottom: "0.6rem" }}>
                        <div style={{ color: "var(--text-muted)", fontSize: "0.7rem", fontWeight: 600 }}>
                          ENVIRONMENTAL CONSTRAINTS:
                        </div>
                        <ul style={{ margin: "0.2rem 0 0", paddingLeft: "1.1rem", color: "var(--text)", lineHeight: 1.4 }}>
                          {(win.environmentalConstraints || []).map((c: string, i: number) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                      </div>

                      <div
                        style={{
                          background: "var(--surface-soft)",
                          padding: "0.5rem 0.75rem",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          marginTop: "0.6rem",
                        }}
                      >
                        <span style={{ color: "var(--text-muted)" }}>Tactical Advisory: </span>
                        <strong>{win.tacticalAdvisory}</strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
              Computing meteorological mission windows...
            </div>
          )}
        </div>
      )}

      {/* ── TAB 5: INVENTORY TRANSACTION HISTORY ──────────────────────── */}
      {activeTab === "TRANSACTIONS" && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", overflow: "hidden" }}>
          <div style={{ padding: "0.75rem 1rem", background: "var(--surface-soft)", borderBottom: "1px solid var(--border)", fontSize: "0.85rem", fontWeight: 700 }}>
            INVENTORY INTAKE & CONSUMPTION AUDIT TRAIL ({transactions.length} EVENTS)
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "var(--surface-soft)", borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}>
                <th style={{ padding: "0.75rem 1rem" }}>Timestamp</th>
                <th style={{ padding: "0.75rem 1rem" }}>Transaction ID</th>
                <th style={{ padding: "0.75rem 1rem" }}>Type</th>
                <th style={{ padding: "0.75rem 1rem" }}>Item ID</th>
                <th style={{ padding: "0.75rem 1rem" }}>Quantity Delta</th>
                <th style={{ padding: "0.75rem 1rem" }}>Balance After</th>
                <th style={{ padding: "0.75rem 1rem" }}>Recorded By</th>
                <th style={{ padding: "0.75rem 1rem" }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                    No recorded transactions yet.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.75rem 1rem", fontSize: "0.75rem" }}>
                      {new Date(tx.createdAt).toLocaleString()}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", fontFamily: "var(--font-mono)", fontSize: "0.7rem" }}>
                      {tx.id}
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <span className="badge badge--info" style={{ fontSize: "0.65rem" }}>
                        {tx.transactionType}
                      </span>
                    </td>
                    <td style={{ padding: "0.75rem 1rem", fontFamily: "var(--font-mono)" }}>{tx.itemId}</td>
                    <td style={{ padding: "0.75rem 1rem", fontWeight: 700, color: tx.quantity > 0 ? "var(--green)" : "var(--critical)" }}>
                      {tx.quantity > 0 ? `+${tx.quantity}` : tx.quantity}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>{Number(tx.balanceAfter).toLocaleString()}</td>
                    <td style={{ padding: "0.75rem 1rem", fontSize: "0.75rem" }}>{tx.operatorId}</td>
                    <td style={{ padding: "0.75rem 1rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>{tx.notes}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* New Requisition Modal */}
      {showNewReqModal && (
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
              maxWidth: "500px",
              width: "100%",
              padding: "1.5rem",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem", color: "var(--text)" }}>
                📝 Create Resupply Requisition
              </h3>
              <button
                type="button"
                style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer" }}
                onClick={() => setShowNewReqModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRequisition}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Select Target Consumable
                </label>
                <select
                  value={reqItemId}
                  onChange={(e) => setReqItemId(e.target.value)}
                  className="select-control"
                  style={{ width: "100%", padding: "0.5rem" }}
                  required
                >
                  {inventory.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.quantity} {i.unit} in stock)
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                    Requested Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={reqQty}
                    onChange={(e) => setReqQty(e.target.value)}
                    placeholder="e.g. 5000"
                    style={{ width: "100%", padding: "0.45rem", border: "1px solid var(--border)", borderRadius: "4px" }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                    Operational Priority
                  </label>
                  <select
                    value={reqPriority}
                    onChange={(e) => setReqPriority(e.target.value as CargoRequisitionPriority)}
                    className="select-control"
                    style={{ width: "100%", padding: "0.45rem" }}
                  >
                    <option value="ROUTINE">Routine</option>
                    <option value="MEDIUM">Medium (Normal)</option>
                    <option value="HIGH">High (Depletion Risk)</option>
                    <option value="CRITICAL">Critical (Immediate Sortie)</option>
                    <option value="EMERGENCY">Emergency (Life Support)</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: "1.25rem" }}>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Operational Justification
                </label>
                <textarea
                  rows={2}
                  value={reqReason}
                  onChange={(e) => setReqReason(e.target.value)}
                  placeholder="Winter lock-in buffer restoration..."
                  style={{ width: "100%", padding: "0.45rem", border: "1px solid var(--border)", borderRadius: "4px", fontSize: "0.8rem" }}
                  required
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => setShowNewReqModal(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button--primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Submitting..." : "Submit Requisition →"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
