import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icons } from "../components/Icons";
import { formatCurrency, cn } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { useAlerts } from "../hooks/useAlerts";
import { getTier, calculateNetCommission } from "../lib/commissionRules";
import { ContractCreateDrawer } from "../components/ContractCreateDrawer";

export default function Contracts() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [pendingLeads, setPendingLeads] = useState<any[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<any[]>([]);
  const [financials, setFinancials] = useState<any[]>([]);
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [contractToEdit, setContractToEdit] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState<'mês' | 'trimestre' | 'semestre' | 'ano' | 'custom'>('ano');
  // Datas temporárias (enquanto o usuário edita no modo personalizado)
  const [pendingStart, setPendingStart] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [pendingEnd, setPendingEnd] = useState(new Date().toISOString().split('T')[0]);
  // Datas aplicadas (só atualizam ao clicar OK)
  const [customStart, setCustomStart] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [customEnd, setCustomEnd] = useState(new Date().toISOString().split('T')[0]);
  const { alerts } = useAlerts();
 
  const contractAlerts = alerts.filter(a => a.type === 'contract' || a.type === 'expiry');

  // Gamificação: Calcular a Pedra (Gema) baseada no mês passado
  const stoneData = useMemo(() => {
    const now = new Date();
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthM = lastMonthDate.getMonth();
    const lastMonthY = lastMonthDate.getFullYear();

    const vgv = contracts
      .filter(c => {
        const d = new Date(c.start_date);
        return d.getMonth() === lastMonthM && d.getFullYear() === lastMonthY;
      })
      .reduce((acc, c) => acc + (Number(c.monthly_fee) || 0), 0);
    
    return getTier(vgv);
  }, [contracts]);

  // Parse de data seguro contra fuso horário (evita UTC shift)
  const parseLocalDate = (dateStr: string) => {
    if (!dateStr) return new Date(0);
    // "2026-05-02" → new Date(2026, 4, 2) — local, sem desvio UTC
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  // Data de início e fim do período selecionado (memoized com deps corretas)
  const periodDates = useMemo(() => {
    const now = new Date();

    if (selectedPeriod === 'custom') {
      const s = parseLocalDate(customStart);
      s.setHours(0, 0, 0, 0);
      const e = parseLocalDate(customEnd);
      e.setHours(23, 59, 59, 999);
      return { start: s, end: e };
    }

    // Período pré-definido: calcular início E fim corretos do período
    const y = now.getFullYear();
    const m = now.getMonth(); // 0-indexed

    let start: Date;
    let end: Date;

    if (selectedPeriod === 'mês') {
      start = new Date(y, m, 1, 0, 0, 0, 0);
      end = new Date(y, m + 1, 0, 23, 59, 59, 999); // último dia do mês
    } else if (selectedPeriod === 'trimestre') {
      const q = Math.floor(m / 3);
      start = new Date(y, q * 3, 1, 0, 0, 0, 0);
      end = new Date(y, q * 3 + 3, 0, 23, 59, 59, 999);
    } else if (selectedPeriod === 'semestre') {
      const h = Math.floor(m / 6);
      start = new Date(y, h * 6, 1, 0, 0, 0, 0);
      end = new Date(y, h * 6 + 6, 0, 23, 59, 59, 999);
    } else { // ano
      start = new Date(y, 0, 1, 0, 0, 0, 0);
      end = new Date(y, 11, 31, 23, 59, 59, 999);
    }

    return { start, end };
  }, [selectedPeriod, customStart, customEnd]);

  // Valor de contratos fechados no período
  const totalFechados = useMemo(() => {
    const { start, end } = periodDates;
    return contracts
      .filter(c => {
        const d = parseLocalDate(c.sale_date || c.start_date);
        return d >= start && d <= end;
      })
      .reduce((acc, c) => acc + (Number(c.monthly_fee) || 0), 0);
  }, [contracts, periodDates]);

  // Contratos filtrados por período + busca (para a tabela)
  const filteredContracts = useMemo(() => {
    const { start, end } = periodDates;
    
    // Preparar leads pendentes como objetos compatíveis com a tabela de contratos
    const pendingAsContracts = pendingLeads.map(l => ({
      id: l.id,
      client_name: l.name,
      carrier: l.carrier,
      product: l.product,
      lives: l.interested_lives,
      start_date: l.contract_start_date || l.created_at?.substring(0, 10),
      monthly_fee: l.deal_value,
      type: l.lead_type,
      modality: l.modality,
      status: 'Aguardando Pagamento',
      is_pending_lead: true,
      first_invoice_date: l.first_invoice_date,
      is_first_invoice_paid: l.is_first_invoice_paid,
      is_paid: l.is_first_invoice_paid,
      is_contract_active: l.is_contract_active,
      is_anticipated: l.is_anticipated,
      sale_date: l.first_invoice_date || l.created_at?.substring(0, 10)
    }));

    const allItems = [...contracts, ...pendingAsContracts];

    return allItems.filter(c => {
      const d = parseLocalDate(c.sale_date || c.start_date);
      const matchesPeriod = d >= start && d <= end;
      const matchesSearch = !searchTerm ||
        c.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.carrier?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesPeriod && matchesSearch;
    });
  }, [contracts, pendingLeads, periodDates, searchTerm]);

  const totalCommissions = useMemo(() => {
    const { start, end } = periodDates;
    return contracts
      .filter(c => {
        const d = parseLocalDate(c.sale_date || c.start_date);
        return d >= start && d <= end;
      })
      .reduce((acc, c) => {
        const calculation = calculateNetCommission(c.carrier || '', Number(c.monthly_fee) || 0, stoneData.name, c.type || 'PF', c.lives || 1, c.modality || 'PME');
        return acc + calculation.net;
      }, 0);
  }, [contracts, stoneData, periodDates]);

  const activeBeneficiaries = useMemo(() => {
    if (!selectedContract) return [];
    return beneficiaries.filter(b => b.contract_id === selectedContract.id);
  }, [beneficiaries, selectedContract]);

  useEffect(() => {
    fetchContractsData();
  }, []);

  const fetchContractsData = async () => {
    const [cRes, bRes, fRes, lRes] = await Promise.all([
      supabase.from('contracts').select('*').order('created_at', { ascending: false }),
      supabase.from('beneficiaries').select('*'),
      supabase.from('financial_history').select('*').order('created_at', { ascending: false }),
      supabase.from('leads').select('*').eq('is_proposal_approved', true)
    ]);
    
    setContracts(cRes.data || []);
    setPendingLeads(lRes.data || []);
    setBeneficiaries(bRes.data || []);
    setFinancials(fRes.data || []);
    if (cRes.data && cRes.data.length > 0 && !selectedContract) setSelectedContract(cRes.data[0]);
    setLoading(false);
  };

  if (loading) return <div className="p-8">Carregando...</div>;
  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-8 space-y-6">
      {/* Page Header + Period Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/60 p-4 rounded-2xl border border-slate-100 backdrop-blur-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Gestão de Contratos</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{filteredContracts.length} contratos no período</p>
        </div>
        {/* Period Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {(['mês', 'trimestre', 'semestre', 'ano', 'custom'] as const).map(p => (
              <button
                key={p}
                onClick={() => setSelectedPeriod(p)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                  selectedPeriod === p
                    ? "bg-white text-blue-600 shadow-sm border border-slate-200"
                    : "text-slate-400 hover:text-slate-600"
                )}
              >
                {p === 'custom' ? 'Personalizado' : p}
              </button>
            ))}
          </div>
          {selectedPeriod === 'custom' && (
            <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl">
              <span className="text-[9px] font-black text-slate-400 uppercase pl-1">De:</span>
              <input
                type="date"
                value={pendingStart}
                onChange={e => setPendingStart(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-bold text-slate-700 outline-none focus:ring-1 focus:ring-blue-400"
              />
              <span className="text-[9px] font-black text-slate-400 uppercase">Até:</span>
              <input
                type="date"
                value={pendingEnd}
                onChange={e => setPendingEnd(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-bold text-slate-700 outline-none focus:ring-1 focus:ring-blue-400"
              />
              <button
                onClick={() => { setCustomStart(pendingStart); setCustomEnd(pendingEnd); }}
                className="bg-blue-600 text-white px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-sm"
              >
                OK
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bento Stats Grid & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Upcoming Renewals (Real Data) */}
        <div className="lg:col-span-8 bg-slate-50 p-6 rounded-xl flex flex-col border border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Icons.TrendingUp className="w-5 h-5 text-blue-600" />
              Alertas de Vigência & Renovação
            </h3>
            <span className="text-[0.6875rem] font-bold uppercase tracking-widest text-blue-600 bg-blue-100 px-3 py-1 rounded-full">{contractAlerts.length} Monitorados</span>
          </div>
          <div className="space-y-3 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
            {contractAlerts.length > 0 ? contractAlerts.map(alert => (
              <div key={alert.id} className={cn(
                "flex items-center bg-white p-4 rounded-lg shadow-sm border-l-4",
                alert.severity === 'urgent' ? "border-red-500" : alert.severity === 'warning' ? "border-amber-500" : "border-blue-500"
              )}>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-900">{alert.title}</p>
                  <p className="text-xs text-slate-500">{alert.description}</p>
                </div>
                <div className="text-right">
                  <p className={cn("text-xs font-bold", alert.severity === 'urgent' ? "text-red-500" : "text-blue-500")}>Anticipation</p>
                  <p className="text-[0.6875rem] text-slate-400 uppercase">{new Date(alert.date).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
            )) : (
              <div className="py-8 text-center bg-white rounded-lg border border-dashed border-slate-200">
                <p className="text-xs text-slate-400 font-bold uppercase">Nenhuma renovação iminente</p>
              </div>
            )}
          </div>
        </div>

        {/* Valor de Contratos Fechados */}
        <div className="lg:col-span-4 bg-blue-700 text-white p-6 rounded-xl flex flex-col justify-between overflow-hidden relative shadow-xl shadow-blue-200">
          <div className="relative z-10">
            <p className="text-[0.6875rem] uppercase tracking-widest text-blue-200 mb-2">Valor de Contratos Fechados</p>
            <h3 className="text-4xl font-extrabold tracking-tight">{formatCurrency(totalFechados)}</h3>
            <p className="text-blue-200 text-xs mt-2">{filteredContracts.length} contrato{filteredContracts.length !== 1 ? 's' : ''} no período</p>
            <p className="text-blue-300 text-[9px] font-black uppercase tracking-widest mt-1">
              {selectedPeriod === 'mês' ? `Mês Atual · ${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}` :
               selectedPeriod === 'trimestre' ? `${['T1','T2','T3','T4'][Math.floor(new Date().getMonth()/3)]} · ${new Date().getFullYear()}` :
               selectedPeriod === 'semestre' ? `${new Date().getMonth() < 6 ? '1º Semestre' : '2º Semestre'} · ${new Date().getFullYear()}` :
               selectedPeriod === 'ano' ? `Ano ${new Date().getFullYear()}` :
               `${customStart.split('-').reverse().join('/')} → ${customEnd.split('-').reverse().join('/')}`}
            </p>
          </div>
          <div className="mt-6 relative z-10">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs">Meta Mensal (R$ 20k)</span>
              <span className="text-xs font-bold">{Math.round((totalFechados / 20000) * 100)}%</span>
            </div>
            <div className="w-full h-1.5 bg-blue-800 rounded-full overflow-hidden">
              <div 
                className="bg-green-400 h-full transition-all duration-1000" 
                style={{ width: `${Math.min((totalFechados / 20000) * 100, 100)}%` }} 
              />
            </div>
          </div>
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-blue-600 rounded-full blur-3xl opacity-50"></div>
        </div>
      </div>

      {/* Table Section */}
      <section className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-100">
        <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-base font-black text-blue-900">Contratos Ativos</h3>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Icons.Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input 
                className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 w-56"
                placeholder="Buscar cliente..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <button 
              onClick={() => { setContractToEdit(null); setIsDrawerOpen(true); }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-md shadow-blue-100"
            >
              <Icons.Plus className="w-4 h-4" /> Novo Contrato
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-[0.6875rem] uppercase tracking-widest font-bold text-slate-400">Cliente</th>
                <th className="px-6 py-4 text-[0.6875rem] uppercase tracking-widest font-bold text-slate-400">Operadora / Produto</th>
                <th className="px-6 py-4 text-[0.6875rem] uppercase tracking-widest font-bold text-slate-400 text-center">Vidas</th>
                <th className="px-6 py-3 text-left text-[0.6875rem] font-bold text-slate-500 uppercase tracking-widest">Vigência</th>
                <th className="px-6 py-3 text-left text-[0.6875rem] font-bold text-slate-500 uppercase tracking-widest">Próx. Reajuste (12m)</th>
                <th className="px-6 py-3 text-left text-[0.6875rem] font-bold text-slate-500 uppercase tracking-widest">Valor Contrato</th>
                <th className="px-6 py-3 text-left text-[0.6875rem] font-bold text-slate-500 uppercase tracking-widest">Comissão (Líq.)</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredContracts.length > 0 ? filteredContracts.map(contract => (
                <tr 
                  key={contract.id} 
                  onClick={() => {
                    setSelectedContract(contract);
                    setContractToEdit(contract);
                    setIsDrawerOpen(true);
                  }}
                  className={cn(
                    "cursor-pointer transition-colors border-l-4",
                    selectedContract?.id === contract.id ? "bg-blue-50/50" : "hover:bg-slate-50",
                    contract.is_pending_lead ? (contract.first_invoice_date ? "border-emerald-400" : "border-red-500") : "border-transparent",
                    contract.is_pending_lead && !contract.first_invoice_date && "text-red-600"
                  )}
                >
                  <td className="px-6 py-4">
                    <p className={cn("text-sm font-bold", contract.is_pending_lead && !contract.first_invoice_date ? "text-red-600" : "text-slate-900")}>{contract.client_name}</p>
                    <p className="text-xs text-slate-400">{contract.type || 'PF'} • Docs: {contract.cnpj || '---'}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-700">
                          {(contract.carrier || 'U').substring(0,2).toUpperCase()}
                        </div>
                        <span className="text-sm font-bold text-slate-700">{contract.carrier}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 ml-8">{contract.product || 'Plano de Saúde'}</span>
                        <span className={cn(
                          "text-[8px] font-black uppercase px-1.5 py-0.5 rounded",
                          contract.modality === 'Adesão' ? "bg-amber-100 text-amber-700" : 
                          contract.modality === 'PME' ? "bg-blue-100 text-blue-700" :
                          contract.modality === 'Empresarial' ? "bg-purple-100 text-purple-700" :
                          "bg-slate-100 text-slate-600"
                        )}>
                          {contract.modality || 'PME'}
                        </span>
                        {contract.modality === 'Adesão' && contract.administrator && (
                          <span className="text-[8px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 italic">
                            via {contract.administrator}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center">
                      <span className="text-sm font-black text-blue-600 bg-blue-50 w-8 h-8 rounded-lg flex items-center justify-center border border-blue-100">
                        {contract.lives || 0}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase mt-1">Vidas</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-slate-700">
                      {contract.start_date.split('-').reverse().join('/')}
                    </p>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Implantado</p>
                  </td>
                  <td className="px-6 py-4">
                    {(() => {
                       const [year, month, day] = contract.start_date.split('-');
                       const d = new Date(Number(year) + 1, Number(month) - 1, Number(day));
                       const now = new Date();
                       const isNear = d.getTime() - now.getTime() < 1000 * 60 * 60 * 24 * 60; // 60 dias
                       return (
                         <div className="flex flex-col gap-1">
                           <span className={cn("text-sm font-bold", isNear ? "text-amber-600" : "text-slate-700")}>
                             {day}/{month}/{Number(year) + 1}
                           </span>
                           <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Aniversário de 1 ano</span>
                         </div>
                       );
                    })()}
                  </td>
                  {/* Valor do Contrato (mensalidade) */}
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-bold text-emerald-700">{formatCurrency(Number(contract.monthly_fee) || 0)}</p>
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Mensalidade</p>
                    </div>
                  </td>
                  {/* Comissão Líquida */}
                  <td className="px-6 py-4">
                    {(() => {
                      const calc = calculateNetCommission(
                        contract.carrier || '', 
                        Number(contract.monthly_fee) || 0, 
                        stoneData.name,
                        contract.type || 'PF',
                        contract.lives || 1,
                        contract.modality || 'PME'
                      );
                       return (
                         <div>
                           <p className="text-sm font-bold text-blue-900">{formatCurrency(calc.net)}</p>
                           <p className="text-[10px] text-slate-400">Total: {calc.percentage}%</p>
                         </div>
                       );
                    })()}
                  </td>
                  <td className="px-6 py-4">
                    {contract.is_pending_lead ? (
                      <span className={cn(
                        "px-2 py-1 rounded text-[10px] font-bold uppercase",
                        contract.is_first_invoice_paid ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                      )}>
                        {contract.is_first_invoice_paid ? 'Boleto Pago' : 'Aguardando pagamento'}
                      </span>
                    ) : (
                      <span className={cn(
                        "px-2 py-1 rounded text-[10px] font-bold uppercase",
                        contract.is_contract_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                      )}>
                        {contract.is_contract_active ? 'ATIVO' : contract.status || 'Implantado'}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setContractToEdit(contract);
                        setIsDrawerOpen(true);
                      }}
                      className={cn(
                        "p-2 rounded-full transition-colors",
                        selectedContract?.id === contract.id ? "text-blue-600 bg-blue-100" : "text-slate-300 hover:text-blue-600 hover:bg-blue-50"
                      )}
                    >
                      <Icons.Edit className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-slate-400 uppercase text-[10px] font-black tracking-widest italic">
                    {contracts.length === 0 ? 'Nenhum contrato cadastrado' : 'Nenhum contrato no período selecionado'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-8">
          <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
            <h3 className="text-md font-bold text-blue-900 mb-6 font-black uppercase tracking-widest text-[10px]">Histórico Financeiro & Reajustes</h3>
            <div className="bg-white rounded-lg overflow-hidden border border-slate-100 min-h-[300px]">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 font-bold text-slate-500 text-[10px] uppercase tracking-widest">Referência</th>
                    <th className="px-4 py-3 font-bold text-right text-slate-500 text-[10px] uppercase tracking-widest">Mensalidade</th>
                    <th className="px-4 py-3 font-bold text-center text-slate-500 text-[10px] uppercase tracking-widest">Reajuste</th>
                    <th className="px-4 py-3 font-bold text-slate-500 text-[10px] uppercase tracking-widest">Sinistralidade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {financials.length > 0 ? financials.map(fin => (
                    <tr key={fin.id}>
                      <td className="px-4 py-3 text-slate-700">{fin.reference_month}</td>
                      <td className="px-4 py-3 text-right text-slate-700 font-bold">{formatCurrency(fin.monthly_fee)}</td>
                      <td className="px-4 py-3 text-center text-red-500 font-bold">{fin.readjustment}%</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1 bg-slate-100 rounded-full">
                            <div className="bg-blue-600 h-full" style={{ width: `${fin.loss_ratio}%` }}></div>
                          </div>
                          <span className="text-[10px] text-slate-500">{fin.loss_ratio}%</span>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-20 text-center text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] italic">Selecione um contrato para ver o histórico</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-md font-bold text-blue-900 font-black uppercase tracking-widest text-[10px]">Beneficiários (Vidas)</h3>
              <p className="text-[11px] text-slate-500 font-bold">{selectedContract?.client_name || 'Selecione um contrato'}</p>
            </div>
            <span className="text-[0.6875rem] font-bold px-2 py-1 bg-blue-50 text-blue-600 rounded">{activeBeneficiaries.length} Total</span>
          </div>
          <div className="space-y-4 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar flex-1">
            {activeBeneficiaries.length > 0 ? activeBeneficiaries.map((beneficiary) => (
              <div key={beneficiary.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors group border border-transparent hover:border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-black text-[10px]">{beneficiary.initials}</div>
                  <div>
                    <p className="text-sm font-black text-slate-900 leading-none mb-1">{beneficiary.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-slate-400 uppercase font-black tracking-tighter">{beneficiary.type}</span>
                      {beneficiary.birth_date && (
                        <>
                          <span className="w-1 h-1 bg-slate-200 rounded-full" />
                          <span className="text-[9px] text-blue-600 font-black uppercase">Nasc: {new Date(beneficiary.birth_date).toLocaleDateString('pt-BR')}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <Icons.Info className="w-4 h-4 text-slate-300 group-hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-all" />
              </div>
            )) : (
              <div className="flex-1 flex flex-col items-center justify-center py-10 opacity-40">
                 <Icons.Users className="w-10 h-10 mb-3" />
                 <p className="text-[9px] font-black uppercase tracking-widest">Nenhuma vida cadastrada</p>
              </div>
            )}
          </div>
          <button className="mt-6 w-full py-3 border border-dashed border-slate-300 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-colors">
            + Adicionar Vidas ao Contrato
          </button>
        </div>
      </div>

      <ContractCreateDrawer 
        isOpen={isDrawerOpen} 
        onClose={() => {
          setIsDrawerOpen(false);
          setContractToEdit(null);
        }} 
        onSuccess={fetchContractsData} 
        editContract={contractToEdit}
      />
    </div>
  );
}
