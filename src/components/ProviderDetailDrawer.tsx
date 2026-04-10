import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icons } from "./Icons";
import { cn } from "../lib/utils";
import { useToast } from "./Toasts";
import { supabase } from "../lib/supabase";

interface ProviderDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  provider: any;
  onUpdate?: () => void;
}

const COVERAGE_LEGEND: Record<string, { label: string, color: string }> = {
  'HE': { label: 'Hospital Especializado', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  'H': { label: 'Internação Eletiva', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  'M': { label: 'Maternidade', color: 'bg-pink-100 text-pink-700 border-pink-200' },
  'PSA': { label: 'Pronto Socorro Adulto', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  'PSI': { label: 'Pronto Socorro Infantil', color: 'bg-teal-100 text-teal-700 border-teal-200' },
  '*NE': { label: 'Atendimento não Especificado', color: 'bg-slate-100 text-slate-500 border-slate-200' }
};

export default function ProviderDetailDrawer({ isOpen, onClose, provider, onUpdate }: ProviderDetailDrawerProps) {
  const { success, error: showError } = useToast();
  const [expandedCarriers, setExpandedCarriers] = React.useState<Record<string, boolean>>({});
  const [isEditing, setIsEditing] = React.useState(false);
  const [editProvider, setEditProvider] = React.useState<any>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (provider) {
      setEditProvider({ ...provider });
    }
    setIsEditing(false);
  }, [provider]);

  if (!provider) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('medical_providers')
        .update({
          name: editProvider.name,
          type: editProvider.type,
          uf: editProvider.uf,
          city: editProvider.city,
          neighborhood: editProvider.neighborhood,
          address: editProvider.address
        })
        .eq('id', provider.id);

      if (error) throw error;
      
      success("Estabelecimento atualizado com sucesso!");
      setIsEditing(false);
      if (onUpdate) onUpdate();
    } catch (e: any) {
      showError("Erro ao atualizar: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleCarrier = (carrier: string) => {
    setExpandedCarriers(prev => ({
      ...prev,
      [carrier]: !prev[carrier]
    }));
  };

  const renderBadge = (tag: string) => {
    const cleanTag = tag.trim().toUpperCase();
    const config = COVERAGE_LEGEND[cleanTag] || { label: cleanTag, color: 'bg-slate-50 text-slate-400 border-slate-100' };
    return (
      <span key={tag} className={cn(
        "text-[8px] font-black uppercase px-2 py-1 rounded-lg border flex items-center gap-1.5 whitespace-nowrap",
        config.color
      )}>
        <span className="opacity-50 font-black">{cleanTag}</span>
        <span className="w-1 h-1 rounded-full bg-current opacity-20" />
        {config.label}
      </span>
    );
  };

  // Group coverage by carrier
  const groupedCoverage = (provider.coverage || []).reduce((acc: any, cov: any) => {
    const carrierName = cov.carrier?.name || "Outros";
    if (!acc[carrierName]) acc[carrierName] = [];
    acc[carrierName].push(cov);
    return acc;
  }, {});

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60]"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl z-[70] flex flex-col"
          >
            {/* Header */}
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4 flex-1">
                <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-600/20 shrink-0">
                  <Icons.Hospital className="w-6 h-6" />
                </div>
                {!isEditing ? (
                  <div className="truncate">
                    <h2 className="text-xl font-black text-slate-900 leading-none truncate">{provider.name}</h2>
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mt-2 inline-block px-2 py-1 bg-blue-50 rounded-lg border border-blue-100 italic">
                      {provider.type}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 flex-1 pr-4">
                    <input 
                      type="text" 
                      value={editProvider.name} 
                      onChange={e => setEditProvider({...editProvider, name: e.target.value})}
                      className="w-full px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-sm font-black outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder="Nome do Estabelecimento"
                    />
                    <select 
                      value={editProvider.type} 
                      onChange={e => setEditProvider({...editProvider, type: e.target.value})}
                      className="text-[10px] font-black uppercase px-2 py-1 bg-white border border-blue-200 rounded-lg outline-none"
                    >
                      <option value="Hospital">Hospital</option>
                      <option value="Clínica">Clínica</option>
                      <option value="Laboratório">Laboratório</option>
                    </select>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-2 shrink-0">
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
                  >
                    <Icons.FileEdit className="w-3.5 h-3.5" />
                    Editar
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 text-slate-400 text-[10px] font-black uppercase hover:text-slate-600 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all disabled:opacity-50"
                    >
                      {isSaving ? <Icons.Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icons.Check className="w-3.5 h-3.5" />}
                      Salvar
                    </button>
                  </>
                )}
                <button
                  onClick={onClose}
                  className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-all text-slate-400 ml-2"
                >
                  <Icons.X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
              
              {/* Informações de Localização */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-4 bg-blue-600 rounded-full" />
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Informações de Localização</h3>
                </div>
                
                <div className="bg-slate-50 rounded-[2.5rem] p-8 border border-slate-100 shadow-inner">
                  {!isEditing ? (
                    <div className="flex items-start gap-6">
                      <div className="w-14 h-14 rounded-3xl bg-white flex items-center justify-center shadow-md text-blue-600 shrink-0 border border-slate-50">
                        <Icons.MapPin className="w-6 h-6" />
                      </div>
                      <div className="space-y-4">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Endereço Completo</p>
                          <p className="text-base font-black text-slate-900 leading-tight uppercase tracking-tight">
                            {provider.address || "Endereço não disponível"}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="px-3 py-1 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-600 uppercase">
                            {provider.neighborhood || "Bairro N/D"}
                          </span>
                          <span className="px-3 py-1 bg-blue-600 text-white border border-blue-400 rounded-xl text-[10px] font-black uppercase">
                            {provider.city} / {provider.uf}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="md:col-span-2 space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Logradouro / Número</label>
                        <input 
                          type="text" 
                          value={editProvider.address} 
                          onChange={e => setEditProvider({...editProvider, address: e.target.value})}
                          className="w-full px-5 py-4 bg-white border border-slate-200 rounded-[1.5rem] text-sm font-bold outline-none focus:border-blue-500 shadow-sm transition-all"
                          placeholder="Ex: Rua das Flores, 123"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Bairro</label>
                        <input 
                          type="text" 
                          value={editProvider.neighborhood} 
                          onChange={e => setEditProvider({...editProvider, neighborhood: e.target.value})}
                          className="w-full px-5 py-4 bg-white border border-slate-200 rounded-[1.5rem] text-sm font-bold outline-none focus:border-blue-500 shadow-sm transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cidade</label>
                        <input 
                          type="text" 
                          value={editProvider.city} 
                          onChange={e => setEditProvider({...editProvider, city: e.target.value})}
                          className="w-full px-5 py-4 bg-white border border-slate-200 rounded-[1.5rem] text-sm font-bold outline-none focus:border-blue-500 shadow-sm transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">UF</label>
                        <input 
                          type="text" 
                          maxLength={2}
                          value={editProvider.uf} 
                          onChange={e => setEditProvider({...editProvider, uf: e.target.value.toUpperCase()})}
                          className="w-full px-5 py-4 bg-white border border-slate-200 rounded-[1.5rem] text-sm font-bold outline-none focus:border-blue-500 shadow-sm transition-all uppercase"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Rede de Atendimento */}
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-emerald-500 rounded-full" />
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Rede de Atendimento</h3>
                  </div>
                  <span className="text-[10px] font-black text-blue-600 px-3 py-1.5 bg-blue-50 rounded-full border border-blue-100">
                    {provider.coverage?.length || 0} Planos Vinculados
                  </span>
                </div>

                <div className="space-y-4">
                  {Object.keys(groupedCoverage).length > 0 ? (
                    Object.entries(groupedCoverage).map(([carrier, coverages]: [string, any]) => {
                      const isExpanded = !!expandedCarriers[carrier];
                      return (
                        <div key={carrier} className="border border-slate-100 rounded-[2.5rem] overflow-hidden bg-slate-50/30 transition-all">
                          {/* Header de Drill Down */}
                          <button 
                            onClick={() => toggleCarrier(carrier)}
                            className="w-full flex items-center justify-between p-6 hover:bg-slate-50 transition-colors group"
                          >
                            <div className="flex items-center gap-4">
                              <div className={cn(
                                "w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-sm",
                                isExpanded ? "bg-emerald-500 text-white shadow-emerald-200" : "bg-white text-emerald-500"
                              )}>
                                <Icons.ShieldCheck className="w-6 h-6" />
                              </div>
                              <div className="text-left">
                                <h4 className={cn(
                                  "text-sm font-black uppercase tracking-tight transition-colors",
                                  isExpanded ? "text-slate-900" : "text-slate-600"
                                )}>
                                  {carrier}
                                </h4>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{coverages.length} Planos Atendidos</p>
                              </div>
                            </div>
                            <motion.div
                              animate={{ rotate: isExpanded ? 180 : 0 }}
                              className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 shadow-sm transition-all group-hover:text-blue-600"
                            >
                              <Icons.ChevronDown className="w-5 h-5" />
                            </motion.div>
                          </button>

                          {/* Lista Expandível */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                              >
                                <div className="p-6 pt-0 grid grid-cols-1 gap-3">
                                  {coverages.map((cov: any) => (
                                    <div key={cov.id} className="p-5 bg-white border border-slate-100 rounded-[1.5rem] shadow-sm hover:border-blue-400 hover:shadow-md transition-all group/item">
                                      <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                          <div className="w-2.5 h-2.5 rounded-full bg-blue-600 group-hover/item:scale-125 transition-transform" />
                                          <div className="flex items-center gap-2">
                                            <p className="text-xs font-black text-slate-700 uppercase tracking-tight">{cov.product?.name}</p>
                                            <span className={cn(
                                              "text-[7px] font-black uppercase px-2 py-0.5 rounded-full border",
                                              cov.product?.modality === 'Adesão' ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-indigo-50 text-indigo-600 border-indigo-100"
                                            )}>
                                              {cov.product?.modality || 'PME'}
                                            </span>
                                          </div>
                                        </div>
                                        {isEditing && (
                                          <button className="p-1.5 text-slate-300 hover:text-red-500 transition-colors">
                                            <Icons.Trash2 className="w-4 h-4" />
                                          </button>
                                        )}
                                      </div>
                                      
                                      <div className="flex flex-wrap gap-2">
                                        {cov.coverage_details && cov.coverage_details !== "Importado via IA" && cov.coverage_details !== "*NE" ? (
                                          cov.coverage_details.split('/').map((tag: string) => renderBadge(tag.trim()))
                                        ) : (
                                          renderBadge("*NE")
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-20 text-center bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
                      <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-slate-200 mx-auto mb-4 shadow-sm">
                        <Icons.AlertCircle className="w-8 h-8" />
                      </div>
                      <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Nenhum plano mapeado</p>
                      <p className="text-xs font-medium text-slate-300 mt-2 italic max-w-xs mx-auto">Informação de cobertura ainda não disponível para este local.</p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
