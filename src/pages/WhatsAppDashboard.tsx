import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Icons } from '../components/Icons';
import { formatCurrency, formatPhone } from '../lib/utils';
import { useToast } from '../components/Toasts';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

export default function WhatsAppDashboard() {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const { error: toastError } = useToast();

  const PRICE_PER_MESSAGE = 0.0625;

  const fetchMessages = async () => {
    setLoading(true);
    
    // Calcula o primeiro e último dia do mês selecionado
    const startDate = new Date(filterYear, filterMonth, 1).toISOString();
    const endDate = new Date(filterYear, filterMonth + 1, 0, 23, 59, 59, 999).toISOString();

    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar mensagens:', error);
      toastError('Não foi possível carregar os dados do WhatsApp.');
    } else {
      setMessages(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMessages();
  }, [filterMonth, filterYear]);

  const metrics = useMemo(() => {
    let sent = 0;
    let received = 0;

    messages.forEach(m => {
      if (m.is_from_me) sent++;
      else received++;
    });

    const cost = sent * PRICE_PER_MESSAGE;

    return { sent, received, cost };
  }, [messages]);

  const chartData = useMemo(() => {
    const daysInMonth = new Date(filterYear, filterMonth + 1, 0).getDate();
    const data: Record<string, { day: string; Enviadas: number; Recebidas: number }> = {};

    for (let i = 1; i <= daysInMonth; i++) {
      const dayStr = i.toString().padStart(2, '0');
      data[dayStr] = { day: dayStr, Enviadas: 0, Recebidas: 0 };
    }

    messages.forEach(m => {
      const d = new Date(m.created_at);
      const dayStr = d.getDate().toString().padStart(2, '0');
      if (data[dayStr]) {
        if (m.is_from_me) data[dayStr].Enviadas++;
        else data[dayStr].Recebidas++;
      }
    });

    return Object.values(data);
  }, [messages, filterMonth, filterYear]);

  // Lista dos últimos meses para o filtro
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear];

  return (
    <div className="flex-1 h-full overflow-y-auto bg-slate-50/50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header e Filtros */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Icons.MessageSquare className="w-6 h-6 text-[#25D366]" />
              Controle WhatsApp
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Monitore o uso da API Oficial e controle seus custos.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(Number(e.target.value))}
              className="bg-transparent border-none text-sm font-medium text-slate-700 focus:ring-0 cursor-pointer pl-3 pr-8 py-2"
            >
              {months.map((m, i) => (
                <option key={i} value={i}>{m}</option>
              ))}
            </select>
            <div className="w-px h-6 bg-slate-200"></div>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(Number(e.target.value))}
              className="bg-transparent border-none text-sm font-medium text-slate-700 focus:ring-0 cursor-pointer pl-3 pr-8 py-2"
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Cards de Métricas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 relative overflow-hidden">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-50 rounded-full opacity-50 blur-2xl"></div>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Mensagens Enviadas</p>
                <h3 className="text-3xl font-bold text-slate-800">
                  {loading ? '...' : metrics.sent}
                </h3>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                <Icons.ArrowUpRight className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs text-slate-500">
              Custo: R$ {PRICE_PER_MESSAGE.toFixed(4).replace('.', ',')} por envio
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 relative overflow-hidden">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-green-50 rounded-full opacity-50 blur-2xl"></div>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Mensagens Recebidas</p>
                <h3 className="text-3xl font-bold text-slate-800">
                  {loading ? '...' : metrics.received}
                </h3>
              </div>
              <div className="p-3 bg-green-50 text-[#25D366] rounded-lg">
                <Icons.ArrowDownLeft className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs text-green-600 font-medium">
              Recebimento Gratuito
            </div>
          </div>

          <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-5 relative overflow-hidden ring-1 ring-blue-500/10">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-100 rounded-full opacity-50 blur-2xl"></div>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Custo Total (Estimado)</p>
                <h3 className="text-3xl font-bold text-blue-600">
                  {loading ? '...' : formatCurrency(metrics.cost)}
                </h3>
              </div>
              <div className="p-3 bg-blue-500 text-white rounded-lg shadow-sm shadow-blue-200">
                <Icons.DollarSign className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs text-slate-500">
              Valor referente ao mês atual
            </div>
          </div>
        </div>

        {/* Gráfico */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-base font-semibold text-slate-800 mb-6">Volume Diário de Mensagens</h3>
          <div className="h-[300px] w-full">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center">
                <Icons.Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis 
                    dataKey="day" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#64748B' }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#64748B' }}
                  />
                  <Tooltip 
                    cursor={{ fill: '#F8FAFC' }}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                  <Bar dataKey="Enviadas" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="Recebidas" fill="#25D366" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Tabela de Logs */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-200">
            <h3 className="text-base font-semibold text-slate-800">Logs Recentes</h3>
            <p className="text-sm text-slate-500">Últimas mensagens trafegadas no período selecionado.</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-medium">Data/Hora</th>
                  <th className="px-6 py-4 font-medium">Direção</th>
                  <th className="px-6 py-4 font-medium">Contato</th>
                  <th className="px-6 py-4 font-medium">Tipo</th>
                  <th className="px-6 py-4 font-medium w-[40%]">Conteúdo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                      <Icons.Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Carregando logs...
                    </td>
                  </tr>
                ) : messages.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      Nenhuma mensagem encontrada neste mês.
                    </td>
                  </tr>
                ) : (
                  messages.slice(0, 50).map((msg) => (
                    <tr key={msg.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-3 whitespace-nowrap text-slate-600">
                        {new Intl.DateTimeFormat('pt-BR', {
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                        }).format(new Date(msg.created_at))}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        {msg.is_from_me ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium">
                            <Icons.ArrowUpRight className="w-3.5 h-3.5" />
                            Enviada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-50 text-green-700 text-xs font-medium">
                            <Icons.ArrowDownLeft className="w-3.5 h-3.5" />
                            Recebida
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-slate-700 font-medium">
                        {formatPhone(msg.sender_number)}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-slate-500 capitalize">
                        {msg.media_type || 'Texto'}
                      </td>
                      <td className="px-6 py-3">
                        <div className="truncate max-w-md text-slate-600" title={msg.message_body}>
                          {msg.message_body || <span className="italic text-slate-400">Sem texto</span>}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {!loading && messages.length > 50 && (
              <div className="p-4 text-center border-t border-slate-100">
                <span className="text-xs text-slate-400">Mostrando os últimos 50 registros de {messages.length}.</span>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
