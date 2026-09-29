import React from "react";
import { useStation } from "../../hooks/useStation";

export function EnergyPage(): React.JSX.Element {
  const { stationId, twinState } = useStation();

  if (!twinState) return <div className="app-content">Energy grid state unavailable.</div>;

  const { energy, logistics } = twinState;
  const stationName = stationId === "station-maitri" ? "Maitri" : "Bharati";

  const netBalance = energy.netPowerKw;
  const isSurplus = netBalance >= 0;

  return (
    <div className="app-content">
      <header className="page-header">
        <div>
          <h1 className="page-header__title">{stationName} Microgrid & Energy Dispatch</h1>
          <p className="page-header__subtitle">
            Microgrid power flow, diesel generators, battery energy storage system (BESS), and fuel autonomy.
          </p>
        </div>

        <span
          className={`badge ${
            energy.gridStatus === "STABLE"
              ? "badge--operational"
              : energy.gridStatus === "DEFICIT"
              ? "badge--critical"
              : "badge--warning"
          }`}
          style={{ fontSize: "0.85rem", padding: "0.35rem 0.75rem" }}
        >
          ● GRID {energy.gridStatus}
        </span>
      </header>

      {/* Grid Balance KPIs */}
      <div className="grid-4">
        <div className="kpi-tile">
          <div className="kpi-tile__label">Total Generation</div>
          <div className="kpi-tile__value">
            {energy.totalGenerationKw} <span className="kpi-tile__unit">kW</span>
          </div>
          <div className="kpi-tile__meta">Primary Diesel + Renewable dispatch</div>
        </div>

        <div className="kpi-tile">
          <div className="kpi-tile__label">Grid Load Demand</div>
          <div className="kpi-tile__value">
            {energy.totalLoadKw} <span className="kpi-tile__unit">kW</span>
          </div>
          <div className="kpi-tile__meta">Life-support, HVAC & Scientific labs</div>
        </div>

        <div className="kpi-tile">
          <div className="kpi-tile__label">Net Balance</div>
          <div
            className="kpi-tile__value"
            style={{ color: isSurplus ? "var(--green)" : "var(--critical)" }}
          >
            {isSurplus ? `+${netBalance}` : netBalance} <span className="kpi-tile__unit">kW</span>
          </div>
          <div className="kpi-tile__meta">
            {isSurplus ? "Surplus charging BESS" : "Deficit draining battery reserve"}
          </div>
        </div>

        <div className="kpi-tile">
          <div className="kpi-tile__label">Battery Storage (BESS)</div>
          <div className="kpi-tile__value">
            {energy.batterySocPct}% <span className="kpi-tile__unit">SoC</span>
          </div>
          <div className="kpi-tile__meta">Capacity: {energy.batteryStorageKwh} kWh</div>
        </div>
      </div>

      {/* Detail Cards */}
      <div className="grid-2">
        {/* Power Flow Breakdown */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">⚡ Power Generation & Load Balance</h2>
            <span className="card-subtitle">Real-time kW dispatch</span>
          </div>

          <div style={{ marginTop: "1rem" }}>
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "0.3rem" }}>
                <span>Generation Output: <strong>{energy.totalGenerationKw} kW</strong></span>
                <span>Rated Capacity: <strong>125 kW</strong></span>
              </div>
              <div className="asset-block__health-bar" style={{ height: "10px" }}>
                <div
                  className="asset-block__health-fill"
                  style={{
                    width: `${Math.min(100, (energy.totalGenerationKw / 125) * 100)}%`,
                    background: "var(--green)",
                  }}
                />
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "0.3rem" }}>
                <span>Station Load: <strong>{energy.totalLoadKw} kW</strong></span>
                <span>Peak Load Threshold: <strong>110 kW</strong></span>
              </div>
              <div className="asset-block__health-bar" style={{ height: "10px" }}>
                <div
                  className="asset-block__health-fill"
                  style={{
                    width: `${Math.min(100, (energy.totalLoadKw / 110) * 100)}%`,
                    background: energy.totalLoadKw > 100 ? "var(--warning)" : "var(--info)",
                  }}
                />
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: "1.5rem",
              padding: "0.75rem",
              background: "var(--surface-soft)",
              borderRadius: "var(--radius-md)",
              fontSize: "0.8rem",
            }}
          >
            <strong>🔌 Critical Loads Dependent on Generator:</strong>
            <ul style={{ paddingLeft: "1.2rem", marginTop: "0.3rem", color: "var(--text)" }}>
              <li>Life Support & Habitat Central HVAC (45 kW)</li>
              <li>Lake Priyadarshini Water Intake Heating Traces (12 kW)</li>
              <li>Polar Satellite Ground Communications Terminal (8 kW)</li>
              <li>Medical Facility & Food Storage Freezers (15 kW)</li>
            </ul>
          </div>
        </div>

        {/* Fuel & Energy Reserves */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">⛽ Arctic Diesel Reserves & Autonomy</h2>
            <span className="card-subtitle">Strategic fuel stocks</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.5rem" }}>
            <div className="inspector-property">
              <span className="inspector-property__key">Days of Fuel Remaining</span>
              <span className="inspector-property__val" style={{ fontSize: "1.1rem", color: "var(--green)" }}>
                {logistics.daysOfFuelRemaining} days
              </span>
            </div>

            <div className="inspector-property">
              <span className="inspector-property__key">Estimated Daily Consumption</span>
              <span className="inspector-property__val">~680 Liters / day</span>
            </div>

            <div className="inspector-property">
              <span className="inspector-property__key">Next Resupply Window</span>
              <span className="inspector-property__val">Austral Summer (Dec – Feb)</span>
            </div>

            <div className="inspector-property">
              <span className="inspector-property__key">Battery Reserve Discharge Time</span>
              <span className="inspector-property__val">
                ~{((energy.batteryStorageKwh * (energy.batterySocPct / 100)) / (energy.totalLoadKw || 1)).toFixed(1)} hours
              </span>
            </div>
          </div>

          <div
            style={{
              marginTop: "1.25rem",
              padding: "0.75rem",
              background: "var(--surface-soft)",
              borderRadius: "var(--radius-md)",
              fontSize: "0.8rem",
            }}
          >
            <div style={{ fontWeight: 600, color: "var(--text)" }}>🛡️ Risk & Contamination Safeguards:</div>
            <p style={{ margin: "0.25rem 0 0 0", color: "var(--text-muted)" }}>
              Double-walled heated bulk storage tanks located 120m from main habitat. Heated trace lines prevent gelation at -40°C.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
