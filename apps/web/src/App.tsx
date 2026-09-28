import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { OverviewPage } from './features/overview/OverviewPage';
import { InfrastructurePage } from './features/infrastructure/InfrastructurePage';
import { EnergyPage } from './features/energy/EnergyPage';
import { LogisticsPage } from './features/logistics/LogisticsPage';
import { EnvironmentPage } from './features/environment/EnvironmentPage';

const NAV_ITEMS = [
  { to: '/', label: 'Overview' },
  { to: '/infrastructure', label: 'Infrastructure' },
  { to: '/energy', label: 'Energy' },
  { to: '/logistics', label: 'Logistics' },
  { to: '/environment', label: 'Environment' },
] as const;

export default function App(): React.JSX.Element {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <aside className="app-sidebar">
          <div className="app-sidebar__logo">Maitri–Bharati</div>
          <nav>
            <ul className="app-sidebar__nav">
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `app-sidebar__link${isActive ? ' app-sidebar__link--active' : ''}`
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
        <main className="app-main">
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/infrastructure" element={<InfrastructurePage />} />
            <Route path="/energy" element={<EnergyPage />} />
            <Route path="/logistics" element={<LogisticsPage />} />
            <Route path="/environment" element={<EnvironmentPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
