// v1.0.5 - Financeiro com proteção total de tipos
import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Icons } from "../components/Icons";
import { formatCurrency, cn } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { calculateNetCommission, getTier, TIERS } from "../lib/commissionRules";
import { useToast } from "../components/Toasts";

const safe = (v: any) => (v && typeof v === 'object') ? '' : v;

export default function Finance() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

  const [isRefreshing, setIsRefreshing] = useState(false);
  const { success, error: toastError } = useToast();

  const fetchData = async () => {
    setIsRefreshing(true);
    const [cRes, lRes] = await Promise.all([
      supabase.from('contracts').select('*').order('start_date', { ascending: false }),
      supabase.from('leads').select('*')
        .eq('is_proposal_approved', true)
        .in('status', ['Boleto Pago', 'Contrato', 'Plano Ativo', 'Vendido'])
    ]);
    
    if (!cRes.error) setContracts(cRes.data || []);
    if (!lRes.error) setLeads(lRes.data || []);

    setLoading(false);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const togglePaymentStatus = async (contractId: string, currentStatus: boolean) => {
    // 1. Tenta atualizar no Supabase (caso a coluna is_paid exista)
    const { error } = await supabase
      .from('contracts')
      .update({ is_paid: !currentStatus })
      .eq('id', contractId);

    // 2. Independente do erro (caso a coluna não exista ainda), atualiza localmente
    setContracts(prev => prev.map(c => 
      c.id === contractId ? { ...c, is_paid: !currentStatus } : c
    ));

    // 3. Persistência de backup em localStorage
    const paidList = JSON.parse(localStorage.getItem('efraim_paid_contracts') || '{}');
    paidList[contractId] = !currentStatus;
    localStorage.setItem('efraim_paid_contracts', JSON.stringify(paidList));

    if (!error) success("Status de pagamento atualizado!");
  };

  // Carregar status do localStorage ao montar (backup)
  useEffect(() => {
    if (contracts.length > 0) {
      const paidList = JSON.parse(localStorage.getItem('efraim_paid_contracts') || '{}');
      setContracts(prev => prev.map(c => ({
        ...c,
        is_paid: !!(paidList[c.id] !== undefined ? paidList[c.id] : (c.is_paid || false))
      })));
    }
  }, [loading]);

  const currentMonthData = useMemo(() => {
    const currentMonth = filterMonth;
    const currentYear = filterYear;

    // 1. Calcular VGV do mês passado para determinar a Pedra (Baseado em DATA DA VENDA)
    const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const vgvLastMonth = contracts
      .filter(c => {
        const d = new Date(c.sale_date || c.start_date);
        return d.getMonth() === lastMonthDate.getMonth() && d.getFullYear() === lastMonthDate.getFullYear();
      })
      .reduce((acc, c) => acc + (Number(c.monthly_fee) || 0), 0);
    
    const stone = getTier(vgvLastMonth);

    // 2. VGV do Mês Selecionado (Baseado em DATA DA VENDA)
    const monthSales = contracts.filter(c => {
      const d = new Date(c.sale_date || c.start_date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const totalVgv = monthSales.reduce((acc, c) => acc + (Number(c.monthly_fee) || 0), 0);

    // 2b. VGV PAGO do Mês (Para cálculo da Pedra Atual)
    const totalVgvPaid = monthSales
      .filter(c => c.is_paid)
      .reduce((acc, c) => acc + (Number(c.monthly_fee) || 0), 0);

    // Determinar a Pedra ATUAL baseada nas vendas PAGAS do próprio mês
    const currentStone = getTier(totalVgvPaid);
    const stoneIndex = TIERS.findIndex(t => t.name === currentStone.name);
    const nextStone = TIERS[stoneIndex + 1] || null;

    // Cálculo de ticket médio
    const pfSales = monthSales.filter(c => c.type === 'PF');
    const pmeSales = monthSales.filter(c => c.type === 'PJ');

    const avgTicketTotal = monthSales.length > 0 ? totalVgv / monthSales.length : 0;
    const avgTicketPf = pfSales.length > 0 ? pfSales.reduce((acc, c) => acc + (Number(c.monthly_fee) || 0), 0) / pfSales.length : 0;
    const avgTicketPme = pmeSales.length > 0 ? pmeSales.reduce((acc, c) => acc + (Number(c.monthly_fee) || 0), 0) / pmeSales.length : 0;

    // 3. FLUXO DE CAIXA: Encontrar todas as parcelas que caem neste mês (Contratos + Leads Pagos)
    const upcomingCommissions: any[] = [];
    let totalNetFlow = 0;

    // Filtrar leads que já possuem contrato real vinculado para evitar duplicidade
    const leadsFiltered = leads.filter(l => !contracts.some(c => c.lead_id === l.id));

    const allConfirmed = [
      ...contracts.map(c => ({ ...c, source: 'contract' })),
      ...leadsFiltered.filter(l => l.is_first_invoice_paid).map(l => ({ 
        ...l, 
        source: 'lead',
        client_name: l.name,
        monthly_fee: l.deal_value,
        lives: l.interested_lives,
        type: l.lead_type,
        start_date: l.contract_start_date || l.first_invoice_date,
        is_paid: l.is_first_invoice_paid
      }))
    ];

    allConfirmed.forEach(c => {
      try {
        const calc = calculateNetCommission(
          String(c.carrier || ''), 
          Number(c.monthly_fee) || 0, 
          stone.name,
          c.type as any,
          Number(c.lives || 1),
          c.modality || 'PME',
          c.is_anticipated || false
        );

        calc.installments.forEach((inst: any) => {
          let paymentDate: Date;
          
          if (inst.index === 1 && c.is_paid && c.commission_received_date) {
            const [y, m, d] = c.commission_received_date.split('-').map(Number);
            paymentDate = new Date(y, m - 1, d);
          } else {
            const startDate = new Date(c.start_date);
            paymentDate = new Date(startDate.getFullYear(), startDate.getMonth() + inst.relativeMonth, 1);
          }

          if (paymentDate.getMonth() === currentMonth && paymentDate.getFullYear() === currentYear) {
            totalNetFlow += inst.netAmount;
            upcomingCommissions.push({
              ...c,
              installment: inst,
              fullCommission: calc,
              display_date: paymentDate.toLocaleDateString('pt-BR')
            });
          }
        });
      } catch (e) {
        console.error("Erro no cálculo de fluxo:", e);
      }
    });

    // 4. PREVISÕES FUTURAS (Leads aprovados mas ainda não pagos)
    const futureForecasts: any[] = [];
    let totalForecastValue = 0;

    leadsFiltered.filter(l => !l.is_first_invoice_paid).forEach(l => {
      if (l.contract_start_date || l.first_invoice_date) {
        try {
          const calc = calculateNetCommission(
            String(l.carrier || ''), 
            Number(l.deal_value) || 0, 
            stone.name,
            l.lead_type as any,
            Number(l.interested_lives || 1),
            l.modality || 'PME',
            l.is_anticipated || false
          );

          const firstInst = calc.installments[0];
          totalForecastValue += firstInst.netAmount;
          
          futureForecasts.push({
            id: l.id,
            client_name: l.name,
            carrier: l.carrier,
            product: l.product,
            monthly_fee: l.deal_value,
            lives: l.interested_lives,
            start_date: l.contract_start_date || l.first_invoice_date,
            forecast_date: l.first_invoice_date || l.contract_start_date,
            net_amount: firstInst.netAmount,
            fullCommission: calc
          });
        } catch (e) {
          console.error("Erro no cálculo de previsão:", e);
        }
      }
    });

    return {
      totalVgv,
      totalVgvPaid,
      totalNet: totalNetFlow,
      count: monthSales.length,
      commissions: upcomingCommissions,
      forecasts: futureForecasts,
      totalForecastValue,
      stats: {
        avgTicketTotal,
        avgTicketPf,
        avgTicketPme
      },
      stone: {
        current: currentStone,
        next: nextStone,
        vgvPaid: totalVgvPaid
      }
    };
  }, [contracts, leads, filterMonth, filterYear]);

  if (loading) return <div className="p-8">Carregando...</div>;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-8 space-y-8">
      {/* Header with Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Fluxo de Comissões</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Acompanhamento de repasses e bônus por produção</p>
        </div>
        
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
          <button 
            onClick={fetchData}
            disabled={isRefreshing}
            className={cn(
              "p-2 text-slate-400 hover:text-blue-600 transition-all",
              isRefreshing ? "animate-spin text-blue-600" : ""
            )}
          >
            <Icons.RefreshCw className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-slate-200"></div>
          <select 
            value={filterMonth} 
            onChange={e => setFilterMonth(Number(e.target.value))}
            className="bg-transparent border-none text-sm font-bold text-slate-700 outline-none px-3 py-1 cursor-pointer"
          >
            {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map((m, i) => (
              <option key={m} value={i}>{m}</option>
            ))}
          </select>
          <div className="w-px h-4 bg-slate-200"></div>
          <select 
            value={filterYear} 
            onChange={e => setFilterYear(Number(e.target.value))}
            className="bg-transparent border-none text-sm font-bold text-slate-700 outline-none px-3 py-1 cursor-pointer"
          >
            {[2024, 2025, 2026].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Finance Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Produção Total (VGV)</p>
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-slate-900">{formatCurrency(currentMonthData.totalVgv)}</h3>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
               <Icons.TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="flex justify-between items-center mt-2">
            <p className="text-[10px] text-slate-500 font-bold">{currentMonthData.count} contratos</p>
            <p className="text-[10px] text-blue-600 font-black uppercase tracking-tight">T.M. {formatCurrency(currentMonthData.stats.avgTicketTotal)}</p>
          </div>
        </div>

        <div className="bg-blue-600 p-6 rounded-2xl shadow-xl shadow-blue-100 text-white">
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-200 mb-2">Recebimento (Fluxo de Caixa)</p>
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black">{formatCurrency(currentMonthData.totalNet)}</h3>
            <div className="p-2 bg-blue-500 text-white rounded-lg">
               <Icons.CreditCard className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[10px] text-blue-100 mt-2 font-bold italic">Baseado em parcelas que caem este mês</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Ticket Médio por Tipo</p>
          <div className="space-y-3 mt-1">
            <div className="flex justify-between items-center">
               <span className="text-[10px] font-black text-slate-400 uppercase">PME</span>
               <span className="text-sm font-bold text-slate-700">{formatCurrency(currentMonthData.stats.avgTicketPme)}</span>
            </div>
            <div className="flex justify-between items-center">
               <span className="text-[10px] font-black text-slate-400 uppercase">PF / ADESÃO</span>
               <span className="text-sm font-bold text-slate-700">{formatCurrency(currentMonthData.stats.avgTicketPf)}</span>
            </div>
          </div>
        </div>

        <div className={cn("p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between", `bg-${currentMonthData.stone.current.color}-50`)}>
           <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Status da Grade Atual</p>
              <h3 className={cn("text-lg font-black uppercase tracking-tighter", `text-${currentMonthData.stone.current.color}-600`)}>
                {currentMonthData.stone.current.label}
              </h3>
           </div>
           
           <div className="mt-4 space-y-2">
              <div className="flex justify-between items-end">
                 <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">
                    {currentMonthData.stone.next 
                      ? `Faltam ${formatCurrency(currentMonthData.stone.next.minVgv - currentMonthData.stone.vgvPaid)} para ${currentMonthData.stone.next.label}`
                      : "Nível Máximo Alcançado!"
                    }
                 </p>
                 <span className="text-[10px] font-black text-slate-700">
                    {formatCurrency(currentMonthData.totalVgvPaid)}
                 </span>
              </div>
              <div className="h-2 bg-white/50 border border-black/5 rounded-full overflow-hidden">
                 <motion.div 
                    initial={{ width: 0 }}
                    animate={{ 
                      width: currentMonthData.stone.next 
                        ? `${Math.min(100, (currentMonthData.stone.vgvPaid / currentMonthData.stone.next.minVgv) * 100)}%`
                        : "100%" 
                    }}
                    className={cn("h-full", `bg-${currentMonthData.stone.current.color}-500`)}
                 />
              </div>
           </div>
        </div>
      </div>

      {/* Commissions Table */}
      <section className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
          <div>
            <h3 className="text-md font-black text-slate-900 uppercase tracking-tight">Entradas de Comissões</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Recebimentos Confirmados</p>
          </div>
          <div className="flex gap-2">
             <button className="px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg">Exportar Relatório</button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Contrato / Cliente</th>
                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Operadora</th>
                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">VGV (Bruto)</th>
                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Grade (%)</th>
                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Comissão Líquida</th>
                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Status Pagto.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentMonthData.commissions.map((c, idx) => (
                <tr key={`${c.id}-${c.installment.index}`} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-slate-900">{safe(c.client_name)}</p>
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">
                      {c.display_date ? `Recebido em: ${c.display_date}` : `Previsão: ${c.start_date?.split('-').reverse().join('/')}`} • {c.installment.description}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs font-bold text-slate-700">{safe(c.carrier)}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{safe(c.product || 'Plano de Saúde')}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-slate-700">{formatCurrency(Number(c.monthly_fee) || 0)}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{Number(c.lives || 1)} Vidas</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 w-fit">{Math.round(c.fullCommission.percentage)}% Total</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                       <div className="flex-1 min-w-[120px]">
                          <p className="text-sm font-black text-slate-900">
                            {formatCurrency(c.installment.netAmount)}
                          </p>
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                      c.is_paid ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-amber-50 border-amber-200 text-amber-600"
                    )}>
                      {c.is_paid ? "Recebido" : "Pendente"}
                    </span>
                  </td>
                </tr>
              ))}
              {currentMonthData.commissions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest italic">Nenhuma entrada confirmada este mês</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Forecasts Table */}
      <section className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
          <div>
            <h3 className="text-md font-black text-slate-900 uppercase tracking-tight">Previsões de Recebimentos</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Baseado em contratos com vigência/boleto lançados</p>
          </div>
          <div className="flex items-center gap-3">
             <div className="text-right">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Previsto</p>
                <p className="text-sm font-black text-blue-600">{formatCurrency(currentMonthData.totalForecastValue)}</p>
             </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Contrato / Cliente</th>
                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Operadora</th>
                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">VGV (Bruto)</th>
                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Grade (%)</th>
                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Comissão Líquida</th>
                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Prev. Pagamento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentMonthData.forecasts.map((f, idx) => (
                <tr key={f.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-slate-900">{f.client_name}</p>
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">Vigência: {f.start_date?.split('-').reverse().join('/')}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs font-bold text-slate-700">{f.carrier}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{f.product}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-slate-700">{formatCurrency(Number(f.monthly_fee) || 0)}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{f.lives} Vidas</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 w-fit">{Math.round(f.fullCommission.percentage)}%</span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-black text-slate-900">{formatCurrency(f.net_amount)}</p>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-[9px] font-black uppercase tracking-widest">
                      {f.forecast_date?.split('-').reverse().join('/')}
                    </span>
                  </td>
                </tr>
              ))}
              {currentMonthData.forecasts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest italic">Nenhuma previsão para os próximos meses</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
