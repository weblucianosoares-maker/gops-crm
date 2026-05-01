import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Icons } from "../components/Icons";
import { formatCurrency, cn } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { calculateNetCommission, getTier } from "../lib/commissionRules";

export default function Finance() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data, error } = await supabase
      .from('contracts')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error) setContracts(data || []);
    setLoading(false);
  };

  const currentMonthData = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // VGV do mês passado para determinar a Pedra (conforme regra do Contracts.tsx)
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const vgvLastMonth = contracts
      .filter(c => {
        const d = new Date(c.start_date);
        return d.getMonth() === lastMonthDate.getMonth() && d.getFullYear() === lastMonthDate.getFullYear();
      })
      .reduce((acc, c) => acc + (Number(c.monthly_fee) || 0), 0);
    
    const stone = getTier(vgvLastMonth);

    const monthContracts = contracts.filter(c => {
      const d = new Date(c.start_date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const totalVgv = monthContracts.reduce((acc, c) => acc + (Number(c.monthly_fee) || 0), 0);
    
    const commissions = monthContracts.map(c => {
      const calc = calculateNetCommission(c.carrier || '', Number(c.monthly_fee) || 0, stone.name);
      return {
        ...c,
        commission: calc
      };
    });

    const totalNet = commissions.reduce((acc, c) => acc + c.commission.net, 0);

    return {
      totalVgv,
      totalNet,
      stone,
      commissions,
      count: monthContracts.length
    };
  }, [contracts]);

  if (loading) return <div className="p-8">Carregando...</div>;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-8 space-y-8">
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
          <p className="text-[10px] text-blue-100 mt-2 font-bold">Baseado na Grade {currentMonthData.stone.label}</p>
        </div>

        <div className={cn("p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between", `bg-${currentMonthData.stone.color}-50`)}>
           <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Status da Grade</p>
              <h3 className={cn("text-lg font-black uppercase tracking-tighter", `text-${currentMonthData.stone.color}-600`)}>{currentMonthData.stone.label}</h3>
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
                <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-slate-900">{c.client_name}</p>
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">Ref: {new Date(c.start_date).toLocaleDateString('pt-BR')}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                       <span className="text-xs font-bold text-slate-700">{c.carrier}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-700 text-sm">{formatCurrency(c.monthly_fee)}</td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">{c.commission.percentage}%</span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-black text-slate-900">{formatCurrency(c.commission.net)}</p>
                    <p className="text-[9px] text-slate-400 uppercase font-bold">Impostos: {formatCurrency(c.commission.taxAmount)}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center">
                       <span className="px-2 py-1 bg-amber-50 text-amber-600 rounded text-[9px] font-black uppercase tracking-widest border border-amber-100">Aguardando</span>
                    </div>
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
