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
import { getTier, TIERS, calculateNetCommission } from "../lib/commissionRules";

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
        supabase.from('contracts').select('*'),
        supabase.from('reminders').select('*, leads(name)').eq('status', 'pendente')
      ]);

    const beneficiaries = beneficiariesRes.data || [];
    const contracts = contractsRes.data || [];
    const reminders = (remindersRes as any)?.data || [];

    // VGV Cálculo (Valor Global de Vendas)
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Mês Anterior para definir a Pedra
    const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const lastMonthM = lastMonthDate.getMonth();
    const lastMonthY = lastMonthDate.getFullYear();

    const lastMonthVgv = contracts
      .filter(c => {
        const d = new Date(c.start_date);
        return d.getMonth() === lastMonthM && d.getFullYear() === lastMonthY;
      })
      .reduce((acc, c) => acc + (Number(c.monthly_fee) || 0), 0);

    const currentMonthVgv = contracts
      .filter(c => {
        const d = new Date(c.start_date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((acc, c) => acc + (Number(c.monthly_fee) || 0), 0);

    const stoneStatus = getTier(lastMonthVgv);
    const nextTier = TIERS[TIERS.indexOf(TIERS.find(t => t.name === stoneStatus.name)!) + 1] || null;
    const progressToNext = nextTier ? Math.min((currentMonthVgv / nextTier.minVgv) * 100, 100) : 100;

    // Cálculo de Comissões Líquidas (baseado na Pedra do mês passado)
    const comissaoLiquidaTotal = contracts
      .filter(c => {
        const d = new Date(c.start_date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((acc, c) => {
        const calculation = calculateNetCommission(c.carrier || '', Number(c.monthly_fee) || 0, stoneStatus.name);
        return acc + calculation.net;
      }, 0);
    
    // Novas estatísticas baseadas nos leads e negócios ativos
    const totalLeads = leads.length;
    
    // Contratos Ativos e Vidas Ativas
    const activeContracts = contracts.filter(c => 
      c.status && 
      c.status.toLowerCase().trim() === 'ativo' && 
      c.client_name // Garante que não é um registro vazio ou de teste sem nome
    );

    // DEBUG: Imprime no console para que o usuário veja o que está sendo contado
    if (activeContracts.length > 0) {
      console.log("--- DEBUG: CONTRATOS ATIVOS ENCONTRADOS ---");
      activeContracts.forEach(c => {
        console.log(`ID: ${c.id} | Cliente: ${c.client_name} | Vidas: ${c.lives} | Data: ${c.start_date}`);
      });
      console.log("-------------------------------------------");
    }

    const totalActiveContracts = activeContracts.length;
    
    // Calcula vidas ativas estritamente dos contratos que passaram no filtro acima
    const vidasAtivas = activeContracts.reduce((acc, c) => acc + (Number(c.lives) || 0), 0);
    
    // Valores específicos solicitados pelo usuário
    const negociaçõesTotais = leads
      .filter(l => !['Ganhos', 'Perdidos', 'Arquivado'].includes(l.status || ''))
      .reduce((acc, l) => acc + (Number(l.deal_value) || 0), 0);

    const propostasEnviadas = leads
      .filter(l => l.status === 'Cotação Enviada')
      .reduce((acc, l) => acc + (Number(l.deal_value) || 0), 0);

    const propostasNaOperadora = leads
      .filter(l => l.status === 'Proposta Operadora')
      .reduce((acc, l) => acc + (Number(l.deal_value) || 0), 0);

    const contratoLiberado = leads
      .filter(l => l.status === 'Contrato')
      .reduce((acc, l) => acc + (Number(l.deal_value) || 0), 0);

    const implantaçãoAtiva = leads
      .filter(l => l.status === 'Plano Ativo')
      .reduce((acc, l) => acc + (Number(l.deal_value) || 0), 0);

    // Meta Mensal (R$ 15.000) baseada em Contratos/Vidas convertidas este mês
    const metaMensal = 15000;
    const atingidoMeta = leads
      .filter(l => {
        if (!['Contrato', 'Plano Ativo'].includes(l.status || '')) return false;
        const d = new Date(l.updated_at || l.created_at);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((acc, l) => acc + (Number(l.deal_value) || 0), 0);
    
    const progressMeta = Math.min((atingidoMeta / metaMensal) * 100, 100);

    setStats({ 
      totalLeads: leads.length, 
      totalActiveContracts: contracts.filter(c => c.status?.toLowerCase() === 'ativo').length,
      vidasAtivas: contracts.filter(c => c.status?.toLowerCase() === 'ativo').reduce((acc, c) => acc + (Number(c.lives) || 0), 0),
      negociaçõesTotais,
      propostasEnviadas,
      propostasNaOperadora,
      contratoLiberado,
      implantaçãoAtiva,
      atingidoMeta,
      metaMensal,
      progressMeta,
      comissaoLiquidaTotal: comissaoLiquidaTotal,
      stoneStatus,
      nextTier,
      progressToNext
    });

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

    // Events & Birthdays Logic (Usa a constante 'now' definida no início da função)
    const currentMonthForEvents = now.getMonth();
    let monthCount = 0;
    let dayCount = 0;
    const upcoming: any[] = [];

    const checkEvent = (dateStr: string, name: string, type: string, parentName?: string) => {
      if (!dateStr) return;
      const d = new Date(dateStr);
      
      // Contar aniversariantes do dia (ignorar ano)
      if (d.getDate() === now.getDate() && d.getMonth() === now.getMonth()) dayCount++;
      
      // Contar aniversariantes do mês (ignorar ano)
      if (d.getMonth() === currentMonthForEvents) monthCount++;

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
      checkEvent(c.start_date, c.client_name || "Contrato", "Vigência");
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

  const MetricCard = ({ label, value, color, icon: Icon, delay }: any) => (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm relative overflow-hidden group"
    >
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", 
            color === 'blue' ? "bg-blue-50 text-blue-600" :
            color === 'emerald' ? "bg-emerald-50 text-emerald-600" :
            color === 'amber' ? "bg-amber-50 text-amber-600" :
            color === 'sky' ? "bg-sky-50 text-sky-600" : "bg-indigo-50 text-indigo-600"
          )}>
            <Icon className="w-4 h-4" />
          </div>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">{label}</span>
        </div>
        <h3 className="text-lg font-black text-slate-900 truncate">{formatCurrency(value)}</h3>
      </div>
      <div className={cn("absolute -right-4 -bottom-4 w-12 h-12 rounded-full blur-xl opacity-20",
        color === 'blue' ? "bg-blue-400" :
        color === 'emerald' ? "bg-emerald-400" :
        color === 'amber' ? "bg-amber-400" :
        color === 'sky' ? "bg-sky-400" : "bg-indigo-400"
      )} />
    </motion.div>
  );

  if (!stats) return <div className="p-8 flex items-center justify-center min-h-[400px]">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <span className="text-slate-400 font-bold uppercase tracking-widest text-xs">Carregando Dashboard...</span>
    </div>
  </div>;

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden custom-scrollbar p-6 space-y-8">
      {/* Summary Metrics - Fixed One Row Layout */}
      {/* Summary Metrics - Fixed One Row Layout */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3 xl:gap-4">
        {/* Row 1/2 Toggle */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm col-span-1 xl:col-span-2 relative overflow-hidden group"
        >
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Meta de Vendas</span>
              <Icons.Target className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl font-black text-slate-900">{formatCurrency(stats.atingidoMeta)}</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase">/ {formatCurrency(stats.metaMensal)}</p>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase mb-1.5 tracking-tighter">
                <span>Progresso Mensal</span>
                <span className={cn(stats.progressMeta >= 100 ? "text-emerald-500" : "text-blue-600")}>
                  {Math.round(stats.progressMeta)}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${stats.progressMeta}%` }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className={cn(
                    "h-full rounded-full transition-colors",
                    stats.progressMeta >= 100 ? "bg-emerald-500" : "bg-blue-600"
                  )}
                />
              </div>
            </div>
          </div>
          <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-emerald-50 rounded-full blur-2xl group-hover:bg-emerald-100/50 transition-colors" />
        </motion.div>

        <MetricCard 
          label="Em Negociação" 
          value={stats.negociaçõesTotais} 
          color="blue" 
          icon={Icons.Funnel} 
          delay={0.1}
        />
        
        <MetricCard 
          label="Cotações Enviadas" 
          value={stats.propostasEnviadas} 
          color="sky" 
          icon={Icons.MessageSquare} 
          delay={0.2}
        />

        <MetricCard 
          label="Na Operadora" 
          value={stats.propostasNaOperadora} 
          color="amber" 
          icon={Icons.History} 
          delay={0.3}
        />

        <MetricCard 
          label="Contrato Liberado" 
          value={stats.contratoLiberado} 
          color="emerald" 
          icon={Icons.CheckCircle} 
          delay={0.4}
        />

        <MetricCard 
          label="Implantação Ativa" 
          value={stats.implantaçãoAtiva} 
          color="indigo" 
          icon={Icons.Rocket} 
          delay={0.5}
        />
      </section>

      {/* Secondary Row: Leads and Broker Stats */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
          className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between"
        >
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total de Leads</p>
            <h3 className="text-xl font-black text-slate-900">{stats.totalLeads.toLocaleString()}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <Icons.Leads className="w-5 h-5" />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
          className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between"
        >
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Vidas Ativas</p>
            <h3 className="text-xl font-black text-slate-900">{stats.vidasAtivas}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <Icons.Users className="w-5 h-5" />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
          className={cn(
            "p-5 rounded-xl text-white relative overflow-hidden group shadow-lg",
            stats.stoneStatus.color === 'amber' ? "bg-amber-500 shadow-amber-100" :
            stats.stoneStatus.color === 'blue' ? "bg-blue-700 shadow-blue-100" :
            stats.stoneStatus.color === 'emerald' ? "bg-emerald-600 shadow-emerald-100" :
            stats.stoneStatus.color === 'red' ? "bg-red-600 shadow-red-100" : "bg-slate-600 shadow-slate-100"
          )}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest opacity-80 mb-1">Status Invictos</p>
              <h3 className="text-lg font-black italic uppercase">{stats.stoneStatus.label}</h3>
            </div>
            <Icons.Trophy className="w-6 h-6 opacity-30" />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}
          className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4"
        >
          <div className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center shrink-0">
            <Icons.Cake className="w-5 h-5 text-pink-600" />
          </div>
          <div className="flex-1 flex justify-between items-center pr-2">
            <div className="text-center">
              <p className="text-[8px] font-black text-slate-400 uppercase">Dia</p>
              <p className="text-sm font-black text-pink-600 leading-none">{birthdaysDay}</p>
            </div>
            <div className="text-center px-4 border-x border-slate-100">
              <p className="text-[8px] font-black text-slate-400 uppercase">Sem</p>
              <p className="text-sm font-black text-pink-600 leading-none">{birthdaysWeek}</p>
            </div>
            <div className="text-center">
              <p className="text-[8px] font-black text-slate-400 uppercase">Mês</p>
              <p className="text-sm font-black text-pink-600 leading-none">{birthdaysMonth}</p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Main Grid: Funnel & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-10">
        {/* Left Column: Funnel and Events */}
        <div className="lg:col-span-2 space-y-6 md:space-y-10">
          {/* Sales Funnel Chart */}
          <section className="bg-white p-4 md:p-8 rounded-2xl border border-slate-100 shadow-sm">
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
          <section className="bg-white p-4 md:p-8 rounded-2xl border border-slate-100 shadow-sm">
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
                  className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between group hover:border-blue-200 transition-all cursor-default overflow-hidden"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
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
        <div className="space-y-6 md:space-y-10">
          {/* Top Carriers Chart */}
          <section className="bg-white p-4 md:p-8 rounded-2xl border border-slate-100 shadow-sm h-fit">
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
