import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { StationProvider } from "./context/StationContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";

import { LoginPage } from "./features/auth/LoginPage";
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
import { CopilotPage } from "./features/copilot/CopilotPage";
import { DemoControlPage } from "./features/demo/DemoControlPage";
import { AlertsPage } from "./features/alerts/AlertsPage";
import { SensorsPage } from "./features/sensors/SensorsPage";
import { EventsPage } from "./features/events/EventsPage";
import { SettingsPage } from "./features/settings/SettingsPage";

import { PolarixLandingPage } from "./features/landing/PolarixLandingPage";

function AppLayout(): React.JSX.Element {
  return (
    <ProtectedRoute>
      <div className="app-shell">
        <Sidebar />
        <div className="app-main-container">
          <TopBar />
          <main>
            <Routes>
              <Route path="/" element={<Navigate to="/overview" replace />} />
              <Route path="/overview" element={<OverviewPage />} />
              <Route path="/twin" element={<DigitalTwinPage />} />
              <Route path="/alerts" element={<AlertsPage />} />
              <Route path="/sensors" element={<SensorsPage />} />
              <Route path="/events" element={<EventsPage />} />
              <Route path="/infrastructure" element={<InfrastructurePage />} />
              <Route path="/energy" element={<EnergyPage />} />
              <Route path="/logistics" element={<LogisticsPage />} />
              <Route path="/environment" element={<EnvironmentPage />} />
              <Route path="/intelligence" element={<IntelligencePage />} />
              <Route path="/simulations" element={<SimulationsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/audit" element={<AuditPage />} />
              <Route path="/copilot" element={<CopilotPage />} />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute allowedRoles={["ADMIN", "ENGINEER"]}>
                    <SettingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/demo"
                element={
                  <ProtectedRoute allowedRoles={["ADMIN", "ENGINEER"]}>
                    <DemoControlPage />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default function App(): React.JSX.Element {
  return (
    <BrowserRouter>
      <AuthProvider>
        <StationProvider>
          <Routes>
            <Route path="/" element={<PolarixLandingPage />} />
            <Route path="/landing" element={<Navigate to="/" replace />} />
            <Route path="/portal" element={<Navigate to="/" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/*" element={<AppLayout />} />
          </Routes>
        </StationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
