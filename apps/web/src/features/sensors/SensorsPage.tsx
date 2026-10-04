import React, { useState, useMemo } from "react";
import { useStation } from "../../hooks/useStation";
import { useNavigate } from "react-router-dom";

type SensorDomain =
  | "ALL"
  | "ENERGY"
  | "ENVIRONMENT"
  | "HVAC"
  | "WATER"
  | "COMMUNICATION"
  | "INFRASTRUCTURE"
  | "LOGISTICS";

interface FlattenedSensor {
  id: string;
  name: string;
  assetId: string;
  assetName: string;
  domain: SensorDomain;
  zone: string;
  value: number;
  unit: string;
  source: string;
  quality: string;
  freshness: string;
  ageSeconds: number;
  xyz: string;
}

export function SensorsPage(): React.JSX.Element {
  const navigate = useNavigate();
  const { stationId, twinState } = useStation();

  const [activeDomain, setActiveDomain] = useState<SensorDomain>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [qualityFilter, setQualityFilter] = useState<string>("ALL");

  const isMaitri = stationId === "station-maitri";

  // Flatten all telemetry points from TwinState assets into sensor rows
  const allSensors = useMemo<FlattenedSensor[]>(() => {
    if (!twinState) return [];

    const list: FlattenedSensor[] = [];
    const assets = twinState.assets;

    for (const asset of assets) {
      // Determine domain based on asset type
      let domain: SensorDomain = "INFRASTRUCTURE";
      if (asset.type === "GENERATOR" || asset.type === "BATTERY" || asset.type === "SOLAR" || asset.type === "WIND_TURBINE") {
        domain = "ENERGY";
      } else if (asset.type === "HVAC") {
        domain = "HVAC";
      } else if (asset.type === "WATER_SYSTEM") {
        domain = "WATER";
      } else if (asset.type === "COMMUNICATION") {
        domain = "COMMUNICATION";
      } else if (asset.type === "BUILDING") {
        domain = "ENVIRONMENT";
      }

      for (const [metric, telem] of Object.entries(asset.currentTelemetry)) {
        let zone = isMaitri ? "Central Block" : "Main Monolith Core";
        let xyz = "X:0.0 Y:4.5 Z:0.0";

        if (asset.type === "GENERATOR") {
          zone = isMaitri ? "Powerhouse Bay A" : "Energy Hub Mod-01";
          xyz = "X:-13.0 Y:2.6 Z:6.0";
        } else if (asset.type === "BATTERY") {
          zone = isMaitri ? "UPS Annex B" : "BESS Enclosure";
          xyz = "X:-7.0 Y:4.0 Z:7.5";
        } else if (asset.type === "WATER_SYSTEM") {
          zone = isMaitri ? "Lake Priyadarshini Pumphouse" : "RO Desalination Bay";
          xyz = "X:-22.0 Y:1.4 Z:-14.0";
        } else if (asset.type === "COMMUNICATION") {
          zone = isMaitri ? "Satellite Radome Tower" : "ISRO Ground Radome";
          xyz = "X:13.0 Y:5.5 Z:-8.0";
        }

        list.push({
          id: `sens-${asset.assetId}-${metric}`,
          name: metric.replace(/_/g, " ").toUpperCase(),
          assetId: asset.assetId,
          assetName: asset.name,
          domain,
          zone,
          value: telem.value,
          unit: telem.unit,
          source: telem.source || "SIMULATED",
          quality: telem.quality || "GOOD",
          freshness: telem.freshness || "FRESH",
          ageSeconds: telem.ageSeconds || 2,
          xyz,
        });
      }
    }

    // Add ambient environmental sensors
    if (twinState.environment) {
      list.push(
        {
          id: "sens-ambient-temp",
          name: "AMBIENT TEMPERATURE",
          assetId: "env-met-station",
          assetName: "Antarctic Meteorological Mast",
          domain: "ENVIRONMENT",
          zone: "Exterior Weather Tower",
          value: twinState.environment.ambientTempC,
          unit: "°C",
          source: "SIMULATED",
          quality: "GOOD",
          freshness: "FRESH",
          ageSeconds: 2,
          xyz: "X:25.0 Y:8.0 Z:20.0",
        },
        {
          id: "sens-ambient-wind",
          name: "SURFACE WIND VELOCITY",
          assetId: "env-met-station",
          assetName: "Antarctic Meteorological Mast",
          domain: "ENVIRONMENT",
          zone: "Exterior Weather Tower",
          value: twinState.environment.windSpeedMs,
          unit: "m/s",
          source: "SIMULATED",
          quality: "GOOD",
          freshness: "FRESH",
          ageSeconds: 2,
          xyz: "X:25.0 Y:8.0 Z:20.0",
        },
        {
          id: "sens-ambient-pressure",
          name: "BAROMETRIC PRESSURE",
          assetId: "env-met-station",
          assetName: "Antarctic Meteorological Mast",
          domain: "ENVIRONMENT",
          zone: "Exterior Weather Tower",
          value: twinState.environment.atmosphericPressureHpa,
          unit: "hPa",
          source: "SIMULATED",
          quality: "GOOD",
          freshness: "FRESH",
          ageSeconds: 2,
          xyz: "X:25.0 Y:8.0 Z:20.0",
        }
      );
    }

    return list;
  }, [twinState, isMaitri]);

  // Filtered sensors
  const filteredSensors = useMemo(() => {
    return allSensors.filter((s) => {
      if (activeDomain !== "ALL" && s.domain !== activeDomain) return false;
      if (qualityFilter !== "ALL" && s.quality !== qualityFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.assetName.toLowerCase().includes(q) ||
          s.zone.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allSensors, activeDomain, qualityFilter, searchQuery]);

  const totalSensors = allSensors.length;
  const goodCount = allSensors.filter((s) => s.quality === "GOOD").length;
  const suspectCount = allSensors.filter((s) => s.quality === "SUSPECT").length;
  const staleCount = allSensors.filter((s) => s.freshness === "STALE" || s.ageSeconds > 30).length;

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
              INSTRUMENTATION • LIVE TELEMETRY MATRIX
            </span>
          </div>
          <h1 className="page-header__title">
            {stationId === "station-maitri" ? "Maitri" : "Bharati"} Sensor Instrumentation
          </h1>
          <p className="page-header__subtitle">
            Comprehensive multi-domain physical telemetry points with strict provenance distinction (Measured vs Simulated).
          </p>
        </div>

        <button
          type="button"
          className="button button--ghost"
          style={{ fontSize: "0.8rem", border: "1px solid var(--border)" }}
          onClick={() => navigate("/twin")}
        >
          View in 3D Digital Twin →
        </button>
      </header>

      {/* KPI Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "1.25rem" }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "1rem", borderRadius: "6px" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>TOTAL INSTRUMENTATION</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text)", marginTop: "0.2rem" }}>
            {totalSensors}
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>Active mapped sensor feeds</div>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderLeft: "4px solid var(--green)", padding: "1rem", borderRadius: "6px" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>NOMINAL / GOOD QUALITY</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--green)", marginTop: "0.2rem" }}>
            {goodCount}
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>Valid physical ranges & noise thresholds</div>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderLeft: "4px solid var(--warning)", padding: "1rem", borderRadius: "6px" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>SUSPECT / DERATED</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--warning)", marginTop: "0.2rem" }}>
            {suspectCount}
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>Rate-of-change anomalies flagged</div>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderLeft: "4px solid #64748b", padding: "1rem", borderRadius: "6px" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>STALE / COMM TIMEOUT</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#64748b", marginTop: "0.2rem" }}>
            {staleCount}
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>Age exceeds &gt;30s threshold</div>
        </div>
      </div>

      {/* Domain Filters & Search */}
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
        <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
          {(
            [
              "ALL",
              "ENERGY",
              "ENVIRONMENT",
              "HVAC",
              "WATER",
              "COMMUNICATION",
              "INFRASTRUCTURE",
            ] as SensorDomain[]
          ).map((domain) => (
            <button
              key={domain}
              type="button"
              onClick={() => setActiveDomain(domain)}
              style={{
                padding: "0.35rem 0.65rem",
                fontSize: "0.75rem",
                fontWeight: 600,
                borderRadius: "4px",
                border: activeDomain === domain ? "1px solid var(--green)" : "1px solid var(--border)",
                background: activeDomain === domain ? "var(--green)" : "var(--surface)",
                color: activeDomain === domain ? "#ffffff" : "var(--text)",
                cursor: "pointer",
              }}
            >
              {domain}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            type="text"
            placeholder="Search sensors, assets, or zones..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: "0.35rem 0.65rem",
              fontSize: "0.8rem",
              borderRadius: "4px",
              border: "1px solid var(--border)",
              minWidth: "220px",
              background: "#ffffff",
            }}
          />

          <select
            value={qualityFilter}
            onChange={(e) => setQualityFilter(e.target.value)}
            className="select-control"
            style={{ padding: "0.35rem 0.5rem", fontSize: "0.8rem" }}
          >
            <option value="ALL">All Quality</option>
            <option value="GOOD">Good Quality Only</option>
            <option value="SUSPECT">Suspect Only</option>
            <option value="BAD">Bad Quality Only</option>
          </select>
        </div>
      </div>

      {/* Sensor Table */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", textAlign: "left" }}>
          <thead>
            <tr style={{ background: "var(--surface-soft)", borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}>
              <th style={{ padding: "0.75rem 1rem" }}>Sensor Name / ID</th>
              <th style={{ padding: "0.75rem 1rem" }}>Subsystem Asset</th>
              <th style={{ padding: "0.75rem 1rem" }}>Domain / Zone</th>
              <th style={{ padding: "0.75rem 1rem" }}>Live Reading</th>
              <th style={{ padding: "0.75rem 1rem" }}>Provenance</th>
              <th style={{ padding: "0.75rem 1rem" }}>Quality</th>
              <th style={{ padding: "0.75rem 1rem" }}>Freshness</th>
              <th style={{ padding: "0.75rem 1rem" }}>Spatial XYZ</th>
            </tr>
          </thead>
          <tbody>
            {filteredSensors.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                  No sensors found matching filter criteria.
                </td>
              </tr>
            ) : (
              filteredSensors.map((s) => (
                <tr
                  key={s.id}
                  style={{
                    borderBottom: "1px solid var(--border)",
                    transition: "background 0.15s",
                    cursor: "pointer",
                  }}
                  onClick={() => navigate(`/twin?assetId=${s.assetId}`)}
                  title="Click to locate asset in 3D Digital Twin"
                >
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <div style={{ fontWeight: 600, color: "var(--text)" }}>{s.name}</div>
                    <div style={{ fontSize: "0.65rem", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                      {s.id}
                    </div>
                  </td>

                  <td style={{ padding: "0.75rem 1rem" }}>
                    <div style={{ fontWeight: 500, color: "var(--text)" }}>{s.assetName}</div>
                    <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>ID: {s.assetId}</div>
                  </td>

                  <td style={{ padding: "0.75rem 1rem" }}>
                    <span className="badge badge--info" style={{ fontSize: "0.65rem", marginRight: "0.3rem" }}>
                      {s.domain}
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{s.zone}</span>
                  </td>

                  <td style={{ padding: "0.75rem 1rem" }}>
                    <span style={{ fontWeight: 700, fontFamily: "var(--font-mono)", fontSize: "0.95rem" }}>
                      {s.value}
                    </span>{" "}
                    <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>{s.unit}</span>
                  </td>

                  <td style={{ padding: "0.75rem 1rem" }}>
                    <span
                      style={{
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        background: "rgba(11, 74, 53, 0.08)",
                        color: "var(--green)",
                        padding: "2px 6px",
                        borderRadius: "4px",
                      }}
                    >
                      {s.source}
                    </span>
                  </td>

                  <td style={{ padding: "0.75rem 1rem" }}>
                    <span
                      className={`badge ${
                        s.quality === "GOOD" ? "badge--operational" : s.quality === "SUSPECT" ? "badge--warning" : "badge--critical"
                      }`}
                      style={{ fontSize: "0.65rem" }}
                    >
                      {s.quality}
                    </span>
                  </td>

                  <td style={{ padding: "0.75rem 1rem" }}>
                    <span style={{ fontSize: "0.75rem", color: s.ageSeconds > 15 ? "var(--warning)" : "var(--green)" }}>
                      ● {s.freshness} ({s.ageSeconds}s)
                    </span>
                  </td>

                  <td style={{ padding: "0.75rem 1rem", fontSize: "0.7rem", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                    {s.xyz}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
