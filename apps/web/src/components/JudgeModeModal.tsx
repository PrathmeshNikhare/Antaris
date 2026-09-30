import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStation } from "../hooks/useStation";

export interface JudgeStep {
  step: number;
  title: string;
  category: string;
  route: string;
  actionLabel?: string;
  description: string;
  judgingHighlights: string[];
  evidenceNotes: string;
  runAction?: (helpers: {
    navigate: (path: string) => void;
    setStationId: (id: string) => void;
    triggerAnomaly: (type: string) => Promise<void>;
    changeConnectivity: (state: any) => Promise<void>;
  }) => Promise<void> | void;
}

export const JUDGE_STEPS: JudgeStep[] = [
  {
    step: 1,
    title: "Authentication & Role-Based Access Control",
    category: "SECURITY & RBAC",
    route: "/login",
    actionLabel: "Inspect Auth & Personas",
    description: "Multi-persona authentication system with HTTP-only cookies, JWT verification, and station-scoped authorization. 5 evaluation personas available with one-click sign-in.",
    judgingHighlights: [
      "Zero sensitive tokens stored in localStorage (secure HTTP-only cookie + fallback).",
      "Station-scoped authorization restricts station operators to their assigned base.",
      "5 distinct personas: Admin, Maitri Officer, Bharati Officer, Engineer Patel, Logistics Sharma.",
    ],
    evidenceNotes: "Server routes enforce verifyToken and requireRole middleware in apps/api/src/auth/.",
    runAction: ({ navigate }) => {
      navigate("/login");
    },
  },
  {
    step: 2,
    title: "Command-Center Remote Overview",
    category: "OVERVIEW & TELEMETRY",
    route: "/",
    actionLabel: "View Maitri Command Console",
    description: "High-density operations console displaying selected station, mission readiness, AMRI resilience index, power balance, environmental sensors, and Decision Trace causal timeline.",
    judgingHighlights: [
      "Immediate situational awareness: status, power reserve, life-support, fuel autonomy.",
      "Live Antarctic Mission Resilience Index (AMRI) showing real-time health breakdown.",
      "Clear visual provenance badges: MEASURED, EXTERNAL, SIMULATED, COMPUTED.",
    ],
    evidenceNotes: "Digital Twin state registry aggregates live telemetry points via PostgreSQL and WebSocket.",
    runAction: ({ navigate, setStationId }) => {
      setStationId("station-maitri");
      navigate("/");
    },
  },
  {
    step: 3,
    title: "3D Antarctic Digital Twin & Visual Modes",
    category: "3D WEBGL & SPATIAL",
    route: "/twin",
    actionLabel: "Open 3D Twin & Modes",
    description: "Fully interactive WebGL 3D model of Maitri station built with React Three Fiber. Features 6 visual inspection modes: NORMAL, X-RAY, SYSTEM, HEAT MAP, FORECAST, REPLAY.",
    judgingHighlights: [
      "Independent procedural 3D model with custom architecture (zero cloned GLBs).",
      "Dynamic polar lighting with sun position slider, snow drift particle system, and 2D schematic blueprint fallback.",
      "Raycasting asset click: inspect GEN-01 alternator, fuel tanks, and battery arrays.",
    ],
    evidenceNotes: "Station3DCanvas.tsx with orbit controls, lerp camera focus, and GPU resource cleanup.",
    runAction: ({ navigate, setStationId }) => {
      setStationId("station-maitri");
      navigate("/twin");
    },
  },
  {
    step: 4,
    title: "Inject Controlled Generator Anomaly",
    category: "SYNTHETIC ANOMALIES",
    route: "/demo",
    actionLabel: "Inject GEN-01 Overheat (+25°C)",
    description: "Admin/Engineer secured simulator control injecting a deterministic thermal spike into Primary Generator GEN-01 (+25°C coolant surge).",
    judgingHighlights: [
      "Deterministic seeded PRNG telemetry engine — zero uncontrolled Math.random().",
      "Physical bounds validation: thermal generation triggers downstream electrical derating.",
      "Strict role protection: only ADMIN and ENGINEER roles can trigger anomaly presets.",
    ],
    evidenceNotes: "Telemetry simulator applies preset with tick-aware deterministic sequence.",
    runAction: async ({ triggerAnomaly, navigate }) => {
      await triggerAnomaly("COOLANT_SPIKE");
      navigate("/alerts");
    },
  },
  {
    step: 5,
    title: "Incident Triage & Anomaly Detection",
    category: "ALERTS & TRIAGE",
    route: "/alerts",
    actionLabel: "Inspect Raised Critical Alert",
    description: "Real-time SPC + Isolation Forest statistical anomaly detection detects coolant threshold breach and creates an operational CRITICAL alert with evidence dossier.",
    judgingHighlights: [
      "Evidence window with z-score calculation, rate of change, and threshold crossing values.",
      "Zero black-box AI: full evidence dossier explains exactly why the anomaly was flagged.",
      "Locate in Digital Twin button enables instantaneous spatial triage.",
    ],
    evidenceNotes: "Isolation Forest and Statistical Process Control running on telemetry points in apps/api/src/intelligence/.",
    runAction: ({ navigate }) => {
      navigate("/alerts");
    },
  },
  {
    step: 6,
    title: "Locate in 3D Digital Twin",
    category: "SPATIAL LINKING",
    route: "/twin",
    actionLabel: "Focus Camera on GEN-01 in 3D",
    description: "Clicking 'Locate in Digital Twin' on the incident alert flies the 3D camera directly to GEN-01 in the Power House with glowing warning beacon and live telemetry inspector.",
    judgingHighlights: [
      "Bi-directional spatial linking between 2D tabular alerts and 3D WebGL viewport.",
      "Smooth camera position lerp with automatic orbit pivot adjustment.",
      "Displays real-time asset health derating (100% -> 42%) and live operating temperature.",
    ],
    evidenceNotes: "Camera fly-to animation in Station3DCanvas.tsx with selectedAssetId hotspot binding.",
    runAction: ({ navigate }) => {
      navigate("/twin");
    },
  },
  {
    step: 7,
    title: "Cross-Domain Causal Chain Analysis",
    category: "EXPLAINABLE CAUSAL AI",
    route: "/",
    actionLabel: "Inspect Causal Propagation Chain",
    description: "Visualizes the multi-hop dependency cascade: GEN-01 Overheat -> Microgrid Capacity Drop -> HVAC Auxiliary Shed -> Habitat Thermal Dissipation -> Fuel Burn Rate Surge.",
    judgingHighlights: [
      "Asset dependency directed acyclic graph (DAG) traversed via breadth-first search.",
      "Downstream blast radius identification across energy, life-support, and logistics domains.",
      "Every cascade hop shows engineering justification and propagated probability score.",
    ],
    evidenceNotes: "apps/api/src/twin/dependency-graph.ts and Decision Trace records.",
    runAction: ({ navigate }) => {
      navigate("/");
    },
  },
  {
    step: 8,
    title: "Antarctic Mission Resilience Index (AMRI)",
    category: "DECISION SUPPORT",
    route: "/",
    actionLabel: "Inspect AMRI Breakdown",
    description: "Dynamic 8-factor resilience score evaluating station survival margins across energy, battery autonomy, fuel autonomy, infrastructure health, thermal safety, comms freshness, and critical stock.",
    judgingHighlights: [
      "100% explainable and formula-backed: zero arbitrary black-box scores.",
      "Identifies top degradation drivers (e.g. Infrastructure Health drop, Hazard Burden surge).",
      "Dynamic confidence and data quality weighting.",
    ],
    evidenceNotes: "apps/api/src/intelligence/resilience-index.ts calculating weighted harmonic metrics.",
    runAction: ({ navigate }) => {
      navigate("/");
    },
  },
  {
    step: 9,
    title: "Evidence-Grounded Operations Copilot",
    category: "AI COPILOT & LLM",
    route: "/copilot",
    actionLabel: "Ask Copilot: Why is readiness falling?",
    description: "Local Ollama LLM assistant with typed, read-only tools and deterministic offline fallback. Answers are strictly grounded in live Digital Twin telemetry, dependency DAGs, and inventory state.",
    judgingHighlights: [
      "Zero hallucination: tools strictly return verifiable JSON evidence dossiers.",
      "Strict RBAC enforcement: LLM cannot execute raw SQL or bypass operator permissions.",
      "Graceful offline fallback: fully functional even when local Ollama daemon is offline.",
    ],
    evidenceNotes: "apps/api/src/copilot/ and apps/web/src/features/copilot/CopilotPage.tsx (zero dangerouslySetInnerHTML).",
    runAction: ({ navigate }) => {
      navigate("/copilot");
    },
  },
  {
    step: 10,
    title: "What-If Counterfactual Resilience Simulation",
    category: "COUNTERFACTUAL SIMULATION",
    route: "/simulations",
    actionLabel: "Run 2-Hour Generator Failure",
    description: "Counterfactual simulation engine cloning an isolated, immutable snapshot of the Digital Twin to model a 2-hour generator failure without touching live physical telemetry.",
    judgingHighlights: [
      "Live Twin state immutability: zero mutation of operational telemetry streams.",
      "Durable database persistence: all runs saved to simulation_runs table.",
      "Blast radius graph, comparison delta table, and 4-step recovery action protocol.",
    ],
    evidenceNotes: "apps/api/src/simulation/resilience-engine.ts and SimulationRepository.",
    runAction: ({ navigate }) => {
      navigate("/simulations");
    },
  },
  {
    step: 11,
    title: "Resupply Cargo Allocation Optimizer",
    category: "OPTIMIZATION ENGINE",
    route: "/logistics",
    actionLabel: "Open Resupply Optimizer",
    description: "Deterministic knapsack cargo optimization engine calculating optimal resupply payload allocation based on daily burn rates, days remaining, critical thresholds, and payload capacity.",
    judgingHighlights: [
      "Greedy utility-ratio optimization heuristic with clear constraint rationale.",
      "Prioritizes life-support critical items (Polar Diesel, Water Filters, Medical Spares).",
      "Shows pre- vs post-delivery survival coverage in days.",
    ],
    evidenceNotes: "apps/api/src/logistics/cargo-optimizer.ts exposed at /stations/:stationId/cargo/optimize.",
    runAction: ({ navigate }) => {
      navigate("/logistics");
    },
  },
  {
    step: 12,
    title: "Mission Meteorological Window Planner",
    category: "MISSION PLANNING",
    route: "/logistics",
    actionLabel: "Inspect Mission Windows",
    description: "Combines katabatic wind forecasts, blizzards, daylight hours, satellite transponder passes, and station resilience to recommend safe transit and maintenance windows.",
    judgingHighlights: [
      "Classifies candidate windows: OPTIMAL (Green), MARGINAL (Yellow), NO_GO (Red).",
      "Explicitly marked COMPUTED / DEMO PLANNING for truth-in-data compliance.",
      "Identifies meteorological constraints (wind speed >45 m/s, blizzard whiteout).",
    ],
    evidenceNotes: "apps/api/src/logistics/mission-window-planner.ts.",
    runAction: ({ navigate }) => {
      navigate("/logistics");
    },
  },
  {
    step: 13,
    title: "Antarctic Comms Outage & Edge Store-and-Forward",
    category: "EDGE RESILIENCE",
    route: "/simulations",
    actionLabel: "Simulate Satellite Link Blackout (OFFLINE)",
    description: "Simulates severe polar geomagnetic storms causing satellite blackout. Edge SSD store-and-forward buffer queues all telemetry packets locally with zero data loss.",
    judgingHighlights: [
      "UI displays OFFLINE blackout state and live packet queue depth incrementing.",
      "Fast-lane telemetry diagnostics: measured compression ratio, payload bytes, queue age.",
      "Stale state indicators clearly warn operators when viewing buffered edge state.",
    ],
    evidenceNotes: "Edge simulator buffer in apps/api/src/telemetry/simulator.ts.",
    runAction: async ({ changeConnectivity, navigate }) => {
      await changeConnectivity("OFFLINE");
      navigate("/simulations");
    },
  },
  {
    step: 14,
    title: "Satellite Link Recovery & Batch Replay",
    category: "EDGE RESILIENCE",
    route: "/simulations",
    actionLabel: "Restore Link & Replay Buffered Telemetry (RECOVERY)",
    description: "Satellite link restored. Edge buffer performs fast-lane batch replay with server-side sequence numbers, deduplication, and out-of-order handling.",
    judgingHighlights: [
      "Queue drains smoothly from buffer back to zero packets.",
      "Server sends explicit sequence acknowledgements preventing duplicate points.",
      "Link transitions automatically from RECOVERY back to NORMAL.",
    ],
    evidenceNotes: "apps/api/src/telemetry/telemetry.router.ts fast-lane endpoints.",
    runAction: async ({ changeConnectivity, navigate }) => {
      await changeConnectivity("RECOVERY");
      navigate("/simulations");
    },
  },
  {
    step: 15,
    title: "Chronological Mission Events & Log",
    category: "MISSION LOG",
    route: "/events",
    actionLabel: "Inspect Mission Events Timeline",
    description: "Dedicated operational mission log distinct from security audit logs. Tracks environmental events, generator trips, cargo movements, and alert lifecycles.",
    judgingHighlights: [
      "Comprehensive search and category filtering: SENSOR, ALERT, ENERGY, LOGISTICS, RESEARCH.",
      "Severity indicators and provenance tracking for every event.",
      "Direct spatial link to inspect the associated asset in the 3D twin.",
    ],
    evidenceNotes: "apps/api/src/routes/events.router.ts querying mission_events table.",
    runAction: ({ navigate }) => {
      navigate("/events");
    },
  },
  {
    step: 16,
    title: "Tamper-Evident Operator Audit Trail",
    category: "SECURITY & COMPLIANCE",
    route: "/audit",
    actionLabel: "Inspect Security Audit Logs",
    description: "Immutable, append-only audit trail capturing every operator mutation, configuration threshold change, requisition approval, and simulation execution.",
    judgingHighlights: [
      "Captures authenticated operator ID, station ID, timestamp, and action description.",
      "Stores structured JSON before-and-after change diffs for compliance verification.",
      "Station-scoped: operators cannot view unauthorized cross-station security logs.",
    ],
    evidenceNotes: "apps/api/src/routes/audit.router.ts querying audit_logs table.",
    runAction: ({ navigate }) => {
      navigate("/audit");
    },
  },
  {
    step: 17,
    title: "Executive Reporting (Official MoES/NCPOR A4 PDF & CSV)",
    category: "REPORTING WORKSPACE",
    route: "/reports",
    actionLabel: "View Report & Print A4 PDF",
    description: "Formal executive operations report with official Ministry of Earth Sciences (MoES) and NCPOR letterhead formatting, domain metrics, active incidents, and A4 print stylesheet.",
    judgingHighlights: [
      "Official government letterhead design with exact A4 print media queries (@media print).",
      "Domain selection: General, Energy, Environment, Infrastructure, Logistics, Incidents.",
      "One-click CSV data export and JSON structured export.",
    ],
    evidenceNotes: "apps/web/src/features/reports/ReportsPage.tsx with index.css A4 print styling.",
    runAction: ({ navigate }) => {
      navigate("/reports");
    },
  },
  {
    step: 18,
    title: "Multi-Station Portability (Switch to Bharati)",
    category: "ARCHITECTURE & MULTI-TENANCY",
    route: "/",
    actionLabel: "Switch Station to Bharati (69°S)",
    description: "Switch active station from Maitri to Bharati Station. Demonstrates complete multi-station architectural parity with zero duplicated frontend business logic.",
    judgingHighlights: [
      "Unique 3D architectural representation: modern elevated aerodynamic pod on stilts.",
      "Independent microgrid topology, distinct asset IDs, separate inventory and sensor streams.",
      "Strict station isolation: mutations and requisitions are strictly scoped to Bharati.",
    ],
    evidenceNotes: "Twin state, telemetry simulator, and inventory repositories indexed by stationId.",
    runAction: ({ navigate, setStationId }) => {
      setStationId("station-bharati");
      navigate("/");
    },
  },
];

interface JudgeModeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function JudgeModeModal({ isOpen, onClose }: JudgeModeModalProps): React.JSX.Element | null {
  const navigate = useNavigate();
  const { setStationId, triggerAnomaly, changeConnectivity } = useStation();
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);

  if (!isOpen) return null;

  const currentStep = JUDGE_STEPS[currentStepIndex];
  const progressPct = Math.round(((currentStepIndex + 1) / JUDGE_STEPS.length) * 100);

  const handleExecute = async () => {
    try {
      setIsExecuting(true);
      if (currentStep.runAction) {
        await currentStep.runAction({
          navigate,
          setStationId,
          triggerAnomaly,
          changeConnectivity,
        });
      } else {
        navigate(currentStep.route);
      }
    } catch (err) {
      console.error("Failed to execute step action:", err);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleNext = () => {
    if (currentStepIndex < JUDGE_STEPS.length - 1) {
      const nextIdx = currentStepIndex + 1;
      setCurrentStepIndex(nextIdx);
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      const prevIdx = currentStepIndex - 1;
      setCurrentStepIndex(prevIdx);
    }
  };

  if (isMinimized) {
    return (
      <div
        style={{
          position: "fixed",
          bottom: "1.5rem",
          right: "1.5rem",
          zIndex: 9999,
          backgroundColor: "var(--green)",
          color: "#fff",
          padding: "0.6rem 1rem",
          borderRadius: "var(--radius-md)",
          boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          cursor: "pointer",
        }}
        onClick={() => setIsMinimized(false)}
      >
        <span style={{ fontSize: "1.1rem" }}>🎯</span>
        <div>
          <div style={{ fontSize: "0.78rem", fontWeight: 700 }}>
            Judge Mode: Step {currentStep.step} / {JUDGE_STEPS.length}
          </div>
          <div style={{ fontSize: "0.7rem", opacity: 0.85 }}>{currentStep.title}</div>
        </div>
        <button
          type="button"
          style={{
            background: "rgba(255,255,255,0.2)",
            border: "none",
            color: "#fff",
            borderRadius: "4px",
            padding: "0.2rem 0.4rem",
            fontSize: "0.7rem",
            cursor: "pointer",
          }}
          onClick={(e) => {
            e.stopPropagation();
            setIsMinimized(false);
          }}
        >
          Expand ↗
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0, 0, 0, 0.45)",
        zIndex: 9998,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "var(--radius-lg, 10px)",
          width: "100%",
          maxWidth: "760px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 12px 32px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            backgroundColor: "var(--green)",
            color: "#fff",
            padding: "1rem 1.25rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span style={{ fontSize: "1.4rem" }}>🎯</span>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#fff" }}>
                SIH26060 Evaluator & Judge Mode Guide
              </h2>
              <span style={{ fontSize: "0.75rem", opacity: 0.85 }}>
                18-Step Deterministic Antarctic Operations Demonstration Sequence
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <button
              type="button"
              style={{
                background: "rgba(255,255,255,0.2)",
                border: "none",
                color: "#fff",
                borderRadius: "4px",
                padding: "0.25rem 0.5rem",
                fontSize: "0.75rem",
                cursor: "pointer",
              }}
              onClick={() => setIsMinimized(true)}
              title="Minimize to bottom corner"
            >
              Minimize ↘
            </button>
            <button
              type="button"
              style={{
                background: "transparent",
                border: "none",
                color: "#fff",
                fontSize: "1.2rem",
                cursor: "pointer",
                padding: "0.2rem 0.4rem",
              }}
              onClick={onClose}
              title="Close modal"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Progress Bar & Step Selector */}
        <div style={{ padding: "0.75rem 1.25rem", borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-subtle)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
              Step {currentStep.step} of {JUDGE_STEPS.length} ({progressPct}%)
            </span>
            <select
              value={currentStepIndex}
              onChange={(e) => setCurrentStepIndex(parseInt(e.target.value, 10))}
              style={{
                fontSize: "0.75rem",
                padding: "0.2rem 0.4rem",
                borderRadius: "4px",
                border: "1px solid var(--border)",
                backgroundColor: "#fff",
              }}
            >
              {JUDGE_STEPS.map((s, idx) => (
                <option key={s.step} value={idx}>
                  {s.step}. {s.title}
                </option>
              ))}
            </select>
          </div>

          <div style={{ height: "6px", backgroundColor: "var(--border)", borderRadius: "3px", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${progressPct}%`,
                backgroundColor: "var(--green)",
                transition: "width 0.25s ease",
              }}
            />
          </div>
        </div>

        {/* Body Content */}
        <div style={{ padding: "1.25rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
              <span className="badge badge--operational" style={{ fontSize: "0.68rem" }}>
                {currentStep.category}
              </span>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                ROUTE: {currentStep.route}
              </span>
            </div>
            <h3 style={{ margin: "0.2rem 0 0.5rem", fontSize: "1.2rem", fontWeight: 700, color: "var(--text)" }}>
              Step {currentStep.step}: {currentStep.title}
            </h3>
            <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
              {currentStep.description}
            </p>
          </div>

          {/* Action Trigger Banner */}
          <div
            style={{
              padding: "0.85rem 1rem",
              backgroundColor: "var(--green-soft)",
              border: "1px solid var(--green)",
              borderRadius: "var(--radius-md)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "1rem",
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--green)" }}>
                Ready to evaluate this step?
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Click below to navigate to the exact screen and trigger the demonstration action.
              </div>
            </div>

            <button
              type="button"
              className="btn btn--primary"
              onClick={handleExecute}
              disabled={isExecuting}
              style={{
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <span>{isExecuting ? "Executing…" : "⚡"}</span>
              <span>{currentStep.actionLabel || `Go to Step ${currentStep.step}`}</span>
            </button>
          </div>

          {/* What Judges Look For */}
          <div className="card" style={{ border: "1px solid var(--border)", padding: "1rem", margin: 0 }}>
            <div style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: "0.5rem", color: "var(--text)" }}>
              🎯 What Makes Our System Stand Out (Judge Talking Points):
            </div>
            <ul style={{ margin: 0, paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {currentStep.judgingHighlights.map((pt, idx) => (
                <li key={idx} style={{ fontSize: "0.82rem", color: "var(--text)", lineHeight: 1.4 }}>
                  {pt}
                </li>
              ))}
            </ul>
          </div>

          {/* Evidence Notes */}
          <div
            style={{
              padding: "0.6rem 0.8rem",
              backgroundColor: "var(--bg-subtle)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              fontFamily: "var(--font-mono)",
            }}
          >
            <strong>Technical Evidence:</strong> {currentStep.evidenceNotes}
          </div>
        </div>

        {/* Footer Navigation */}
        <div
          style={{
            padding: "0.85rem 1.25rem",
            borderTop: "1px solid var(--border)",
            backgroundColor: "#fff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <button
            type="button"
            className="btn btn--outline"
            onClick={handlePrev}
            disabled={currentStepIndex === 0}
          >
            ← Previous Step
          </button>

          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>
            {currentStepIndex + 1} / {JUDGE_STEPS.length}
          </span>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            {currentStepIndex < JUDGE_STEPS.length - 1 ? (
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleNext}
              >
                Next Step ({currentStepIndex + 2}) →
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--primary"
                onClick={onClose}
              >
                ✓ Finish Demonstration
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
