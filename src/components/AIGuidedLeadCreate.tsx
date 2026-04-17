import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icons } from "./Icons";
import { cn, formatCEP, formatCNPJ, formatPhone } from "../lib/utils";
import { processInterviewStep } from "../lib/geminiService";
import { supabase } from "../lib/supabase";
import { useToast } from "./Toasts";

interface AIGuidedLeadCreateProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (leadId: string) => void;
}

export function AIGuidedLeadCreate({ isOpen, onClose, onSuccess }: AIGuidedLeadCreateProps) {
  const { success, error: showError } = useToast();
  const [messages, setMessages] = useState<{ role: "model" | "user"; text: string }[]>([]);
  const [userInput, setUserInput] = useState("");
  const [extractedData, setExtractedData] = useState<any>({});
  const [isThinking, setIsThinking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Iniciar a conversa
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      startInterview();
    }
  }, [isOpen]);

  const startInterview = async () => {
    setIsThinking(true);
    try {
      const res = await processInterviewStep([]);
      setMessages([{ role: "model", text: res.next_question }]);
      setIsThinking(false);
    } catch (e: any) {
      console.error("ERRO GEMINI (START):", e);
      showError(`Erro ao iniciar Gemini: ${e.message || 'Sem conexão'}`);
      setIsThinking(false);
    }
  };

  const handleSend = async () => {
    if (!userInput.trim() || isThinking) return;

    const userMsg = userInput;
    setUserInput("");
    const newMessages = [...messages, { role: "user", text: userMsg }];
    setMessages(newMessages as any);
    
    setIsThinking(true);
    try {
      // Formatar histórico para o Gemini
      const history = newMessages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const res = await processInterviewStep(history as any);
      
      setMessages(prev => [...prev, { role: "model", text: res.next_question }]);
      
      // Mesclar dados extraídos
      if (res.extracted_data) {
        const newData = { ...extractedData, ...res.extracted_data };
        setExtractedData(newData);
        
        // Se detectou CNPJ novo, vamos tentar validar
        if (res.extracted_data.cnpj && res.extracted_data.cnpj !== extractedData.cnpj) {
          handleCNPJLookup(res.extracted_data.cnpj);
        }
        // Se detectou CEP novo
        if (res.extracted_data.address?.includes('-') && res.extracted_data.address.length >= 8) {
           handleCEPLookup(res.extracted_data.address);
        }
      }
    } catch (e: any) {
      console.error("ERRO GEMINI (SEND):", e);
      showError(`Erro na resposta: ${e.message || 'Tente novamente'}`);
    } finally {
      setIsThinking(false);
    }
  };

  const handleCNPJLookup = async (cnpj: string) => {
    const clean = cnpj.replace(/\D/g, "");
    if (clean.length === 14) {
      try {
        const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
        const data = await res.json();
        if (res.ok) {
           setExtractedData(prev => ({
             ...prev,
             company_name: data.razao_social,
             nickname: data.nome_fantasia,
             opening_date: data.data_abertura,
             cnae: data.cnae_fiscal ? `${data.cnae_fiscal}${data.cnae_fiscal_descricao ? ' - ' + data.cnae_fiscal_descricao : ''}` : data.cnae_fiscal_descricao,
             address: `${data.logradouro}, ${data.numero} - ${data.municipio}/${data.uf}`
           }));
           success("Dados da empresa carregados via CNPJ!");
        }
      } catch (e) {}
    }
  };

  const handleCEPLookup = async (address: string) => {
    const cepMatch = address.match(/\d{5}-?\d{3}/);
    if (cepMatch) {
       const clean = cepMatch[0].replace(/\D/g, "");
       try {
         const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
         const data = await res.json();
         if (!data.erro) {
           setExtractedData(prev => ({
             ...prev,
             address_city: data.localidade,
             address_state: data.uf,
             address_street: data.logradouro,
             address_neighborhood: data.bairro
           }));
         }
       } catch (e) {}
    }
  };

  const handleFinalize = async () => {
    if (isSaving) return;
    setIsSaving(true);
    
    try {
      // 1. Criar o Lead Principal
      const { data: lead, error: leadErr } = await supabase.from('leads').insert([{
        name: extractedData.name || "Lead via IA",
        email: extractedData.email,
        phone: extractedData.phone?.replace(/\D/g, ''),
        cnpj: extractedData.cnpj?.replace(/\D/g, ''),
        lead_type: extractedData.cnpj ? 'PJ' : 'PF',
        address_street: extractedData.address_street || extractedData.address,
        address_city: extractedData.address_city,
        address_state: extractedData.address_state,
        company_name: extractedData.company_name,
        interested_lives: extractedData.interested_lives || 1,
        has_current_plan: !!extractedData.has_current_plan,
        current_carrier: extractedData.current_carrier,
        current_product: extractedData.current_product,
        current_value: extractedData.current_value,
        source: 'IA Interview',
        status: 'Novo',
        temperature: 'Morno'
      }]).select().single();

      if (leadErr) throw leadErr;

      // 2. Salvar Ficha de Entrevista
      const { error: intErr } = await supabase.from('lead_interviews').insert([{
        lead_id: lead.id,
        motivation: extractedData.motivation,
        preferred_network: extractedData.preferred_hospital,
        health_history: extractedData.pre_existing_condition,
        utilization_profile: extractedData.utilization_profile,
        priorities: extractedData.priorities,
        raw_transcript: messages,
        ai_recommendation: extractedData.recommendation || "Pendente"
      }]);

      if (intErr) throw intErr;

      success("Lead e Entrevista criados com sucesso!");
      onSuccess(lead.id);
      onClose();
    } catch (e: any) {
      showError("Erro ao salvar: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isThinking]);

  if (!isOpen) return null;

  return (
    <div className={cn(
      "flex items-center justify-center",
      isOpen && !onClose.toString().includes('() => {}') ? "fixed inset-0 z-[300] bg-slate-900/40 backdrop-blur-sm p-4" : "h-full w-full"
    )}>
      <motion.div 
        initial={onClose.toString().includes('() => {}') ? { opacity: 1 } : { opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={cn(
          "bg-white flex overflow-hidden border border-slate-100",
          isOpen && !onClose.toString().includes('() => {}') ? "w-full max-w-5xl h-[85vh] rounded-[2.5rem] shadow-2xl" : "h-full w-full rounded-none border-none"
        )}
      >
        {/* Lado Esquerdo: Chat */}
        <div className="flex-1 flex flex-col bg-slate-50/50">
          <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-100">
                <Icons.Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Entrevista Mágica</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
                  Gemini AI Online
                </p>
              </div>
            </div>
            {!onClose.toString().includes('() => {}') && (
              <button onClick={onClose} className="p-2 text-slate-300 hover:text-slate-900 transition-colors">
                <Icons.X className="w-7 h-7" />
              </button>
            )}
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
            {messages.map((m, i) => (
              <motion.div 
                initial={{ opacity: 0, x: m.role === 'model' ? -10 : 10 }}
                animate={{ opacity: 1, x: 0 }}
                key={i} 
                className={cn(
                  "flex flex-col max-w-[80%]",
                  m.role === 'model' ? "self-start" : "self-end items-end"
                )}
              >
                <div className={cn(
                  "p-5 rounded-3xl text-sm font-medium shadow-sm",
                  m.role === 'model' 
                    ? "bg-white text-slate-800 rounded-tl-none border border-slate-100" 
                    : "bg-blue-600 text-white rounded-tr-none"
                )}>
                  {String(m.text)}
                </div>
              </motion.div>
            ))}
            {isThinking && (
              <div className="flex gap-2 p-4 bg-white self-start rounded-2xl rounded-tl-none border border-slate-100 shadow-sm animate-pulse">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-75" />
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-150" />
              </div>
            )}
          </div>

          <div className="p-8 bg-white border-t border-slate-100">
            <div className="relative group">
              <input
                value={userInput}
                onChange={e => setUserInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Digite a resposta do lead aqui..."
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-8 py-5 pr-20 outline-none focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all text-sm font-bold text-slate-900"
              />
              <button 
                onClick={handleSend}
                disabled={!userInput.trim() || isThinking}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-30"
              >
                <Icons.Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Lado Direito: Dados Extraídos */}
        <div className="w-[350px] border-l border-slate-100 flex flex-col bg-white">
          <div className="p-8 border-b border-slate-100 bg-slate-50/50">
            <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Dados Coletados</h4>
          </div>
          
          <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
             {/* Grupo de Identificação */}
             <div className="space-y-4">
                <div className="flex items-center gap-2 text-blue-600 mb-2">
                   <Icons.Users className="w-4 h-4" />
                   <span className="text-[10px] font-black uppercase tracking-widest">Identificação</span>
                </div>
                <Field label="Nome" value={extractedData.name} />
                <Field label="WhatsApp" value={extractedData.phone} mask={formatPhone} />
                <Field label="Email" value={extractedData.email} />
                {extractedData.cnpj ? (
                   <Field label="CNPJ" value={extractedData.cnpj} mask={formatCNPJ} />
                ) : (
                   <Field label="Profissão" value={extractedData.profession || extractedData.job_title} />
                )}
             </div>

             {/* Grupo de Saúde / Preferência */}
             <div className="space-y-4 pt-4 border-t border-slate-50">
                <div className="flex items-center gap-2 text-rose-600 mb-2">
                   <Icons.Heart className="w-4 h-4" />
                   <span className="text-[10px] font-black uppercase tracking-widest">Consultivo</span>
                </div>
                <Field label="Hospital" value={extractedData.preferred_hospital} />
                <Field label="Saúde" value={extractedData.pre_existing_condition} />
                <Field label="Vidas" value={extractedData.interested_lives} />
             </div>
          </div>

          <div className="p-8 bg-slate-50 border-t border-slate-100">
             <button 
               onClick={handleFinalize}
               disabled={isSaving || !extractedData.name}
               className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-3 hover:bg-black transition-all active:scale-95 disabled:opacity-50"
             >
               {isSaving ? <Icons.Loader2 className="w-4 h-4 animate-spin" /> : <Icons.CheckCircle className="w-4 h-4" />}
               Finalizar e Gerar Lead
             </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

const Field = ({ label, value, mask }: any) => (
  <div className="space-y-1">
    <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter ml-1">{label}</p>
    <div className={cn(
      "px-4 py-2.5 rounded-xl text-xs font-bold transition-all",
      value ? "bg-blue-50 text-blue-800 border-blue-100 border" : "bg-slate-50 text-slate-300 italic border border-transparent"
    )}>
      {value ? (mask ? mask(value) : value) : "Pendente..."}
    </div>
  </div>
);
