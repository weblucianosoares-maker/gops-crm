import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icons } from "./Icons";
import { cn, formatCPF, formatPhone, formatCNPJ, formatCEP, formatCurrencyValue, parseCurrencyValue } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { useLeads } from "../lib/leadsContext";
import { evolutionService } from "../lib/evolution";
import { useToast } from "./Toasts";

// Cores para os status de interação
const getStatusColor = (name: string) => {
  switch (name) {
    case 'Sem Status': return 'bg-slate-100 text-slate-500';
    case 'Aguardando Retorno': return 'bg-amber-100 text-amber-700';
    case 'Não Responde': return 'bg-red-100 text-red-700';
    case 'Analisando Cotação': return 'bg-indigo-100 text-indigo-700';
    case 'Realizei Contato': return 'bg-emerald-100 text-emerald-700';
    default: return 'bg-blue-100 text-blue-700';
  }
};

// Componente para renderizar mensagens com mídia
const MediaMessage = ({ msg }: { msg: any }) => {
  const [mediaData, setMediaData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isImage = msg.media_type === 'image' || msg.media_type === 'sticker';
  const isDoc = msg.media_type === 'document';
  const isAudio = msg.media_type === 'audio';
  const isVideo = msg.media_type === 'video';

  useEffect(() => {
    const hasMedia = isImage || isDoc || isAudio || isVideo;
    if (hasMedia && msg.id && !msg.id.startsWith('temp-')) {
      const loadMedia = async () => {
        setLoading(true);
        try {
          const res = await evolutionService.fetchMedia(msg.id);
          if (res && res.base64) setMediaData(res.base64);
        } catch (e) {
          console.error("Erro ao carregar mídia:", e);
        } finally {
          setLoading(false);
        }
      };
      loadMedia();
    } else if (msg.media_preview) {
      setMediaData(msg.media_preview.includes('base64,') ? msg.media_preview.split('base64,')[1] : msg.media_preview);
    }
  }, [msg.id, msg.media_type, msg.media_preview]);

  if (loading) {
    return (
      <div className="w-48 h-20 bg-slate-100/50 animate-pulse rounded-lg flex items-center justify-center gap-2">
        <Icons.Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
        <span className="text-[9px] font-black uppercase text-slate-300">Carregando mídias...</span>
      </div>
    );
  }

  if (isImage) {
    return (
      <div className="space-y-2">
        {mediaData ? (
          <img 
            src={`data:${msg.mimetype || 'image/png'};base64,${mediaData}`} 
            alt="Anexo" 
            className="rounded-lg max-w-full cursor-pointer hover:brightness-95 transition-all shadow-sm"
            onClick={() => window.open(`data:${msg.mimetype || 'image/png'};base64,${mediaData}`, '_blank')}
          />
        ) : (
          <div className="p-3 bg-slate-50 rounded-lg border border-dashed text-[10px] text-slate-400 text-center font-bold uppercase tracking-tighter">Imagem não disponível</div>
        )}
        {msg.text && <p className="whitespace-pre-wrap text-slate-800 font-medium ">{msg.text}</p>}
      </div>
    );
  }

  if (isAudio) {
    return (
      <div className="space-y-2 py-1 min-w-[200px]">
        {mediaData ? (
          <audio controls className="h-8 w-full">
            <source src={`data:${msg.mimetype || 'audio/ogg'};base64,${mediaData}`} type={msg.mimetype || 'audio/ogg'} />
            Seu navegador não suporta áudio.
          </audio>
        ) : (
          <div className="flex items-center gap-2 text-slate-400">
            <Icons.Mic className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase">Áudio indisponível</span>
          </div>
        )}
      </div>
    );
  }

  if (isVideo) {
    return (
      <div className="space-y-2">
        {mediaData ? (
          <video controls className="rounded-lg max-w-full shadow-sm max-h-[300px]">
            <source src={`data:${msg.mimetype || 'video/mp4'};base64,${mediaData}`} type={msg.mimetype || 'video/mp4'} />
          </video>
        ) : (
          <div className="p-3 bg-slate-50 rounded-lg border border-dashed text-[10px] text-slate-400 text-center font-bold uppercase">Vídeo não disponível</div>
        )}
        {msg.text && <p className="whitespace-pre-wrap text-slate-800 font-medium ">{msg.text}</p>}
      </div>
    );
  }

  if (isDoc) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3 p-3 bg-white/40 rounded-xl border border-black/5">
          <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
             <Icons.File className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
             <p className="text-[11px] font-black text-slate-700 truncate capitalize">{msg.file_name || "Documento"}</p>
             <p className="text-[9px] text-slate-400 uppercase font-black tracking-tight">{msg.mimetype?.split('/')[1] || "DOC"}</p>
          </div>
          {mediaData && (
             <button 
               onClick={() => {
                  const link = document.createElement('a');
                  link.href = `data:${msg.mimetype};base64,${mediaData}`;
                  link.download = msg.file_name || 'arquivo';
                  link.click();
               }}
               className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
             >
                <Icons.Download className="w-4 h-4" />
             </button>
          )}
        </div>
        {msg.text && <p className="whitespace-pre-wrap text-slate-800 font-medium">{msg.text || ""}</p>}
      </div>
    );
  }

  return <p className="whitespace-pre-wrap text-slate-800 font-medium">{msg.text || "[Mídia/Outro]"}</p>;
};

const SectionHeader = ({ icon: Icon, title, colorClass }: { icon: any, title: string, colorClass: string }) => (
  <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
    <div className={cn("p-2 rounded-lg", colorClass)}>
      <Icon className="w-4 h-4" />
    </div>
    <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">{title}</h4>
  </div>
);

const DetailField = ({ label, value, onChange, placeholder, type = "text", mask, selectOptions, lead, setLead, interactionStatuses }: any) => (
  <div className="space-y-1">
    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">{label}</label>
    {label === "Status de Interação" ? (
      <select 
        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none focus:bg-white focus:border-blue-500 text-sm font-bold text-slate-700 transition-all hover:bg-slate-100/50" 
        value={lead.interaction_status} 
        onChange={e => setLead({...lead, interaction_status: e.target.value})}
      >
        <option value="">Selecione o Status</option>
        {interactionStatuses?.filter((s: any) => s.active).map((status: any) => (
          <option key={status.id} value={status.name}>{status.name}</option>
        ))}
      </select>
    ) : selectOptions ? (
      <select 
        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:bg-white focus:border-blue-500 text-sm font-bold text-slate-700" 
        value={value || ""} 
        onChange={e => onChange(e.target.value)}
      >
        <option value="">Selecione...</option>
        {selectOptions.map((opt:any) => <option key={opt.id || opt} value={opt.value !== undefined ? opt.value : (opt.name || opt)}>{opt.label || opt.name || opt}</option>)}
      </select>
    ) : (
      <input 
        type={type}
        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:bg-white focus:ring-4 focus:ring-blue-100/10 focus:border-blue-500 transition-all text-sm font-bold text-slate-900 placeholder:text-slate-300"
        placeholder={placeholder}
        value={mask ? mask(value) : (value || '')}
        onChange={e => onChange(e.target.value)}
      />
    )}
  </div>
);

interface LeadDetailDrawerProps {
  lead: any;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedLead?: any) => void;
  onRefreshAlerts?: () => void;
}

export function LeadDetailDrawer({ lead: initialLead, isOpen, onClose, onUpdate, onRefreshAlerts }: LeadDetailDrawerProps) {
  const { 
    stages, 
    fetchLeads, 
    fetchStages, 
    contactTypes, 
    interactionStatuses,
    carriers, 
    products 
  } = useLeads();
  const { success, error: showError } = useToast();
  const [lead, setLead] = useState(initialLead);
  const [history, setHistory] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [activeTab, setActiveTab] = useState<'details' | 'chat' | 'history'>('details');
  const [loadingChat, setLoadingChat] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderDate, setReminderDate] = useState("");
  const [isSavingReminder, setIsSavingReminder] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialLead) {
      setLead(initialLead);
      fetchHistory(initialLead.id);
      setActiveTab('details');
    }
  }, [initialLead]);

  const loadMessages = async () => {
    if (!lead?.phone) return;
    setLoadingChat(true);
    try {
      const apiRes = await evolutionService.getMessages(lead.phone);
      const { data: localData } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: true });

      let rawApi = [];
      if (Array.isArray(apiRes)) {
        rawApi = apiRes;
      } else if (apiRes && typeof apiRes === 'object' && 'messages' in apiRes && Array.isArray((apiRes as any).messages)) {
        rawApi = (apiRes as any).messages;
      }

      const normalizedApi = rawApi.map((m: any) => {
        const msg = m.message || {};
        let text = msg.conversation || msg.extendedTextMessage?.text || "";
        let mediaType = undefined;
        let mimetype = undefined;
        let fileName = undefined;

        if (msg.imageMessage) { mediaType = 'image'; mimetype = msg.imageMessage.mimetype; text = msg.imageMessage.caption || ""; }
        else if (msg.audioMessage) { mediaType = 'audio'; mimetype = msg.audioMessage.mimetype; }
        else if (msg.videoMessage) { mediaType = 'video'; mimetype = msg.videoMessage.mimetype; text = msg.videoMessage.caption || ""; }
        else if (msg.documentMessage) { mediaType = 'document'; mimetype = msg.documentMessage.mimetype; fileName = msg.documentMessage.fileName || msg.documentMessage.title; text = msg.documentMessage.caption || ""; }
        else if (msg.stickerMessage) { mediaType = 'sticker'; mimetype = msg.stickerMessage.mimetype; }

        return {
          id: m.key?.id || `api-${Math.random()}`,
          fromMe: !!m.key?.fromMe,
          text,
          timestamp: m.messageTimestamp ? (typeof m.messageTimestamp === 'number' ? m.messageTimestamp * 1000 : m.messageTimestamp) : Date.now(),
          media_type: mediaType,
          mimetype,
          file_name: fileName,
          source: 'api'
        };
      });

      const normalizedLocal = (localData || []).map((m: any) => ({
        id: m.message_id,
        fromMe: m.is_from_me,
        text: m.message_body,
        timestamp: new Date(m.created_at).getTime(),
        media_type: m.media_type,
        mimetype: m.mimetype,
        file_name: m.file_name,
        is_read: m.is_read ?? true,
        source: 'local'
      }));

      const merged = [...normalizedApi, ...normalizedLocal].reduce((acc: any[], curr: any) => {
        if (!acc.find(m => m.id === curr.id)) acc.push(curr);
        return acc;
      }, []);

      setMessages(merged.sort((a,b) => a.timestamp - b.timestamp));
    } catch (e) {
      console.error("Erro ao carregar mensagens:", e);
    } finally {
      setLoadingChat(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'chat' && lead?.id) {
       loadMessages();
       const markRead = async () => {
         await supabase.from('whatsapp_messages').update({ is_read: true }).eq('lead_id', lead.id).eq('is_from_me', false).eq('is_read', false);
       };
       markRead();
       const channel = supabase.channel(`chat-${lead.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages', filter: `lead_id=eq.${lead.id}` }, (payload) => {
           const n = payload.new;
           setMessages(prev => {
             if (prev.find(m => m.id === n.message_id)) return prev;
             return [...prev, { id: n.message_id, fromMe: n.is_from_me, text: n.message_body, timestamp: new Date(n.created_at).getTime(), media_type: n.media_type, mimetype: n.mimetype, file_name: n.file_name, is_read: true, source: 'realtime' }].sort((a,b) => a.timestamp - b.timestamp);
           });
           markRead();
       }).subscribe();
       return () => { supabase.removeChannel(channel); };
    }
  }, [activeTab, lead?.id]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !lead?.phone) return;
    const txt = newMessage; setNewMessage("");
    const tempId = `temp-${Date.now()}`;
    setMessages(prev => [...prev, { id: tempId, fromMe: true, text: txt, timestamp: Date.now(), status: 'sending' }]);
    try {
      const res = await evolutionService.sendMessage(lead.phone, txt);
      if (res && res.key?.id) {
        const now = new Date();
        const formattedDate = `${now.getDate()} ${now.toLocaleString('pt-BR', { month: 'short' }).replace('.', '')}, ${now.getFullYear()}`;
        
        // Update messages table
        const { error: upsertError } = await supabase.from('whatsapp_messages').upsert({ 
          lead_id: lead.id, 
          message_id: res.key.id, 
          sender_number: lead.phone.replace(/\D/g, ''), 
          message_body: txt, 
          is_from_me: true, 
          is_read: true, 
          created_at: now.toISOString() 
        }, { onConflict: 'message_id' });

        if (upsertError) console.error('Erro ao registrar mensagem no Supabase:', upsertError);
        
        // Update lead contact info
        const { error: updateError } = await supabase.from('leads').update({ 
          last_app_message_at: now.toISOString(),
          lastcontact: formattedDate 
        }).eq('id', lead.id);

        if (updateError) {
          console.error('Erro ao atualizar lead no Supabase:', updateError);
        } else {
          // Update local state for immediate feedback
          setLead(prev => ({ ...prev, last_app_message_at: now.toISOString(), lastcontact: formattedDate }));
        }

        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: res.key.id, status: 'sent' } : m));
        
        // Notify parent without awaiting it (don't block the UI)
        setTimeout(() => { if (onUpdate) onUpdate(); }, 100);
      } else {
        throw new Error("Resposta da API sem ID de mensagem");
      }
    } catch (e: any) { 
      console.error('Falha crítica no envio:', e);
      setMessages(prev => prev.filter(m => m.id !== tempId)); 
      
      let userMsg = "Falha ao enviar mensagem. Verifique a conexão.";
      const errorStr = JSON.stringify(e);
      if (errorStr.includes('"exists":false')) {
        userMsg = "Este número não possui WhatsApp ou é inválido.";
      } else if (e.message) {
        userMsg = "Erro: " + e.message;
      }
      
      showError(userMsg); 
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !lead?.phone) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const b64 = ev.target?.result as string;
      const type = file.type.startsWith('image/') ? 'image' : 'document';
      const tempId = `temp-${Date.now()}`;
      setMessages(prev => [...prev, { id: tempId, fromMe: true, text: file.name, timestamp: Date.now(), media_type: type, mimetype: file.type, file_name: file.name, status: 'sending', media_preview: b64 }]);
      try {
        const res = await evolutionService.sendMedia(lead.phone, b64, type, file.type, file.name);
        if (res && res.key?.id) {
          const now = new Date();
          const formattedDate = `${now.getDate()} ${now.toLocaleString('pt-BR', { month: 'short' }).replace('.', '')}, ${now.getFullYear()}`;

          // Update messages table
          const { error: upsertError } = await supabase.from('whatsapp_messages').upsert({ 
            lead_id: lead.id, 
            message_id: res.key.id, 
            sender_number: lead.phone.replace(/\D/g, ''),
            message_body: `[Arquivo: ${file.name}]`, 
            is_from_me: true, 
            is_read: true, 
            created_at: now.toISOString(),
            media_type: type,
            mimetype: file.type,
            file_name: file.name
          }, { onConflict: 'message_id' });

          if (upsertError) console.error('Erro ao registrar mídia no Supabase:', upsertError);

          // Update lead contact info
          const { error: updateError } = await supabase.from('leads').update({ 
            last_app_message_at: now.toISOString(),
            lastcontact: formattedDate 
          }).eq('id', lead.id);

          if (updateError) {
            console.error('Erro ao atualizar lead após mídia:', updateError);
          } else {
            // Update local state
            setLead(prev => ({ ...prev, last_app_message_at: now.toISOString(), lastcontact: formattedDate }));
          }

          setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: res.key.id, status: 'sent' } : m));
          
          success("Arquivo enviado!");
          setTimeout(() => { if (onUpdate) onUpdate(); }, 100);
        }
      } catch (e: any) {
        console.error('Erro no envio de mídia:', e);
        setMessages(prev => prev.filter(m => m.id !== tempId));
        
        let userMsg = "Falha ao enviar arquivo.";
        const errorStr = JSON.stringify(e);
        if (errorStr.includes('"exists":false')) {
          userMsg = "Este número não possui WhatsApp ou é inválido.";
        } else if (e.message) {
          userMsg = "Erro: " + e.message;
        }
        
        showError(userMsg);
      }
    };
    reader.readAsDataURL(file);
  };

  const fetchHistory = async (id: string) => {
    const { data } = await supabase.from('lead_history').select('*').eq('lead_id', id).order('created_at', { ascending: false });
    setHistory(data || []);
  };

  const handleAddNote = async () => {
    if (!noteContent.trim() || !lead?.id) return;
    setIsSavingNote(true);
    const content = `[NOTA] ${noteContent}`;
    const { error } = await supabase.from('lead_history').insert([{ lead_id: lead.id, content }]);
    setIsSavingNote(false);
    if (!error) {
       success("Nota adicionada ao histórico!");
       setNoteContent("");
       fetchHistory(lead.id);
    } else {
       showError("Erro ao salvar nota: " + error.message);
    }
  };

  const handleAddReminder = async (days?: number) => {
    if (!lead?.id) return;
    let finalDate = reminderDate;
    let finalTitle = reminderTitle || "Lembrete de acompanhamento";

    if (days !== undefined) {
      const d = new Date();
      d.setDate(d.getDate() + days);
      finalDate = d.toISOString().split('T')[0];
    }

    if (!finalDate) {
      showError("Selecione uma data para o lembrete.");
      return;
    }

    setIsSavingReminder(true);
    const { error } = await supabase.from('reminders').insert([{
      lead_id: lead.id,
      title: finalTitle,
      due_date: finalDate,
      status: 'pendente'
    }]);
    
    setIsSavingReminder(false);
    if (!error) {
       success("Lembrete agendado com sucesso!");
       setReminderTitle("");
       setReminderDate("");
       if (onRefreshAlerts) onRefreshAlerts();
    } else {
       showError("Erro ao salvar lembrete: " + error.message);
    }
  };

  const handleSave = async () => {
    if (!lead.name?.trim()) {
      showError("O nome é obrigatório para cadastrar ou atualizar.");
      return;
    }

    setIsSaving(true);
    const updates = { 
      name: lead.name, 
      email: lead.email, 
      phone: lead.phone?.replace(/\D/g, '') || null, 
      status: lead.status, 
      nickname: lead.nickname, 
      lead_type: lead.lead_type || 'PF', 
      company_name: lead.company_name, 
      contact_person: lead.contact_person, 
      job_title: lead.job_title,
      birth_date: lead.birth_date || null, 
      marriage_date: lead.marriage_date || null, 
      rg: lead.rg, 
      cnpj: lead.cnpj?.replace(/\D/g, '') || null,
      address_zip: lead.address_zip, 
      address_street: lead.address_street, 
      address_neighborhood: lead.address_neighborhood,
      address_city: lead.address_city, 
      address_state: lead.address_state, 
      address_number: lead.address_number,
      address_complement: lead.address_complement, 
      current_carrier: lead.current_carrier, 
      current_product: lead.current_product,
      current_lives: lead.current_lives, 
      current_value: lead.current_value, 
      docs_link: lead.docs_link,
      plan_type: lead.plan_type, 
      carrier: lead.carrier, 
      product: lead.product,
      interested_lives: lead.interested_lives, 
      deal_value: lead.deal_value,
      has_current_plan: lead.has_current_plan,
      contract_expiry_date: lead.contract_expiry_date || null,
      has_broker: !!lead.has_broker,
      source: lead.source || 'Manual',
      initials: (lead.name || "?").substring(0, 2).toUpperCase(),
      // PME Data
      resp_emp_name: lead.resp_emp_name, 
      resp_emp_job: lead.resp_emp_job, 
      resp_emp_birth_date: lead.resp_emp_birth_date || null,
      resp_emp_marital_status: lead.resp_emp_marital_status, 
      resp_emp_marriage_date: lead.resp_emp_marriage_date || null,
      resp_emp_cpf: lead.resp_emp_cpf?.replace(/\D/g, '') || null, 
      resp_emp_rg: lead.resp_emp_rg,
      resp_emp_whatsapp: lead.resp_emp_whatsapp?.replace(/\D/g, '') || null, 
      resp_emp_phone: lead.resp_emp_phone?.replace(/\D/g, '') || null,
      resp_emp_email: lead.resp_emp_email,
      resp_con_name: lead.resp_con_name, 
      resp_con_job: lead.resp_con_job, 
      resp_con_birth_date: lead.resp_con_birth_date || null,
      resp_con_marital_status: lead.resp_con_marital_status, 
      resp_con_marriage_date: lead.resp_con_marriage_date || null,
      resp_con_cpf: lead.resp_con_cpf?.replace(/\D/g, '') || null, 
      resp_con_rg: lead.resp_con_rg,
      resp_con_whatsapp: lead.resp_con_whatsapp?.replace(/\D/g, '') || null, 
      resp_con_phone: lead.resp_con_phone?.replace(/\D/g, '') || null,
      resp_con_email: lead.resp_con_email,
      temperature: lead.temperature || 'Morno',
      interaction_status: lead.interaction_status || 'Sem Status'
    };

    let result;
    if (lead.id) {
      result = await supabase.from('leads').update(updates).eq('id', lead.id);
    } else {
      result = await supabase.from('leads').insert([updates]);
    }

    setIsSaving(false);
    if (!result.error) { 
      success(lead.id ? "Lead atualizado!" : "Oportunidade cadastrada!"); 
      onUpdate(); 
      onClose(); 
    } else { 
      showError("Erro ao salvar: " + result.error.message); 
    }
  };

  const handleDelete = async () => { if (window.confirm(`Excluir permanentemente "${lead.name}"?`)) { await supabase.from('leads').delete().eq('id', lead.id); onUpdate(); onClose(); } };

  if (!isOpen || !lead) return null;

  return (
    <div className="fixed inset-0 z-[200] overflow-hidden">
      <div onClick={onClose} className="absolute inset-0 bg-slate-900/95 backdrop-blur-md" />
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} className="absolute right-0 top-0 h-[100dvh] w-full max-w-3xl bg-white shadow-2xl flex flex-col">
        
        {/* Header Premium */}
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-xl", lead.lead_type === 'PJ' ? "bg-indigo-600 shadow-indigo-100" : "bg-blue-600 shadow-blue-100")}>
              {(lead.name || "?").substring(0,1).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 leading-tight">{lead.id ? (lead.name || "Sem Nome") : "Nova Oportunidade"}</h2>
              <div className="flex items-center gap-2 mt-1">
                 <span className="px-2 py-0.5 bg-blue-100 text-blue-600 rounded text-[9px] font-black uppercase tracking-tighter">{lead.lead_type || 'PF'}</span>
                 <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{stages.find(s => s.name === lead.status)?.label || lead.status}</span>
                 <div className="relative">
                    <select 
                      value={lead.interaction_status || 'Sem Status'}
                      onChange={(e) => setLead({ ...lead, interaction_status: e.target.value })}
                      className={cn(
                        "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border-0 cursor-pointer outline-none transition-all appearance-none text-center",
                        getStatusColor(lead.interaction_status || 'Sem Status')
                      )}
                    >
                      {interactionStatuses.filter((s: any) => s.active).map((opt: any) => (
                        <option key={opt.id} value={opt.name} className="bg-white text-slate-900 uppercase font-bold text-[10px]">{opt.name}</option>
                      ))}
                    </select>
                  </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {lead.id && (
              <button onClick={handleDelete} title="Excluir Lead" className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-all"><Icons.Trash className="w-5 h-5"/></button>
            )}
            <button onClick={handleSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl text-sm font-black shadow-lg shadow-blue-200 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2 uppercase tracking-widest">
               {isSaving ? <Icons.Loader2 className="w-4 h-4 animate-spin" /> : <Icons.CheckCircle className="w-4 h-4" />}
               {isSaving ? "Salvando..." : "Salvar Oportunidade"}
            </button>
            <button onClick={onClose} className="p-2 text-slate-300 hover:text-slate-600 transition-colors"><Icons.X className="w-6 h-6"/></button>
          </div>
        </div>

        {/* Navigation Tabs Premium */}
        <div className="flex px-8 border-b border-slate-100 bg-white shadow-sm z-10 shrink-0">
          <button onClick={() => setActiveTab('details')} className={cn("px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] transition-all border-b-2", activeTab === 'details' ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400")}>Ficha Detalhada</button>
          <button onClick={() => setActiveTab('chat')} className={cn("px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] transition-all border-b-2", activeTab === 'chat' ? "border-green-500 text-green-600" : "border-transparent text-slate-400")}>WhatsApp Chat</button>
          <button onClick={() => setActiveTab('history')} className={cn("px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] transition-all border-b-2", activeTab === 'history' ? "border-amber-500 text-amber-600" : "border-transparent text-slate-400")}>Linha do Tempo</button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto relative bg-slate-50 custom-scrollbar">
          {activeTab === 'details' ? (
            <div className="p-8 space-y-10 bg-white pb-24">
               {/* Identificação */}
               <section>
                  <SectionHeader icon={Icons.Users} title="Identificação do Lead" colorClass="bg-blue-50 text-blue-600" />
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    <div>
                      <DetailField 
                        label="Categoria / Perfil" 
                        value={lead.lead_type || 'PF'} 
                        selectOptions={[{ value: 'PF', label: 'Pessoa Física (PF)' }, { value: 'PJ', label: 'Corporativo (PME)' }]} 
                        onChange={(v:any) => setLead({...lead, lead_type: v})} 
                      />
                    </div>
                    <div className="md:col-span-2">
                       <DetailField label={lead.lead_type === 'PJ' ? "Razão Social" : "Nome Completo"} value={lead.name} onChange={(v:any) => setLead({...lead, name: v, company_name: lead.lead_type === 'PJ' ? v : lead.company_name})} />
                    </div>
                    <DetailField label="Apelido / Fantasia" value={lead.nickname} onChange={(v:any) => setLead({...lead, nickname: v})} />
                    <DetailField label={lead.lead_type === 'PJ' ? "CNPJ" : "CPF"} value={lead.lead_type === 'PJ' ? lead.cnpj : lead.cpf} mask={lead.lead_type === 'PJ' ? formatCNPJ : formatCPF} onChange={(v:any) => setLead({...lead, [lead.lead_type === 'PJ' ? 'cnpj' : 'cpf']: v})} />
                    <DetailField label="RG" value={lead.rg} onChange={(v:any) => setLead({...lead, rg: v})} />
                    <DetailField label="Status Fluxo" value={lead.status} selectOptions={stages.map(s => ({ value: s.name, label: s.label }))} onChange={(v:any) => setLead({...lead, status: v})} />
                    <DetailField label="Data Nascimento" type="date" value={lead.birth_date} onChange={(v:any) => setLead({...lead, birth_date: v})} />
                    <DetailField label="Estado Civil" value={lead.marital_status} selectOptions={['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União Estável']} onChange={(v:any) => setLead({...lead, marital_status: v})} />
                    <DetailField label="Data Casamento" type="date" value={lead.marriage_date} onChange={(v:any) => setLead({...lead, marriage_date: v})} />
                    <DetailField 
                      label="Temperatura" 
                      value={lead.temperature || 'Morno'} 
                      selectOptions={['Muito quente', 'Quente', 'Morno', 'Frio', 'Congelado']} 
                      onChange={(v:any) => setLead({...lead, temperature: v})} 
                    />
                  </div>
               </section>

               {/* Contato & Localização */}
               <section className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <SectionHeader icon={Icons.Phone} title="Canais de Contato" colorClass="bg-green-50 text-green-600" />
                    <div className="space-y-5">
                       <DetailField label="WhatsApp Principal" value={lead.phone} mask={formatPhone} onChange={(v:any) => setLead({...lead, phone: v})} />
                       <DetailField label="E-mail" value={lead.email} onChange={(v:any) => setLead({...lead, email: v})} />
                       <DetailField label="Tipo de Contato" value={lead.contact_type} selectOptions={contactTypes.map((t:any) => t.name)} onChange={(v:any) => setLead({...lead, contact_type: v})} />
                    </div>
                  </div>
                  <div className="space-y-6">
                    <SectionHeader icon={Icons.MapPin} title="Localização" colorClass="bg-orange-50 text-orange-600" />
                    <div className="grid grid-cols-2 gap-4">
                       <div className="col-span-2"><DetailField label="CEP" value={lead.address_zip} mask={formatCEP} onChange={(v:any) => setLead({...lead, address_zip: v})} /></div>
                       <div className="col-span-2"><DetailField label="Logradouro" value={lead.address_street} onChange={(v:any) => setLead({...lead, address_street: v})} /></div>
                       <DetailField label="Número" value={lead.address_number} onChange={(v:any) => setLead({...lead, address_number: v})} />
                       <DetailField label="Bairro" value={lead.address_neighborhood} onChange={(v:any) => setLead({...lead, address_neighborhood: v})} />
                       <DetailField label="Cidade" value={lead.address_city} onChange={(v:any) => setLead({...lead, address_city: v})} />
                       <DetailField label="UF" value={lead.address_state} onChange={(v:any) => setLead({...lead, address_state: v})} />
                    </div>
                  </div>
               </section>

               {/* Responsáveis (Apenas PME) */}
               {lead.lead_type === 'PJ' && (
                 <section className="space-y-10">
                    <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100">
                       <SectionHeader icon={Icons.Building2} title="Responsável pela Empresa" colorClass="bg-indigo-100 text-indigo-700" />
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                          <div className="md:col-span-2"><DetailField label="Nome Completo" value={lead.resp_emp_name} onChange={(v:any) => setLead({...lead, resp_emp_name: v})} /></div>
                          <DetailField label="Cargo" value={lead.resp_emp_job} onChange={(v:any) => setLead({...lead, resp_emp_job: v})} />
                          <DetailField label="CPF" value={lead.resp_emp_cpf} mask={formatCPF} onChange={(v:any) => setLead({...lead, resp_emp_cpf: v})} />
                          <DetailField label="WhatsApp" value={lead.resp_emp_whatsapp} mask={formatPhone} onChange={(v:any) => setLead({...lead, resp_emp_whatsapp: v})} />
                          <DetailField label="E-mail" value={lead.resp_emp_email} onChange={(v:any) => setLead({...lead, resp_emp_email: v})} />
                       </div>
                    </div>
                    <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100">
                       <SectionHeader icon={Icons.FileText} title="Responsável pelo Contrato" colorClass="bg-emerald-100 text-emerald-700" />
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                          <div className="md:col-span-2"><DetailField label="Nome Completo" value={lead.resp_con_name} onChange={(v:any) => setLead({...lead, resp_con_name: v})} /></div>
                          <DetailField label="Cargo" value={lead.resp_con_job} onChange={(v:any) => setLead({...lead, resp_con_job: v})} />
                          <DetailField label="CPF" value={lead.resp_con_cpf} mask={formatCPF} onChange={(v:any) => setLead({...lead, resp_con_cpf: v})} />
                          <DetailField label="WhatsApp" value={lead.resp_con_whatsapp} mask={formatPhone} onChange={(v:any) => setLead({...lead, resp_con_whatsapp: v})} />
                          <DetailField label="E-mail" value={lead.resp_con_email} onChange={(v:any) => setLead({...lead, resp_con_email: v})} />
                       </div>
                    </div>
                 </section>
               )}

               {/* Plano Atual & Proposta */}
               <section className="space-y-10">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100">
                       <SectionHeader icon={Icons.Target} title="Plano Atual" colorClass="bg-amber-100 text-amber-700" />
                       <div className="space-y-6">
                          <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Possui plano atualmente?</label>
                            <div className="flex gap-2">
                               <button onClick={() => setLead({...lead, has_current_plan: true})} className={cn("flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 transition-all", lead.has_current_plan ? "bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-100" : "bg-white border-slate-200 text-slate-400")}>Sim</button>
                               <button onClick={() => setLead({...lead, has_current_plan: false})} className={cn("flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 transition-all", !lead.has_current_plan ? "bg-slate-800 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-400")}>Não</button>
                            </div>
                          </div>
                          
                          {lead.has_current_plan && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 pt-4 border-t border-slate-200">
                               <DetailField label="Operadora Atual" value={lead.current_carrier} onChange={(v:any) => setLead({...lead, current_carrier: v})} />
                               <DetailField label="Produto Atual" value={lead.current_product} onChange={(v:any) => setLead({...lead, current_product: v})} />
                               <div className="grid grid-cols-2 gap-4">
                                  <DetailField label="Vidas" type="number" value={lead.current_lives} onChange={(v:any) => setLead({...lead, current_lives: Number(v)})} />
                                  <DetailField 
                                    label="Valor Atual" 
                                    value={lead.current_value ? Math.round(lead.current_value * 100).toString() : ""} 
                                    mask={formatCurrencyValue}
                                    onChange={(v:any) => setLead({...lead, current_value: parseCurrencyValue(v)})} 
                                    placeholder="R$ 0,00"
                                  />
                               </div>
                               <div className="grid grid-cols-2 gap-4">
                                  <DetailField label="Vencimento Contrato" type="date" value={lead.contract_expiry_date} onChange={(v:any) => setLead({...lead, contract_expiry_date: v})} />
                                  <div className="space-y-2">
                                     <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Tem Corretor?</label>
                                     <div className="flex gap-2">
                                        <button onClick={() => setLead({...lead, has_broker: true})} className={cn("flex-1 py-2 rounded-xl text-[9px] font-black uppercase border-2 transition-all", lead.has_broker ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100" : "bg-white border-slate-200 text-slate-400 text-[8px]")}>Sim</button>
                                        <button onClick={() => setLead({...lead, has_broker: false})} className={cn("flex-1 py-2 rounded-xl text-[9px] font-black uppercase border-2 transition-all", lead.has_broker === false ? "bg-slate-700 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-400 text-[8px]")}>Não</button>
                                     </div>
                                  </div>
                               </div>
                            </motion.div>
                          )}
                       </div>
                    </div>
                    <div className="p-8 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
                       <SectionHeader icon={Icons.FileText} title="Proposta Solicitada" colorClass="bg-blue-50 text-blue-600" />
                       <div className="space-y-5">
                          <div className="space-y-2">
                             <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Tipo de Plano</label>
                             <div className="flex gap-2">
                               {['Saúde', 'Odonto', 'Saúde + Odonto'].map(t => (
                                 <button key={t} onClick={() => setLead({...lead, plan_type: t})} className={cn("flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter border-2 transition-all", lead.plan_type === t ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100" : "bg-slate-50 border-transparent text-slate-400")}>{t}</button>
                               ))}
                             </div>
                          </div>
                          <DetailField label="Operadora Proposta" value={lead.carrier} selectOptions={carriers} onChange={(v:any) => setLead({...lead, carrier: v, product: ''})} />
                          <DetailField label="Produto Proposta" value={lead.product} onChange={(v:any) => setLead({...lead, product: v})} placeholder="Ex: Produto Saúde Master" />
                          <div className="grid grid-cols-2 gap-4">
                             <DetailField label="Interesse (Vidas)" type="number" value={lead.interested_lives} onChange={(v:any) => setLead({...lead, interested_lives: Number(v)})} />
                             <DetailField 
                               label="Valor Proposta" 
                               value={lead.deal_value ? Math.round(lead.deal_value * 100).toString() : ""} 
                               mask={formatCurrencyValue}
                               onChange={(v:any) => setLead({...lead, deal_value: parseCurrencyValue(v)})} 
                               placeholder="R$ 0,00"
                             />
                          </div>
                       </div>
                    </div>
                  </div>
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <DetailField label="Link Documentação (Drive/Dropbox)" value={lead.docs_link} onChange={(v:any) => setLead({...lead, docs_link: v})} placeholder="https://..." />
                    </div>
                    {lead.docs_link && (
                      <button 
                        onClick={() => window.open(lead.docs_link.startsWith('http') ? lead.docs_link : `https://${lead.docs_link}`, '_blank')}
                        className="mb-1 p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm flex items-center gap-2 group"
                      >
                        <Icons.ExternalLink className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest hidden group-hover:block transition-all">Abrir Pasta</span>
                      </button>
                    )}
                  </div>
               </section>

               {/* Ações Rápidas: Notas & Lembretes */}
               <section className="pt-10 border-t border-slate-100 grid grid-cols-1 lg:grid-cols-2 gap-10">
                  {/* Bloco de Notas */}
                  <div className="space-y-6">
                    <SectionHeader icon={Icons.FileText} title="Nova Anotação" colorClass="bg-blue-50 text-blue-600" />
                    <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                      <textarea
                        value={noteContent}
                        onChange={e => setNoteContent(e.target.value)}
                        placeholder="Digite aqui uma observação importante sobre o lead..."
                        className="w-full bg-white border border-slate-100 rounded-2xl px-6 py-4 text-sm font-medium text-slate-700 outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all min-h-[120px] resize-none"
                      />
                      <button 
                        onClick={handleAddNote}
                        disabled={isSavingNote || !noteContent.trim()}
                        className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                      >
                        {isSavingNote ? <Icons.Loader2 className="w-4 h-4 animate-spin" /> : <Icons.Check className="w-4 h-4" />}
                        Salvar Nota no Histórico
                      </button>
                    </div>
                  </div>

                  {/* Bloco de Lembretes */}
                  <div className="space-y-6">
                    <SectionHeader icon={Icons.Bell} title="Agendar Follow-up" colorClass="bg-amber-50 text-amber-600" />
                    <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                      <input 
                        type="text" 
                        value={reminderTitle}
                        onChange={e => setReminderTitle(e.target.value)}
                        placeholder="O que precisa ser feito?"
                        className="w-full bg-white border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-amber-500"
                      />
                      <div className="flex gap-2">
                        <input 
                          type="date" 
                          value={reminderDate}
                          onChange={e => setReminderDate(e.target.value)}
                          className="flex-1 bg-white border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-amber-500"
                        />
                        <button 
                          onClick={() => handleAddReminder()}
                          disabled={isSavingReminder || !reminderDate}
                          className="px-6 bg-amber-500 text-white rounded-xl font-bold text-xs uppercase shadow-lg shadow-amber-100 hover:bg-amber-600"
                        >
                          OK
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <button onClick={() => handleAddReminder(1)} className="py-2.5 bg-white border border-slate-100 rounded-xl text-[9px] font-black uppercase text-slate-400 hover:border-amber-500 hover:text-amber-500 transition-all">+1 Dia</button>
                        <button onClick={() => handleAddReminder(3)} className="py-2.5 bg-white border border-slate-100 rounded-xl text-[9px] font-black uppercase text-slate-400 hover:border-amber-500 hover:text-amber-500 transition-all">+3 Dias</button>
                        <button onClick={() => handleAddReminder(7)} className="py-2.5 bg-white border border-slate-100 rounded-xl text-[9px] font-black uppercase text-slate-400 hover:border-amber-500 hover:text-amber-500 transition-all">+7 Dias</button>
                      </div>
                    </div>
                  </div>
               </section>
            </div>
          ) : activeTab === 'chat' ? (
            <div className="h-full flex flex-col bg-[#efe7de]">
               <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 flex flex-col custom-scrollbar scroll-smooth">
                  {messages.map((msg, idx) => (
                    <div key={msg.id || idx} className={cn("max-w-[85%] p-3 rounded-2xl text-sm shadow-sm relative animate-in fade-in slide-in-from-bottom-2 duration-300", 
                      msg.fromMe ? "bg-[#dcf8c6] self-end rounded-tr-none" : "bg-white self-start rounded-tl-none border border-black/5"
                    )}>
                       {!msg.fromMe && !msg.is_read && <div className="absolute -left-2 top-0 w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm ring-2 ring-white animate-pulse" />}
                       <MediaMessage msg={msg} />
                       <p className="text-[9px] text-slate-400 text-right mt-1 font-bold opacity-70">
                         {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ""}
                       </p>
                    </div>
                  ))}
                  {loadingChat && <div className="mx-auto bg-white/90 px-4 py-1.5 rounded-full text-[10px] font-black text-slate-400 uppercase shadow-sm">Buscando mensagens...</div>}
               </div>
               <div className="bg-[#f0f0f0] p-4 flex flex-col gap-3 border-t border-black/5">
                  <div className="flex bg-white rounded-2xl items-center px-4 py-1 shadow-sm border border-black/5">
                    <textarea rows={1} value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} placeholder="Sua mensagem..." className="flex-1 bg-transparent border-none py-3 text-sm focus:ring-0 outline-none resize-none font-medium h-12 flex items-center" />
                    <div className="flex items-center gap-0.5">
                       <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
                       <button onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-blue-600 transition-colors rounded-full hover:bg-slate-50"><Icons.Paperclip className="w-5 h-5"/></button>
                       <button onClick={handleSendMessage} disabled={!newMessage.trim()} className="p-2 text-[#00a884] hover:scale-110 active:scale-95 transition-all disabled:opacity-30 disabled:scale-100"><Icons.CheckCircle className="w-6 h-6"/></button>
                    </div>
                  </div>
               </div>
            </div>
          ) : (
            /* Linha do Tempo / Histórico */
            <div className="p-8 space-y-6">
                <SectionHeader icon={Icons.History} title="Histórico de Atividades" colorClass="bg-amber-50 text-amber-600" />
                <div className="space-y-4">
                  {history.length > 0 ? history.map(h => {
                    const isManualNote = h.content?.startsWith('[NOTA]');
                    const displayContent = isManualNote ? h.content.replace('[NOTA]', '').trim() : h.content;
                    
                    return (
                      <div key={h.id} className={cn(
                        "p-5 rounded-3xl border shadow-sm relative overflow-hidden group transition-all",
                        isManualNote ? "bg-blue-50 border-blue-100 ring-2 ring-blue-500/5 shadow-blue-100" : "bg-white border-slate-100"
                      )}>
                         <div className={cn(
                           "absolute left-0 top-0 bottom-0 w-1 opacity-20 group-hover:opacity-100 transition-opacity",
                           isManualNote ? "bg-blue-600" : "bg-amber-500"
                         )} />
                         <div className="flex justify-between items-start mb-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase leading-none">{new Date(h.created_at).toLocaleString('pt-BR')}</p>
                            {isManualNote && <span className="text-[8px] font-black uppercase bg-blue-600 text-white px-1.5 py-0.5 rounded tracking-tighter">Anotação Manual</span>}
                         </div>
                         <p className={cn(
                           "text-sm leading-relaxed",
                           isManualNote ? "text-blue-900 font-bold" : "text-slate-700 font-semibold"
                         )}>{displayContent}</p>
                      </div>
                    );
                  }) : (
                    <div className="py-20 text-center space-y-4">
                       <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-200"><Icons.History className="w-8 h-8"/></div>
                       <p className="text-sm text-slate-400 font-black uppercase tracking-widest italic">Nenhum evento registrado</p>
                    </div>
                  )}
                </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
