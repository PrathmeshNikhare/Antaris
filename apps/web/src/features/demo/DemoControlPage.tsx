import React, { useState, useEffect, useCallback } from "react";
import { twinApi } from "../../services/api";

// ── Demo Scenarios ──────────────────────────────────────────────────
const DEMO_SCENARIOS = [
  {
    id: "generator-anomaly",
    title: "Generator Anomaly",
    icon: "",
    description: "GEN-01 overtemperature spike & power degradation",
    preset: "generator-trip",
    category: "INFRASTRUCTURE",
    color: "#ef4444",
  },
  {
    id: "battery-degradation",
    title: "Battery Degradation",
    icon: "",
    description: "Sub-zero capacity loss in battery bank",
    preset: "battery-degradation",
    category: "ENERGY",
    color: "#f59e0b",
  },
  {
    id: "fuel-reduction",
    title: "Fuel Shortage",
    icon: "",
    description: "Critical polar diesel reserve reduction",
    preset: "fuel-reduction",
    category: "LOGISTICS",
    color: "#f97316",
  },
  {
    id: "extreme-cold",
    title: "Extreme Cold (-45°C)",
    icon: "",
    description: "Deep polar cold snap — thermal load surge",
    preset: "extreme-cold",
    category: "ENVIRONMENT",
    color: "#3b82f6",
  },
  {
    id: "high-wind",
    title: "Blizzard (48 m/s)",
    icon: "",
    description: "Category 5 storm — turbine lockout",
    preset: "high-wind",
    category: "ENVIRONMENT",
    color: "#8b5cf6",
  },
  {
    id: "comm-outage",
    title: "Comms Outage",
    icon: "",
    description: "Satellite transponder blackout — store & forward",
    preset: "comm-outage",
    category: "COMMS",
    color: "#6366f1",
  },
];

// ── Demo Flow Steps ─────────────────────────────────────────────────
const DEMO_FLOW_STEPS = [
  {
    step: 1,
    title: "Normal Operations",
    description: "Station Maitri is operating normally. All systems green.",
    action: "reset",
    icon: "1",
  },
  {
    step: 2,
    title: "Inject Generator Anomaly",
    description: "GEN-01 develops an overtemperature anomaly. Watch Twin state transition.",
    action: "inject-generator",
    icon: "2",
  },
  {
    step: 3,
    title: "Observe Twin Transition",
    description: "Navigate to Digital Twin → see DEGRADED state, anomaly detection, cascading impact.",
    action: "navigate-twin",
    icon: "3",
  },
  {
    step: 4,
    title: "Intelligence Explains",
    description: "Check Intelligence tab for anomaly analysis, cross-domain risk, and recommendations.",
    action: "navigate-intelligence",
    icon: "4",
  },
  {
    step: 5,
    title: "Run What-If Simulation",
    description: "Simulate GEN-01 failure for 2 hours. See blast radius and recovery plan.",
    action: "navigate-simulations",
    icon: "5",
  },
  {
    step: 6,
    title: "Ask the Copilot",
    description: "\"Why is GEN-01 at risk?\" — Get evidence-backed AI explanation.",
    action: "navigate-copilot",
    icon: "6",
  },
  {
    step: 7,
    title: "Communication Outage",
    description: "Trigger satellite outage. Observe store-and-forward buffering.",
    action: "inject-comms",
    icon: "7",
  },
  {
    step: 8,
    title: "Recovery & Audit",
    description: "Restore normal state. Check audit trail for all actions taken.",
    action: "reset-and-audit",
    icon: "8",
  },
];

export function DemoControlPage(): React.JSX.Element {
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [isInjecting, setIsInjecting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [simStatus, setSimStatus] = useState<{ connectivity: string; anomalyPreset: string } | null>(null);

  // ── Poll simulator status ─────────────────────────────────────
  const refreshStatus = useCallback(async () => {
    try {
      const status = await twinApi.getSimulationStatus();
      setSimStatus(status);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, 4000);
    return () => clearInterval(interval);
  }, [refreshStatus]);

  // ── Inject anomaly ────────────────────────────────────────────
  const injectScenario = async (preset: string, scenarioId: string) => {
    setIsInjecting(true);
    setStatusMsg(`Injecting ${scenarioId}…`);
    try {
      await twinApi.triggerAnomalyPreset(preset);
      setActiveScenario(scenarioId);
      setStatusMsg(`✅ ${scenarioId} injected successfully`);
      setTimeout(refreshStatus, 1500);
    } catch (err) {
      setStatusMsg(`❌ Failed: ${(err as Error).message}`);
    } finally {
      setIsInjecting(false);
    }
  };

  // ── Reset to normal ───────────────────────────────────────────
  const resetToNormal = async () => {
    setIsInjecting(true);
    setStatusMsg("Resetting to normal…");
    try {
      // Clear anomalies
      await fetch("http://localhost:3001/api/telemetry/simulate/anomaly/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stationId: "station-maitri" }),
      });
      // Restore connectivity
      await twinApi.setConnectivity("NORMAL");
      setActiveScenario(null);
      setStatusMsg("✅ Station restored to normal operations");
      setTimeout(refreshStatus, 1500);
    } catch (err) {
      setStatusMsg(`❌ Reset failed: ${(err as Error).message}`);
    } finally {
      setIsInjecting(false);
    }
  };

  // ── Set connectivity ──────────────────────────────────────────
  const setConnectivity = async (state: "NORMAL" | "DEGRADED" | "OFFLINE") => {
    setIsInjecting(true);
    try {
      await twinApi.setConnectivity(state);
      setStatusMsg(`✅ Connectivity set to ${state}`);
      setTimeout(refreshStatus, 1000);
    } catch (err) {
      setStatusMsg(`❌ Failed: ${(err as Error).message}`);
    } finally {
      setIsInjecting(false);
    }
  };

  // ── Execute demo step ─────────────────────────────────────────
  const executeDemoStep = async (step: (typeof DEMO_FLOW_STEPS)[number]) => {
    switch (step.action) {
      case "reset":
        await resetToNormal();
        break;
      case "inject-generator":
        await injectScenario("generator-trip", "generator-anomaly");
        break;
      case "inject-comms":
        await setConnectivity("OFFLINE");
        break;
      case "reset-and-audit":
        await resetToNormal();
        break;
      case "navigate-twin":
      case "navigate-intelligence":
      case "navigate-simulations":
      case "navigate-copilot":
        // Navigate hint only
        break;
    }
  };

  return (
    <div className="demo-page">
      {/* Header */}
      <div className="demo-header">
        <div className="demo-header-left">
          <h1 className="page-title">
            Demo Control Panel
          </h1>
          <p className="page-subtitle">
            SIH Demonstration — Inject scenarios, control connectivity, run guided demo flow
          </p>
        </div>
        <div className="demo-header-right">
          <button
            className={`demo-presentation-toggle ${isPresentationMode ? "demo-presentation-toggle--active" : ""}`}
            onClick={() => setIsPresentationMode(!isPresentationMode)}
          >
            {isPresentationMode ? "◉ Presentation Mode" : "○ Enable Presentation"}
          </button>
          <button
            className="demo-reset-btn"
            onClick={resetToNormal}
            disabled={isInjecting}
          >
            Reset All
          </button>
        </div>
      </div>

      {/* Status bar */}
      <div className="demo-status-bar">
        <div className="demo-status-item">
          <span className="demo-status-label">Connectivity</span>
          <span className={`demo-status-badge demo-status-badge--${(simStatus?.connectivity || "NORMAL").toLowerCase()}`}>
            {simStatus?.connectivity || "NORMAL"}
          </span>
        </div>
        <div className="demo-status-item">
          <span className="demo-status-label">Active Anomaly</span>
          <span className={`demo-status-badge ${activeScenario ? "demo-status-badge--warning" : "demo-status-badge--normal"}`}>
            {activeScenario || "None"}
          </span>
        </div>
        {statusMsg && (
          <div className="demo-status-msg">{statusMsg}</div>
        )}
      </div>

      <div className="demo-content">
        {/* Left: Scenario injection cards */}
        <div className="demo-section">
          <h2 className="demo-section-title">Scenario Injection</h2>
          <p className="demo-section-desc">Click to inject an anomaly into the live Digital Twin</p>

          <div className="demo-scenario-grid">
            {DEMO_SCENARIOS.map((scenario) => (
              <button
                key={scenario.id}
                className={`demo-scenario-card ${activeScenario === scenario.id ? "demo-scenario-card--active" : ""}`}
                onClick={() => injectScenario(scenario.preset, scenario.id)}
                disabled={isInjecting}
                style={{ "--scenario-color": scenario.color } as React.CSSProperties}
              >
                <div className="demo-scenario-info">
                  <span className="demo-scenario-title">{scenario.title}</span>
                  <span className="demo-scenario-desc">{scenario.description}</span>
                </div>
                <span className="demo-scenario-category">{scenario.category}</span>
              </button>
            ))}
          </div>

          {/* Connectivity controls */}
          <h3 className="demo-subsection-title">Connectivity Control</h3>
          <div className="demo-connectivity-controls">
            {(["NORMAL", "DEGRADED", "OFFLINE"] as const).map((state) => (
              <button
                key={state}
                className={`demo-conn-btn demo-conn-btn--${state.toLowerCase()}`}
                onClick={() => setConnectivity(state)}
                disabled={isInjecting}
              >
                {state}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Presentation flow */}
        {isPresentationMode && (
          <div className="demo-section demo-section--flow">
            <h2 className="demo-section-title">Guided Demo Flow</h2>
            <p className="demo-section-desc">Step-by-step SIH demonstration sequence</p>

            <div className="demo-flow-timeline">
              {DEMO_FLOW_STEPS.map((step, idx) => (
                <div
                  key={step.step}
                  className={`demo-flow-step ${idx < currentStep ? "demo-flow-step--done" : ""} ${idx === currentStep ? "demo-flow-step--current" : ""}`}
                >
                  <div className="demo-flow-step-marker">
                    <span className="demo-flow-step-number">
                      {idx < currentStep ? "✓" : step.step}
                    </span>
                  </div>
                  <div className="demo-flow-step-content">
                    <h4 className="demo-flow-step-title">{step.title}</h4>
                    <p className="demo-flow-step-desc">{step.description}</p>
                    {idx === currentStep && (
                      <button
                        className="demo-flow-step-action"
                        onClick={async () => {
                          await executeDemoStep(step);
                          setCurrentStep((prev) => Math.min(prev + 1, DEMO_FLOW_STEPS.length - 1));
                        }}
                        disabled={isInjecting}
                      >
                        {isInjecting ? "⏳ Executing…" : `▶ Execute Step ${step.step}`}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="demo-flow-controls">
              <button
                className="demo-flow-nav-btn"
                onClick={() => setCurrentStep(0)}
                disabled={currentStep === 0}
              >
                ⟵ Start Over
              </button>
              <span className="demo-flow-progress">
                Step {currentStep + 1} of {DEMO_FLOW_STEPS.length}
              </span>
              <button
                className="demo-flow-nav-btn"
                onClick={() => setCurrentStep((p) => Math.min(p + 1, DEMO_FLOW_STEPS.length - 1))}
                disabled={currentStep >= DEMO_FLOW_STEPS.length - 1}
              >
                Skip ⟶
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
