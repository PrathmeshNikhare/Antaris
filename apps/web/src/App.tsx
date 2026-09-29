import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { StationProvider } from "./context/StationContext";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";

import { OverviewPage } from "./features/overview/OverviewPage";
import { DigitalTwinPage } from "./features/twin/DigitalTwinPage";
import { InfrastructurePage } from "./features/infrastructure/InfrastructurePage";
import { EnergyPage } from "./features/energy/EnergyPage";
import { LogisticsPage } from "./features/logistics/LogisticsPage";
import { EnvironmentPage } from "./features/environment/EnvironmentPage";
import { IntelligencePage } from "./features/intelligence/IntelligencePage";
import { SimulationsPage } from "./features/simulations/SimulationsPage";
import { ReportsPage } from "./features/reports/ReportsPage";
import { AuditPage } from "./features/audit/AuditPage";

export default function App(): React.JSX.Element {
  return (
    <BrowserRouter>
      <StationProvider>
        <div className="app-shell">
          <Sidebar />
          <div className="app-main-container">
            <TopBar />
            <main>
              <Routes>
                <Route path="/" element={<OverviewPage />} />
                <Route path="/overview" element={<Navigate to="/" replace />} />
                <Route path="/twin" element={<DigitalTwinPage />} />
                <Route path="/infrastructure" element={<InfrastructurePage />} />
                <Route path="/energy" element={<EnergyPage />} />
                <Route path="/logistics" element={<LogisticsPage />} />
                <Route path="/environment" element={<EnvironmentPage />} />
                <Route path="/intelligence" element={<IntelligencePage />} />
                <Route path="/simulations" element={<SimulationsPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/audit" element={<AuditPage />} />
              </Routes>
            </main>
          </div>
        </div>
      </StationProvider>
    </BrowserRouter>
  );
}
