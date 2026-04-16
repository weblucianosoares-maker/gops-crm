import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { cn } from "@/src/lib/utils";
import { Sidebar, TopBar } from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import Funnel from "./pages/Funnel";
import Contracts from "./pages/Contracts";
import Carriers from "./pages/Carriers";
import Settings from "./pages/Settings";
import NetworkSearch from "./pages/NetworkSearch";
import Alerts from "./pages/Alerts";
import AIInterview from "./pages/AIInterview";

import { LeadsProvider } from "./lib/leadsContext";
import { BrokerProvider } from "./lib/brokerContext";
import { DrawerProvider } from "./lib/drawerContext";
import { ToastProvider } from "./components/Toasts";

function AppContent() {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  const getTitle = (path: string) => {
    switch (path) {
      case "/": return "Visão Geral";
      case "/leads": return "Inteligência de Leads";
      case "/funnel": return "Funil de Vendas";
      case "/contracts": return "Gestão de Contratos";
      case "/carriers": return "Catálogo de Operadoras";
      case "/settings": return "Configurações do Sistema";
      case "/network": return "Mapeamento de Rede Médica";
      case "/alerts": return "Central de Avisos";
      case "/interview": return "Entrevista Mágica";
      default: return "Efraim";
    }
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden text-slate-900">
      <Sidebar 
        isOpen={isMobileMenuOpen} 
        setIsOpen={setIsMobileMenuOpen} 
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
      />
      <div className={cn(
        "flex-1 flex flex-col min-w-0 w-full overflow-hidden transition-all duration-300",
        isCollapsed ? "md:ml-20" : "md:ml-64"
      )}>
        <TopBar title={getTitle(location.pathname)} onMenuClick={() => setIsMobileMenuOpen(true)} />
        {/* Main now has overflow-hidden to allow children pages to manage their own scrolling */}
        <main className="flex-1 overflow-hidden relative">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/funnel" element={<Funnel />} />
            <Route path="/contracts" element={<Contracts />} />
            <Route path="/carriers" element={<Carriers />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/network" element={<NetworkSearch />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/interview" element={<AIInterview />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <BrokerProvider>
        <LeadsProvider>
          <DrawerProvider>
            <Router>
              <AppContent />
            </Router>
          </DrawerProvider>
        </LeadsProvider>
      </BrokerProvider>
    </ToastProvider>
  );
}
