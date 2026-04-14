import React, { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/src/lib/utils";
import { Icons } from "./Icons";
import { useLeads } from "../lib/leadsContext";
import { useBroker } from "../lib/brokerContext";
import { useAlerts } from "../hooks/useAlerts";
import { useDrawer } from "../lib/drawerContext";
import { LeadDetailDrawer } from "./LeadDetailDrawer";
import { motion, AnimatePresence } from "framer-motion";

const menuItems = [
  { icon: Icons.Dashboard, label: "Dashboard", path: "/" },
  { icon: Icons.Leads, label: "Leads", path: "/leads" },
  { icon: Icons.Funnel, label: "Funil de Vendas", path: "/funnel" },
  { icon: Icons.Contracts, label: "Contratos", path: "/contracts" },
  { icon: Icons.Carriers, label: "Operadoras", path: "/carriers" },
  { icon: Icons.MapPin, label: "Rede Médica", path: "/network" },
  { icon: Icons.Bell, label: "Avisos", path: "/alerts" },
  { icon: Icons.Settings, label: "Configurações", path: "/settings" },
];

export function Sidebar({ isOpen, setIsOpen }: { isOpen?: boolean; setIsOpen?: (val: boolean) => void }) {
  const location = useLocation();
  
  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 md:hidden"
          onClick={() => setIsOpen && setIsOpen(false)}
        />
      )}
      
      <aside className={cn(
        "flex flex-col h-screen w-64 fixed left-0 top-0 bg-slate-50 border-r border-slate-200 py-6 z-50 transition-transform duration-300 md:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="px-6 mb-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white">
              <Icons.CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-blue-900 leading-none">Efraim</h1>
              <p className="text-[0.6875rem] tracking-wider uppercase text-slate-500 mt-1 font-semibold">Gestão de Leads de Saúde</p>
            </div>
          </div>
          <button className="md:hidden text-slate-500 hover:text-slate-700" onClick={() => setIsOpen && setIsOpen(false)}>
            <Icons.X className="w-6 h-6" />
          </button>
        </div>
      
      <nav className="flex-1 space-y-1">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          const isLeads = item.path === '/leads';
          
          return (
            <React.Fragment key={item.path}>
              <NavLink
                to={item.path}
                onClick={() => setIsOpen && setIsOpen(false)}
                className={({ isActive }) => cn(
                   "flex items-center pl-6 py-3 transition-all group",
                   isActive 
                     ? "text-blue-700 font-semibold bg-white rounded-l-lg ml-2 pl-4 shadow-sm" 
                     : "text-slate-500 hover:text-blue-600 hover:translate-x-1"
                )}
              >
                <item.icon className={cn("w-5 h-5 mr-3", "group-hover:text-blue-600")} />
                <span className="text-[0.6875rem] tracking-wider uppercase">{item.label}</span>
                
                {item.path === '/alerts' && alerts.length > 0 && (
                   <span className="ml-auto mr-4 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-sm animate-pulse">
                     {alerts.length}
                   </span>
                )}

                {isLeads && isActive && (
                  <Icons.ChevronDown className="w-4 h-4 ml-auto mr-4 text-blue-400" />
                )}
              </NavLink>

              {/* Submenu for Leads */}
              {isLeads && isActive && <LeadsSubMenu setIsOpen={setIsOpen} />}
            </React.Fragment>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-slate-100 pt-6 px-6 space-y-1">
        <button className="flex items-center w-full text-slate-500 py-3 hover:text-blue-600 transition-all">
          <Icons.Support className="w-5 h-5 mr-3" />
          <span className="text-[0.6875rem] tracking-wider uppercase font-medium">Suporte</span>
        </button>
        <button className="flex items-center w-full text-slate-500 py-3 hover:text-blue-600 transition-all">
          <Icons.Logout className="w-5 h-5 mr-3" />
          <span className="text-[0.6875rem] tracking-wider uppercase font-medium">Sair</span>
        </button>
      </div>
    </aside>
    </>
  );
}

function LeadsSubMenu({ setIsOpen }: { setIsOpen?: (val: boolean) => void }) {
  const { filter, setFilter, filterCounts } = useLeads();
  const sources = ["Todos", "Grupo RH", "Ex-colegas", "Leads Eventos"];

  return (
    <div className="ml-12 mt-1 mb-4 space-y-1 border-l border-slate-200">
      {sources.map((s) => (
        <button
          key={s}
          onClick={() => {
            setFilter(s);
            if (window.innerWidth < 768 && setIsOpen) setIsOpen(false);
          }}
          className={cn(
            "flex items-center justify-between w-full pl-4 py-2 transition-all text-left",
            filter === s 
              ? "text-blue-600 font-bold" 
              : "text-slate-400 hover:text-slate-600 hover:pl-5"
          )}
        >
          <span className="text-[10px] uppercase tracking-widest">{s}</span>
          <span className={cn(
            "mr-4 text-[9px] px-1.5 py-0.5 rounded-full font-bold",
            filter === s ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-400"
          )}>
            {filterCounts[s] || 0}
          </span>
        </button>
      ))}
    </div>
  );
}


function GlobalAlertBar() {
  const { alerts } = useAlerts();
  const { openDrawer } = useDrawer();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (alerts.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % alerts.length);
    }, 20000); // 20 Segundos
    return () => clearInterval(timer);
  }, [alerts.length]);

  if (alerts.filter(a => a.isToday || a.severity === 'urgent' || a.severity === 'warning').length === 0) return null;

  // Prioritize active/relevant alerts for the ticker
  const activeAlerts = alerts.filter(a => a.isToday || a.severity === 'urgent' || a.severity === 'warning');
  const current = activeAlerts[index % activeAlerts.length];

  return (
    <div className="bg-slate-900 text-white h-10 flex items-center justify-between px-4 overflow-hidden relative z-[110] border-b border-white/10 shadow-lg">
       <div className="flex items-center gap-2 overflow-hidden w-full justify-center">
          <AnimatePresence mode="wait">
            <motion.button
               key={current.id}
               initial={{ x: -100, opacity: 0 }}
               animate={{ x: 0, opacity: 1 }}
               exit={{ x: 100, opacity: 0 }}
               transition={{ type: "spring", stiffness: 80, damping: 15 }}
               onClick={() => {
                 if (current.leadData) {
                    console.log("Opening lead from alert:", current.leadData.name);
                    openDrawer(current.leadData, 'details');
                 }
               }}
               className="flex items-center gap-4 px-6 h-full hover:bg-white/5 transition-all group cursor-pointer"
            >
               <div className="flex items-center gap-2">
                 <span className={cn(
                   "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded shadow-sm",
                   current.severity === 'urgent' ? "bg-red-500 text-white animate-pulse shadow-red-900/40" :
                   current.severity === 'warning' ? "bg-amber-500 text-slate-900 shadow-amber-900/40" : "bg-blue-500 text-white"
                 )}>
                   {current.typeLabel}
                 </span>
                 <span className={cn(
                    "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-white/10 text-slate-300 border border-white/5",
                    current.statusLabel === 'Vencido' ? "text-red-400 border-red-400/20 bg-red-400/5" : 
                    current.statusLabel === 'Hoje' ? "text-amber-400 border-amber-400/20 bg-amber-400/5" : ""
                 )}>
                   {current.statusLabel}
                 </span>
               </div>

               <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                 <div className="flex items-center gap-2 md:gap-3 pr-2 md:pr-4 border-r border-white/10 shrink-0">
                    <div className="flex flex-col items-start">
                       <p className="text-[9px] md:text-[11px] font-black tracking-widest group-hover:text-amber-400 transition-colors uppercase whitespace-nowrap">{current.title}</p>
                       <p className="text-[7px] md:text-[8px] font-bold text-slate-500 uppercase tracking-tighter">
                         Data: {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(current.date)}
                       </p>
                    </div>
                 </div>
                 <p className="text-[10px] font-bold text-slate-400 group-hover:text-slate-100 transition-colors truncate max-w-lg hidden md:block italic tracking-tight">{current.description}</p>
               </div>

               <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[9px] font-black uppercase tracking-tighter text-blue-400">Ver Ficha</span>
                  <Icons.ChevronRight className="w-3 h-3 text-blue-400 translate-x-0 group-hover:translate-x-1 transition-transform" />
               </div>
            </motion.button>
          </AnimatePresence>
       </div>
    </div>
  );
}

function BrokerProfileBadge() {
  const { currentBroker, loading } = useBroker();

  if (loading) {
    return (
      <>
        <div className="text-right hidden sm:block">
          <div className="h-4 w-24 bg-slate-200 rounded animate-pulse mb-1"></div>
          <div className="h-3 w-16 bg-slate-100 rounded animate-pulse ml-auto"></div>
        </div>
        <div className="w-10 h-10 rounded-xl bg-slate-200 animate-pulse"></div>
      </>
    );
  }

  const name = currentBroker?.name || "Sem Corretor";
  const role = currentBroker?.role === 'admin' ? 'Admin / Corretor' : 'Corretor';
  const initials = name.split(' ').filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase() || "SC";
  const avatarUrl = currentBroker?.avatar_url;

  return (
    <>
      <div className="text-right hidden sm:block">
        <p className="text-sm font-black text-blue-900">{name}</p>
        <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest">{role}</p>
      </div>
      <div className="w-10 h-10 rounded-xl bg-blue-100 border-2 border-white shadow-sm flex items-center justify-center text-blue-700 font-bold text-xs overflow-hidden">
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          initials
        )}
      </div>
    </>
  );
}

export function TopBar({ title, onMenuClick }: { title: string; onMenuClick?: () => void }) {
  const { alerts, refresh } = useAlerts();
  const [showNotifications, setShowNotifications] = React.useState(false);
  const { selectedLead, isOpen, isExternalDrawerOpen, closeDrawer, openDrawer } = useDrawer();
  const { fetchLeads } = useLeads();
  const location = useLocation();
  const isNetworkPage = location.pathname === '/network';

  const isAnyDrawerOpen = isOpen || isExternalDrawerOpen;

  return (
    <header className="flex flex-col w-full sticky top-0 z-[100]">
      {!isAnyDrawerOpen && !isNetworkPage && <GlobalAlertBar />}
      {!isAnyDrawerOpen && (
        <div className={cn(
          "flex justify-between items-center px-4 md:px-8 py-2 bg-white/80 backdrop-blur-md border-b border-slate-100 shadow-sm",
          isNetworkPage && "hidden md:flex"
        )}>
          <div className="flex items-center gap-4">
            <button className="md:hidden text-slate-500 hover:text-blue-700" onClick={onMenuClick}>
              <Icons.Menu className="w-5 h-5" />
            </button>
            <h2 className="text-lg md:text-xl font-bold text-blue-900 truncate max-w-[150px] md:max-w-none">{title}</h2>
            {title === "Visão Geral" && (
              <span className="text-[10px] md:text-xs font-medium text-slate-400 mt-1 ml-2 hidden md:block">
                {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date())}
              </span>
            )}
          </div>
          <div className="flex items-center gap-6">
            <div className="relative group">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-1 text-slate-500 hover:text-blue-700 transition-all rounded-full hover:bg-slate-50"
              >
                <Icons.Notifications className="w-6 h-6" />
                {alerts.length > 0 && (
                  <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[8px] font-black flex items-center justify-center rounded-full ring-2 ring-white">
                    {alerts.length}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-4 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50"
                    >
                      <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Notificações</span>
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{alerts.length} Ativas</span>
                      </div>
                      <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                        {alerts.length > 0 ? alerts.map((alert) => (
                          <div key={alert.id} onClick={() => { if(alert.leadData) closeDrawer(); setTimeout(() => alert.leadData && openDrawer(alert.leadData, 'details'), 50); setShowNotifications(false); }} className="p-4 flex gap-4 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-none cursor-pointer">
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                              alert.type === 'birthday' ? "bg-pink-100 text-pink-600" :
                              alert.type === 'marriage' ? "bg-rose-100 text-rose-600" : "bg-blue-100 text-blue-600"
                            )}>
                              {alert.type === 'birthday' ? <Icons.Cake className="w-5 h-5" /> :
                               alert.type === 'marriage' ? <Icons.Heart className="w-5 h-5" /> : <Icons.History className="w-5 h-5" />}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900 leading-tight">{alert.title}</p>
                              <p className="text-[11px] text-slate-500 mt-1 font-medium">{alert.description}</p>
                            </div>
                          </div>
                        )) : (
                          <div className="p-10 text-center">
                            <Icons.Bell className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                            <p className="text-xs text-slate-400 font-bold uppercase">Sem notificações</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            <NavLink to="/settings">
              <Icons.Settings className="w-5 h-5 text-slate-500 hover:text-blue-700 cursor-pointer transition-all" />
            </NavLink>
            <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
              <BrokerProfileBadge />
            </div>
          </div>
        </div>
      )}
      
      <LeadDetailDrawer 
        lead={selectedLead} 
        isOpen={isOpen} 
        onClose={closeDrawer} 
        onUpdate={fetchLeads} 
        onRefreshAlerts={refresh}
      />
    </header>
  );
}
