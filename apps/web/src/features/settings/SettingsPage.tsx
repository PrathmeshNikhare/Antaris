import React, { useState, useEffect, useCallback } from "react";
import { useStation } from "../../hooks/useStation";
import { useAuth } from "../../context/AuthContext";
import { twinApi } from "../../services/api";
import type { StationThreshold } from "@maitri-bharati/shared";

export function SettingsPage(): React.JSX.Element {
  const { stationId } = useStation();
  const { user, hasRole } = useAuth();

  const [thresholds, setThresholds] = useState<StationThreshold[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [editingThreshold, setEditingThreshold] = useState<StationThreshold | null>(null);
  const [warnLow, setWarnLow] = useState<string>("");
  const [warnHigh, setWarnHigh] = useState<string>("");
  const [critLow, setCritLow] = useState<string>("");
  const [critHigh, setCritHigh] = useState<string>("");
  const [comment, setComment] = useState<string>("");
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const isMaitri = stationId === "station-maitri";

  const fetchThresholds = useCallback(async () => {
    try {
      const data = await twinApi.getStationThresholds(stationId);
      setThresholds(data);
    } catch (err) {
      console.warn("Failed to load thresholds:", err);
    } finally {
      setLoading(false);
    }
  }, [stationId]);

  useEffect(() => {
    void fetchThresholds();
  }, [fetchThresholds]);

  const openEditModal = (t: StationThreshold) => {
    setEditingThreshold(t);
    setWarnLow(t.warningThresholdLow !== undefined && t.warningThresholdLow !== null ? String(t.warningThresholdLow) : "");
    setWarnHigh(t.warningThresholdHigh !== undefined && t.warningThresholdHigh !== null ? String(t.warningThresholdHigh) : "");
    setCritLow(t.criticalThresholdLow !== undefined && t.criticalThresholdLow !== null ? String(t.criticalThresholdLow) : "");
    setCritHigh(t.criticalThresholdHigh !== undefined && t.criticalThresholdHigh !== null ? String(t.criticalThresholdHigh) : "");
    setComment(t.comment || "");
    setSaveStatus(null);
  };

  const handleSaveThreshold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingThreshold) return;

    if (!hasRole("ADMIN", "ENGINEER")) {
      alert("Unauthorized: Only expedition administrators and lead station engineers may adjust physical threshold parameters.");
      return;
    }

    setIsSaving(true);
    setSaveStatus(null);

    try {
      const updated = await twinApi.updateStationThreshold(stationId, {
        metric: editingThreshold.metric,
        warningLow: warnLow !== "" ? Number(warnLow) : undefined,
        warningHigh: warnHigh !== "" ? Number(warnHigh) : undefined,
        criticalLow: critLow !== "" ? Number(critLow) : undefined,
        criticalHigh: critHigh !== "" ? Number(critHigh) : undefined,
        comment: comment.trim() || undefined,
      });

      setThresholds((prev) =>
        prev.map((t) => (t.metric === updated.metric ? updated : t))
      );
      setSaveStatus("✅ Threshold updated and recorded in station security audit log.");
      setTimeout(() => {
        setEditingThreshold(null);
        setSaveStatus(null);
      }, 1200);
    } catch (err) {
      setSaveStatus(`❌ Failed to update threshold: ${(err as Error).message}`);
    } finally {
      setIsSaving(false);
    }
  };

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
              CONFIGURATION • SAFETY & SENSOR THRESHOLDS
            </span>
          </div>
          <h1 className="page-header__title">
            {isMaitri ? "Maitri Station" : "Bharati Station"} Mission Settings
          </h1>
          <p className="page-header__subtitle">
            Configure station telemetry thresholds, geographical parameters, and life-support safety boundaries.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            Operator: <strong>{user?.username}</strong> [{user?.role}]
          </span>
        </div>
      </header>

      {/* Station Geolocation & Identity Card */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "1.25rem",
          marginBottom: "1.25rem",
        }}
      >
        <div style={{ fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.75rem", color: "var(--text)" }}>
          📍 Station Operational Identity & Coordinates
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", fontSize: "0.8rem" }}>
          <div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>STATION CODE</div>
            <div style={{ fontWeight: 700, marginTop: "0.2rem" }}>{isMaitri ? "IND-MAITRI-01" : "IND-BHARATI-02"}</div>
          </div>
          <div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>POLAR COORDINATES</div>
            <div style={{ fontWeight: 700, marginTop: "0.2rem" }}>
              {isMaitri ? "70°45′58″ S, 11°43′56″ E" : "69°24′28″ S, 76°11′14″ E"}
            </div>
          </div>
          <div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>GEOGRAPHIC CONTEXT</div>
            <div style={{ fontWeight: 700, marginTop: "0.2rem" }}>
              {isMaitri ? "Schirmacher Oasis (Moraine Ridge)" : "Larsemann Hills (Coastal Promontory)"}
            </div>
          </div>
          <div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>ELEVATION ABOVE SEA LEVEL</div>
            <div style={{ fontWeight: 700, marginTop: "0.2rem" }}>{isMaitri ? "117 m MSL" : "35 m MSL"}</div>
          </div>
        </div>
      </div>

      {/* Station-Specific Thresholds Table */}
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
            fontSize: "0.85rem",
            fontWeight: 700,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>PHYSICAL SENSOR THRESHOLDS & ALARM CEILINGS</span>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>
            {hasRole("ADMIN", "ENGINEER") ? "✏️ Click row to modify safety limits" : "🔒 Read-only view (Engineer/Admin role required to edit)"}
          </span>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", textAlign: "left" }}>
          <thead>
            <tr style={{ background: "var(--surface-soft)", borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}>
              <th style={{ padding: "0.75rem 1rem" }}>Monitored Metric</th>
              <th style={{ padding: "0.75rem 1rem" }}>Warning Low</th>
              <th style={{ padding: "0.75rem 1rem" }}>Warning High</th>
              <th style={{ padding: "0.75rem 1rem" }}>Critical Low</th>
              <th style={{ padding: "0.75rem 1rem" }}>Critical High</th>
              <th style={{ padding: "0.75rem 1rem" }}>Engineering Rationale / Comment</th>
              <th style={{ padding: "0.75rem 1rem" }}>Last Modified By</th>
              <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                  Loading station thresholds...
                </td>
              </tr>
            ) : thresholds.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                  No configured thresholds found for this station.
                </td>
              </tr>
            ) : (
              thresholds.map((t) => (
                <tr
                  key={t.id}
                  style={{
                    borderBottom: "1px solid var(--border)",
                    cursor: hasRole("ADMIN", "ENGINEER") ? "pointer" : "default",
                  }}
                  onClick={() => hasRole("ADMIN", "ENGINEER") && openEditModal(t)}
                >
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <div style={{ fontWeight: 700, color: "var(--text)", fontFamily: "var(--font-mono)" }}>
                      {t.metric}
                    </div>
                  </td>
                  <td style={{ padding: "0.75rem 1rem", fontFamily: "var(--font-mono)" }}>
                    {t.warningThresholdLow ?? "—"}
                  </td>
                  <td style={{ padding: "0.75rem 1rem", fontFamily: "var(--font-mono)" }}>
                    {t.warningThresholdHigh ?? "—"}
                  </td>
                  <td style={{ padding: "0.75rem 1rem", fontFamily: "var(--font-mono)", color: "var(--critical)" }}>
                    {t.criticalThresholdLow ?? "—"}
                  </td>
                  <td style={{ padding: "0.75rem 1rem", fontFamily: "var(--font-mono)", color: "var(--critical)" }}>
                    {t.criticalThresholdHigh ?? "—"}
                  </td>
                  <td style={{ padding: "0.75rem 1rem", color: "var(--text-muted)", fontSize: "0.75rem", maxWidth: "260px" }}>
                    {t.comment || "Manufacturer specification"}
                  </td>
                  <td style={{ padding: "0.75rem 1rem", fontSize: "0.75rem" }}>
                    <strong>{t.updatedBy}</strong>
                    <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>
                      {new Date(t.updatedAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                    {hasRole("ADMIN", "ENGINEER") && (
                      <button
                        type="button"
                        className="button button--ghost"
                        style={{ padding: "0.25rem 0.5rem", fontSize: "0.7rem", border: "1px solid var(--border)" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(t);
                        }}
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Threshold Modal */}
      {editingThreshold && (
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
              <div>
                <span style={{ fontSize: "0.7rem", color: "var(--green)", fontWeight: 700, textTransform: "uppercase" }}>
                  TRANSACTIONAL UPDATE
                </span>
                <h3 style={{ margin: "0.2rem 0 0", fontSize: "1.1rem", color: "var(--text)" }}>
                  Configure {editingThreshold.metric}
                </h3>
              </div>
              <button
                type="button"
                style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer" }}
                onClick={() => setEditingThreshold(null)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveThreshold}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                    Warning Threshold Low
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={warnLow}
                    onChange={(e) => setWarnLow(e.target.value)}
                    style={{ width: "100%", padding: "0.4rem 0.6rem", border: "1px solid var(--border)", borderRadius: "4px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                    Warning Threshold High
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={warnHigh}
                    onChange={(e) => setWarnHigh(e.target.value)}
                    style={{ width: "100%", padding: "0.4rem 0.6rem", border: "1px solid var(--border)", borderRadius: "4px" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.25rem", color: "var(--critical)" }}>
                    Critical Threshold Low
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={critLow}
                    onChange={(e) => setCritLow(e.target.value)}
                    style={{ width: "100%", padding: "0.4rem 0.6rem", border: "1px solid var(--border)", borderRadius: "4px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.25rem", color: "var(--critical)" }}>
                    Critical Threshold High
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={critHigh}
                    onChange={(e) => setCritHigh(e.target.value)}
                    style={{ width: "100%", padding: "0.4rem 0.6rem", border: "1px solid var(--border)", borderRadius: "4px" }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "1.25rem" }}>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                  Engineering Rationale / Audit Comment
                </label>
                <textarea
                  rows={2}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Reason for safety ceiling adjustment..."
                  style={{ width: "100%", padding: "0.4rem 0.6rem", border: "1px solid var(--border)", borderRadius: "4px", fontSize: "0.8rem" }}
                  required
                />
              </div>

              {saveStatus && (
                <div style={{ marginBottom: "1rem", fontSize: "0.8rem", fontWeight: 600 }}>
                  {saveStatus}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => setEditingThreshold(null)}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button--primary"
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Commit Threshold Update →"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
