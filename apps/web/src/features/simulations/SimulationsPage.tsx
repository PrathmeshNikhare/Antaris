import React, { useState, useEffect } from "react";
import { useStation } from "../../hooks/useStation";
import { twinApi } from "../../services/api";
import type {
  ResilienceScenarioType,
  ResilienceSimulationResult,
  SimulationParameters,
  SimulationComparisonItem,
  BlastRadiusNode,
  BlastRadiusEdge,
  ImpactedAssetSummary,
} from "@maitri-bharati/shared";

interface ScenarioDefinition {
  type: ResilienceScenarioType;
  title: string;
  category: "ENERGY" | "LOGISTICS" | "ENVIRONMENT" | "OPERATIONS" | "INFRASTRUCTURE" | "COMMS";
  description: string;
  icon: string;
}

const SUPPORTED_SCENARIOS: ScenarioDefinition[] = [
  {
    type: "GENERATOR_FAILURE",
    title: "Primary Generator Trip & Rapid Discharge",
    category: "ENERGY",
    description: "Alternator trip drives emergency battery deep-discharge and water intake pipeline freeze hazard.",
    icon: "⚡",
  },
  {
    type: "BATTERY_DEGRADATION",
    title: "Battery Sub-Zero Degradation",
    category: "ENERGY",
    description: "Extreme cold capacity derating, internal cell resistance surge, and reduced microgrid reserve.",
    icon: "🔋",
  },
  {
    type: "FUEL_SHORTAGE",
    title: "Polar Diesel Storage Shortage",
    category: "LOGISTICS",
    description: "Bulk tankage loss plunging station fuel reserves past the 45-day winter emergency survival window.",
    icon: "🛢️",
  },
  {
    type: "EXTREME_COLD",
    title: "Polar Chill Vortex (-45°C)",
    category: "ENVIRONMENT",
    description: "Building envelope thermal conduction surge and generator heating electrical demand spike.",
    icon: "❄️",
  },
  {
    type: "HIGH_WIND",
    title: "Category 5 Blizzard (>48 m/s)",
    category: "ENVIRONMENT",
    description: "Turbine mechanical storm brake engagement, solar array snow blinding, and station red lockdown.",
    icon: "🌪️",
  },
  {
    type: "LOAD_REDUCTION",
    title: "Demand Response & Load Shedding",
    category: "OPERATIONS",
    description: "Intentional non-essential science load curtailment expanding generator reserve margin.",
    icon: "📉",
  },
  {
    type: "BACKUP_GEN_ACTIVATION",
    title: "Standby Generator Synchronization",
    category: "INFRASTRUCTURE",
    description: "Autonomous secondary generator start-up and parallel bus synchronization to secure N+1 redundancy.",
    icon: "🔄",
  },
  {
    type: "COMMUNICATION_OUTAGE",
    title: "Satellite Blackout & Edge Store-and-Forward",
    category: "COMMS",
    description: "Geomagnetic storm transponder fade triggering autonomous local SSD store-and-forward telemetry queuing.",
    icon: "📡",
  },
];

export function SimulationsPage(): React.JSX.Element {
  const { stationId, simulationStatus, triggerAnomaly, changeConnectivity } = useStation();

  const [activeTab, setActiveTab] = useState<"resilience" | "sandbox">("resilience");
  const [selectedScenario, setSelectedScenario] = useState<ResilienceScenarioType>("GENERATOR_FAILURE");
  const [currentResult, setCurrentResult] = useState<ResilienceSimulationResult | null>(null);
  const [history, setHistory] = useState<ResilienceSimulationResult[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Scenario specific parameters
  const [durationHours, setDurationHours] = useState<number>(2.0);
  const [severity, setSeverity] = useState<"WARNING" | "CRITICAL">("CRITICAL");
  const [ambientTempC, setAmbientTempC] = useState<number>(-45.0);
  const [windSpeedMs, setWindSpeedMs] = useState<number>(48.0);
  const [loadReductionPct, setLoadReductionPct] = useState<number>(30);
  const [fuelLossLiters, setFuelLossLiters] = useState<number>(65000);
  const [batteryDegradationPct, setBatteryDegradationPct] = useState<number>(60);

  // Load history on mount or when stationId changes
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        setError(null);
        const runs = await twinApi.getSimulations(stationId, 15);
        if (!isMounted) return;
        setHistory(runs);

        if (runs.length > 0) {
          setCurrentResult(runs[0]);
        } else {
          // If no simulations yet run for this station, execute default scenario
          handleRunSimulation("GENERATOR_FAILURE");
        }
      } catch (err) {
        if (!isMounted) return;
        console.error("Failed to load simulation runs:", err);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [stationId]);

  async function handleRunSimulation(scenarioToRun = selectedScenario) {
    try {
      setIsRunning(true);
      setError(null);

      const params: Partial<SimulationParameters> = {
        durationHours,
        severity,
        ambientTempC: scenarioToRun === "EXTREME_COLD" ? ambientTempC : undefined,
        windSpeedMs: scenarioToRun === "HIGH_WIND" ? windSpeedMs : undefined,
        loadReductionPct: scenarioToRun === "LOAD_REDUCTION" ? loadReductionPct : undefined,
        fuelLossLiters: scenarioToRun === "FUEL_SHORTAGE" ? fuelLossLiters : undefined,
        batteryDegradationPct: scenarioToRun === "BATTERY_DEGRADATION" ? batteryDegradationPct : undefined,
      };

      const result = await twinApi.runResilienceSimulation(stationId, scenarioToRun, params);
      setCurrentResult(result);
      setHistory((prev) => [result, ...prev.filter((r) => r.simulationId !== result.simulationId)]);
    } catch (err) {
      setError((err as Error).message || "Simulation execution failed");
    } finally {
      setIsRunning(false);
    }
  }

  const connectivity = simulationStatus?.connectivity ?? "NORMAL";
  const queueSize = simulationStatus?.queueSize ?? 0;
  const isMaitri = stationId.toLowerCase().includes("maitri");

  return (
    <div className="app-content">
      {/* Page Header */}
      <header className="page-header" style={{ marginBottom: "1rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <h1 className="page-header__title">What-If Resilience Simulation Engine</h1>
            <span className="badge badge--operational" style={{ fontSize: "0.75rem" }}>
              {isMaitri ? "MAITRI STATION" : "BHARATI STATION"}
            </span>
          </div>
          <p className="page-header__subtitle">
            Counterfactual multi-physics cascade modeling with blast-radius dependency traversal and zero mutation on live Twin state.
          </p>
        </div>

        {/* Tab Controls */}
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            className={`btn ${activeTab === "resilience" ? "btn--primary" : "btn--outline"}`}
            onClick={() => setActiveTab("resilience")}
            id="tab-resilience-engine"
          >
            ⚡ What-If Resilience Engine
          </button>
          <button
            className={`btn ${activeTab === "sandbox" ? "btn--primary" : "btn--outline"}`}
            onClick={() => setActiveTab("sandbox")}
            id="tab-comms-sandbox"
          >
            📡 Comms & Anomaly Sandbox
          </button>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: RESILIENCE SIMULATION ENGINE (PHASE 6)                       */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === "resilience" && (
        <div>
          {/* Explicit SIMULATION Non-Measured Banner */}
          <div className="sim-banner">
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span className="sim-banner__tag">
                <span>⚠</span> SIMULATION
              </span>
              <div style={{ fontSize: "0.82rem", color: "var(--text)" }}>
                <strong>COUNTERFACTUAL PROJECTION MODE:</strong> Running against an isolated, immutable snapshot clone of the Digital Twin. Live telemetry streams and physical actuators are completely untouched.
              </div>
            </div>
            {currentResult && (
              <span style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                ID: {currentResult.simulationId}
              </span>
            )}
          </div>

          {error && (
            <div
              style={{
                backgroundColor: "var(--critical-soft)",
                color: "var(--critical)",
                padding: "0.75rem 1rem",
                borderRadius: "var(--radius-md)",
                marginBottom: "1rem",
                fontSize: "0.85rem",
              }}
            >
              ⚠ {error}
            </div>
          )}

          {/* Scenario Catalog */}
          <div style={{ marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
              <h2 style={{ fontSize: "0.95rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)" }}>
                Select Counterfactual Scenario (8 Scenarios)
              </h2>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Click a scenario card to configure parameters
              </span>
            </div>

            <div className="sim-scenario-grid">
              {SUPPORTED_SCENARIOS.map((sc) => {
                const isSelected = selectedScenario === sc.type;
                return (
                  <button
                    key={sc.type}
                    type="button"
                    className={`sim-scenario-card ${isSelected ? "sim-scenario-card--active" : ""}`}
                    onClick={() => setSelectedScenario(sc.type)}
                  >
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span className="sim-scenario-card__category">{sc.category}</span>
                        <span style={{ fontSize: "1.2rem" }}>{sc.icon}</span>
                      </div>
                      <h3 className="sim-scenario-card__title">{sc.title}</h3>
                    </div>
                    <p className="sim-scenario-card__desc">{sc.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Parameter Configuration & Run Trigger Bar */}
          <div className="card" style={{ marginBottom: "1.25rem", padding: "1rem 1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
              <div style={{ display: "flex", gap: "1.5rem", alignItems: "center", flexWrap: "wrap" }}>
                {/* Duration Control */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)" }}>
                    Duration: <strong style={{ color: "var(--text)" }}>{durationHours} Hours</strong>
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="48"
                    step="0.5"
                    value={durationHours}
                    onChange={(e) => setDurationHours(parseFloat(e.target.value))}
                    style={{ width: "130px", accentColor: "var(--green)" }}
                  />
                </div>

                {/* Severity Toggle */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)" }}>
                    Scenario Severity
                  </label>
                  <div style={{ display: "flex", gap: "0.3rem" }}>
                    <button
                      type="button"
                      className={`btn ${severity === "WARNING" ? "btn--primary" : "btn--outline"}`}
                      style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                      onClick={() => setSeverity("WARNING")}
                    >
                      Warning
                    </button>
                    <button
                      type="button"
                      className={`btn ${severity === "CRITICAL" ? "btn--danger" : "btn--outline"}`}
                      style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                      onClick={() => setSeverity("CRITICAL")}
                    >
                      Critical
                    </button>
                  </div>
                </div>

                {/* Scenario Specific Inputs */}
                {selectedScenario === "EXTREME_COLD" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)" }}>
                      Ambient Temp: <strong style={{ color: "var(--text)" }}>{ambientTempC}°C</strong>
                    </label>
                    <input
                      type="range"
                      min="-60"
                      max="-15"
                      step="1"
                      value={ambientTempC}
                      onChange={(e) => setAmbientTempC(parseFloat(e.target.value))}
                      style={{ width: "130px", accentColor: "var(--green)" }}
                    />
                  </div>
                )}

                {selectedScenario === "HIGH_WIND" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)" }}>
                      Blizzard Wind: <strong style={{ color: "var(--text)" }}>{windSpeedMs} m/s</strong>
                    </label>
                    <input
                      type="range"
                      min="25"
                      max="65"
                      step="1"
                      value={windSpeedMs}
                      onChange={(e) => setWindSpeedMs(parseFloat(e.target.value))}
                      style={{ width: "130px", accentColor: "var(--green)" }}
                    />
                  </div>
                )}

                {selectedScenario === "LOAD_REDUCTION" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)" }}>
                      Load Shed: <strong style={{ color: "var(--text)" }}>{loadReductionPct}%</strong>
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="50"
                      step="5"
                      value={loadReductionPct}
                      onChange={(e) => setLoadReductionPct(parseInt(e.target.value, 10))}
                      style={{ width: "130px", accentColor: "var(--green)" }}
                    />
                  </div>
                )}

                {selectedScenario === "FUEL_SHORTAGE" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)" }}>
                      Tank Loss: <strong style={{ color: "var(--text)" }}>{fuelLossLiters.toLocaleString()} L</strong>
                    </label>
                    <input
                      type="range"
                      min="20000"
                      max="100000"
                      step="5000"
                      value={fuelLossLiters}
                      onChange={(e) => setFuelLossLiters(parseInt(e.target.value, 10))}
                      style={{ width: "140px", accentColor: "var(--green)" }}
                    />
                  </div>
                )}

                {selectedScenario === "BATTERY_DEGRADATION" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)" }}>
                      Capacity Loss: <strong style={{ color: "var(--text)" }}>{batteryDegradationPct}%</strong>
                    </label>
                    <input
                      type="range"
                      min="20"
                      max="80"
                      step="5"
                      value={batteryDegradationPct}
                      onChange={(e) => setBatteryDegradationPct(parseInt(e.target.value, 10))}
                      style={{ width: "130px", accentColor: "var(--green)" }}
                    />
                  </div>
                )}
              </div>

              {/* Execution Action Button */}
              <button
                className="btn btn--primary"
                style={{ padding: "0.6rem 1.4rem", fontSize: "0.88rem" }}
                onClick={() => handleRunSimulation()}
                disabled={isRunning}
                id="btn-run-simulation"
              >
                {isRunning ? "⏳ Computing Cascade..." : "▶ Run Counterfactual Simulation"}
              </button>
            </div>
          </div>

          {/* ACTIVE SIMULATION DOSSIER */}
          {currentResult && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {/* Executive Impact Cards */}
              <div className="grid-4">
                <div className="kpi-tile">
                  <div className="kpi-tile__label">Operational Risk Score</div>
                  <div className="kpi-tile__value" style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
                    {currentResult.operationalRisk.score}
                    <span
                      className={`badge ${
                        currentResult.operationalRisk.level === "CRITICAL"
                          ? "badge--critical"
                          : currentResult.operationalRisk.level === "HIGH"
                          ? "badge--critical"
                          : currentResult.operationalRisk.level === "MEDIUM"
                          ? "badge--warning"
                          : "badge--operational"
                      }`}
                      style={{ fontSize: "0.75rem" }}
                    >
                      {currentResult.operationalRisk.level}
                    </span>
                  </div>
                  <div className="kpi-tile__meta">Multi-domain risk assessment</div>
                </div>

                <div className="kpi-tile">
                  <div className="kpi-tile__label">Subsystems in Blast Radius</div>
                  <div className="kpi-tile__value">
                    {currentResult.blastRadius.nodes.length}{" "}
                    <span className="kpi-tile__unit">nodes</span>
                  </div>
                  <div className="kpi-tile__meta">{currentResult.blastRadius.links.length} cascading dependency links</div>
                </div>

                <div className="kpi-tile">
                  <div className="kpi-tile__label">Impacted Assets</div>
                  <div className="kpi-tile__value">
                    {currentResult.impactedAssets.length}{" "}
                    <span className="kpi-tile__unit">equipment</span>
                  </div>
                  <div className="kpi-tile__meta">Physical assets suffering degraded status</div>
                </div>

                <div className="kpi-tile">
                  <div className="kpi-tile__label">Est. Recovery Duration</div>
                  <div className="kpi-tile__value">
                    ~{currentResult.recoveryState.estimatedRecoveryMinutes}{" "}
                    <span className="kpi-tile__unit">min</span>
                  </div>
                  <div className="kpi-tile__meta">{currentResult.recoveryState.suggestedActions.length} mitigation steps required</div>
                </div>
              </div>

              {/* Main Comparison Section: Baseline vs Counterfactual */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <h2 className="card-title">⚖ Baseline vs. Counterfactual Comparison Matrix</h2>
                    <span className="card-subtitle">
                      Quantified delta between current live Digital Twin state and simulated counterfactual
                    </span>
                  </div>
                  <span className="badge badge--operational" style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)" }}>
                    SEED: {currentResult.deterministicSeed}
                  </span>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table className="sim-matrix-table">
                    <thead>
                      <tr>
                        <th>Metric</th>
                        <th>Baseline (Live Twin)</th>
                        <th>Simulated (Scenario)</th>
                        <th>Absolute Change</th>
                        <th>Delta %</th>
                        <th>Severity</th>
                        <th>Causal Rationale</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentResult.comparisons.map((row: SimulationComparisonItem, idx: number) => {
                        const badgeClass =
                          row.severity === "CRITICAL"
                            ? "badge--critical"
                            : row.severity === "WARNING"
                            ? "badge--warning"
                            : row.severity === "IMPROVEMENT"
                            ? "badge--improvement"
                            : "badge--info";

                        return (
                          <tr key={idx}>
                            <td>
                              <strong>{row.metric}</strong>
                              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginLeft: "0.3rem" }}>
                                ({row.unit})
                              </span>
                            </td>
                            <td style={{ fontFamily: "var(--font-mono)" }}>{row.baseline}</td>
                            <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{row.scenario}</td>
                            <td style={{ fontFamily: "var(--font-mono)" }}>{row.absoluteChange}</td>
                            <td style={{ fontFamily: "var(--font-mono)" }}>{row.percentageChange}</td>
                            <td>
                              <span className={`badge ${badgeClass}`} style={{ fontSize: "0.7rem", padding: "0.2rem 0.45rem" }}>
                                {row.severity}
                              </span>
                            </td>
                            <td style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>{row.reason}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Blast-Radius & Cascading Dependency Map */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <h2 className="card-title">🕸 Dependency Blast-Radius & Cascading Impact Propagation</h2>
                    <span className="card-subtitle">
                      Direct and indirect multi-domain subsystems impacted via TwinDependencyGraph
                    </span>
                  </div>
                </div>

                <div className="sim-blast-grid">
                  {currentResult.blastRadius.nodes.map((node: BlastRadiusNode) => {
                    const cardClass =
                      node.severity === "CRITICAL"
                        ? "sim-blast-card--critical"
                        : node.severity === "WARNING"
                        ? "sim-blast-card--warning"
                        : "sim-blast-card--normal";

                    return (
                      <div key={node.id} className={`sim-blast-card ${cardClass}`}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                          <span style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
                            {node.domain}
                          </span>
                          <span
                            className={`badge ${
                              node.severity === "CRITICAL"
                                ? "badge--critical"
                                : node.severity === "WARNING"
                                ? "badge--warning"
                                : "badge--operational"
                            }`}
                            style={{ fontSize: "0.65rem", padding: "0.15rem 0.35rem" }}
                          >
                            {node.status}
                          </span>
                        </div>
                        <h4 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text)", marginBottom: "0.25rem" }}>
                          {node.label}
                        </h4>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.4rem", lineHeight: 1.35 }}>
                          {node.impactDescription}
                        </p>
                        {node.metricValue && (
                          <div style={{ fontSize: "0.8rem", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text)" }}>
                            Delta: {node.metricValue}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Dependency Edge Vector List */}
                {currentResult.blastRadius.links.length > 0 && (
                  <div style={{ marginTop: "1rem", borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>
                    <h4 style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                      Active Cascade Vectors ({currentResult.blastRadius.links.length} propagation links)
                    </h4>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                      {currentResult.blastRadius.links.map((link: BlastRadiusEdge, idx: number) => (
                        <div
                          key={idx}
                          style={{
                            fontSize: "0.75rem",
                            backgroundColor: "var(--surface-soft)",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius-sm)",
                            padding: "0.3rem 0.6rem",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.4rem",
                          }}
                        >
                          <strong style={{ color: "var(--text)" }}>{link.source}</strong>
                          <span style={{ color: "var(--critical)", fontWeight: 700 }}>➔ [{link.dependencyType}] ➔</span>
                          <strong style={{ color: "var(--text)" }}>{link.target}</strong>
                          <span style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>({link.impactReason})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Causal Narrative & Recovery Action Plan (2 columns) */}
              <div className="grid-2">
                {/* Causal Narrative */}
                <div className="card">
                  <div className="card-header">
                    <h2 className="card-title">📖 Plain-Language Causal Narrative Dossier</h2>
                    <span className="card-subtitle">Physics and thermodynamic mechanics analysis</span>
                  </div>
                  <div style={{ padding: "0.5rem 0", lineHeight: 1.6, fontSize: "0.85rem", color: "var(--text)" }}>
                    <p style={{ marginBottom: "0.8rem" }}>{currentResult.explanation}</p>
                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>
                      <strong style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-muted)", display: "block", marginBottom: "0.4rem" }}>
                        Identified Risk Factors:
                      </strong>
                      <ul style={{ paddingLeft: "1.25rem", color: "var(--text-muted)", fontSize: "0.8rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                        {currentResult.operationalRisk.factors.map((factor: string, idx: number) => (
                          <li key={idx}>{factor}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Recovery Action Plan */}
                <div className="card">
                  <div className="card-header">
                    <h2 className="card-title">🛠 Actionable Mitigation & Recovery Protocol</h2>
                    <span className="card-subtitle">Recommended operational procedures for Antarctic team</span>
                  </div>
                  <div style={{ padding: "0.5rem 0" }}>
                    <div style={{ marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span className="badge badge--warning" style={{ fontSize: "0.75rem" }}>
                        ESTIMATED TIME TO RESTORE: ~{currentResult.recoveryState.estimatedRecoveryMinutes} MINUTES
                      </span>
                    </div>

                    <ol style={{ paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.6rem", fontSize: "0.82rem", color: "var(--text)" }}>
                      {currentResult.recoveryState.suggestedActions.map((action: string, idx: number) => (
                        <li key={idx} style={{ lineHeight: 1.4 }}>
                          {action}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </div>

              {/* Impacted Assets Detailed Inventory */}
              {currentResult.impactedAssets.length > 0 && (
                <div className="card">
                  <div className="card-header">
                    <h2 className="card-title">⚙ Impacted Equipment Inventory ({currentResult.impactedAssets.length} Assets)</h2>
                    <span className="card-subtitle">Physical plant health degradation and failure modes</span>
                  </div>

                  <div style={{ overflowX: "auto" }}>
                    <table className="sim-matrix-table">
                      <thead>
                        <tr>
                          <th>Asset ID / Name</th>
                          <th>Type</th>
                          <th>Criticality</th>
                          <th>Baseline Health</th>
                          <th>Simulated Health</th>
                          <th>Status Shift</th>
                          <th>Specific Failure Mode</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentResult.impactedAssets.map((asset: ImpactedAssetSummary) => (
                          <tr key={asset.assetId}>
                            <td>
                              <strong>{asset.assetName}</strong>
                              <div style={{ fontSize: "0.7rem", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                                {asset.assetId}
                              </div>
                            </td>
                            <td>{asset.assetType}</td>
                            <td>
                              <span className="badge badge--warning" style={{ fontSize: "0.65rem" }}>
                                {asset.criticality}
                              </span>
                            </td>
                            <td style={{ fontFamily: "var(--font-mono)" }}>{asset.baselineHealth}%</td>
                            <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--critical)" }}>
                              {asset.simulatedHealth}%
                            </td>
                            <td>
                              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{asset.baselineStatus}</span>
                              {" ➔ "}
                              <span
                                className={`badge ${
                                  asset.simulatedStatus === "FAILED" || asset.simulatedStatus === "CRITICAL"
                                    ? "badge--critical"
                                    : "badge--warning"
                                }`}
                                style={{ fontSize: "0.65rem" }}
                              >
                                {asset.simulatedStatus}
                              </span>
                            </td>
                            <td style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{asset.failureCause}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Simulation Run History List */}
              {history.length > 1 && (
                <div className="card">
                  <div className="card-header">
                    <h2 className="card-title">📜 Historical Simulation Runs for {isMaitri ? "Maitri" : "Bharati"}</h2>
                    <span className="card-subtitle">Stored in simulation memory repository</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {history.map((run) => {
                      const isCurrent = run.simulationId === currentResult.simulationId;
                      return (
                        <div
                          key={run.simulationId}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "0.6rem 0.8rem",
                            backgroundColor: isCurrent ? "rgba(20, 107, 74, 0.06)" : "var(--surface-soft)",
                            border: `1px solid ${isCurrent ? "var(--green)" : "var(--border)"}`,
                            borderRadius: "var(--radius-sm)",
                          }}
                        >
                          <div>
                            <strong style={{ fontSize: "0.82rem", color: "var(--text)" }}>{run.title}</strong>
                            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                              {new Date(run.createdAt).toLocaleTimeString()} • Risk Score: {run.operationalRisk.score} • {run.impactedAssets.length} assets impacted
                            </div>
                          </div>

                          <button
                            type="button"
                            className={`btn ${isCurrent ? "btn--primary" : "btn--outline"}`}
                            style={{ padding: "0.25rem 0.6rem", fontSize: "0.75rem" }}
                            onClick={() => setCurrentResult(run)}
                          >
                            {isCurrent ? "Viewing" : "Load Run"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: COMMS & TELEMETRY SANDBOX (PHASE 2)                         */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === "sandbox" && (
        <div>
          {/* Simulator Status Overview */}
          <div className="grid-3" style={{ marginBottom: "1.25rem" }}>
            <div className="kpi-tile">
              <div className="kpi-tile__label">Satellite Link State</div>
              <div className="kpi-tile__value">
                <span
                  className={`badge ${
                    connectivity === "NORMAL"
                      ? "badge--operational"
                      : connectivity === "OFFLINE"
                      ? "badge--critical"
                      : "badge--warning"
                  }`}
                  style={{ fontSize: "1.1rem", padding: "0.3rem 0.6rem" }}
                >
                  {connectivity}
                </span>
              </div>
              <div className="kpi-tile__meta">Simulating Polar satellite link availability</div>
            </div>

            <div className="kpi-tile">
              <div className="kpi-tile__label">Edge SSD Store-and-Forward Buffer</div>
              <div className="kpi-tile__value">
                {queueSize} <span className="kpi-tile__unit">packets</span>
              </div>
              <div className="kpi-tile__meta">
                {queueSize > 0 ? "Queued during link blackout" : "Buffer empty (100% ingested)"}
              </div>
            </div>

            <div className="kpi-tile">
              <div className="kpi-tile__label">Simulation Engine Step</div>
              <div className="kpi-tile__value">#{simulationStatus?.step ?? 0}</div>
              <div className="kpi-tile__meta">
                Last synced at {simulationStatus?.lastSync ? new Date(simulationStatus.lastSync).toLocaleTimeString() : "Live"}
              </div>
            </div>
          </div>

          {/* Interactive Controls */}
          <div className="grid-2">
            {/* Link Connectivity Control */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">📡 Satellite Link Connectivity Simulation</h2>
                <span className="card-subtitle">Simulate real polar communications disruptions</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.5rem" }}>
                <button
                  className={`btn ${connectivity === "NORMAL" ? "btn--primary" : "btn--outline"}`}
                  onClick={() => changeConnectivity("NORMAL")}
                >
                  ● NORMAL: 100% immediate delivery to MQTT broker
                </button>
                <button
                  className={`btn ${connectivity === "DEGRADED" ? "btn--primary" : "btn--outline"}`}
                  onClick={() => changeConnectivity("DEGRADED")}
                >
                  ▲ DEGRADED: 30% packet loss routed to edge buffer
                </button>
                <button
                  className={`btn ${connectivity === "OFFLINE" ? "btn--danger" : "btn--outline"}`}
                  onClick={() => changeConnectivity("OFFLINE")}
                >
                  ■ OFFLINE: Total satellite blackout, 100% stored in edge buffer
                </button>
                <button
                  className={`btn ${connectivity === "RECOVERY" ? "btn--primary" : "btn--outline"}`}
                  onClick={() => changeConnectivity("RECOVERY")}
                >
                  ↺ RECOVERY: Batch replay buffered packets with server acknowledgement
                </button>
              </div>
            </div>

            {/* Anomaly Preset Injections */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">⚡ Synthetic Anomaly Preset Injections</h2>
                <span className="card-subtitle">Trigger targeted system disruptions</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.5rem" }}>
                <button
                  className="btn btn--outline"
                  onClick={() => triggerAnomaly("COOLANT_SPIKE")}
                  style={{ textAlign: "left", justifyContent: "flex-start" }}
                >
                  🔥 Coolant Temperature Surge (+25°C in 60s on Primary Generator)
                </button>
                <button
                  className="btn btn--outline"
                  onClick={() => triggerAnomaly("SOLAR_DROP")}
                  style={{ textAlign: "left", justifyContent: "flex-start" }}
                >
                  ⛅ Solar Array Obscuration (Simulated Blizzard Snow Cover)
                </button>
                <button
                  className="btn btn--outline"
                  onClick={() => triggerAnomaly("FUEL_LEAK")}
                  style={{ textAlign: "left", justifyContent: "flex-start" }}
                >
                  ⛽ Abnormal Fuel Consumption Spike (Simulated Transfer Leak)
                </button>
                <button
                  className="btn btn--outline"
                  onClick={() => triggerAnomaly("WATER_FREEZE")}
                  style={{ textAlign: "left", justifyContent: "flex-start" }}
                >
                  🧊 Lake Water Intake Line Freeze (Temperature Drop to -2°C)
                </button>
                <button
                  className="btn btn--outline"
                  onClick={() => triggerAnomaly("STORM_SURGE")}
                  style={{ textAlign: "left", justifyContent: "flex-start" }}
                >
                  🌪 Severe Katabatic Wind Gust (Blizzard Warning Trigger)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
