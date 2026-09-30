import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useStation } from "../../hooks/useStation";
import { twinApi } from "../../services/api";
import type { MissionEvent } from "@maitri-bharati/shared";

type EventCategory =
  | "ALL"
  | "SYSTEM"
  | "ENERGY"
  | "LOGISTICS"
  | "COMMUNICATION"
  | "RESEARCH"
  | "ALERT"
  | "MAINTENANCE"
  | "MISSION";

export function EventsPage(): React.JSX.Element {
  const navigate = useNavigate();
  const { stationId } = useStation();

  const [events, setEvents] = useState<MissionEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [categoryFilter, setCategoryFilter] = useState<EventCategory>("ALL");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const fetchEvents = useCallback(async () => {
    try {
      const data = await twinApi.getMissionEvents(
        stationId,
        categoryFilter !== "ALL" ? categoryFilter : undefined,
        severityFilter !== "ALL" ? severityFilter : undefined,
        searchQuery.trim() || undefined
      );
      setEvents(data);
    } catch (err) {
      console.warn("Failed to load mission events:", err);
    } finally {
      setLoading(false);
    }
  }, [stationId, categoryFilter, severityFilter, searchQuery]);

  useEffect(() => {
    void fetchEvents();
    const interval = setInterval(fetchEvents, 6000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

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
              MISSION LOG • OPERATIONAL CHRONICLE
            </span>
          </div>
          <h1 className="page-header__title">
            {stationId === "station-maitri" ? "Maitri" : "Bharati"} Operational Events & Mission Log
          </h1>
          <p className="page-header__subtitle">
            Chronological log of physical station transitions, sensor milestones, logistics movements, and research events.
          </p>
        </div>

        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "right" }}>
          <span>Security & user actions logged separately in </span>
          <button
            type="button"
            className="button button--ghost"
            style={{ padding: "2px 6px", fontSize: "0.75rem", textDecoration: "underline" }}
            onClick={() => navigate("/audit")}
          >
            Audit Log →
          </button>
        </div>
      </header>

      {/* Filter Toolbar */}
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
          marginBottom: "1.25rem",
        }}
      >
        <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
          {(
            [
              "ALL",
              "SYSTEM",
              "ENERGY",
              "LOGISTICS",
              "COMMUNICATION",
              "RESEARCH",
              "ALERT",
              "MAINTENANCE",
              "MISSION",
            ] as EventCategory[]
          ).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              style={{
                padding: "0.3rem 0.6rem",
                fontSize: "0.75rem",
                fontWeight: 600,
                borderRadius: "4px",
                border: categoryFilter === cat ? "1px solid var(--green)" : "1px solid var(--border)",
                background: categoryFilter === cat ? "var(--green)" : "var(--surface)",
                color: categoryFilter === cat ? "#ffffff" : "var(--text)",
                cursor: "pointer",
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            type="text"
            placeholder="Search event title, zone, or text..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: "0.35rem 0.65rem",
              fontSize: "0.8rem",
              borderRadius: "4px",
              border: "1px solid var(--border)",
              minWidth: "240px",
              background: "#ffffff",
            }}
          />

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="select-control"
            style={{ padding: "0.35rem 0.5rem", fontSize: "0.8rem" }}
          >
            <option value="ALL">All Severities</option>
            <option value="INFO">Info Only</option>
            <option value="WARNING">Warning Only</option>
            <option value="CRITICAL">Critical Only</option>
          </select>
        </div>
      </div>

      {/* Timeline View */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
            Loading mission timeline...
          </div>
        ) : events.length === 0 ? (
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "3rem",
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: "0.85rem",
            }}
          >
            No mission events match the current filter.
          </div>
        ) : (
          events.map((evt) => {
            const isWarn = evt.severity === "WARNING";
            const isCrit = evt.severity === "CRITICAL";

            return (
              <div
                key={evt.id}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderLeft: isCrit ? "4px solid var(--critical)" : isWarn ? "4px solid var(--warning)" : "4px solid var(--green)",
                  borderRadius: "6px",
                  padding: "1rem 1.25rem",
                  display: "grid",
                  gridTemplateColumns: "140px 1fr auto",
                  gap: "1rem",
                  alignItems: "center",
                }}
              >
                {/* Left: Time and Category */}
                <div>
                  <div style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--text)" }}>
                    {new Date(evt.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                    {new Date(evt.createdAt).toLocaleDateString()}
                  </div>
                  <span
                    className="badge badge--info"
                    style={{ fontSize: "0.65rem", marginTop: "0.35rem", display: "inline-block" }}
                  >
                    {evt.category}
                  </span>
                </div>

                {/* Center: Title and Description */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: 0, color: "var(--text)" }}>
                      {evt.title}
                    </h3>
                    {evt.zone && (
                      <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                        • Zone: <strong>{evt.zone}</strong>
                      </span>
                    )}
                  </div>

                  <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                    {evt.description}
                  </p>

                  <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.4rem", fontSize: "0.7rem" }}>
                    <span style={{ color: "var(--text-muted)" }}>
                      Source: <strong>{evt.source}</strong>
                    </span>
                    <span>•</span>
                    <span style={{ color: "var(--green)", fontWeight: 600 }}>
                      PROVENANCE: {evt.provenanceType}
                    </span>
                    {evt.assetId && (
                      <>
                        <span>•</span>
                        <span>
                          Asset: <strong>{evt.assetId}</strong>
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Right: Actions */}
                <div>
                  {evt.assetId ? (
                    <button
                      type="button"
                      className="button button--ghost"
                      style={{ fontSize: "0.75rem", border: "1px solid var(--border)" }}
                      onClick={() => navigate(`/twin?assetId=${evt.assetId}`)}
                    >
                      📍 Locate in Twin
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="button button--ghost"
                      style={{ fontSize: "0.75rem", border: "1px solid var(--border)" }}
                      onClick={() => navigate("/twin")}
                    >
                      📍 Station Overview
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
