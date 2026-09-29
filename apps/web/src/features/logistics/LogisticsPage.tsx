import React from "react";
import { useStation } from "../../hooks/useStation";

interface ConsumableItem {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  unit: string;
  dailyBurn: number;
  daysRemaining: number;
  minThresholdDays: number;
  urgency: "NOMINAL" | "WARNING" | "CRITICAL";
  leadTimeDays: number;
}

export function LogisticsPage(): React.JSX.Element {
  const { stationId, twinState } = useStation();

  if (!twinState) return <div className="app-content">Logistics data unavailable.</div>;

  const { logistics } = twinState;

  const consumables: ConsumableItem[] = [
    {
      id: "inv-fuel",
      name: "Arctic High-Grade Diesel (A1)",
      category: "Energy & Heating",
      currentStock: logistics.daysOfFuelRemaining * 680,
      unit: "Liters",
      dailyBurn: 680,
      daysRemaining: logistics.daysOfFuelRemaining,
      minThresholdDays: 30,
      urgency: logistics.daysOfFuelRemaining < 15 ? "CRITICAL" : logistics.daysOfFuelRemaining < 30 ? "WARNING" : "NOMINAL",
      leadTimeDays: 90,
    },
    {
      id: "inv-water",
      name: "Potable Fresh Water",
      category: "Life Support",
      currentStock: logistics.daysOfWaterRemaining * 1180,
      unit: "Liters",
      dailyBurn: 1180,
      daysRemaining: logistics.daysOfWaterRemaining,
      minThresholdDays: 7,
      urgency: logistics.daysOfWaterRemaining < 5 ? "CRITICAL" : logistics.daysOfWaterRemaining < 10 ? "WARNING" : "NOMINAL",
      leadTimeDays: 1, // On-site lake pump / RO desalination
    },
    {
      id: "inv-food",
      name: "Freeze-Dried Rations & Dry Provisions",
      category: "Provisions",
      currentStock: logistics.daysOfFoodRemaining * 24,
      unit: "kg",
      dailyBurn: 24,
      daysRemaining: logistics.daysOfFoodRemaining,
      minThresholdDays: 45,
      urgency: "NOMINAL",
      leadTimeDays: 120,
    },
    {
      id: "inv-o2",
      name: "Medical Oxygen & First Aid Reserve",
      category: "Medical",
      currentStock: 18,
      unit: "Cylinders",
      dailyBurn: 0.1,
      daysRemaining: 180,
      minThresholdDays: 60,
      urgency: "NOMINAL",
      leadTimeDays: 90,
    },
    {
      id: "inv-filters",
      name: "Generator Oil & Fuel Filter Assemblies",
      category: "Spares",
      currentStock: 12,
      unit: "Sets",
      dailyBurn: 0.05,
      daysRemaining: 240,
      minThresholdDays: 90,
      urgency: "NOMINAL",
      leadTimeDays: 120,
    },
  ];

  return (
    <div className="app-content">
      <header className="page-header">
        <div>
          <h1 className="page-header__title">
            {stationId === "station-maitri" ? "Maitri" : "Bharati"} Logistics & Consumables Autonomy
          </h1>
          <p className="page-header__subtitle">
            Critical supply tracking, daily consumption velocity, resupply lead times, and thermal trace dependencies.
          </p>
        </div>
      </header>

      {/* KPI Tiles */}
      <div className="grid-3">
        <div className="kpi-tile">
          <div className="kpi-tile__label">Fuel Autonomy</div>
          <div className="kpi-tile__value">
            {logistics.daysOfFuelRemaining} <span className="kpi-tile__unit">days</span>
          </div>
          <div className="kpi-tile__meta">Threshold: 30 days minimum</div>
        </div>

        <div className="kpi-tile">
          <div className="kpi-tile__label">Water Autonomy</div>
          <div className="kpi-tile__value">
            {logistics.daysOfWaterRemaining} <span className="kpi-tile__unit">days</span>
          </div>
          <div className="kpi-tile__meta">Priyadarshini Lake / RO buffer</div>
        </div>

        <div className="kpi-tile">
          <div className="kpi-tile__label">Provisions Stock</div>
          <div className="kpi-tile__value">
            {logistics.daysOfFoodRemaining} <span className="kpi-tile__unit">days</span>
          </div>
          <div className="kpi-tile__meta">Expedition crew capacity: 25 personnel</div>
        </div>
      </div>

      {/* Consumables Inventory Table */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div className="card-header">
          <h2 className="card-title">📦 Critical Expedition Consumables</h2>
          <span className="card-subtitle">Real-time stock vs. daily burn rate</span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border)", color: "var(--text-muted)", fontSize: "0.75rem" }}>
                <th style={{ padding: "0.6rem" }}>SUPPLY ITEM</th>
                <th style={{ padding: "0.6rem" }}>CATEGORY</th>
                <th style={{ padding: "0.6rem" }}>CURRENT STOCK</th>
                <th style={{ padding: "0.6rem" }}>DAILY BURN</th>
                <th style={{ padding: "0.6rem" }}>DAYS REMAINING</th>
                <th style={{ padding: "0.6rem" }}>LEAD TIME</th>
                <th style={{ padding: "0.6rem" }}>URGENCY</th>
              </tr>
            </thead>
            <tbody>
              {consumables.map((item) => {
                let badgeClass = "badge--operational";
                if (item.urgency === "CRITICAL") badgeClass = "badge--critical";
                else if (item.urgency === "WARNING") badgeClass = "badge--warning";

                return (
                  <tr key={item.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.75rem 0.6rem", fontWeight: 600 }}>{item.name}</td>
                    <td style={{ padding: "0.75rem 0.6rem" }}>
                      <span className="badge badge--info">{item.category}</span>
                    </td>
                    <td style={{ padding: "0.75rem 0.6rem", fontFamily: "var(--font-mono)" }}>
                      {item.currentStock.toLocaleString()} {item.unit}
                    </td>
                    <td style={{ padding: "0.75rem 0.6rem", fontFamily: "var(--font-mono)" }}>
                      {item.dailyBurn} {item.unit}/day
                    </td>
                    <td style={{ padding: "0.75rem 0.6rem", fontWeight: 700 }}>
                      <span style={{ color: item.daysRemaining < item.minThresholdDays ? "var(--critical)" : "var(--green)" }}>
                        {item.daysRemaining} days
                      </span>
                    </td>
                    <td style={{ padding: "0.75rem 0.6rem", color: "var(--text-muted)" }}>
                      {item.leadTimeDays} days
                    </td>
                    <td style={{ padding: "0.75rem 0.6rem" }}>
                      <span className={`badge ${badgeClass}`}>{item.urgency}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cross-Domain Thermal & Energy Dependency */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">❄️ Cross-Domain Thermal & Energy Dependencies</h2>
          <span className="card-subtitle">Coupling between life-support supplies and power</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", fontSize: "0.8rem", color: "var(--text)" }}>
          <div style={{ background: "var(--surface-soft)", padding: "0.85rem", borderRadius: "var(--radius-md)" }}>
            <strong>💧 Water Intake Freezing Safeguard:</strong>
            <p style={{ marginTop: "0.3rem", color: "var(--text-muted)" }}>
              The Priyadarshini water pipeline relies on 12 kW electrical trace heating. A generator outage causes frazil ice blockage within 45 minutes if heating traces drop below 2°C.
            </p>
          </div>
          <div style={{ background: "var(--surface-soft)", padding: "0.85rem", borderRadius: "var(--radius-md)" }}>
            <strong>⛽ Diesel Fuel Viscosity Maintenance:</strong>
            <p style={{ marginTop: "0.3rem", color: "var(--text-muted)" }}>
              Special Arctic-grade fuel contains anti-waxing additives effective down to -45°C. Day tanks inside the generator module are heated using engine coolant waste heat recovery (CHP).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
