import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

interface PersonaPreset {
  title: string;
  role: string;
  username: string;
  scope: string;
  desc: string;
}

const PRESET_PERSONAS: PersonaPreset[] = [
  {
    title: "Col. Rajesh Sharma",
    role: "ADMIN",
    username: "admin",
    scope: "Global Polar Fleet",
    desc: "Unrestricted master operations, system configuration, demo & user control",
  },
  {
    title: "Cmdr. Vikram Negi",
    role: "OPERATOR",
    username: "officer.maitri",
    scope: "Maitri Station",
    desc: "Station monitoring, alarm triage, simulated procedure proposals",
  },
  {
    title: "Lt. Cmdr. Ananya Roy",
    role: "OPERATOR",
    username: "officer.bharati",
    scope: "Bharati Station",
    desc: "Coastal station operations, tri-gen microgrid oversight",
  },
  {
    title: "Dr. Pranav Deshmukh",
    role: "ENGINEER",
    username: "engineer.patel",
    scope: "Cross-Station Engineering",
    desc: "What-If resilience stress simulations, generator failure models",
  },
  {
    title: "Kavita Raman",
    role: "LOGISTICS",
    username: "logistics.sharma",
    scope: "Supply Chain & Cargo",
    desc: "Depletion radar, cargo requisitions, resupply optimization",
  },
  {
    title: "Duty Desk Officer",
    role: "VIEWER",
    username: "viewer",
    scope: "Read-Only Terminal",
    desc: "Read-only situational awareness, no mutation privileges",
  },
];

export function LoginPage(): React.JSX.Element {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("antigravity2026");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // If already authenticated, redirect to previous page or /
  if (isAuthenticated) {
    const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/";
    navigate(from, { replace: true });
  }

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const result = await login(username, password);
    setIsSubmitting(false);

    if (result.success) {
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/";
      navigate(from, { replace: true });
    } else {
      setErrorMessage(result.error || "Login verification failed.");
    }
  };

  const selectPersona = (p: PersonaPreset) => {
    setUsername(p.username);
    setPassword("antigravity2026");
    setErrorMessage(null);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg, #f7f8f4)",
        padding: "2rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "960px",
          background: "#ffffff",
          borderRadius: "12px",
          border: "1px solid var(--border, #e2e6df)",
          boxShadow: "0 12px 36px rgba(11, 74, 53, 0.08)",
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
        }}
      >
        {/* Left: Login Form */}
        <div style={{ padding: "3rem 2.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                background: "var(--green, #146b4a)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                fontWeight: "bold",
                fontSize: "1.1rem",
              }}
            >
              ❄
            </div>
            <div>
              <div style={{ fontSize: "0.8rem", fontWeight: 700, letterSpacing: "0.08em", color: "var(--green, #146b4a)" }}>
                SIH26060 PLATFORM
              </div>
              <h1 style={{ margin: 0, fontSize: "1.25rem", color: "var(--text, #17211b)" }}>
                Antarctic Operations Terminal
              </h1>
            </div>
          </div>

          <p style={{ color: "var(--text-muted, #7a847d)", fontSize: "0.875rem", marginBottom: "2rem", lineHeight: 1.5 }}>
            Authenticate with verified mission credentials to access real-time Digital Twin telemetry, resilience models, and logistics control.
          </p>

          {errorMessage && (
            <div
              style={{
                padding: "0.75rem 1rem",
                borderRadius: "6px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                fontSize: "0.85rem",
                marginBottom: "1.25rem",
              }}
            >
              ⚠️ {errorMessage}
            </div>
          )}

          <form onSubmit={handleLoginSubmit}>
            <div style={{ marginBottom: "1.25rem" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "var(--text, #17211b)",
                  marginBottom: "0.4rem",
                }}
              >
                Operator Call-Sign / Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.65rem 0.85rem",
                  border: "1px solid var(--border, #e2e6df)",
                  borderRadius: "6px",
                  fontSize: "0.9rem",
                  color: "var(--text, #17211b)",
                  background: "#ffffff",
                }}
              />
            </div>

            <div style={{ marginBottom: "1.75rem" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "var(--text, #17211b)",
                  marginBottom: "0.4rem",
                }}
              >
                Mission Security Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.65rem 0.85rem",
                  border: "1px solid var(--border, #e2e6df)",
                  borderRadius: "6px",
                  fontSize: "0.9rem",
                  color: "var(--text, #17211b)",
                  background: "#ffffff",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                width: "100%",
                padding: "0.75rem",
                background: isSubmitting ? "var(--text-muted, #7a847d)" : "var(--green, #146b4a)",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                fontWeight: 600,
                fontSize: "0.95rem",
                cursor: isSubmitting ? "not-allowed" : "pointer",
                transition: "background 0.2s",
              }}
            >
              {isSubmitting ? "Authenticating Session..." : "Authorize Terminal Access →"}
            </button>
          </form>

          <div
            style={{
              marginTop: "2rem",
              paddingTop: "1.25rem",
              borderTop: "1px solid var(--border, #e2e6df)",
              fontSize: "0.75rem",
              color: "var(--text-muted, #7a847d)",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>HTTP-Only Cookie Session</span>
            <span>Scrypt Hash Verified</span>
          </div>
        </div>

        {/* Right: Quick Demo Persona Selector */}
        <div
          style={{
            background: "var(--surface-soft, #f0f3ed)",
            borderLeft: "1px solid var(--border, #e2e6df)",
            padding: "2.5rem 2rem",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ marginBottom: "1rem" }}>
            <span
              style={{
                fontSize: "0.7rem",
                fontWeight: 700,
                letterSpacing: "0.06em",
                color: "var(--green, #146b4a)",
                textTransform: "uppercase",
              }}
            >
              Evaluation & Judging Profiles
            </span>
            <h2 style={{ fontSize: "1.1rem", margin: "0.25rem 0 0", color: "var(--text, #17211b)" }}>
              One-Click Persona Switcher
            </h2>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted, #7a847d)", margin: "0.35rem 0 1rem" }}>
              Select an authorized polar expedition role to auto-populate credentials for role-based testing.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", flex: 1, overflowY: "auto" }}>
            {PRESET_PERSONAS.map((p) => {
              const isSelected = username === p.username;
              return (
                <div
                  key={p.username}
                  onClick={() => selectPersona(p)}
                  style={{
                    padding: "0.75rem 1rem",
                    borderRadius: "6px",
                    background: isSelected ? "#ffffff" : "rgba(255, 255, 255, 0.6)",
                    border: `1.5px solid ${isSelected ? "var(--green, #146b4a)" : "var(--border, #e2e6df)"}`,
                    cursor: "pointer",
                    transition: "all 0.15s ease-in-out",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                    <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text, #17211b)" }}>
                      {p.title}
                    </span>
                    <span
                      style={{
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        padding: "0.15rem 0.4rem",
                        borderRadius: "4px",
                        background:
                          p.role === "ADMIN"
                            ? "#dcfce7"
                            : p.role === "OPERATOR"
                            ? "#e0e7ff"
                            : p.role === "ENGINEER"
                            ? "#fef3c7"
                            : "#f3f4f6",
                        color:
                          p.role === "ADMIN"
                            ? "#15803d"
                            : p.role === "OPERATOR"
                            ? "#3730a3"
                            : p.role === "ENGINEER"
                            ? "#92400e"
                            : "#374151",
                      }}
                    >
                      {p.role}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted, #7a847d)", lineHeight: 1.3 }}>
                    {p.desc}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: "1rem", fontSize: "0.75rem", color: "var(--text-muted, #7a847d)", textAlign: "center" }}>
            All personas use default demo passphrase: <code>antigravity2026</code>
          </div>
        </div>
      </div>
    </div>
  );
}
