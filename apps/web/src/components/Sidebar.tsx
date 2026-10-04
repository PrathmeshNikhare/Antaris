import React from "react";
import { NavLink, Link } from "react-router-dom";

interface NavItem {
  to: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/overview", label: "Overview" },
  { to: "/twin", label: "Digital Twin" },
  { to: "/alerts", label: "Alerts & Incidents" },
  { to: "/sensors", label: "Sensors" },
  { to: "/events", label: "Mission Events" },
  { to: "/infrastructure", label: "Infrastructure" },
  { to: "/energy", label: "Energy Grid" },
  { to: "/logistics", label: "Logistics" },
  { to: "/environment", label: "Environment" },
  { to: "/intelligence", label: "Intelligence" },
  { to: "/simulations", label: "Simulations" },
  { to: "/copilot", label: "Ops Copilot" },
  { to: "/reports", label: "Snapshots & Reports" },
  { to: "/audit", label: "Audit Log" },
  { to: "/settings", label: "Mission Settings" },
  { to: "/demo", label: "Demo Control" },
];

export function Sidebar(): React.JSX.Element {
  return (
    <aside className="app-sidebar">
      <Link to="/" style={{ textDecoration: "none", color: "inherit" }} className="app-sidebar__brand" title="Return to Antaris Gateway Portal">
        <div className="app-sidebar__logo-icon">MB</div>
        <div className="app-sidebar__brand-text">
          <span className="app-sidebar__title">Maitri–Bharati</span>
          <span className="app-sidebar__sub">Antarctic Twin</span>
        </div>
      </Link>

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
