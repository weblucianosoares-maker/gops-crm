import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icons } from "./Icons";
import { cn } from "../lib/utils";

interface ProviderDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  provider: any;
}

export default function ProviderDetailDrawer({ isOpen, onClose, provider }: ProviderDetailDrawerProps) {
  const [expandedCarriers, setExpandedCarriers] = React.useState<Record<string, boolean>>({});

  if (!provider) return null;

  const toggleCarrier = (carrier: string) => {
    setExpandedCarriers(prev => ({
      ...prev,
      [carrier]: !prev[carrier]
    }));
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
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-600/20">
                  <Icons.Hospital className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 leading-none">{provider.name}</h2>
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mt-2 inline-block px-2 py-1 bg-blue-50 rounded-lg border border-blue-100 italic">
                    {provider.type}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-all text-slate-400"
              >
                <Icons.X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
              
              {/* Informações de Localização */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-4 bg-blue-600 rounded-full" />
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Informações de Localização</h3>
                </div>
                
                <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shadow-sm text-blue-600 shrink-0">
                      <Icons.MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Endereço Completo</p>
                      <p className="text-sm font-bold text-slate-900 leading-relaxed">
                        {provider.address || "Endereço não disponível"}
                      </p>
                      <p className="text-xs font-medium text-slate-500 mt-1">
                        {provider.neighborhood ? `${provider.neighborhood}, ` : ""}{provider.city} - {provider.uf}
                      </p>
                    </div>
                  </div>
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
                        <div key={carrier} className="border border-slate-100 rounded-[2rem] overflow-hidden bg-slate-50/30 transition-all">
                          {/* Header de Drill Down */}
                          <button 
                            onClick={() => toggleCarrier(carrier)}
                            className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors group"
                          >
                            <div className="flex items-center gap-4">
                              <div className={cn(
                                "w-10 h-10 rounded-2xl flex items-center justify-center transition-all shadow-sm",
                                isExpanded ? "bg-emerald-500 text-white shadow-emerald-200" : "bg-white text-emerald-500"
                              )}>
                                <Icons.ShieldCheck className="w-5 h-5" />
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
                                <div className="p-5 pt-0 grid grid-cols-1 gap-2.5">
                                  {coverages.map((cov: any) => (
                                    <div key={cov.id} className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-blue-400 hover:shadow-md transition-all group/item flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                        <div className="w-2.5 h-2.5 rounded-full bg-blue-600 group-hover/item:scale-125 transition-transform" />
                                        <p className="text-xs font-black text-slate-700 uppercase tracking-tight">{cov.product?.name}</p>
                                      </div>
                                      {cov.coverage_details && (
                                        <span className="text-[9px] font-black uppercase px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-400">
                                          {cov.coverage_details}
                                        </span>
                                      )}
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

            {/* Footer */}
            <div className="p-8 border-t border-slate-100 bg-slate-50/30">
              <button
                onClick={onClose}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
              >
                Fechar Detalhes
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
