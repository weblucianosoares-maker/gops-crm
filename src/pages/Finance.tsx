// v1.0.5 - Financeiro com proteção total de tipos
import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Icons } from "../components/Icons";
import { formatCurrency, cn } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { calculateNetCommission, getTier } from "../lib/commissionRules";
import { useToast } from "../components/Toasts";

const safe = (v: any) => (v && typeof v === 'object') ? '' : v;

export default function Finance() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

  const [isRefreshing, setIsRefreshing] = useState(false);
  const { success, error: toastError } = useToast();

  const fetchData = async () => {
    setIsRefreshing(true);
    const { data, error } = await supabase
      .from('contracts')
      .select('*')
      .order('start_date', { ascending: false });
    
    if (!error) {
      setContracts(data || []);
    } else {
      console.error("Erro ao buscar contratos:", error);
    }
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

    // 3. FLUXO DE CAIXA: Encontrar todas as parcelas que caem neste mês
    // Percorremos TODOS os contratos para ver quais parcelas vencem agora
    const upcomingCommissions: any[] = [];
    let totalNetFlow = 0;

    contracts.forEach(c => {
      try {
        const calc = calculateNetCommission(
          String(c.carrier || ''), 
          Number(c.monthly_fee) || 0, 
          stone.name,
          c.type as any,
          Number(c.lives || 1)
        );

        // Verifica cada parcela do contrato
        calc.installments.forEach((inst: any) => {
          const startDate = new Date(c.start_date);
          const paymentDate = new Date(startDate.getFullYear(), startDate.getMonth() + inst.relativeMonth, 1);

          if (paymentDate.getMonth() === currentMonth && paymentDate.getFullYear() === currentYear) {
            totalNetFlow += inst.netAmount;
            upcomingCommissions.push({
              ...c,
              installment: inst,
              fullCommission: calc
            });
          }
        });
      } catch (e) {
        console.error("Erro no cálculo de fluxo:", e);
      }
    });

    return {
      totalVgv,
      totalNet: totalNetFlow,
      stone: {
        label: String(stone.label || 'Sem Grade'),
        color: String(stone.color || 'slate'),
        name: stone.name
      },
      commissions: upcomingCommissions,
      count: monthSales.length
    };
  }, [contracts, filterMonth, filterYear]);

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">VGV Produzido (Mês Atual)</p>
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-slate-900">{formatCurrency(currentMonthData.totalVgv)}</h3>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
               <Icons.TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-2 font-bold">{currentMonthData.count} novos contratos</p>
        </div>

        <div className="bg-blue-600 p-6 rounded-2xl shadow-xl shadow-blue-100 text-white">
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-200 mb-2">Comissões a Receber (Líquido)</p>
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black">{formatCurrency(currentMonthData.totalNet)}</h3>
            <div className="p-2 bg-blue-500 text-white rounded-lg">
               <Icons.CreditCard className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[10px] text-blue-100 mt-2 font-bold">Baseado na Grade {safe(currentMonthData.stone.label)}</p>
        </div>

        <div className={cn("p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between", `bg-${currentMonthData.stone.color}-50`)}>
           <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Status da Grade</p>
              <h3 className={cn("text-lg font-black uppercase tracking-tighter", `text-${currentMonthData.stone.color}-600`)}>{safe(currentMonthData.stone.label)}</h3>
           </div>
           <div className="flex items-center gap-2 mt-4">
              <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                 <div className={cn("h-full transition-all duration-1000", `bg-${currentMonthData.stone.color}-500`)} style={{ width: '70%' }}></div>
              </div>
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Meta Rubi</span>
           </div>
        </div>
      </div>

      {/* Commissions Table */}
      <section className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
          <div>
            <h3 className="text-md font-black text-slate-900 uppercase tracking-tight">Entradas de Comissões</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Previsão por Contrato Implantado</p>
          </div>
          <div className="flex gap-2">
             <button className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:text-blue-600 transition-colors">
                <Icons.Search className="w-4 h-4" />
             </button>
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
                      Vigência: {c.start_date.split('-').reverse().join('/')} • {c.installment.description}
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
                      {c.fullCommission.bonus > 0 && (
                        <span className="text-[9px] font-bold text-emerald-600">+{formatCurrency(c.fullCommission.bonus)} Bônus</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                       <div className="flex-1 min-w-[120px]">
                          <p className={cn("text-sm font-black", c.installment.isDirect ? "text-blue-600" : "text-slate-900")}>
                            {formatCurrency(c.installment.netAmount)}
                          </p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">
                            {c.installment.isDirect ? "Recebimento Direto" : "Via Operadora/United"}
                          </p>
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => togglePaymentStatus(c.id, c.is_paid)}
                      className={cn(
                        "flex flex-col items-center gap-1 group transition-all",
                        c.is_paid ? "text-emerald-600" : "text-amber-600"
                      )}
                    >
                       <span className={cn(
                         "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all",
                         c.is_paid 
                          ? "bg-emerald-50 border-emerald-200 group-hover:bg-emerald-100" 
                          : "bg-amber-50 border-amber-200 group-hover:bg-amber-100"
                       )}>
                         {c.is_paid ? "Recebido" : "Pendente"}
                       </span>
                       {!c.is_paid && c.carrier.toLowerCase().includes('united') && (
                         <span className="text-[8px] font-bold text-blue-500 uppercase tracking-tighter">Antecipação Disp.</span>
                       )}
                       {c.is_paid && (
                         <span className="text-[8px] font-bold text-emerald-500 uppercase tracking-tighter">Caiu na Conta</span>
                       )}
                    </button>
                  </td>
                </tr>
              ))}
              {currentMonthData.commissions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest italic">Nenhuma venda registrada este mês</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
