import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icons } from "../components/Icons";
import { useAlerts } from "../hooks/useAlerts";
import { useDrawer } from "../lib/drawerContext";
import { cn } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { useToast } from "../components/Toasts";

export default function Alerts() {
  const { alerts, loading, refresh } = useAlerts();
  const { openDrawer } = useDrawer();
  const { success, error: showError } = useToast();
  const [isFinishing, setIsFinishing] = useState<string | null>(null);

  const handleFinishReminder = async (id: string) => {
    setIsFinishing(id);
    try {
      const { error } = await supabase
        .from('reminders')
        .update({ status: 'concluido' })
        .eq('id', id);

      if (error) throw error;
      success("Lembrete concluído!");
      refresh();
    } catch (err: any) {
      showError("Erro ao concluir: " + err.message);
    } finally {
      setIsFinishing(null);
    }
  };

  const overdue = alerts.filter(a => a.statusLabel === 'Vencido');
  const today = alerts.filter(a => a.isToday);
  const upcoming = alerts.filter(a => !a.isToday && a.statusLabel !== 'Vencido');

  const Section = ({ title, data, colorClass }: any) => {
    if (data.length === 0) return null;
    return (
      <section className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
             <div className={cn("w-1.5 h-6 rounded-full", colorClass)} />
             <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest leading-none">{title}</h3>
             <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{data.length}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {data.map((alert: any, idx: number) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => {
                if (alert.leadData) {
                  openDrawer(alert.leadData, 'details');
                }
              }}
              className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-blue-900/5 hover:-translate-y-1 transition-all group cursor-pointer relative overflow-hidden"
            >
              {/* Type Icon Area */}
              <div className="flex items-start justify-between mb-4">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-inner",
                  alert.type === 'birthday' ? "bg-pink-50 text-pink-600" :
                  alert.type === 'marriage' ? "bg-rose-50 text-rose-600" :
                  alert.type === 'reminder' ? "bg-amber-50 text-amber-600" :
                  alert.type === 'expiry' ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
                )}>
                  {alert.type === 'birthday' && <Icons.Cake className="w-6 h-6" />}
                  {alert.type === 'marriage' && <Icons.Heart className="w-6 h-6" />}
                  {alert.type === 'reminder' && <Icons.Bell className="w-6 h-6" />}
                  {alert.type === 'expiry' && <Icons.FileText className="w-6 h-6" />}
                  {alert.type === 'contract' && <Icons.CheckCircle className="w-6 h-6" />}
                </div>

                <div className="text-right">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter leading-none mb-1">DATA EVENTO</p>
                   <p className="text-xs font-black text-slate-900 leading-none">
                     {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(alert.date)}
                   </p>
                </div>
              </div>

              {/* Content */}
              <div className="space-y-2 mb-6">
                <h4 className="text-sm font-black text-slate-900 leading-tight group-hover:text-blue-600 transition-colors uppercase tracking-tight">{alert.title}</h4>
                <p className="text-xs font-medium text-slate-500 line-clamp-2 leading-relaxed italic">{alert.description}</p>
              </div>

              {/* Lead & Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                 <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-500 uppercase">
                      {((alert.leadData?.name || "?") as string).substring(0,2).toUpperCase()}
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate max-w-[120px]">
                      {alert.leadData?.name || "TITULAR"}
                    </span>
                 </div>
                 
                 {alert.type === 'reminder' ? (
                   <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFinishReminder(alert.id.replace('rem-', ''));
                    }}
                    disabled={isFinishing === alert.id.replace('rem-', '')}
                    className="flex items-center gap-1 text-[9px] font-black uppercase bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white px-3 py-1.5 rounded-xl transition-all shadow-sm shadow-emerald-100"
                   >
                     {isFinishing === alert.id.replace('rem-', '') ? <Icons.Loader2 className="w-3 h-3 animate-spin" /> : <Icons.Check className="w-3 h-3" />}
                     Concluir
                   </button>
                 ) : (
                    <div className="flex items-center gap-1 text-[9px] font-black uppercase text-blue-600">
                      Ver Ficha <Icons.ChevronRight className="w-3 h-3" />
                    </div>
                 )}
              </div>

              {/* Section Tag */}
              <div className={cn(
                "absolute top-0 right-0 h-1 w-full opacity-50",
                alert.statusLabel === 'Vencido' ? "bg-red-500" :
                alert.isToday ? "bg-amber-500" : "bg-blue-500"
              )} />
            </motion.div>
          ))}
        </div>
      </section>
    );
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-400 font-bold uppercase tracking-widest text-xs">Sincronizando Avisos...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-8 space-y-12">
      {/* Header Centralizado */}
      <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl shadow-blue-900/20">
         <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-4 text-center md:text-left">
               <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 rounded-full border border-white/10 backdrop-blur-sm">
                  <Icons.Bell className="w-4 h-4 text-amber-400" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">Fluxo de Gestão</span>
               </div>
               <h2 className="text-4xl font-black italic tracking-tighter">Central de <span className="text-blue-400">Avisos</span></h2>
               <p className="text-slate-400 text-sm max-w-md font-medium">Acompanhe todos os compromissos, aniversários e lembretes em um único lugar. Ação rápida garantida.</p>
            </div>

            <div className="flex gap-4">
               <div className="bg-white/5 border border-white/10 rounded-3xl p-6 text-center backdrop-blur-sm min-w-[120px]">
                  <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Vencidos</p>
                  <p className="text-3xl font-black text-red-400">{overdue.length}</p>
               </div>
               <div className="bg-white/5 border border-white/10 rounded-3xl p-6 text-center backdrop-blur-sm min-w-[120px]">
                  <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Para Hoje</p>
                  <p className="text-3xl font-black text-amber-400">{today.length}</p>
               </div>
            </div>
         </div>
         
         <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 rounded-full blur-[120px] opacity-20 -mr-32 -mt-32" />
         <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-600 rounded-full blur-[100px] opacity-10 -ml-24 -mb-24" />
      </div>

      <Section title="Vencidos ou em Atraso" data={overdue} colorClass="bg-red-500" />
      <Section title="Eventos para Hoje" data={today} colorClass="bg-amber-500" />
      <Section title="Próximos 7 Dias" data={upcoming} colorClass="bg-blue-500" />

      {alerts.length === 0 && (
        <div className="py-32 text-center space-y-6">
           <div className="w-24 h-24 bg-slate-100 rounded-[2.5rem] flex items-center justify-center mx-auto text-slate-300">
              <Icons.Bell className="w-12 h-12" />
           </div>
           <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-900 italic tracking-tight">Tudo sob controle!</h3>
              <p className="text-sm text-slate-400 max-w-sm mx-auto font-medium">Você não possui avisos pendentes ou próximos eventos no momento.</p>
           </div>
        </div>
      )}
    </div>
  );
}
