import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icons } from "../components/Icons";
import { supabase } from "../lib/supabase";
import { cn } from "../lib/utils";
import { useLeads } from "../lib/leadsContext";
import { useDrawer } from "../lib/drawerContext";
import ProviderDetailDrawer from "../components/ProviderDetailDrawer";

interface Provider {
  id: string;
  name: string;
  type: 'Hospital' | 'Clínica' | 'Laboratório';
  uf: string;
  city: string;
  neighborhood: string;
  address: string;
  coverage: any[];
}

export default function NetworkSearch() {
  const { carriers, products } = useLeads();
  const { setExternalDrawerOpen } = useDrawer();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // Sincroniza estado do drawer local com o global para esconder a TopBar
  useEffect(() => {
    setExternalDrawerOpen(isDrawerOpen);
    return () => setExternalDrawerOpen(false);
  }, [isDrawerOpen, setExternalDrawerOpen]);
  const [filters, setFilters] = useState({
    uf: "",
    city: "",
    type: ""
  });

  const [availableCities, setAvailableCities] = useState<string[]>([]);

  const fetchProviders = async () => {
    setLoading(true);
    let query = supabase
      .from('medical_providers')
      .select(`
        *,
        coverage:network_coverage(
          id,
          carrier_id,
          product_id,
          coverage_details,
          carrier:carriers(name),
          product:products(name)
        )
      `)
      .order('name');

    if (filters.uf) query = query.eq('uf', filters.uf);
    if (filters.type) query = query.eq('type', filters.type);

    const { data, error } = await query;

    if (error) {
      console.error("Erro ao buscar rede médica:", error);
      return;
    }

    if (data) {
      setProviders(data as any);
      
      // Update available cities based on current results (filtered by UF/Type but NOT by search/city)
      const cities = Array.from(new Set(data.map((p: any) => p.city))).filter(Boolean) as string[];
      setAvailableCities(cities.sort());
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProviders();
  }, [filters]);

  const filteredProviders = providers.filter(p => {
    const matchesSearch = !searchTerm || 
      (p.name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.city?.toLowerCase().includes(searchTerm.toLowerCase()));
      
    const matchesCity = !filters.city || p.city === filters.city;
    
    return matchesSearch && matchesCity;
  });

  const getTypeStyle = (type: string) => {
    switch (type) {
      case 'Hospital': return { bg: 'bg-red-50', text: 'text-red-600', dot: 'bg-red-500', icon: Icons.Building2 };
      case 'Clínica': return { bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-500', icon: Icons.Users };
      case 'Laboratório': return { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500', icon: Icons.FileSearch };
      default: return { bg: 'bg-slate-50', text: 'text-slate-600', dot: 'bg-slate-500', icon: Icons.MapPin };
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 relative overflow-hidden">
      {/* Header com Filtros */}
      <header className="bg-white border-b border-slate-200 px-8 py-6 shadow-sm z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 max-w-7xl mx-auto w-full">
          <div>
            <h1 className="text-2xl font-black text-blue-900 italic tracking-tight flex items-center gap-3">
              <Icons.MapPin className="w-6 h-6 text-blue-600" />
              Mapeamento de Rede
            </h1>
            <p className="text-sm text-slate-500 font-medium mt-1">Consulte hospitais e planos por região</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative group">
              <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input 
                type="text"
                placeholder="Buscar por nome ou cidade..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold w-full md:w-64 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all"
              />
            </div>

            <select 
              value={filters.uf}
              onChange={e => setFilters({...filters, uf: e.target.value, city: ""})}
              className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-blue-500 transition-all"
            >
              <option value="">UF (Todos)</option>
              <option value="RJ">RJ</option>
              <option value="SP">SP</option>
              <option value="MG">MG</option>
              <option value="ES">ES</option>
              {/* Adicionar outros conforme necessário */}
            </select>

            <select 
              value={filters.city}
              onChange={e => setFilters({...filters, city: e.target.value})}
              className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-blue-500 transition-all disabled:opacity-50"
              disabled={!filters.uf}
            >
              <option value="">Cidade (Todas)</option>
              {availableCities.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>

            <select 
              value={filters.type}
              onChange={e => setFilters({...filters, type: e.target.value})}
              className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-blue-500 transition-all"
            >
              <option value="">Tipo (Todos)</option>
              <option value="Hospital">Hospital</option>
              <option value="Clínica">Clínica</option>
              <option value="Laboratório">Laboratório</option>
            </select>
          </div>
        </div>
      </header>

      {/* Grid de Estabelecimentos */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="py-20 flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest animate-pulse">Consultando Rede...</p>
            </div>
          ) : filteredProviders.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProviders.map((provider) => {
                const style = getTypeStyle(provider.type);
                return (
                  <motion.div
                    layout
                    key={provider.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={() => {
                      setSelectedProvider(provider);
                      setIsDrawerOpen(true);
                    }}
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-blue-300 transition-all overflow-hidden group flex flex-col cursor-pointer"
                  >
                    {/* Header do Card */}
                    <div className="p-3.5 border-b border-slate-100 bg-slate-50/30 group-hover:bg-white transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div className={cn("p-2 rounded-xl shadow-sm", style.bg, style.text)}>
                          <style.icon className="w-5 h-5" />
                        </div>
                        <span className={cn(
                          "text-[9px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-full border",
                          style.text, style.bg, "border-current opacity-70"
                        )}>
                          {provider.type}
                        </span>
                      </div>
                      
                      <h3 className="text-lg font-black text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">
                        {provider.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1 text-slate-400">
                        <Icons.MapPin className="w-3 h-3" />
                        <p className="text-[10px] font-bold uppercase tracking-wider truncate">{provider.neighborhood ? `${provider.neighborhood}, ` : ""}{provider.city}</p>
                      </div>
                    </div>

                    {/* Lista de Cobertura */}
                    {(() => {
                      const uniqueCarriers = (provider.coverage || []).reduce((acc: any[], current: any) => {
                        if (!acc.find(item => item.carrier?.id === current.carrier?.id)) {
                          acc.push(current);
                        }
                        return acc;
                      }, []);
                      const carrierCount = uniqueCarriers.length;

                      return (
                        <div className="p-3.5 space-y-2 flex-1">
                          <div className="flex items-center justify-between pointer-events-none">
                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Operadoras Aceitas</span>
                            <span className="text-[9px] font-black text-blue-600 px-2 py-0.5 bg-blue-50 rounded-full">{carrierCount} {carrierCount === 1 ? 'Opção' : 'Opções'}</span>
                          </div>

                          <div className="space-y-1">
                            {uniqueCarriers.length > 0 ? (
                              uniqueCarriers.slice(0, 3).map((cov: any) => (
                                <div key={cov.carrier?.id} className="p-2 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between group/item hover:bg-white hover:border-blue-100 transition-all pointer-events-none">
                                  <div className="truncate pr-2">
                                    <p className="text-[11px] font-black text-blue-900 uppercase tracking-tight truncate">{cov.carrier?.name}</p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-0 truncate">Multi-produtos disponíveis</p>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="py-2 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                                 <p className="text-[9px] font-bold text-slate-400 uppercase">Nenhuma operadora mapeada</p>
                              </div>
                            )}
                            {carrierCount > 3 && (
                              <div className="text-center pt-1 animate-pulse">
                                <span className="text-[9px] font-black text-blue-400 uppercase italic">+{carrierCount - 3} outras operadoras </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Footer - Agora apenas indicativo */}
                    <div className="px-3.5 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                       <div className="flex -space-x-1">
                          {Array.from(new Set((provider.coverage || []).map((c:any) => c.carrier?.name))).slice(0, 3).map((n:any) => (
                            <div key={n} className="w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[7px] font-black text-blue-600 shadow-sm uppercase overflow-hidden" title={n}>
                              {n.substring(0,2)}
                            </div>
                          ))}
                       </div>
                       <span className="text-[9px] font-black text-blue-600 uppercase tracking-[0.1em] flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                         Clique para Ver <Icons.ChevronRight className="w-2.5 h-2.5" />
                       </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="py-32 text-center space-y-6">
              <div className="w-24 h-24 bg-slate-100 rounded-[2rem] flex items-center justify-center mx-auto text-slate-300 shadow-inner">
                <Icons.MapPin className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 leading-tight">Nenhum estabelecimento encontrado</h3>
                <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">Tente ajustar seus filtros ou buscar por outro termo de pesquisa.</p>
              </div>
              <button 
                onClick={() => {setSearchTerm(""); setFilters({uf: "", city: "", type: ""})}}
                className="px-8 py-3 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all"
              >
                Limpar Filtros
              </button>
            </div>
          )}
        </div>
      </div>

      <ProviderDetailDrawer 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
        provider={selectedProvider} 
      />
    </div>
  );
}
