import React, { useEffect, useState, useMemo } from "react";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Cell,
  PieChart, 
  Pie
} from "recharts";
import { motion } from "framer-motion";
import { Icons } from "../components/Icons";
import { formatCurrency, cn } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { useLeads } from "../lib/leadsContext";

export default function Dashboard() {
  const { leads, stages, fetchLeads } = useLeads();
  const [stats, setStats] = useState<any>(null);
  const [funnelData, setFunnelData] = useState<any[]>([]);
  const [ranking, setRanking] = useState<any[]>([]);
  const [proposals, setProposals] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [birthdaysMonth, setBirthdaysMonth] = useState(0);
  const [birthdaysWeek, setBirthdaysWeek] = useState(0);
  const [birthdaysDay, setBirthdaysDay] = useState(0);

  const fetchDashboardData = async () => {
    try {
      const [beneficiariesRes, contractsRes, remindersRes] = await Promise.all([
        supabase.from('beneficiaries').select('*'),
        supabase.from('contracts').select('*, leads(name)'),
        supabase.from('reminders').select('*, leads(name)').eq('status', 'pendente')
      ]);

    const beneficiaries = beneficiariesRes.data || [];
    const contracts = contractsRes.data || [];
    const reminders = (remindersRes as any)?.data || [];

    // Stats
    const totalLeads = leads.length;
    const vidasVendidas = beneficiaries.length;
    
    // Filtra leads que estão em etapas de "risco" (ex: proposta, assinatura)
    // Para simplificar, vamos considerar etapas que não são a primeira nem a última (Pago)
    const riskStages = stages.slice(1, -1).map(s => s.name);
    const receitaEmRisco = leads
      .filter(l => riskStages.includes(l.status))
      .reduce((acc, l) => acc + (Number(l.deal_value) || 0), 0);
    
    const receitaStandby = leads
      .filter(l => l.status === 'Stand-by')
      .reduce((acc, l) => acc + (Number(l.deal_value) || 0), 0);
    
    setStats({ totalLeads, vidasVendidas, receitaEmRisco, receitaStandby });

    // Funnel Dinâmico
    const newFunnelData = stages.map(stage => ({
      stage: stage.label,
      name: stage.name,
      value: leads.filter(l => l.status === stage.name).length,
      color: stage.color
    }));
    setFunnelData(newFunnelData);

    // Ranking de Operadoras (baseado nos Leads)
    const rankingObj: Record<string, number> = {};
    leads.forEach((l: any) => {
      if(!l.carrier) return;
      if(!rankingObj[l.carrier]) rankingObj[l.carrier] = 0;
      rankingObj[l.carrier] += (Number(l.deal_value) || 0);
    });
    const totalValue = Object.values(rankingObj).reduce((a: number,b: number)=>a+b, 0) || 1;
    const rankArray = Object.keys(rankingObj).map(car => ({
      name: car,
      value: rankingObj[car],
      percentage: Math.round((rankingObj[car] / totalValue) * 100)
    })).sort((a,b) => b.value - a.value).slice(0, 4);
    setRanking(rankArray.length ? rankArray : [{name: "N/A", value: 0, percentage: 0}]);

    // Proposals (Leads em etapas finais)
    const finalStages = stages.slice(-3).map(s => s.name); // As últimas 3 etapas
    setProposals(leads.filter((l: any) => finalStages.includes(l.status)).map((l: any) => ({
      id: l.id,
      initials: (l.name || "XX").substring(0, 2).toUpperCase(),
      client: l.name,
      carrier: l.carrier || "N/A",
      lives: l.interested_lives || 0,
      value: Number(l.deal_value) || 0,
      status: l.status === stages[stages.length - 1]?.name ? 'Pago' : 'Em Análise'
    })));

    // Events & Birthdays Logic
    const now = new Date();
    now.setHours(0,0,0,0);
    const currentMonth = now.getMonth();
    let monthCount = 0;
    let dayCount = 0;
    const upcoming: any[] = [];

    const checkEvent = (dateStr: string, name: string, type: string, parentName?: string) => {
      if (!dateStr) return;
      const d = new Date(dateStr);
      
      // Contar aniversariantes do dia (ignorar ano)
      if (d.getDate() === now.getDate() && d.getMonth() === now.getMonth()) dayCount++;
      
      // Contar aniversariantes do mês (ignorar ano)
      if (d.getMonth() === currentMonth) monthCount++;

      // Próximos 7 dias (ignorar ano)
      const eventThisYear = new Date(now.getFullYear(), d.getMonth(), d.getDate());
      
      // Se já passou este ano, checar para o próximo (para o caso de fim de ano)
      if (eventThisYear < now) {
        eventThisYear.setFullYear(now.getFullYear() + 1);
      }

      const diff = Math.ceil((eventThisYear.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diff >= 0 && diff <= 7) {
        upcoming.push({ name, type, date: d, diff, parentName });
      }
    };

    leads.forEach((l: any) => {
      checkEvent(l.birth_date, l.name, "Aniversário");
      checkEvent(l.marriage_date, l.name, "Aniv. Casamento");
    });

    beneficiaries.forEach((b: any) => {
      checkEvent(b.birth_date, b.name, "Aniv. Dependente", b.lead_id ? leads.find((l:any)=>l.id === b.lead_id)?.name : undefined);
    });

    contracts.forEach((c: any) => {
      checkEvent(c.start_date, c.leads?.name || "Contrato", "Vigência");
    });

    reminders.forEach((rem: any) => {
      const d = new Date(rem.due_date);
      d.setHours(0,0,0,0);
      const diff = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diff >= 0 && diff <= 7) {
        upcoming.push({ name: rem.title, type: "Lembrete", date: d, diff, parentName: rem.leads?.name });
      }
    });

    setBirthdaysMonth(monthCount);
    setBirthdaysDay(dayCount);
    setBirthdaysWeek(upcoming.filter(e => (e.type === "Aniversário" || e.type === "Aniv. Dependente") && e.diff <= 7).length);
    setUpcomingEvents(upcoming.sort((a,b) => a.diff - b.diff));
    } catch (error) {
      console.error("Dashboard error:", error);
    }
  };

  useEffect(() => {
    if (leads.length > 0 && stages.length > 0) {
      fetchDashboardData();
    }
  }, [leads, stages]);

  if (!stats) return <div className="p-8 flex items-center justify-center min-h-[400px]">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <span className="text-slate-400 font-bold uppercase tracking-widest text-xs">Carregando Dashboard...</span>
    </div>
  </div>;

  return (
    <div className="p-8 space-y-10">
      {/* Summary Metrics */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-xl relative overflow-hidden group border border-slate-100 shadow-sm"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110 duration-500" />
          <p className="text-[0.6875rem] uppercase tracking-widest text-slate-500 font-bold mb-2">Total de Leads</p>
          <h3 className="text-5xl font-extrabold text-blue-900 tracking-tight">{stats.totalLeads.toLocaleString()}</h3>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-8 rounded-xl relative overflow-hidden group border border-slate-100 shadow-sm"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110 duration-500" />
          <p className="text-[0.6875rem] uppercase tracking-widest text-slate-500 font-bold mb-2">Vidas Ativas</p>
          <h3 className="text-5xl font-extrabold text-blue-900 tracking-tight">{stats.vidasVendidas}</h3>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-blue-600 p-8 rounded-xl text-white relative overflow-hidden group shadow-lg shadow-blue-100"
        >
          <div className="relative z-10">
            <p className="text-[0.6875rem] uppercase tracking-widest text-blue-100 font-bold mb-2">Receitas em Negociação</p>
            <h3 className="text-2xl font-extrabold tracking-tight truncate">{formatCurrency(stats.receitaEmRisco)}</h3>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-amber-500 p-8 rounded-xl text-white relative overflow-hidden group shadow-lg shadow-amber-100"
        >
          <div className="relative z-10">
            <p className="text-[0.6875rem] uppercase tracking-widest text-amber-50 font-bold mb-2">Receita em Standby</p>
            <h3 className="text-2xl font-extrabold tracking-tight truncate">{formatCurrency(stats.receitaStandby)}</h3>
          </div>
        </motion.div>

        {/* NEW: Birthday Month Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white p-8 rounded-xl relative overflow-hidden group border border-slate-100 shadow-sm md:col-span-2 lg:col-span-2"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-pink-50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110 duration-500" />
          <div className="flex items-center gap-6 relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-pink-100 flex items-center justify-center shrink-0">
              <Icons.Cake className="w-8 h-8 text-pink-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-3">Aniversariantes</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-black text-slate-400 uppercase">No Dia</p>
                  <p className="text-2xl font-black text-pink-600">{birthdaysDay}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Semana</p>
                  <p className="text-2xl font-black text-pink-600">{birthdaysWeek}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-black text-slate-400 uppercase">No Mês</p>
                  <p className="text-2xl font-black text-pink-600">{birthdaysMonth}</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Main Grid: Funnel & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Left Column: Funnel and Events */}
        <div className="lg:col-span-2 space-y-10">
          {/* Sales Funnel Chart */}
          <section className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Icons.Funnel className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Funil de Vendas</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Controle de Pipeline</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              {funnelData.map((item, idx) => (
                <div key={item.name} className="flex items-center">
                  <span className="w-32 text-[10px] font-black uppercase text-slate-400">{item.stage}</span>
                  <div className="flex-1 h-12 bg-slate-50 rounded-xl flex items-center pr-4 overflow-hidden border border-slate-100">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${funnelData[0]?.value ? (item.value / funnelData[0].value) * 100 : 0}%` }}
                      transition={{ duration: 1, delay: idx * 0.1 }}
                      className={cn(
                        "h-full",
                        item.color || "bg-blue-600"
                      )}
                    />
                    <span className="ml-auto text-sm font-black text-blue-900">{item.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* NEW: Upcoming Events Panel */}
          <section className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Icons.Bell className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Agenda de Eventos</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Próximos 7 Dias</p>
                </div>
              </div>
              <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-3 py-1 rounded-full uppercase">Sincronizado</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {upcomingEvents.length > 0 ? upcomingEvents.map((event, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between group hover:border-blue-200 transition-all cursor-default"
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black shadow-sm",
                      event.type === 'Aniversário' ? "bg-blue-100 text-blue-600" :
                      event.type === 'Aniv. Dependente' ? "bg-pink-100 text-pink-600" :
                      event.type === 'Aniv. Casamento' ? "bg-rose-100 text-rose-600" : 
                      event.type === 'Lembrete' ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"
                    )}>
                      {event.date.getDate()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-900 truncate">{event.name}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-slate-400">{event.type}</span>
                        {event.parentName && (
                          <span className="text-[9px] font-medium text-slate-400 truncate opacity-70">({event.parentName})</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right ml-2">
                    {event.diff === 0 ? (
                      <span className="text-[10px] font-black text-white bg-red-500 px-2 py-0.5 rounded-full animate-pulse uppercase">Hoje</span>
                    ) : (
                      <span className="text-[10px] font-black text-slate-400 uppercase">Em {event.diff}d</span>
                    )}
                  </div>
                </motion.div>
              )) : (
                <div className="col-span-2 py-12 text-center border-2 border-dashed border-slate-100 rounded-2xl">
                  <Icons.Plus className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-sm font-medium text-slate-400">Nenhum evento importante nos próximos 7 dias.</p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Carriers and Recent Proposals */}
        <div className="space-y-10">
          {/* Top Carriers Chart */}
          <section className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm h-fit">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <Icons.TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Operadoras</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Market Share</p>
              </div>
            </div>
            
            <div className="h-[250px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={ranking}
                    innerRadius={70}
                    outerRadius={95}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {ranking.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={['#2563eb', '#10b981', '#f59e0b', '#ef4444'][index % 4]} 
                        className="outline-none"
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black text-slate-900">{ranking[0]?.percentage || 0}%</span>
                <span className="text-[9px] font-black text-slate-400 uppercase">Líder</span>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              {ranking.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-2.5 h-2.5 rounded-full",
                      idx === 0 ? "bg-blue-600" : idx === 1 ? "bg-emerald-500" : idx === 2 ? "bg-amber-500" : "bg-red-500"
                    )} />
                    <span className="text-xs font-black text-slate-600 truncate max-w-[120px]">{item.name}</span>
                  </div>
                  <span className="text-[10px] font-black text-slate-400">{item.percentage}%</span>
                </div>
              ))}
            </div>
          </section>

          {/* Recent Proposals Table (Mini) */}
          <section className="bg-slate-900 rounded-2xl p-8 text-white">
            <h3 className="text-lg font-black mb-6">Últimas Propostas</h3>
            <div className="space-y-6">
              {proposals.slice(0, 4).map((prop) => (
                <div key={prop.id} className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center font-bold text-xs">
                    {prop.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{prop.client}</p>
                    <p className="text-[10px] text-slate-400 uppercase font-black">{prop.carrier}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-blue-400">{formatCurrency(prop.value).split(',')[0]}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
