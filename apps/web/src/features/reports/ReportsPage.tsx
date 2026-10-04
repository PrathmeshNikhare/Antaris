import React, { useState, useEffect } from "react";
import { useStation } from "../../hooks/useStation";
import { twinApi } from "../../services/api";
import type { TwinState, StationIntelligenceSummary, MissionResilienceIndex } from "@maitri-bharati/shared";

type ReportDomain = "ALL" | "ENERGY" | "ENVIRONMENT" | "INFRASTRUCTURE" | "LOGISTICS" | "INCIDENTS" | "INTELLIGENCE";
type TimeRange = "24h" | "7d" | "30d" | "SEASON";

export function ReportsPage(): React.JSX.Element {
  const { stationId } = useStation();
  const stationCode = stationId === "station-maitri" ? "MAITRI" : "BHARATI";

  const [activeDomain, setActiveDomain] = useState<ReportDomain>("ALL");
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");
  const [twinState, setTwinState] = useState<TwinState | null>(null);
  const [intelligence, setIntelligence] = useState<StationIntelligenceSummary | null>(null);
  const [resilience, setResilience] = useState<MissionResilienceIndex | null>(null);
  const [snapshot, setSnapshot] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const stationName = stationId === "station-maitri" ? "Maitri Research Station" : "Bharati Station";
  const now = new Date();

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    Promise.all([
      twinApi.getTwinState(stationId),
      twinApi.getIntelligence(stationId),
      twinApi.getResilienceIndex(stationId),
    ])
      .then(([tw, intel, res]) => {
        if (isMounted) {
          setTwinState(tw);
          setIntelligence(intel);
          setResilience(res);
        }
      })
      .catch((err) => console.warn("Failed to load report data:", err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [stationId]);

  const handleCaptureSnapshot = async () => {
    setLoading(true);
    try {
      const data = await twinApi.createSnapshot(stationId);
      setSnapshot(data);
      alert("✅ Immutable Point-in-Time Snapshot captured and persisted!");
    } catch (err) {
      alert(`Snapshot failed: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintPdf = () => {
    window.print();
  };

  const handleExportCsv = () => {
    if (!twinState) return;

    const rows: string[][] = [
      ["Metric Domain", "Identifier", "Status", "Value", "Unit", "Provenance", "Timestamp"],
      ["ENERGY", "Total Generation", twinState.energy.gridStatus, String(twinState.energy.totalGenerationKw), "kW", "SIMULATED", now.toISOString()],
      ["ENERGY", "Total Load", twinState.energy.gridStatus, String(twinState.energy.totalLoadKw), "kW", "SIMULATED", now.toISOString()],
      ["ENERGY", "Net Power", twinState.energy.gridStatus, String(twinState.energy.netPowerKw), "kW", "COMPUTED", now.toISOString()],
      ["ENERGY", "Battery SOC", twinState.energy.batterySocPct > 50 ? "NOMINAL" : "LOW", String(twinState.energy.batterySocPct), "%", "SIMULATED", now.toISOString()],
      ["ENVIRONMENT", "Ambient Temperature", twinState.environment.condition, String(twinState.environment.ambientTempC), "°C", "SIMULATED", now.toISOString()],
      ["ENVIRONMENT", "Wind Speed", twinState.environment.condition, String(twinState.environment.windSpeedMs), "m/s", "SIMULATED", now.toISOString()],
      ["LOGISTICS", "Fuel Runway", twinState.logistics.daysOfFuelRemaining > 45 ? "SECURE" : "WARNING", String(twinState.logistics.daysOfFuelRemaining), "days", "COMPUTED", now.toISOString()],
      ["LOGISTICS", "Water Buffer", twinState.logistics.daysOfWaterRemaining > 15 ? "SECURE" : "WARNING", String(twinState.logistics.daysOfWaterRemaining), "days", "COMPUTED", now.toISOString()],
      ["RESILIENCE", "AMRI Overall Index", resilience?.status || "STABLE", String(resilience?.overallScore || 85), "/100", "COMPUTED_AMRI", now.toISOString()],
    ];

    // Add asset health rows
    twinState.assets?.forEach((a) => {
      rows.push(["ASSET", a.name, a.status, String(a.healthScore ?? 85), "/100", "MEASURED_EDGE", now.toISOString()]);
    });

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.map((val) => `"${val}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ncpor-report-${stationCode.toLowerCase()}-${now.toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJson = () => {
    const reportPayload = {
      meta: {
        organization: "National Centre for Polar and Ocean Research (NCPOR)",
        ministry: "Ministry of Earth Sciences, Government of India",
        stationId,
        stationName,
        stationCode,
        generatedAt: now.toISOString(),
        timeRange,
        domainFilter: activeDomain,
        provenanceLabel: "SIMULATED / DEMO OPERATIONS REPORT",
        modelVersions: {
          twinEngine: "MB-TWIN-v2.1",
          resilienceModel: resilience?.modelVersion || "AMRI-v2.6",
          intelligenceEngine: "POLAR-AI-v3",
        },
      },
      resilienceIndex: resilience,
      twinState,
      intelligenceSummary: intelligence,
    };

    const blob = new Blob([JSON.stringify(reportPayload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `operational-report-${stationCode.toLowerCase()}-${now.toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app-content">
      {/* Non-Printable Header & Controls */}
      <header className="page-header no-print">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                fontSize: "0.65rem",
                padding: "0.15rem 0.4rem",
                background: "rgba(11, 74, 53, 0.1)",
                color: "var(--green)",
                borderRadius: "4px",
                fontWeight: 700,
                letterSpacing: "0.05em",
              }}
            >
              MISSION COMPLIANCE & AUDIT ARTIFACT
            </span>
            <span className="badge badge--operational" style={{ fontSize: "0.65rem" }}>
              DEMO / SIMULATED VERIFIED
            </span>
          </div>
          <h1 className="page-header__title" style={{ margin: "0.25rem 0" }}>
            {stationName} Operational Report Workspace
          </h1>
          <p className="page-header__subtitle">
            Generate, inspect, and export executive polar briefings, ISO/regulatory compliance digests, and immutable state snapshots.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          {snapshot && (
            <span className="badge badge--operational" style={{ fontSize: "0.7rem" }}>
              Snapshot Active: {snapshot.snapshotId || snapshot.id || "Captured"}
            </span>
          )}
          <button className="button button--ghost" onClick={handleCaptureSnapshot} disabled={loading}>
            Capture Snapshot
          </button>
          <button className="button button--ghost" onClick={handleExportJson}>
            Export JSON
          </button>
          <button className="button button--ghost" onClick={handleExportCsv}>
            Export CSV
          </button>
          <button className="button button--primary" onClick={handlePrintPdf}>
            Print / Save A4 PDF
          </button>
        </div>
      </header>

      {/* Filter Ribbon (no-print) */}
      <div
        className="no-print"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "0.5rem 1rem",
          marginBottom: "1.25rem",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        {/* Domain Tabs */}
        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
          {(
            [
              ["ALL", "Executive Overview"],
              ["ENERGY", "Energy & Microgrid"],
              ["ENVIRONMENT", "Meteorology & Chill"],
              ["INFRASTRUCTURE", "Assets & Health"],
              ["LOGISTICS", "Consumables & Cargo"],
              ["INCIDENTS", "Incidents & Hazards"],
              ["INTELLIGENCE", "AI & Resilience"],
            ] as const
          ).map(([dom, label]) => (
            <button
              key={dom}
              type="button"
              onClick={() => setActiveDomain(dom)}
              style={{
                padding: "0.35rem 0.65rem",
                borderRadius: "4px",
                fontSize: "0.75rem",
                fontWeight: activeDomain === dom ? 700 : 500,
                background: activeDomain === dom ? "var(--green)" : "transparent",
                color: activeDomain === dom ? "#ffffff" : "var(--text-muted)",
                border: "none",
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Time Horizon Selector */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.75rem" }}>
          <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>TIME HORIZON:</span>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
            className="select-control"
            style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="SEASON">Full 44th ISEA Season</option>
          </select>
        </div>
      </div>

      {/* Printable Report Document (A4 Styled Container) */}
      <div
        className="printable-report-container"
        style={{
          background: "#ffffff",
          color: "#111827",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "2.5rem 3rem",
          boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
          maxWidth: "1050px",
          margin: "0 auto",
        }}
      >
        {/* Official Header Letterhead */}
        <div
          style={{
            borderBottom: "2px solid #0b4a35",
            paddingBottom: "1.25rem",
            marginBottom: "1.5rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          <div>
            <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#0b4a35", letterSpacing: "0.08em" }}>
              NATIONAL CENTRE FOR POLAR AND OCEAN RESEARCH (NCPOR)
            </div>
            <div style={{ fontSize: "0.7rem", color: "#4b5563" }}>
              Ministry of Earth Sciences • Government of India • Headland Sada, Vasco-da-Gama, Goa
            </div>
            <h1 style={{ fontSize: "1.6rem", fontWeight: 800, margin: "0.35rem 0 0.1rem", color: "#111827" }}>
              {stationName.toUpperCase()} — OPERATIONAL READINESS DOSSIER
            </h1>
            <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>
              Domain Focus: <strong>{activeDomain}</strong> • Analysis Horizon: <strong>{timeRange}</strong> • Generated:{" "}
              {now.toLocaleString("en-GB", { timeZone: "UTC" })} UTC
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div
              style={{
                display: "inline-block",
                padding: "0.35rem 0.75rem",
                background: "#f0fdf4",
                border: "1px solid #16a34a",
                borderRadius: "4px",
                fontSize: "0.7rem",
                fontWeight: 700,
                color: "#16a34a",
              }}
            >
              SIMULATED / DEMO AUDIT COPY
            </div>
            <div style={{ fontSize: "0.65rem", color: "#9ca3af", marginTop: "0.25rem" }}>
              Doc ID: NCPOR-ISEA44-{stationCode}-{now.getTime().toString().slice(-6)}
            </div>
          </div>
        </div>

        {/* 1. Executive Summary Narrative */}
        {(activeDomain === "ALL" || activeDomain === "INTELLIGENCE") && (
          <section style={{ marginBottom: "1.75rem" }}>
            <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#0b4a35", borderBottom: "1px solid #e5e7eb", paddingBottom: "0.3rem", marginBottom: "0.6rem" }}>
              1. EXECUTIVE OPERATIONS SUMMARY
            </h2>
            <p style={{ fontSize: "0.85rem", lineHeight: 1.6, color: "#374151", margin: 0 }}>
              During the active observation window ({timeRange}), {stationName} recorded an overall Antarctic Mission
              Resilience Index of <strong>{resilience?.overallScore ?? 88}/100 ({resilience?.status ?? "STABLE"})</strong>.
              Microgrid generation averaged <strong>{twinState?.energy.totalGenerationKw ?? 145} kW</strong> against a base life-support
              load of <strong>{twinState?.energy.totalLoadKw ?? 82} kW</strong>, maintaining a net spinning reserve of{" "}
              <strong>+{twinState?.energy.netPowerKw ?? 63} kW</strong>. On-station Polar Diesel inventory currently guarantees{" "}
              <strong>{twinState?.logistics.daysOfFuelRemaining ?? 66} days</strong> of unassisted thermal autonomy, safely above the
              minimum winter lock-in threshold (60 days). Potable water reserves stand at{" "}
              <strong>{twinState?.logistics.daysOfWaterRemaining ?? 14} days</strong>. Active critical alarms:{" "}
              <strong>{twinState?.activeAlerts.filter((a) => a.severity === "CRITICAL").length ?? 0}</strong>; degraded assets:{" "}
              <strong>{twinState?.assets.filter((a) => a.status === "DEGRADED").length ?? 0}</strong>.
            </p>
          </section>
        )}

        {/* 2. Key Operational Metrics Strip */}
        <section style={{ marginBottom: "1.75rem" }}>
          <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#0b4a35", borderBottom: "1px solid #e5e7eb", paddingBottom: "0.3rem", marginBottom: "0.75rem" }}>
            2. KEY PERFORMANCE INDICATORS
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem" }}>
            <div style={{ padding: "0.75rem", border: "1px solid #e5e7eb", borderRadius: "6px", background: "#f9fafb" }}>
              <div style={{ fontSize: "0.65rem", color: "#6b7280", fontWeight: 700 }}>AMRI RESILIENCE SCORE</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0b4a35" }}>
                {resilience?.overallScore ?? 88}<span style={{ fontSize: "0.8rem", color: "#6b7280" }}>/100</span>
              </div>
              <div style={{ fontSize: "0.65rem", color: "#16a34a", fontWeight: 600 }}>{resilience?.status ?? "STABLE"}</div>
            </div>

            <div style={{ padding: "0.75rem", border: "1px solid #e5e7eb", borderRadius: "6px", background: "#f9fafb" }}>
              <div style={{ fontSize: "0.65rem", color: "#6b7280", fontWeight: 700 }}>NET POWER BALANCE</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#111827" }}>
                {(twinState?.energy.netPowerKw ?? 0) >= 0 ? `+${twinState?.energy.netPowerKw ?? 0}` : twinState?.energy.netPowerKw} kW
              </div>
              <div style={{ fontSize: "0.65rem", color: "#6b7280" }}>Battery SOC: {twinState?.energy.batterySocPct ?? 82}%</div>
            </div>

            <div style={{ padding: "0.75rem", border: "1px solid #e5e7eb", borderRadius: "6px", background: "#f9fafb" }}>
              <div style={{ fontSize: "0.65rem", color: "#6b7280", fontWeight: 700 }}>FUEL SURVIVAL BUFFER</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#111827" }}>
                {twinState?.logistics.daysOfFuelRemaining ?? 66} <span style={{ fontSize: "0.8rem" }}>Days</span>
              </div>
              <div style={{ fontSize: "0.65rem", color: "#6b7280" }}>Winter Safe: &gt;60 Days</div>
            </div>

            <div style={{ padding: "0.75rem", border: "1px solid #e5e7eb", borderRadius: "6px", background: "#f9fafb" }}>
              <div style={{ fontSize: "0.65rem", color: "#6b7280", fontWeight: 700 }}>METEOROLOGICAL CHILL</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#111827" }}>
                {twinState?.environment.ambientTempC ?? -18.5}°C
              </div>
              <div style={{ fontSize: "0.65rem", color: "#6b7280" }}>Wind: {twinState?.environment.windSpeedMs ?? 14} m/s</div>
            </div>
          </div>
        </section>

        {/* 3. Resilience Factor Breakdown */}
        {(activeDomain === "ALL" || activeDomain === "INTELLIGENCE") && resilience && (
          <section style={{ marginBottom: "1.75rem" }}>
            <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#0b4a35", borderBottom: "1px solid #e5e7eb", paddingBottom: "0.3rem", marginBottom: "0.75rem" }}>
              3. EXPLAINABLE RESILIENCE FACTORS (AMRI-v2.6)
            </h2>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#f3f4f6", borderBottom: "2px solid #e5e7eb", color: "#374151" }}>
                  <th style={{ padding: "0.5rem" }}>Mission Resilience Factor</th>
                  <th style={{ padding: "0.5rem" }}>Weight</th>
                  <th style={{ padding: "0.5rem" }}>Factor Score</th>
                  <th style={{ padding: "0.5rem" }}>Status</th>
                  <th style={{ padding: "0.5rem" }}>Current Metric Reading</th>
                  <th style={{ padding: "0.5rem" }}>Engineering Explanation</th>
                </tr>
              </thead>
              <tbody>
                {resilience.factors.map((f) => (
                  <tr key={f.factor} style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: "0.5rem", fontWeight: 600 }}>{f.factor}</td>
                    <td style={{ padding: "0.5rem" }}>{f.weightPct}%</td>
                    <td style={{ padding: "0.5rem", fontWeight: 700 }}>{f.score}/100</td>
                    <td style={{ padding: "0.5rem" }}>
                      <span
                        style={{
                          fontWeight: 700,
                          color: f.status === "OPTIMAL" ? "#16a34a" : f.status === "NOMINAL" ? "#2563eb" : "#d97706",
                        }}
                      >
                        {f.status}
                      </span>
                    </td>
                    <td style={{ padding: "0.5rem", fontFamily: "var(--font-mono)" }}>{f.rawMetricValue}</td>
                    <td style={{ padding: "0.5rem", color: "#4b5563" }}>{f.explanation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* 4. Critical Subsystem Asset Audit */}
        {(activeDomain === "ALL" || activeDomain === "INFRASTRUCTURE") && (
          <section style={{ marginBottom: "1.75rem" }}>
            <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#0b4a35", borderBottom: "1px solid #e5e7eb", paddingBottom: "0.3rem", marginBottom: "0.75rem" }}>
              4. CRITICAL SUBSYSTEM ASSET HEALTH REGISTRY
            </h2>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#f3f4f6", borderBottom: "2px solid #e5e7eb", color: "#374151" }}>
                  <th style={{ padding: "0.5rem" }}>Asset Name</th>
                  <th style={{ padding: "0.5rem" }}>Type</th>
                  <th style={{ padding: "0.5rem" }}>Criticality</th>
                  <th style={{ padding: "0.5rem" }}>Status</th>
                  <th style={{ padding: "0.5rem" }}>Health Score</th>
                  <th style={{ padding: "0.5rem" }}>Data Quality</th>
                  <th style={{ padding: "0.5rem" }}>Downstream Dependencies</th>
                </tr>
              </thead>
              <tbody>
                {twinState?.assets.map((a) => (
                  <tr key={a.assetId} style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: "0.5rem", fontWeight: 600 }}>{a.name}</td>
                    <td style={{ padding: "0.5rem" }}>{a.type}</td>
                    <td style={{ padding: "0.5rem" }}>{a.criticality}</td>
                    <td style={{ padding: "0.5rem" }}>
                      <span
                        style={{
                          fontWeight: 700,
                          color: a.status === "OPERATIONAL" ? "#16a34a" : a.status === "DEGRADED" ? "#d97706" : "#dc2626",
                        }}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td style={{ padding: "0.5rem", fontWeight: 700 }}>{a.healthScore ?? 85}/100</td>
                    <td style={{ padding: "0.5rem" }}>{a.dataQuality}</td>
                    <td style={{ padding: "0.5rem", color: "#4b5563" }}>
                      {a.impactedDownstreamAssets && a.impactedDownstreamAssets.length > 0
                        ? `${a.impactedDownstreamAssets.length} downstream assets linked`
                        : "None (Leaf Node)"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* 5. Incidents and Hazards */}
        {(activeDomain === "ALL" || activeDomain === "INCIDENTS") && (
          <section style={{ marginBottom: "1.75rem" }}>
            <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#0b4a35", borderBottom: "1px solid #e5e7eb", paddingBottom: "0.3rem", marginBottom: "0.75rem" }}>
              5. ACTIVE ALERTS & INCIDENT DOSSIER
            </h2>
            {twinState?.activeAlerts.length === 0 ? (
              <div style={{ padding: "0.75rem", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "4px", fontSize: "0.8rem", color: "#166534" }}>
                ✓ Zero critical or warning alerts active. Microgrid and life support operating inside normal bounds.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {twinState?.activeAlerts.map((alt) => (
                  <div key={alt.id} style={{ padding: "0.65rem 0.85rem", border: "1px solid #e5e7eb", borderRadius: "6px", background: "#f9fafb" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                      <strong style={{ fontSize: "0.8rem", color: alt.severity === "CRITICAL" ? "#dc2626" : "#d97706" }}>
                        [{alt.severity}] {alt.title}
                      </strong>
                      <span style={{ fontSize: "0.7rem", color: "#6b7280" }}>{new Date(alt.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#374151" }}>{alt.description}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* 6. Provenance & Compliance Sign-off Block */}
        <section
          style={{
            borderTop: "2px solid #e5e7eb",
            paddingTop: "1.25rem",
            marginTop: "2rem",
            fontSize: "0.75rem",
            color: "#6b7280",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
            <div>
              <div style={{ fontWeight: 700, color: "#111827", marginBottom: "0.25rem" }}>DATA PROVENANCE ATTESTATION:</div>
              <p style={{ margin: 0, lineHeight: 1.5 }}>
                Telemetry data is sourced from edge station MQTT/TimescaleDB ingestion layers. All predictive, what-if, and
                optimization metrics are generated via deterministic PRNG algorithms and labeled <strong>SIMULATED / DEMO</strong>.
                Decision traces are cryptographically linked to audit event logs.
              </p>
            </div>

            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 700, color: "#111827", marginBottom: "0.25rem" }}>EXPEDITION OFFICER ENDORSEMENT:</div>
              <div style={{ borderBottom: "1px solid #9ca3af", width: "220px", margin: "2rem 0 0.25rem auto" }} />
              <div style={{ fontSize: "0.7rem", color: "#374151" }}>Station Operations Commander (ISEA 44)</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
