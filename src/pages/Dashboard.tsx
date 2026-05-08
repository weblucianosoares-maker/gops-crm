// v1.0.5 - Dashboard com proteção total de tipos
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
  const [selectedPeriod, setSelectedPeriod] = useState<'mês' | 'trimestre' | 'semestre' | 'ano' | 'custom'>('mês');
  const [customStartDate, setCustomStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [customEndDate, setCustomEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [drilldown, setDrilldown] = useState<{ title: string; leads: any[] } | null>(null);
  // Mês específico selecionado (formato YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  );

  const getStartDate = (period: string) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (period === 'mês') {
      d.setDate(1);
    } else if (period === 'trimestre') {
      const quarter = Math.floor(d.getMonth() / 3);
      d.setMonth(quarter * 3, 1);
    } else if (period === 'semestre') {
      const semester = Math.floor(d.getMonth() / 6);
      d.setMonth(semester * 6, 1);
    } else if (period === 'ano') {
      d.setMonth(0, 1);
    }
    return d;
  };

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
    
    const periodStartDate: Date = (() => {
      if (selectedPeriod === 'custom') return new Date(customStartDate);
      if (selectedPeriod === 'mês') {
        const [y, m] = selectedMonth.split('-').map(Number);
        return new Date(y, m - 1, 1, 0, 0, 0, 0);
      }
      return getStartDate(selectedPeriod);
    })();

    const periodEndDate: Date = (() => {
      if (selectedPeriod === 'custom') {
        const d = new Date(customEndDate); d.setHours(23,59,59,999); return d;
      }
      if (selectedPeriod === 'mês') {
        const [y, m] = selectedMonth.split('-').map(Number);
        const d = new Date(y, m, 0, 23, 59, 59, 999); // último dia do mês
        return d;
      }
      const d = new Date(); d.setHours(23,59,59,999); return d;
    })();
    
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

    
    // Status Invictos (Baseado em VGV PAGO do mês atual - Regra Financeiro)
    const totalVgvPaid = contracts
      .filter(c => {
        const d = new Date(c.sale_date || c.start_date);
        return d >= periodStartDate && d <= periodEndDate && c.is_paid;
      })
      .reduce((acc, c) => acc + (Number(c.monthly_fee) || 0), 0);

    const stoneStatus = getTier(totalVgvPaid);
    const nextTier = TIERS[TIERS.indexOf(TIERS.find(t => t.name === stoneStatus.name)!) + 1] || null;
    const progressToNext = nextTier ? Math.min((totalVgvPaid / nextTier.minVgv) * 100, 100) : 100;
    
    // Novas estatísticas baseadas nos leads e negócios ativos
    const totalLeads = leads.length;
    
    // Contratos Ativos e Vidas Ativas
    const activeContracts = contracts.filter(c => 
      c.status && 
      c.status.toLowerCase().trim() === 'ativo' && 
      c.client_name // Garante que não é um registro vazio ou de teste sem nome
    );

    const totalActiveContracts = activeContracts.length;
    
    // Calcula vidas ativas estritamente dos contratos que passaram no filtro acima
    const vidasAtivas = activeContracts.reduce((acc, c) => acc + (Number(c.lives) || 0), 0);
    
    // Valores específicos solicitados pelo usuário
    const negociaçõesTotais = leads
      .filter(l => !['Ganhos', 'Perdidos', 'Arquivado'].includes(l.status || ''))
      .reduce((acc, l) => acc + (Number(l.deal_value) || 0), 0);

    const propostasEnviadas = leads
      .filter(l => {
        if (l.status !== 'Cotação Enviada') return false;
        const d = new Date(l.updated_at || l.created_at);
        return d >= periodStartDate && d <= periodEndDate;
      })
      .reduce((acc, l) => acc + (Number(l.deal_value) || 0), 0);

    const propostasNaOperadora = leads
      .filter(l => {
        if (l.status !== 'Proposta Operadora') return false;
        const d = new Date(l.updated_at || l.created_at);
        return d >= periodStartDate && d <= periodEndDate;
      })
      .reduce((acc, l) => acc + (Number(l.deal_value) || 0), 0);

    const contratoLiberado = leads
      .filter(l => {
        if (l.status !== 'Contrato') return false;
        const d = new Date(l.updated_at || l.created_at);
        return d >= periodStartDate && d <= periodEndDate;
      })
      .reduce((acc, l) => acc + (Number(l.deal_value) || 0), 0);

    const implantaçãoAtiva = leads
      .filter(l => {
        if (l.status !== 'Plano Ativo') return false;
        const d = new Date(l.updated_at || l.created_at);
        return d >= periodStartDate && d <= periodEndDate;
      })
      .reduce((acc, l) => acc + (Number(l.deal_value) || 0), 0);

    // Meta Mensal: soma das mensalidades dos contratos PAGOS no período (sale_date)
    const metaMensal = 15000;
    const atingidoMeta = contracts
      .filter(c => {
        const dateRef = c.sale_date || c.start_date;
        if (!dateRef) return false;
        const [y, m, d] = dateRef.split('-').map(Number);
        const dt = new Date(y, m - 1, d);
        return dt >= periodStartDate && dt <= periodEndDate;
      })
      .reduce((acc, c) => acc + (Number(c.monthly_fee) || 0), 0);
    
    const progressMeta = Math.min((atingidoMeta / metaMensal) * 100, 100);

    setStats({ 
      totalLeads: leads.length, 
      totalActiveContracts: activeContracts.length,
      vidasAtivas,
      negociaçõesTotais,
      propostasEnviadas,
      propostasNaOperadora,
      contratoLiberado,
      implantaçãoAtiva,
      atingidoMeta,
      metaMensal,
      progressMeta,
      comissaoLiquidaTotal: totalVgvPaid,
      stoneStatus,
      nextTier,
      progressToNext,
      // raw lead sets for drilldown
      _leads_negociacao: leads.filter(l => !['Ganhos', 'Perdidos', 'Arquivado'].includes(l.status || '')),
      _leads_cotacoes: leads.filter(l => { const d = new Date(l.updated_at || l.created_at); return l.status === 'Cotação Enviada' && d >= periodStartDate && d <= periodEndDate; }),
      _leads_operadora: leads.filter(l => { const d = new Date(l.updated_at || l.created_at); return l.status === 'Proposta Operadora' && d >= periodStartDate && d <= periodEndDate; }),
      _leads_contrato: leads.filter(l => { const d = new Date(l.updated_at || l.created_at); return l.status === 'Contrato' && d >= periodStartDate && d <= periodEndDate; }),
      _leads_implantacao: leads.filter(l => { const d = new Date(l.updated_at || l.created_at); return l.status === 'Plano Ativo' && d >= periodStartDate && d <= periodEndDate; }),
      _leads_meta: leads.filter(l => { const d = new Date(l.updated_at || l.created_at); return ['Contrato', 'Plano Ativo'].includes(l.status || '') && d >= periodStartDate && d <= periodEndDate; }),
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

    const checkEvent = (dateStr: string, name: any, type: string, parentName?: any) => {
      if (!dateStr) return;
      const d = new Date(dateStr);
      
      const safeName = String(name || '');
      const safeParent = parentName ? String(parentName) : undefined;

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
        upcoming.push({ name: safeName, type, date: d, diff, parentName: safeParent });
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
        upcoming.push({ name: String(rem.title || ''), type: "Lembrete", date: d, diff, parentName: String(rem.leads?.name || '') });
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
  }, [leads, stages, selectedPeriod, customStartDate, customEndDate, selectedMonth]);

  const MetricCard = ({ label, value, color, icon: Icon, delay, onClick }: any) => (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      onClick={onClick}
      className={cn("bg-white p-3 md:p-4 rounded-xl border border-slate-100 shadow-sm relative overflow-hidden group", onClick && "cursor-pointer hover:shadow-md hover:border-blue-200 transition-all")}
    >
      <div className="relative z-10">
        <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
          <div className={cn("w-6 h-6 md:w-7 md:h-7 rounded-lg flex items-center justify-center", 
            color === 'blue' ? "bg-blue-50 text-blue-600" :
            color === 'emerald' ? "bg-emerald-50 text-emerald-600" :
            color === 'amber' ? "bg-amber-50 text-amber-600" :
            color === 'sky' ? "bg-sky-50 text-sky-600" : "bg-indigo-50 text-indigo-600"
          )}>
            <Icon className="w-3.5 h-3.5 md:w-4 md:h-4" />
          </div>
          <span className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest truncate">{label}</span>
          {onClick && <Icons.ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-blue-400 ml-auto transition-colors" />}
        </div>
        <h3 className="text-xs md:text-base font-black text-slate-900 truncate">{formatCurrency(value)}</h3>
      </div>
      <div className={cn("absolute -right-4 -bottom-4 w-12 h-12 rounded-full blur-xl opacity-20",
        color === 'blue' ? "bg-blue-400" :
        color === 'emerald' ? "bg-emerald-400" :
        color === 'amber' ? "bg-amber-400" :
        color === 'sky' ? "bg-sky-400" : "bg-indigo-400"
      )} />
    </motion.div>
  );

  // ---- Drilldown Modal ----
  const DrilldownModal = () => {
    if (!drilldown) return null;
    const fmt = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={() => setDrilldown(null)}>
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100">
            <div>
              <h2 className="text-xl font-black text-slate-900">{drilldown.title}</h2>
              <p className="text-xs text-slate-400 font-bold mt-0.5">{drilldown.leads.length} registro{drilldown.leads.length !== 1 ? 's' : ''}</p>
            </div>
            <button onClick={() => setDrilldown(null)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-all">
              <Icons.X className="w-5 h-5" />
            </button>
          </div>
          {/* Table */}
          <div className="overflow-y-auto custom-scrollbar flex-1">
            {drilldown.leads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Icons.Inbox className="w-10 h-10 mb-3 opacity-30" />
                <p className="font-bold text-sm">Nenhum lead encontrado neste período</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-6 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Nome</th>
                    <th className="px-4 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Status no Funil</th>
                    <th className="px-4 py-3 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">Valor</th>
                    <th className="px-4 py-3 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">Últ. Contato</th>
                    <th className="px-4 py-3 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">Cadastro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {drilldown.leads.map((lead: any) => (
                    <tr key={lead.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-black shrink-0">
                            {(lead.name || 'NN').substring(0,2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800">{lead.name || '—'}</p>
                            <p className="text-[10px] text-slate-400">{lead.carrier || lead.contact_type || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block text-[9px] font-black uppercase px-2 py-1 rounded-full bg-blue-50 text-blue-700">
                          {lead.status || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-black text-slate-900">{formatCurrency(Number(lead.deal_value) || 0)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs font-bold text-slate-500">{fmt(lead.updated_at)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs font-bold text-slate-400">{fmt(lead.created_at)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {/* Footer total */}
          {drilldown.leads.length > 0 && (
            <div className="px-8 py-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Total</span>
              <span className="text-lg font-black text-blue-600">
                {formatCurrency(drilldown.leads.reduce((acc: number, l: any) => acc + (Number(l.deal_value) || 0), 0))}
              </span>
            </div>
          )}
        </motion.div>
      </div>
    );
  };

  if (!stats) return <div className="p-8 flex items-center justify-center min-h-[400px]">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <span className="text-slate-400 font-bold uppercase tracking-widest text-xs">Carregando Dashboard...</span>
    </div>
  </div>;

  return (
    <>
      {drilldown && <DrilldownModal />}
      <div className="h-full overflow-y-auto overflow-x-hidden custom-scrollbar p-4 md:p-6 space-y-6 md:space-y-8">
      {/* Period Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/50 p-3 rounded-2xl border border-slate-100/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
            <Icons.Calendar className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">Período do Relatório</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Selecione o intervalo</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 bg-slate-100/50 p-1 rounded-xl border border-slate-200/50">
          {(['mês', 'trimestre', 'semestre', 'ano', 'custom'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setSelectedPeriod(p)}
              className={cn(
                "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-200",
                selectedPeriod === p 
                  ? "bg-white text-blue-600 shadow-sm border border-slate-200" 
                  : "text-slate-400 hover:text-slate-600 hover:bg-white/50"
              )}
            >
              {p === 'custom' ? 'Personalizado' : p}
            </button>
          ))}
          
          {selectedPeriod === 'custom' && (
            <div className="flex items-center gap-2 ml-2 px-2 border-l border-slate-200">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-black text-slate-400 uppercase">De:</span>
                <input 
                  type="date" 
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-white border border-slate-200 rounded px-2 py-1 text-[10px] font-bold text-slate-700 outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-black text-slate-400 uppercase">Até:</span>
                <input 
                  type="date" 
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-white border border-slate-200 rounded px-2 py-1 text-[10px] font-bold text-slate-700 outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
            </div>
          )}
          {selectedPeriod === 'mês' && (
            <div className="flex items-center gap-2 ml-2 px-3 border-l border-slate-200">
              <Icons.Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="month"
                value={selectedMonth}
                max={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`}
                onChange={e => setSelectedMonth(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-700 outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer"
              />
            </div>
          )}
        </div>
      </div>

      {/* Summary Metrics - Fixed One Row Layout */}
      {/* Summary Metrics - Fixed One Row Layout */}
      <section className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3 xl:gap-4">
        {/* Row 1/2 Toggle */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-4 md:p-5 rounded-xl border border-slate-100 shadow-sm col-span-2 md:col-span-1 lg:col-span-1 xl:col-span-2 relative overflow-hidden group"
        >
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Meta de Vendas</span>
              <Icons.Target className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <h3 className="text-xl font-black text-slate-900">{formatCurrency(stats.atingidoMeta)}</h3>
              <p className="text-[9px] font-black text-slate-400 uppercase">/ {formatCurrency(stats.metaMensal)}</p>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-[8px] font-black text-slate-400 uppercase mb-1.5 tracking-tighter">
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
          onClick={() => setDrilldown({ title: 'Em Negociação', leads: stats._leads_negociacao })}
        />
        
        <MetricCard 
          label="Cotações Enviadas" 
          value={stats.propostasEnviadas} 
          color="sky" 
          icon={Icons.MessageSquare} 
          delay={0.2}
          onClick={() => setDrilldown({ title: 'Cotações Enviadas', leads: stats._leads_cotacoes })}
        />

        <MetricCard 
          label="Na Operadora" 
          value={stats.propostasNaOperadora} 
          color="amber" 
          icon={Icons.History} 
          delay={0.3}
          onClick={() => setDrilldown({ title: 'Na Operadora', leads: stats._leads_operadora })}
        />

        <MetricCard 
          label="Contrato Liberado" 
          value={stats.contratoLiberado} 
          color="emerald" 
          icon={Icons.CheckCircle} 
          delay={0.4}
          onClick={() => setDrilldown({ title: 'Contrato Liberado', leads: stats._leads_contrato })}
        />

        <MetricCard 
          label="Implantação Ativa" 
          value={stats.implantaçãoAtiva} 
          color="indigo" 
          icon={Icons.Rocket} 
          delay={0.5}
          onClick={() => setDrilldown({ title: 'Implantação Ativa', leads: stats._leads_implantacao })}
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
          {/* NEW: Today's Birthdays Highlight */}
          {upcomingEvents.filter(e => (e.type === "Aniversário" || e.type === "Aniv. Dependente") && e.diff === 0).length > 0 && (
            <motion.section 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-pink-600 p-4 md:p-6 rounded-2xl text-white shadow-xl shadow-pink-100 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">
                  🎂
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight">Aniversariantes de Hoje!</h3>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {upcomingEvents
                      .filter(e => (e.type === "Aniversário" || e.type === "Aniv. Dependente") && e.diff === 0)
                      .map((e, idx) => (
                        <span key={idx} className="bg-white/10 px-2 py-0.5 rounded text-xs font-bold border border-white/20">
                          {e.name}
                        </span>
                      ))}
                  </div>
                </div>
              </div>
              <Icons.Plus className="w-6 h-6 rotate-45 opacity-50" />
            </motion.section>
          )}

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
              
              <div className="bg-blue-50 px-4 py-1.5 rounded-xl border border-blue-100 flex flex-col items-end">
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Total em Andamento</span>
                <span className="text-lg font-black text-blue-900 leading-tight">
                  {funnelData.reduce((acc, item) => acc + item.value, 0)}
                </span>
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
                  className="p-3 md:p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between group hover:border-blue-200 transition-all cursor-default overflow-hidden"
                >
                  <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
                    <div className={cn(
                      "w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-sm md:text-lg font-black shadow-sm shrink-0",
                      event.type === 'Aniversário' ? "bg-blue-100 text-blue-600" :
                      event.type === 'Aniv. Dependente' ? "bg-pink-100 text-pink-600" :
                      event.type === 'Aniv. Casamento' ? "bg-rose-100 text-rose-600" : 
                      event.type === 'Lembrete' ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"
                    )}>
                      {event.date.getDate()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs md:text-sm font-black text-slate-900 truncate leading-tight">{event.name}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] md:text-[10px] font-black uppercase text-slate-400">{event.type}</span>
                        {event.parentName && (
                          <span className="text-[8px] font-medium text-slate-400 truncate opacity-70">({event.parentName})</span>
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
                    <span className="text-xs font-black text-slate-600 truncate max-w-[120px]">{String(item.name)}</span>
                  </div>
                  <span className="text-[10px] font-black text-slate-400">{Number(item.percentage)}%</span>
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
                    {String(prop.initials)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{String(prop.client)}</p>
                    <p className="text-[10px] text-slate-400 uppercase font-black">{String(prop.carrier)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-blue-400">{String(formatCurrency(Number(prop.value)).split(',')[0])}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
    </>
  );
}
