import React from "react";
import { useStation } from "../../hooks/useStation";

export function EnvironmentPage(): React.JSX.Element {
  const { stationId, twinState } = useStation();

  if (!twinState) return <div className="app-content">Meteorological state unavailable.</div>;

  const { environment } = twinState;
  const stationName = stationId === "station-maitri" ? "Maitri Oasis AWS" : "Bharati Promontory AWS";

  const isExtreme = environment.condition !== "NORMAL";

  return (
    <div className="app-content">
      <header className="page-header">
        <div>
          <h1 className="page-header__title">{stationName} Meteorological & Space Weather Console</h1>
          <p className="page-header__subtitle">
            Polar atmospheric pressure, katabatic wind velocity, chill factors, and diurnal solar irradiance.
          </p>
        </div>

        <span
          className={`badge ${isExtreme ? "badge--warning" : "badge--operational"}`}
          style={{ fontSize: "0.85rem", padding: "0.35rem 0.75rem" }}
        >
          ● CONDITION: {environment.condition}
        </span>
      </header>

      {/* Meteorological KPI Grid */}
      <div className="grid-4">
        <div className="kpi-tile">
          <div className="kpi-tile__label">Ambient Temperature</div>
          <div className="kpi-tile__value">
            {environment.ambientTempC}° <span className="kpi-tile__unit">C</span>
          </div>
          <div className="kpi-tile__meta">Wind chill feels like: {(environment.ambientTempC - environment.windSpeedMs * 0.7).toFixed(1)}°C</div>
        </div>

        <div className="kpi-tile">
          <div className="kpi-tile__label">Wind Velocity</div>
          <div className="kpi-tile__value">
            {environment.windSpeedMs} <span className="kpi-tile__unit">m/s</span>
          </div>
          <div className="kpi-tile__meta">{(environment.windSpeedMs * 3.6).toFixed(0)} km/h • Katabatic vector 160° SSE</div>
        </div>

        <div className="kpi-tile">
          <div className="kpi-tile__label">Barometric Pressure</div>
          <div className="kpi-tile__value">
            {environment.atmosphericPressureHpa} <span className="kpi-tile__unit">hPa</span>
          </div>
          <div className="kpi-tile__meta">{environment.atmosphericPressureHpa < 980 ? "Storm depression incoming" : "Stable Antarctic high"}</div>
        </div>

        <div className="kpi-tile">
          <div className="kpi-tile__label">Solar Irradiance</div>
          <div className="kpi-tile__value">
            {environment.solarIrradianceWm2} <span className="kpi-tile__unit">W/m²</span>
          </div>
          <div className="kpi-tile__meta">Austral season diurnal curve</div>
        </div>
      </div>

      {/* Atmospheric Hazards & Safe Operating Windows */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Katabatic Wind & Blizzard Warning Matrix</h2>
            <span className="card-subtitle">Local microclimate risk thresholds</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", fontSize: "0.85rem", marginTop: "0.5rem" }}>
            <div
              style={{
                padding: "0.75rem",
                borderRadius: "var(--radius-md)",
                background: environment.windSpeedMs > 25 ? "var(--critical-soft)" : "var(--surface-soft)",
                border: "1px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
                <span>Wind Velocity Threshold: &gt;25 m/s (90 km/h)</span>
                <span className={`badge ${environment.windSpeedMs > 25 ? "badge--critical" : "badge--operational"}`}>
                  {environment.windSpeedMs > 25 ? "ACTIVE WARNING" : "SAFE"}
                </span>
              </div>
              <p style={{ margin: "0.3rem 0 0 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                High-speed katabatic air cascades from the polar ice plateau. Outdoor movement restricted, satellite dish auto-stow protocol standby.
              </p>
            </div>

            <div
              style={{
                padding: "0.75rem",
                borderRadius: "var(--radius-md)",
                background: environment.ambientTempC < -30 ? "var(--warning-soft)" : "var(--surface-soft)",
                border: "1px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
                <span>Extreme Cold Alert: &lt; -30°C</span>
                <span className={`badge ${environment.ambientTempC < -30 ? "badge--warning" : "badge--operational"}`}>
                  {environment.ambientTempC < -30 ? "CAUTION" : "NORMAL"}
                </span>
              </div>
              <p style={{ margin: "0.3rem 0 0 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Thermal heating demand on HVAC increases to 60 kW. Water intake lines monitored for frazil ice crystals.
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Geographical Coordinates & Climate Profile</h2>
            <span className="card-subtitle">Permanent station parameters</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.85rem", marginTop: "0.5rem" }}>
            <div className="inspector-property">
              <span className="inspector-property__key">Geographic Location</span>
              <span className="inspector-property__val">
                {stationId === "station-maitri" ? "70°45'58\" S, 11°43'56\" E (Schirmacher Oasis)" : "69°24'28\" S, 76°11'14\" E (Larsemann Hills)"}
              </span>
            </div>
            <div className="inspector-property">
              <span className="inspector-property__key">Elevation</span>
              <span className="inspector-property__val">
                {stationId === "station-maitri" ? "117 m ASL (Ice-free plateau)" : "35 m ASL (Coastal promontory)"}
              </span>
            </div>
            <div className="inspector-property">
              <span className="inspector-property__key">Polar Night Duration</span>
              <span className="inspector-property__val">May 21 – July 22 (62 Days)</span>
            </div>
            <div className="inspector-property">
              <span className="inspector-property__key">Midnight Sun Period</span>
              <span className="inspector-property__val">November 18 – January 24 (68 Days)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
