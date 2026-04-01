import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Icons } from "../components/Icons";
import { formatCurrency, cn } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { useAlerts } from "../hooks/useAlerts";

export default function Contracts() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<any[]>([]);
  const [financials, setFinancials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { alerts } = useAlerts();

  const contractAlerts = alerts.filter(a => a.type === 'contract');

  useEffect(() => {
    fetchContractsData();
  }, []);

  const fetchContractsData = async () => {
    const [cRes, bRes, fRes] = await Promise.all([
      supabase.from('contracts').select('*').order('created_at', { ascending: false }),
      supabase.from('beneficiaries').select('*'),
      supabase.from('financial_history').select('*').order('created_at', { ascending: false })
    ]);
    
    setContracts(cRes.data || []);
    setBeneficiaries(bRes.data || []);
    setFinancials(fRes.data || []);
    setLoading(false);
  };

  if (loading) return <div className="p-8">Carregando...</div>;
  return (
    <div className="p-8 space-y-8">
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
                  <p className={cn("text-xs font-bold", alert.severity === 'urgent' ? "text-red-500" : "text-blue-500")}>Anniversary</p>
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

        {/* Commission Summary */}
        <div className="lg:col-span-4 bg-blue-700 text-white p-6 rounded-xl flex flex-col justify-between overflow-hidden relative shadow-xl shadow-blue-200">
          <div className="relative z-10">
            <p className="text-[0.6875rem] uppercase tracking-widest text-blue-200 mb-2">Comissões Acumuladas</p>
            <h3 className="text-4xl font-extrabold tracking-tight">R$ 14.280,<span className="text-xl">50</span></h3>
          </div>
          <div className="mt-8 relative z-10">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs">Meta Mensal</span>
              <span className="text-xs font-bold">85%</span>
            </div>
            <div className="w-full h-1.5 bg-blue-800 rounded-full overflow-hidden">
              <div className="bg-green-400 h-full w-[85%]"></div>
            </div>
          </div>
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-blue-600 rounded-full blur-3xl opacity-50"></div>
        </div>
      </div>

      {/* Contracts Table */}
      <section className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-100">
        <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-blue-900">Contratos Ativos</h3>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Icons.Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input 
                className="pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-100 w-64" 
                placeholder="Buscar cliente..." 
              />
            </div>
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
              <Icons.Plus className="w-4 h-4" /> Novo Contrato
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-[0.6875rem] uppercase tracking-widest font-bold text-slate-400">Cliente</th>
                <th className="px-6 py-4 text-[0.6875rem] uppercase tracking-widest font-bold text-slate-400">Operadora</th>
                <th className="px-6 py-4 text-[0.6875rem] uppercase tracking-widest font-bold text-slate-400 text-center">Vidas</th>
                <th className="px-6 py-4 text-[0.6875rem] uppercase tracking-widest font-bold text-slate-400">Vigência</th>
                <th className="px-6 py-4 text-[0.6875rem] uppercase tracking-widest font-bold text-slate-400">Status</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contracts.map(contract => (
                <tr key={contract.id} className="bg-blue-50/30 hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-slate-900">{contract.client_name}</p>
                    <p className="text-xs text-slate-400">CNPJ: {contract.cnpj || 'Não cadastrado'}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-700">
                        {(contract.carrier || 'U').substring(0,2).toUpperCase()}
                      </div>
                      <span className="text-sm text-slate-700">{contract.carrier}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center font-bold text-slate-700">{contract.lives}</td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-slate-700">{new Date(contract.start_date).toLocaleDateString('pt-BR') || contract.start_date}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] font-bold uppercase">{contract.status}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-blue-600 hover:bg-blue-100 p-2 rounded-full transition-colors">
                      <Icons.Info className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-8">
          <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
            <h3 className="text-md font-bold text-blue-900 mb-6">Histórico Financeiro & Reajustes</h3>
            <div className="bg-white rounded-lg overflow-hidden border border-slate-100">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 font-bold text-slate-500">Referência</th>
                    <th className="px-4 py-3 font-bold text-right text-slate-500">Mensalidade</th>
                    <th className="px-4 py-3 font-bold text-center text-slate-500">Reajuste</th>
                    <th className="px-4 py-3 font-bold text-slate-500">Sinistralidade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {financials.map(fin => (
                    <tr key={fin.id}>
                      <td className="px-4 py-3 text-slate-700">{fin.reference_month}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(fin.monthly_fee)}</td>
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-md font-bold text-blue-900">Beneficiários (Vidas)</h3>
              <p className="text-xs text-slate-400">Contrato: Indústria Alvorada S.A.</p>
            </div>
            <span className="text-[0.6875rem] font-bold px-2 py-1 bg-slate-100 text-slate-600 rounded">142 Total</span>
          </div>
          <div className="space-y-4 overflow-y-auto max-h-[300px] pr-2">
            {beneficiaries.map((beneficiary) => (
              <div key={beneficiary.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">{beneficiary.initials}</div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 leading-none mb-1">{beneficiary.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-slate-400 uppercase font-black">{beneficiary.type}</span>
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
            ))}
          </div>
          <button className="mt-6 w-full py-3 border border-dashed border-slate-300 rounded-lg text-xs font-bold text-slate-400 hover:bg-slate-50 transition-colors">
            + Adicionar Vidas ao Contrato
          </button>
        </div>
      </div>
    </div>
  );
}
