import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { OperatorRole } from "@maitri-bharati/shared";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: OperatorRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps): React.JSX.Element {
  const { isAuthenticated, loading, user, hasRole } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="app-content" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <div style={{ textAlign: "center" }}>
          <div className="status-indicator status-indicator--nominal" style={{ width: "24px", height: "24px", margin: "0 auto 1rem" }} />
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Authenticating remote terminal session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !hasRole(...allowedRoles)) {
    return (
      <div className="app-content">
        <div className="card" style={{ maxWidth: "600px", margin: "4rem auto", textAlign: "center", padding: "2.5rem" }}>
          <div className="status-badge status-badge--critical" style={{ display: "inline-block", marginBottom: "1rem" }}>
            ACCESS RESTRICTED (HTTP 403)
          </div>
          <h2 style={{ fontSize: "1.4rem", color: "var(--text)", marginBottom: "0.5rem" }}>
            Insufficient Operator Privileges
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: 1.5, marginBottom: "1.5rem" }}>
            This workspace requires authorized credentials under role:{" "}
            <strong>[{allowedRoles.join(", ")}]</strong>.<br />
            Current authenticated operator <strong>{user?.username}</strong> holds role:{" "}
            <span className="status-badge status-badge--nominal">{user?.role}</span>.
          </p>
          <button
            className="btn btn--secondary"
            onClick={() => window.history.back()}
          >
            ← Return to Previous Workspace
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
