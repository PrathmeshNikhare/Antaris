import React from "react";
import { NavLink } from "react-router-dom";

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Overview", icon: "⊞" },
  { to: "/twin", label: "Digital Twin", icon: "❖" },
  { to: "/alerts", label: "Alerts & Incidents", icon: "🚨" },
  { to: "/sensors", label: "Sensors", icon: "📡" },
  { to: "/events", label: "Mission Events", icon: "📜" },
  { to: "/infrastructure", label: "Infrastructure", icon: "⚙" },
  { to: "/energy", label: "Energy Grid", icon: "⚡" },
  { to: "/logistics", label: "Logistics", icon: "📦" },
  { to: "/environment", label: "Environment", icon: "❄" },
  { to: "/intelligence", label: "Intelligence", icon: "◈" },
  { to: "/simulations", label: "Simulations", icon: "▷" },
  { to: "/copilot", label: "Ops Copilot", icon: "🤖" },
  { to: "/reports", label: "Snapshots & Reports", icon: "▤" },
  { to: "/audit", label: "Audit Log", icon: "📋" },
  { to: "/settings", label: "Mission Settings", icon: "🔧" },
  { to: "/demo", label: "Demo Control", icon: "🎮" },
];

export function Sidebar(): React.JSX.Element {
  return (
    <aside className="app-sidebar">
      <div className="app-sidebar__brand">
        <div className="app-sidebar__logo-icon">MB</div>
        <div className="app-sidebar__brand-text">
          <span className="app-sidebar__title">Maitri–Bharati</span>
          <span className="app-sidebar__sub">Antarctic Twin</span>
        </div>
      </div>

      <nav>
        <ul className="app-sidebar__nav">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `app-sidebar__link ${isActive ? "app-sidebar__link--active" : ""}`
                }
              >
                <span style={{ fontSize: "1.1rem", lineHeight: 1 }}>{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="app-sidebar__footer">
        <span>NCPOR Polar Ops</span>
        <span style={{ opacity: 0.6 }}>v0.3.0</span>
      </div>
    </aside>
  );
}
