import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icons } from "./Icons";
import { cn, formatCPF, formatPhone } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { useLeads } from "../lib/leadsContext";
import { evolutionService } from "../lib/evolution";
import { useToast } from "./Toasts";

// Componente para renderizar mensagens com mídia (Imagem, PDF, Áudio, etc)
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
    }
  }, [msg.id, msg.media_type]);

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
        {msg.text && <p className="whitespace-pre-wrap text-slate-800 font-medium">{msg.text}</p>}
      </div>
    );
  }

  return <p className="whitespace-pre-wrap text-slate-800 font-medium">{msg.text || "[Mídia/Outro]"}</p>;
};

interface LeadDetailDrawerProps {
  lead: any;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedLead?: any) => void;
}

export function LeadDetailDrawer({ lead: initialLead, isOpen, onClose, onUpdate }: LeadDetailDrawerProps) {
  const { stages, jobTitles } = useLeads();
  const { success, error: showError } = useToast();
  const [lead, setLead] = useState(initialLead);
  const [history, setHistory] = useState<any[]>([]);
  const [dependents, setDependents] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [activeTab, setActiveTab] = useState<'details' | 'chat'>('details');
  const [loadingChat, setLoadingChat] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialLead) {
      setLead(initialLead);
      fetchHistory(initialLead.id);
      fetchDependents(initialLead.id);
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

      let rawApi = Array.isArray(apiRes) ? apiRes : (apiRes as any)?.messages || [];
      const normalizedApi = rawApi.map((m: any) => {
        const msg = m.message || {};
        let text = msg.conversation || msg.extendedTextMessage?.text || "";
        let mediaType = undefined;
        let mimetype = undefined;
        let fileName = undefined;

        if (msg.imageMessage) {
          mediaType = 'image';
          mimetype = msg.imageMessage.mimetype;
          text = msg.imageMessage.caption || "";
        } else if (msg.audioMessage) {
          mediaType = 'audio';
          mimetype = msg.audioMessage.mimetype;
        } else if (msg.videoMessage) {
          mediaType = 'video';
          mimetype = msg.videoMessage.mimetype;
          text = msg.videoMessage.caption || "";
        } else if (msg.documentMessage) {
          mediaType = 'document';
          mimetype = msg.documentMessage.mimetype;
          fileName = msg.documentMessage.fileName || msg.documentMessage.title;
          text = msg.documentMessage.caption || "";
        } else if (msg.stickerMessage) {
          mediaType = 'sticker';
          mimetype = msg.stickerMessage.mimetype;
        }

        return {
          id: m.key?.id || `api-${Math.random()}`,
          fromMe: !!m.key?.fromMe,
          text,
          timestamp: m.messageTimestamp ? m.messageTimestamp * 1000 : Date.now(),
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
         await supabase
           .from('whatsapp_messages')
           .update({ is_read: true })
           .eq('lead_id', lead.id)
           .eq('is_from_me', false)
           .eq('is_read', false);
       };
       markRead();

       const channel = supabase
         .channel(`chat-${lead.id}`)
         .on('postgres_changes', { 
           event: 'INSERT', 
           schema: 'public', 
           table: 'whatsapp_messages', 
           filter: `lead_id=eq.${lead.id}` 
         }, (payload) => {
           const n = payload.new;
           setMessages(prev => {
             if (prev.find(m => m.id === n.message_id)) return prev;
             return [...prev, {
               id: n.message_id,
               fromMe: n.is_from_me,
               text: n.message_body,
               timestamp: new Date(n.created_at).getTime(),
               media_type: n.media_type,
               mimetype: n.mimetype,
               file_name: n.file_name,
               is_read: true,
               source: 'realtime'
             }].sort((a,b) => a.timestamp - b.timestamp);
           });
           markRead();
         })
         .subscribe();
       
       return () => { supabase.removeChannel(channel); };
    }
  }, [activeTab, lead?.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !lead?.phone) return;
    const txt = newMessage;
    setNewMessage("");
    const tempId = `temp-${Date.now()}`;

    setMessages(prev => [...prev, { id: tempId, fromMe: true, text: txt, timestamp: Date.now(), status: 'sending' }]);

    try {
      const res = await evolutionService.sendMessage(lead.phone, txt);
      if (res && res.key?.id) {
        await supabase.from('whatsapp_messages').upsert({
          lead_id: lead.id,
          message_id: res.key.id,
          sender_number: lead.phone.replace(/\D/g, ''),
          message_body: txt,
          is_from_me: true,
          is_read: true,
          created_at: new Date().toISOString()
        }, { onConflict: 'message_id' });
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: res.key.id, status: 'sent' } : m));
      }
    } catch (e) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      alert("Falha ao enviar mensagem.");
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !lead?.phone) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const b64 = ev.target?.result as string;
      const type = file.type.startsWith('image/') ? 'image' : 'document';
      const tempId = `temp-${Date.now()}`;

      setMessages(prev => [...prev, { 
        id: tempId, fromMe: true, text: file.name, timestamp: Date.now(), 
        media_type: type, mimetype: file.type, file_name: file.name, status: 'sending' 
      }]);

      try {
        const res = await evolutionService.sendMedia(lead.phone, b64, type, file.type, file.name);
        if (res && res.key?.id) {
          await supabase.from('whatsapp_messages').upsert({
            lead_id: lead.id,
            message_id: res.key.id,
            sender_number: lead.phone.replace(/\D/g, ''),
            message_body: file.name,
            is_from_me: true,
            is_read: true,
            created_at: new Date().toISOString(),
            media_type: type,
            mimetype: file.type,
            file_name: file.name
          }, { onConflict: 'message_id' });
          setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: res.key.id, status: 'sent' } : m));
        }
      } catch (e) {
        setMessages(prev => prev.filter(m => m.id !== tempId));
        alert("Erro ao anexar arquivo.");
      }
    };
    reader.readAsDataURL(file);
  };

  const fetchHistory = async (id: string) => {
    const { data } = await supabase.from('lead_history').select('*').eq('lead_id', id).order('created_at', { ascending: false });
    setHistory(data || []);
  };

  const fetchDependents = async (id: string) => {
    const { data } = await supabase.from('beneficiaries').select('*').eq('lead_id', id);
    setDependents(data || []);
  };

  const handleSave = async () => {
    setIsSaving(true);
    const { error: err } = await supabase.from('leads').update({ 
      name: lead.name, 
      email: lead.email, 
      phone: lead.phone, 
      status: lead.status,
      nickname: lead.nickname,
      lead_type: lead.lead_type,
      company_name: lead.company_name,
      contact_person: lead.contact_person,
      job_title: lead.job_title,
      birth_date: lead.birth_date || null,
      marriage_date: lead.marriage_date || null,
      rg: lead.rg,
      cnpj: lead.cnpj,
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
      docs_link: lead.docs_link
    }).eq('id', lead.id);
    
    setIsSaving(false);
    if (!err) {
      success("Lead atualizado!");
      onUpdate(); onClose();
    } else {
      showError("Erro ao salvar: " + err.message);
    }
  };

  const handleDelete = async () => {
    if (window.confirm(`Excluir permanentemente o lead "${lead.name}"?`)) {
      await supabase.from('leads').delete().eq('id', lead.id);
      onUpdate(); onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden">
      <div onClick={onClose} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} className="absolute right-0 top-0 h-[100dvh] w-full max-w-2xl bg-white shadow-2xl flex flex-col">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white text-xl font-bold shadow-lg">
              {(lead.name || "N").substring(0,1).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-black text-blue-900 leading-tight">{lead.name || "Sem Nome"}</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{lead.status || "Novo"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleDelete} title="Excluir Lead" className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-all"><Icons.Trash className="w-5 h-5"/></button>
            <button onClick={handleSave} disabled={isSaving} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-md active:scale-95 disabled:opacity-50 transition-all">
               {isSaving ? "Salvando..." : "Salvar"}
            </button>
            <button onClick={onClose} className="p-2 text-slate-300 hover:text-slate-600 transition-colors"><Icons.X className="w-6 h-6"/></button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex px-8 border-b border-slate-100 bg-white shadow-sm z-10">
          <button onClick={() => setActiveTab('details')} className={cn("px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] transition-all border-b-2", activeTab === 'details' ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400")}>Ficha do Lead</button>
          <button onClick={() => setActiveTab('chat')} className={cn("px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] transition-all border-b-2", activeTab === 'chat' ? "border-green-500 text-green-600" : "border-transparent text-slate-400")}>WhatsApp Chat</button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative bg-slate-50">
          {activeTab === 'details' ? (
            <div className="absolute inset-0 overflow-y-auto p-8 space-y-8 custom-scrollbar bg-white">
               {/* Tipo de Lead e Identificação */}
               <section className="space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-2 text-slate-400 font-black uppercase text-[10px] tracking-widest">
                       {lead.lead_type === 'PJ' ? <Icons.Building2 className="w-4 h-4 text-blue-600"/> : <Icons.Users className="w-4 h-4 text-blue-600"/>}
                       Identificação ({lead.lead_type || 'PF'})
                    </div>
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                      <button 
                        onClick={() => setLead({...lead, lead_type: 'PF'})}
                        className={cn("px-3 py-1 text-[9px] font-black uppercase rounded-md transition-all", lead.lead_type === 'PF' || !lead.lead_type ? "bg-white text-blue-600 shadow-sm" : "text-slate-400")}
                      >PF</button>
                      <button 
                        onClick={() => setLead({...lead, lead_type: 'PJ'})}
                        className={cn("px-3 py-1 text-[9px] font-black uppercase rounded-md transition-all", lead.lead_type === 'PJ' ? "bg-white text-blue-600 shadow-sm" : "text-slate-400")}
                      >PJ</button>
                    </div>
                  </div>

                  {lead.lead_type === 'PJ' ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2 space-y-1">
                        <label className="text-[9px] uppercase font-black text-slate-400 ml-1">Razão Social</label>
                        <input className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-blue-500 transition-all" value={lead.company_name || ""} onChange={e => setLead({...lead, company_name: e.target.value, name: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-black text-slate-400 ml-1">CNPJ</label>
                        <input className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold outline-none" value={lead.cnpj || ""} onChange={e => setLead({...lead, cnpj: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-black text-slate-400 ml-1">Nome Fantasia / Apelido</label>
                        <input className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold outline-none" value={lead.nickname || ""} onChange={e => setLead({...lead, nickname: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-black text-slate-400 ml-1">Responsável</label>
                        <input className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold outline-none" value={lead.contact_person || ""} onChange={e => setLead({...lead, contact_person: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-black text-slate-400 ml-1">Cargo</label>
                        <select 
                          className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold text-slate-700 outline-none" 
                          value={lead.job_title || ""} 
                          onChange={e => setLead({...lead, job_title: e.target.value})}
                        >
                          <option value="">Selecione...</option>
                          {jobTitles.map((jt:any) => <option key={jt.id} value={jt.name}>{jt.name}</option>)}
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2 space-y-1">
                        <label className="text-[9px] uppercase font-black text-slate-400 ml-1">Nome Completo</label>
                        <input className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold outline-none" value={lead.name || ""} onChange={e => setLead({...lead, name: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-black text-slate-400 ml-1">RG</label>
                        <input className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold outline-none" value={lead.rg || ""} onChange={e => setLead({...lead, rg: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-black text-slate-400 ml-1">Status</label>
                        <select className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold text-slate-700 outline-none capitalize" value={lead.status || ""} onChange={e => setLead({...lead, status: e.target.value})}>
                          {stages.map(s => <option key={s.id} value={s.name}>{s.label}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-black text-slate-400 ml-1">Data Nascimento</label>
                        <input type="date" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold outline-none" value={lead.birth_date || ""} onChange={e => setLead({...lead, birth_date: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-black text-slate-400 ml-1">Data Casamento</label>
                        <input type="date" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold outline-none" value={lead.marriage_date || ""} onChange={e => setLead({...lead, marriage_date: e.target.value})} />
                      </div>
                    </div>
                  )}
               </section>

               {/* Contato Principal */}
               <section className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-black/5 pb-2 text-slate-400 font-black uppercase text-[10px] tracking-widest"><Icons.Phone className="w-3.5 h-3.5"/> Contato</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1"><label className="text-[9px] uppercase font-black text-slate-400 ml-1">WhatsApp / Telefone</label><input className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold outline-none" value={lead.phone || ""} onChange={e => setLead({...lead, phone: e.target.value})} /></div>
                    <div className="space-y-1"><label className="text-[9px] uppercase font-black text-slate-400 ml-1">E-mail</label><input className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold outline-none" value={lead.email || ""} onChange={e => setLead({...lead, email: e.target.value})} /></div>
                  </div>
               </section>

               {/* Localização */}
               <section className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-black/5 pb-2 text-slate-400 font-black uppercase text-[10px] tracking-widest"><Icons.MapPin className="w-3.5 h-3.5"/> Endereço</div>
                  <div className="grid grid-cols-6 gap-4">
                    <div className="col-span-2 space-y-1"><label className="text-[9px] uppercase font-black text-slate-400 ml-1">CEP</label><input className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold outline-none" value={lead.address_zip || ""} onChange={e => setLead({...lead, address_zip: e.target.value})} /></div>
                    <div className="col-span-4 space-y-1"><label className="text-[9px] uppercase font-black text-slate-400 ml-1">Logradouro</label><input className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold outline-none" value={lead.address_street || ""} onChange={e => setLead({...lead, address_street: e.target.value})} /></div>
                    <div className="col-span-2 space-y-1"><label className="text-[9px] uppercase font-black text-slate-400 ml-1">Número</label><input className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold outline-none" value={lead.address_number || ""} onChange={e => setLead({...lead, address_number: e.target.value})} /></div>
                    <div className="col-span-4 space-y-1"><label className="text-[9px] uppercase font-black text-slate-400 ml-1">Complemento</label><input className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold outline-none" value={lead.address_complement || ""} onChange={e => setLead({...lead, address_complement: e.target.value})} /></div>
                    <div className="col-span-3 space-y-1"><label className="text-[9px] uppercase font-black text-slate-400 ml-1">Bairro</label><input className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold outline-none" value={lead.address_neighborhood || ""} onChange={e => setLead({...lead, address_neighborhood: e.target.value})} /></div>
                    <div className="col-span-2 space-y-1"><label className="text-[9px] uppercase font-black text-slate-400 ml-1">Cidade</label><input className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold outline-none" value={lead.address_city || ""} onChange={e => setLead({...lead, address_city: e.target.value})} /></div>
                    <div className="col-span-1 space-y-1"><label className="text-[9px] uppercase font-black text-slate-400 ml-1">UF</label><input className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold outline-none text-center" value={lead.address_state || ""} onChange={e => setLead({...lead, address_state: e.target.value})} /></div>
                  </div>
               </section>

               {/* Plano Atual */}
               <section className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-black/5 pb-2 text-slate-400 font-black uppercase text-[10px] tracking-widest"><Icons.Target className="w-3.5 h-3.5"/> Plano Atual</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1"><label className="text-[9px] uppercase font-black text-slate-400 ml-1">Operadora Atual</label><input className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold outline-none" value={lead.current_carrier || ""} onChange={e => setLead({...lead, current_carrier: e.target.value})} /></div>
                    <div className="space-y-1"><label className="text-[9px] uppercase font-black text-slate-400 ml-1">Vidas Atuais</label><input type="number" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold outline-none" value={lead.current_lives || 0} onChange={e => setLead({...lead, current_lives: Number(e.target.value)})} /></div>
                    <div className="space-y-1"><label className="text-[9px] uppercase font-black text-slate-400 ml-1">Valor Atual</label><input type="number" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold outline-none" value={lead.current_value || 0} onChange={e => setLead({...lead, current_value: Number(e.target.value)})} /></div>
                    <div className="space-y-1"><label className="text-[9px] uppercase font-black text-slate-400 ml-1">Docs Link</label><input className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold outline-none text-blue-600 underline" placeholder="https://..." value={lead.docs_link || ""} onChange={e => setLead({...lead, docs_link: e.target.value})} /></div>
                  </div>
               </section>

               {/* Histórico */}
               <section className="space-y-4 pb-12">
                  <div className="flex items-center gap-2 border-b border-black/5 pb-2 text-slate-400 font-black uppercase text-[10px] tracking-widest"><Icons.History className="w-3.5 h-3.5"/> Histórico</div>
                  <div className="space-y-3">
                    {history.length > 0 ? history.map(h => (
                      <div key={h.id} className="p-4 bg-slate-50 rounded-2xl border border-black/5">
                        <p className="text-[10px] font-black text-slate-300 uppercase leading-none mb-1">{new Date(h.created_at).toLocaleString('pt-BR')}</p>
                        <p className="text-sm text-slate-600 font-medium">{h.content}</p>
                      </div>
                    )) : (
                      <p className="text-center py-4 text-xs text-slate-400 font-bold uppercase italic">Nenhum histórico registrado</p>
                    )}
                  </div>
               </section>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col bg-[#efe7de]">
               {/* Messages Container */}
               <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 flex flex-col custom-scrollbar scroll-smooth">
                  {messages.map((msg, idx) => (
                    <div key={msg.id || idx} className={cn(
                      "max-w-[85%] p-3 rounded-2xl text-sm shadow-sm relative animate-in fade-in slide-in-from-bottom-2 duration-300",
                      msg.fromMe ? "bg-[#dcf8c6] self-end rounded-tr-none" : "bg-white self-start rounded-tl-none border border-black/5"
                    )}>
                       {!msg.fromMe && !msg.is_read && (
                         <div className="absolute -left-2 top-0 w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm ring-2 ring-white animate-pulse" />
                       )}
                       <MediaMessage msg={msg} />
                       <p className="text-[9px] text-slate-400 text-right mt-1 font-bold opacity-70">
                         {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ""}
                       </p>
                    </div>
                  ))}
                  {loadingChat && <div className="mx-auto bg-white/90 px-4 py-1.5 rounded-full text-[10px] font-black text-slate-400 uppercase shadow-sm">Buscando mensagens...</div>}
               </div>

               {/* Toolbar & Input */}
               <div className="bg-[#f0f0f0] p-4 flex flex-col gap-3 border-t border-black/5">
                  <div className="flex bg-white rounded-2xl items-center px-4 py-1 shadow-sm border border-black/5">
                    <textarea 
                      rows={1} 
                      value={newMessage} 
                      onChange={e => setNewMessage(e.target.value)} 
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} 
                      placeholder="Sua mensagem..." 
                      className="flex-1 bg-transparent border-none py-3 text-sm focus:ring-0 outline-none resize-none font-medium h-12 flex items-center"
                    />
                    <div className="flex items-center gap-0.5">
                       <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
                       <button onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-blue-600 transition-colors rounded-full hover:bg-slate-50"><Icons.Paperclip className="w-5 h-5"/></button>
                       <button onClick={handleSendMessage} disabled={!newMessage.trim()} className="p-2 text-[#00a884] hover:scale-110 active:scale-95 transition-all disabled:opacity-30 disabled:scale-100"><Icons.CheckCircle className="w-6 h-6"/></button>
                    </div>
                  </div>
               </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
