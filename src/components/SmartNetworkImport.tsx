import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icons } from "./Icons";
import { useLeads } from "../lib/leadsContext";
import { useToast } from "./Toasts";
import { cn } from "../lib/utils";
import { supabase } from "../lib/supabase";

interface ExtractedProvider {
  name: string;
  type: 'Hospital' | 'Clínica' | 'Laboratório';
  uf: string;
  city: string;
  neighborhood: string;
  address: string;
  products: { name: string, modality: string }[];
  coverage_details?: string;
  status?: 'new' | 'duplicate' | 'error';
  matchedId?: string;
  selected?: boolean;
}

export default function SmartNetworkImport({ isOpen, onClose, onRefresh }: { isOpen: boolean, onClose: () => void, onRefresh: () => void }) {
  const { carriers, products: allProducts, fetchProducts } = useLeads();
  const { success, error: showError } = useToast();
  
  const [step, setStep] = useState<'upload' | 'processing' | 'review' | 'summary'>('upload');
  const [selectedCarrier, setSelectedCarrier] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedProvider[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [importStats, setImportStats] = useState({
    newProviders: 0,
    linkedPlans: 0,
    newProducts: 0,
    duplicatesHandled: 0
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('upload');
      setSelectedCarrier("");
      setFile(null);
      setExtractedData([]);
      setIsSaving(false);
      setImportStats({
        newProviders: 0,
        linkedPlans: 0,
        newProducts: 0,
        duplicatesHandled: 0
      });
    }
  }, [isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setFile(e.target.files[0]);
  };

  const handleStartImport = async () => {
    if (!file || !selectedCarrier) return;
    
    setStep('processing');
    const carrier = carriers.find(c => c.id === selectedCarrier);
    
    const formData = new FormData();
    formData.append("file", file);
    formData.append("carrierName", carrier?.name || "");

    try {
      const response = await fetch("/api/network/import", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Erro ao processar arquivo com IA.");
      }

      const result = await response.json();
      
      // Analisar duplicados
      const analyzedData = await Promise.all(result.data.map(async (item: any) => {
        const { data: existing } = await supabase
          .from('medical_providers')
          .select('id, name')
          .ilike('name', `%${item.name}%`)
          .limit(1);

        return {
          ...item,
          status: existing && existing.length > 0 ? 'duplicate' : 'new',
          matchedId: existing?.[0]?.id,
          selected: true
        };
      }));

      setExtractedData(analyzedData);
      setStep('review');
    } catch (e: any) {
      showError(e.message);
      setStep('upload');
    }
  };

  const handleSaveImport = async () => {
    setIsSaving(true);
    let stats = { newProviders: 0, linkedPlans: 0, newProducts: 0, duplicatesHandled: 0 };
    try {
      const toImport = extractedData.filter(d => d.selected);
      
      for (const item of toImport) {
        let providerId = item.matchedId;

        // Se for novo ou usuário decidiu criar novo
        if (item.status === 'new' || !providerId) {
          const { data: newProv, error: provErr } = await supabase
            .from('medical_providers')
            .insert([{
              name: item.name,
              type: item.type,
              uf: item.uf,
              city: item.city,
              neighborhood: item.neighborhood,
              address: item.address
            }])
            .select()
            .single();
          
          if (provErr) throw provErr;
          providerId = newProv.id;
          stats.newProviders++;
        } else {
          stats.duplicatesHandled++;
        }

        // Vincular produtos
        if (item.products && item.products.length > 0) {
          for (const productData of item.products) {
            const productName = productData.name;
            const productModality = productData.modality || 'PME';

            // Tentar achar o produto pelo nome correspondente na operadora
            let productMatch = allProducts.find(p => 
              p.carrier_id === selectedCarrier && 
              p.name.toLowerCase().includes(productName.toLowerCase())
            );

            // Criar produto se não existir
            if (!productMatch) {
               const { data: newProd, error: prodErr } = await supabase
                .from('products')
                .insert([{
                  carrier_id: selectedCarrier,
                  name: productName,
                  modality: productModality,
                  status: 'Ativo'
                }])
                .select()
                .single();
              
              if (!prodErr && newProd) {
                productMatch = newProd;
                stats.newProducts++;
                // Adicionamos ao allProducts local temporariamente para evitar recriação no mesmo loop
                allProducts.push(newProd);
              }
            }

            if (productMatch) {
              const { error: upsertErr } = await supabase.from('network_coverage').upsert({
                carrier_id: selectedCarrier,
                product_id: productMatch.id,
                coverage_details: item.coverage_details || "*NE"
              }, { onConflict: 'provider_id, product_id' });
              
              if (!upsertErr) stats.linkedPlans++;
            }
          }
        }
      }

      await fetchProducts();
      setImportStats(stats);
      setStep('summary');
      onRefresh();
    } catch (e: any) {
      showError("Erro ao salvar: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100">
              <Icons.Rocket className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 leading-tight">Importação Inteligente</h2>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">IA Gemini 1.5 Flash</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-300 hover:text-slate-600 transition-colors"><Icons.X className="w-6 h-6"/></button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <AnimatePresence mode="wait">
            {step === 'upload' && (
              <motion.div key="upload" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">1. Selecione a Operadora</label>
                    <div className="grid grid-cols-2 gap-3">
                      {carriers.map(c => (
                        <button 
                          key={c.id} 
                          onClick={() => setSelectedCarrier(c.id)}
                          className={cn(
                            "p-4 rounded-3xl border-2 transition-all text-left group",
                            selectedCarrier === c.id ? "border-indigo-600 bg-indigo-50 shadow-indigo-100" : "border-slate-100 bg-white hover:border-slate-200"
                          )}
                        >
                          <p className={cn("text-xs font-black uppercase tracking-tight", selectedCarrier === c.id ? "text-indigo-700" : "text-slate-600")}>{c.name}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">2. Upload do Documento</label>
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className={cn(
                        "h-48 rounded-[2rem] border-4 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all",
                        file ? "border-emerald-200 bg-emerald-50" : "border-slate-100 hover:border-indigo-200 hover:bg-slate-50"
                      )}
                    >
                      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".pdf,image/*" />
                      {file ? (
                        <>
                          <Icons.CheckCircle className="w-10 h-10 text-emerald-500 mb-2" />
                          <p className="text-sm font-black text-emerald-700">{file.name}</p>
                          <p className="text-[10px] text-emerald-500 uppercase mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </>
                      ) : (
                        <>
                          <Icons.Upload className="w-10 h-10 text-slate-300 mb-2" />
                          <p className="text-sm font-bold text-slate-400">Clique ou arraste o PDF</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-slate-900 rounded-3xl text-white">
                   <div className="flex items-start gap-4">
                      <div className="p-3 bg-white/10 rounded-2xl"><Icons.Info className="w-6 h-6 text-indigo-400" /></div>
                      <div>
                        <h4 className="font-bold text-sm">Como funciona?</h4>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">Nossa IA processa o documento e identifica hospitais, clínicas e laboratórios, correlacionando-os automaticamente com os planos da operadora selecionada.</p>
                      </div>
                   </div>
                </div>

                <button 
                  disabled={!file || !selectedCarrier}
                  onClick={handleStartImport}
                  className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-30 transition-all flex items-center justify-center gap-3"
                >
                  Iniciar Leitura Inteligente <Icons.ChevronRight className="w-5 h-5" />
                </button>
              </motion.div>
            )}

            {step === 'processing' && (
              <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-20 flex flex-col items-center gap-6">
                 <div className="relative">
                    <div className="w-24 h-24 border-8 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                       <Icons.Rocket className="w-8 h-8 text-indigo-600 animate-bounce" />
                    </div>
                 </div>
                 <div className="text-center space-y-2">
                    <h3 className="text-2xl font-black text-slate-900">IA está lendo o documento...</h3>
                    <p className="text-sm text-slate-500">Isso pode levar alguns segundos dependendo do tamanho do arquivo.</p>
                 </div>
              </motion.div>
            )}

            {step === 'review' && (
              <motion.div key="review" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                 <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-black text-slate-900">Revisão dos Dados ({extractedData.length})</h3>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Confira os itens antes de salvar</p>
                    </div>
                    <div className="flex gap-2">
                       <button onClick={() => setStep('upload')} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50">Voltar</button>
                       <button 
                         onClick={handleSaveImport} 
                         disabled={isSaving}
                         className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-100 hover:bg-emerald-700 flex items-center gap-2"
                       >
                         {isSaving ? <Icons.Loader2 className="w-4 h-4 animate-spin" /> : <Icons.Check className="w-4 h-4" />}
                         Finalizar Importação
                       </button>
                    </div>
                 </div>

                 <div className="border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                       <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                          <tr>
                            <th className="px-6 py-4 w-12"><input type="checkbox" defaultChecked /></th>
                            <th className="px-6 py-4">Estabelecimento</th>
                            <th className="px-6 py-4">Cidade / UF</th>
                            <th className="px-6 py-4">Planos</th>
                            <th className="px-6 py-4">Status</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                          {extractedData.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                               <td className="px-6 py-4">
                                  <input 
                                    type="checkbox" 
                                    checked={item.selected} 
                                    onChange={(e) => {
                                      const newExtract = [...extractedData];
                                      newExtract[idx].selected = e.target.checked;
                                      setExtractedData(newExtract);
                                    }} 
                                  />
                               </td>
                               <td className="px-6 py-4">
                                  <p className="text-xs font-black text-slate-900">{item.name}</p>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.type}</p>
                               </td>
                               <td className="px-6 py-4">
                                  <p className="text-xs font-bold text-slate-500 uppercase">{item.city} - {item.uf}</p>
                               </td>
                               <td className="px-6 py-4">
                                  <div className="flex flex-wrap gap-1">
                                     {item.products.map((p, pIdx) => (
                                       <span key={pIdx} className={cn(
                                         "text-[8px] font-black uppercase px-2 py-1 rounded border flex flex-col items-center",
                                         p.modality === 'Adesão' ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-indigo-50 text-indigo-600 border-indigo-100"
                                       )}>
                                         <span>{p.name}</span>
                                         <span className="opacity-50 text-[6px] tracking-tighter mt-0.5">{p.modality}</span>
                                       </span>
                                     ))}
                                  </div>
                               </td>
                               <td className="px-6 py-4">
                                  {item.status === 'duplicate' ? (
                                    <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100">
                                       <Icons.AlertCircle className="w-3 h-3" />
                                       <span className="text-[9px] font-black uppercase">Possível Duplicado</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                                       <Icons.Check className="w-3 h-3" />
                                       <span className="text-[9px] font-black uppercase">Novo</span>
                                    </div>
                                  )}
                               </td>
                            </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              </motion.div>
            )}
            {step === 'summary' && (
              <motion.div key="summary" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-12 flex flex-col items-center max-w-2xl mx-auto">
                 <div className="w-20 h-20 bg-emerald-100 rounded-[2rem] flex items-center justify-center text-emerald-600 mb-8 shadow-inner">
                    <Icons.CheckCircle className="w-10 h-10" />
                 </div>
                 
                 <div className="text-center mb-10">
                    <h3 className="text-2xl font-black text-slate-900">Importação Concluída!</h3>
                    <p className="text-sm text-slate-500 mt-2">Veja o relatório de atualizações realizadas na base.</p>
                 </div>

                 <div className="w-full grid grid-cols-3 gap-4 mb-10">
                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 text-center">
                       <p className="text-2xl font-black text-indigo-600 leading-none">{importStats.newProviders}</p>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Novos Locais</p>
                    </div>
                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 text-center">
                       <p className="text-2xl font-black text-emerald-600 leading-none">{importStats.linkedPlans}</p>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Planos Vinculados</p>
                    </div>
                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 text-center">
                       <p className="text-2xl font-black text-amber-600 leading-none">{importStats.duplicatesHandled}</p>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Duplicados</p>
                    </div>
                 </div>

                 <div className="w-full p-8 bg-indigo-900 rounded-[2.5rem] text-white relative overflow-hidden group">
                    <Icons.ShieldCheck className="absolute -right-8 -bottom-8 w-40 h-40 text-white/5 opacity-20 rotate-12 group-hover:scale-110 transition-transform" />
                    <h4 className="text-sm font-black uppercase tracking-[0.2em] mb-4">Relatório Inteligente</h4>
                    <div className="space-y-3 text-xs font-medium text-slate-300 leading-relaxed">
                       <p>• Foram identificados e cadastrados <span className="text-white font-bold">{importStats.newProviders}</span> novos provedores de saúde.</p>
                       <p>• A IA correlacionou <span className="text-white font-bold">{importStats.linkedPlans}</span> ofertas de planos com os estabelecimentos.</p>
                       <p>• <span className="text-white font-bold">{importStats.duplicatesHandled}</span> estabelecimentos já existiam e tiveram seus vínculos apenas atualizados ou mantidos.</p>
                    </div>
                 </div>

                 <button 
                   onClick={onClose}
                   className="mt-12 px-12 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
                 >
                   Ok, Entendido
                 </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
