import React from "react";
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
              <p className="text-[0.6875rem] tracking-wider uppercase text-slate-500 mt-1 font-semibold">Gestão de Seguros</p>
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

      <NotificationPanel setIsOpen={setIsOpen} />

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

function NotificationPanel({ setIsOpen }: { setIsOpen?: (val: boolean) => void }) {
  const { unreadLeads, leads, unreadCounts } = useLeads();
  const { openDrawer } = useDrawer();

  // Filter leads that have unread messages
  const leadsWithUnread = unreadLeads
    .map(id => leads.find(l => l.id === id))
    .filter(Boolean);

  if (leadsWithUnread.length === 0) return null;

  return (
    <div className="px-6 py-4 border-t border-slate-100/50 mt-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Mensagens Diretas</span>
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[8px] font-bold text-white animate-pulse">
          {leadsWithUnread.length}
        </span>
      </div>
      
      <div className="space-y-1.5 overflow-y-auto max-h-[300px] no-scrollbar">
        {leadsWithUnread.map((lead) => (
          <button
            key={lead.id}
            onClick={() => {
              openDrawer(lead, 'chat');
              if (window.innerWidth < 768 && setIsOpen) setIsOpen(false);
            }}
            className="flex items-center w-full group p-2 hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-100 hover:shadow-sm"
          >
            <div className="relative shrink-0">
              <div className="w-9 h-9 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center font-bold text-xs text-slate-600 overflow-hidden group-hover:scale-105 transition-transform">
                {lead.avatar_url ? (
                  <img src={lead.avatar_url} alt={lead.name} className="w-full h-full object-cover" />
                ) : (
                  (lead.name || "N").substring(0, 2).toUpperCase()
                )}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full flex items-center justify-center">
                <Icons.MessageSquare className="w-2 h-2 text-white" />
              </div>
            </div>
            
            <div className="ml-3 flex-1 text-left min-w-0">
              <p className="text-[11px] font-bold text-slate-700 truncate leading-tight group-hover:text-blue-600 transition-colors">
                {lead.name}
              </p>
              <div className="flex items-center justify-between mt-0.5">
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">WhatsApp</p>
                {unreadCounts[lead.id] > 1 && (
                  <span className="bg-slate-100 text-slate-500 text-[8px] px-1.5 py-0.5 rounded-full font-black">
                    {unreadCounts[lead.id]}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}


function GlobalAlertBar() {
  const { alerts } = useAlerts();
  const todayAlerts = alerts.filter(a => a.isToday);

  if (todayAlerts.length === 0) return null;

  return (
    <div className="bg-blue-600 text-white px-4 py-2 flex items-center justify-center gap-4 animate-in slide-in-from-top duration-500 relative z-[100] shadow-lg">
      <Icons.Cake className="w-4 h-4 animate-bounce" />
      <div className="flex gap-4 overflow-x-auto no-scrollbar py-0.5">
        {todayAlerts.map(alert => (
          <div key={alert.id} className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded">Hoje</span>
            <span className="text-xs font-bold">{alert.title}</span>
          </div>
        ))}
      </div>
      <Icons.Cake className="w-4 h-4 animate-bounce" />
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
  const { alerts } = useAlerts();
  const [showNotifications, setShowNotifications] = React.useState(false);
  const { selectedLead, isOpen, closeDrawer } = useDrawer();
  const { fetchLeads } = useLeads();

  return (
    <header className="flex flex-col w-full sticky top-0 z-30">
      <GlobalAlertBar />
      <div className="flex justify-between items-center px-4 md:px-8 py-4 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="flex items-center gap-4">
          <button className="md:hidden text-slate-500 hover:text-blue-700" onClick={onMenuClick}>
            <Icons.Menu className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold text-blue-900">{title}</h2>
          {title === "Visão Geral" && (
            <span className="text-xs font-medium text-slate-400 mt-1 ml-2">
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
                        <div key={alert.id} className="p-4 flex gap-4 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-none">
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
      
      <LeadDetailDrawer 
        lead={selectedLead} 
        isOpen={isOpen} 
        onClose={closeDrawer} 
        onUpdate={fetchLeads} 
      />
    </header>
  );
}
