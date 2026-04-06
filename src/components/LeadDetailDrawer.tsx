import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icons } from "./Icons";
import { cn, formatCPF, formatPhone } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { useLeads } from "../lib/leadsContext";
import { evolutionService } from "../lib/evolution";

// Componente para renderizar mensagens com mídia (Imagem, PDF, etc)
const MediaMessage = ({ msg }: { msg: any }) => {
  const [mediaData, setMediaData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isImage = msg.media_type === 'image';
  const isDoc = msg.media_type === 'document';

  useEffect(() => {
    if ((isImage || isDoc) && msg.id && !msg.id.startsWith('temp-')) {
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

  if (isImage) {
    return (
      <div className="space-y-2">
        {loading ? (
          <div className="w-48 h-32 bg-slate-100 animate-pulse rounded-lg flex items-center justify-center">
            <Icons.Image className="w-6 h-6 text-slate-300" />
          </div>
        ) : mediaData ? (
          <img 
            src={`data:${msg.mimetype};base64,${mediaData}`} 
            alt="Anexo" 
            className="rounded-lg max-w-full cursor-pointer hover:brightness-95 transition-all shadow-sm"
            onClick={() => window.open(`data:${msg.mimetype};base64,${mediaData}`, '_blank')}
          />
        ) : (
          <div className="p-3 bg-slate-50 rounded-lg border border-dashed text-[10px] text-slate-400 text-center font-bold uppercase tracking-tighter">Mídia não disponível</div>
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

  return <p className="whitespace-pre-wrap text-slate-800 font-medium">{msg.text}</p>;
};

interface LeadDetailDrawerProps {
  lead: any;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export function LeadDetailDrawer({ lead: initialLead, isOpen, onClose, onUpdate }: LeadDetailDrawerProps) {
  const { stages } = useLeads();
  const [lead, setLead] = useState(initialLead);
  const [history, setHistory] = useState<any[]>([]);
  const [dependents, setDependents] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [newNote, setNewNote] = useState("");
  const [activeTab, setActiveTab] = useState<'details' | 'chat'>('details');
  const [loadingChat, setLoadingChat] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isAddingDependent, setIsAddingDependent] = useState(false);
  const [newDependent, setNewDependent] = useState({ name: '', type: 'Dependente', birth_date: '' });
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialLead) {
      setLead(initialLead);
      if (initialLead.id) {
        fetchHistory(initialLead.id);
        fetchDependents(initialLead.id);
      } else {
        setHistory([]);
        setDependents([]);
      }
      setActiveTab('details');
    }
  }, [initialLead]);

  const loadMessages = async () => {
    if (!lead?.phone || !lead?.id) return;
    setLoadingChat(true);
    try {
      const apiRes = await evolutionService.getMessages(lead.phone);
      const { data: localData } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: true });

      let rawApi = Array.isArray(apiRes) ? apiRes : (apiRes as any)?.messages || [];
      const normalizedApi = rawApi.map((m: any) => ({
        id: m.key?.id || `api-${Math.random()}`,
        fromMe: !!m.key?.fromMe,
        text: m.message?.conversation || m.message?.extendedTextMessage?.text || "",
        timestamp: m.messageTimestamp ? m.messageTimestamp * 1000 : Date.now(),
        source: 'api'
      }));

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
    if (!newMessage.trim() || !lead?.phone || !lead?.id) return;
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
    if (!file || !lead?.phone || !lead?.id) return;

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
    if (!lead?.name) return alert("O nome do lead é obrigatório");
    setIsSaving(true);
    
    const leadData = {
      name: lead.name, 
      email: lead.email || '', 
      phone: lead.phone || '', 
      status: lead.status || 'Novo',
      source: lead.source || 'Manual',
      deal_value: Number(lead.deal_value || 0),
      carrier: lead.carrier || 'Operadora não definida'
    };

    let result;
    try {
      if (lead?.id) {
        result = await supabase.from('leads').update(leadData).eq('id', lead.id);
      } else {
        result = await supabase.from('leads').insert([leadData]).select();
      }
      
      if (!result.error) {
        if (!lead?.id && result.data && result.data[0]) {
          setLead(result.data[0]);
        }
        onUpdate();
        onClose();
      } else {
        alert("Erro ao salvar: " + result.error.message);
      }
    } catch (e: any) {
      alert("Erro sistêmico ao salvar: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!lead?.id) return onClose();
    if (window.confirm(`Excluir permanentemente o lead "${lead.name}"?`)) {
      await supabase.from('leads').delete().eq('id', lead.id);
      onUpdate(); onClose();
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    if (!lead?.id) return alert("Salve o lead antes de adicionar uma nota.");
    
    setIsAddingNote(true);
    const { error } = await supabase.from('lead_history').insert([{ lead_id: lead.id, content: newNote }]);
    setIsAddingNote(false);
    if (!error) { 
      setNewNote(""); 
      fetchHistory(lead.id); 
    }
  };

  const handleAddDependent = async () => {
    if (!newDependent.name.trim() || !lead?.id) return;
    const { error } = await supabase.from('beneficiaries').insert([{ lead_id: lead.id, name: newDependent.name, type: newDependent.type }]);
    if (!error) { 
      setNewDependent({ name: '', type: 'Dependente', birth_date: '' }); 
      setIsAddingDependent(false); 
      fetchDependents(lead.id); 
    }
  };

  const handleRemoveDependent = async (id: string) => {
    await supabase.from('beneficiaries').delete().eq('id', id);
    fetchDependents(lead.id);
  };

  const renderedMessages = useMemo(() => {
    return messages.map((msg, idx) => (
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
    ));
  }, [messages]);

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
            {lead.id && <button onClick={handleDelete} className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-all"><Icons.Trash className="w-5 h-5"/></button>}
            <button onClick={handleSave} disabled={isSaving} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-md active:scale-95 disabled:opacity-50 transition-all">
               {isSaving ? "Salvando..." : "Salvar"}
            </button>
            <button onClick={onClose} className="p-2 text-slate-300 hover:text-slate-600 transition-colors"><Icons.X className="w-6 h-6"/></button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex px-8 border-b border-slate-100 bg-white">
          <button onClick={() => setActiveTab('details')} className={cn("px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] transition-all border-b-2", activeTab === 'details' ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400")}>Ficha do Lead</button>
          <button onClick={() => setActiveTab('chat')} className={cn("px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] transition-all border-b-2", activeTab === 'chat' ? "border-green-500 text-green-600" : "border-transparent text-slate-400")}>WhatsApp Chat</button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative bg-slate-50">
          {activeTab === 'details' ? (
            <div className="absolute inset-0 overflow-y-auto p-8 space-y-8 custom-scrollbar">
               <section className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-black/5 pb-2 text-slate-400 font-black uppercase text-[10px] tracking-widest"><Icons.Users className="w-3.5 h-3.5"/> Dados Basicos</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1"><label className="text-[9px] uppercase font-black text-slate-400 ml-1">Nome</label><input className="w-full bg-white border border-slate-200 p-3 rounded-xl text-sm outline-none focus:ring-2 ring-blue-100 transition-all font-medium" value={lead.name || ""} onChange={e => setLead({...lead, name: e.target.value})} /></div>
                    <div className="space-y-1"><label className="text-[9px] uppercase font-black text-slate-400 ml-1">Telefone</label><input className="w-full bg-white border border-slate-200 p-3 rounded-xl text-sm outline-none focus:ring-2 ring-blue-100 transition-all font-medium" value={lead.phone || ""} onChange={e => setLead({...lead, phone: e.target.value})} /></div>
                    <div className="space-y-1"><label className="text-[9px] uppercase font-black text-slate-400 ml-1">Email</label><input className="w-full bg-white border border-slate-200 p-3 rounded-xl text-sm outline-none focus:ring-2 ring-blue-100 transition-all font-medium" value={lead.email || ""} onChange={e => setLead({...lead, email: e.target.value})} /></div>
                    <div className="space-y-1"><label className="text-[9px] uppercase font-black text-slate-400 ml-1">Status</label>
                      <select className="w-full bg-white border border-slate-200 p-3 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 ring-blue-100 transition-all" value={String(lead.status || "")} onChange={e => setLead({...lead, status: e.target.value})}>
                        {(stages || []).map(s => <option key={s.id} value={s.name}>{s.label}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1"><label className="text-[9px] uppercase font-black text-slate-400 ml-1">Valor do Negócio</label><input type="number" className="w-full bg-white border border-slate-200 p-3 rounded-xl text-sm outline-none focus:ring-2 ring-blue-100 transition-all font-medium" value={lead.deal_value || 0} onChange={e => setLead({...lead, deal_value: e.target.value})} /></div>
                    <div className="space-y-1"><label className="text-[9px] uppercase font-black text-slate-400 ml-1">Operadora Sugerida</label><input className="w-full bg-white border border-slate-200 p-3 rounded-xl text-sm outline-none focus:ring-2 ring-blue-100 transition-all font-medium" value={lead.carrier || ""} onChange={e => setLead({...lead, carrier: e.target.value})} /></div>
                  </div>
               </section>

               <section className="space-y-4">
                  <div className="flex items-center justify-between border-b border-black/5 pb-2 text-slate-400 font-black uppercase text-[10px] tracking-widest">
                    <div className="flex items-center gap-2"><Icons.Users className="w-3.5 h-3.5"/> Dependentes</div>
                    <button onClick={() => setIsAddingDependent(!isAddingDependent)} className="text-[9px] text-blue-600 hover:underline">+ Adicionar</button>
                  </div>
                  
                  {isAddingDependent && (
                    <div className="bg-white p-4 rounded-2xl border border-blue-100 space-y-3 shadow-sm animate-in fade-in zoom-in-95">
                      <input className="w-full border border-slate-200 p-2.5 rounded-xl text-xs" placeholder="Nome do dependente" value={newDependent.name} onChange={e => setNewDependent({...newDependent, name: e.target.value})} />
                      <div className="flex gap-2">
                        <button onClick={handleAddDependent} className="flex-1 bg-blue-600 text-white p-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest">Salvar</button>
                        <button onClick={() => setIsAddingDependent(false)} className="px-4 bg-slate-100 text-slate-400 p-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest">Cancelar</button>
                      </div>
                    </div>
                  )}

                  <div className="grid gap-2">
                    {dependents.map(dep => (
                      <div key={dep.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-black/5">
                        <span className="text-xs font-bold text-slate-600">{dep.name}</span>
                        <button onClick={() => handleRemoveDependent(dep.id)} className="text-slate-300 hover:text-red-500"><Icons.Trash className="w-3.5 h-3.5"/></button>
                      </div>
                    ))}
                  </div>
               </section>

               <section className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-black/5 pb-2 text-slate-400 font-black uppercase text-[10px] tracking-widest"><Icons.History className="w-3.5 h-3.5"/> Historico / Notas</div>
                  
                  <div className="space-y-4">
                    <div className="relative">
                      <textarea 
                        value={newNote} 
                        onChange={e => setNewNote(e.target.value)} 
                        className="w-full bg-white border border-slate-200 p-4 rounded-2xl text-sm outline-none focus:ring-2 ring-blue-100 transition-all font-medium min-h-[100px] resize-none" 
                        placeholder="Adicionar nova nota ao histórico..." 
                      />
                      <button 
                        onClick={handleAddNote} 
                        disabled={isAddingNote || !newNote.trim()} 
                        className="absolute bottom-3 right-3 bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 disabled:opacity-30 transition-all"
                      >
                        {isAddingNote ? "Enviando..." : "Registrar"}
                      </button>
                    </div>

                    <div className="space-y-3 pb-20">
                      {history.map(h => (
                        <div key={h.id} className="p-5 bg-white rounded-2xl border border-black/5 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start mb-2">
                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none">{new Date(h.created_at).toLocaleString('pt-BR')}</p>
                          </div>
                          <p className="text-sm text-slate-600 font-medium whitespace-pre-wrap">{h.content}</p>
                        </div>
                      ))}
                      {history.length === 0 && <p className="text-center py-10 text-[10px] font-black text-slate-300 uppercase tracking-widest">Nenhuma nota registrada</p>}
                    </div>
                  </div>
               </section>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col bg-[#efe7de]">
               {/* Messages Container */}
               <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 flex flex-col custom-scrollbar scroll-smooth">
                  {renderedMessages}
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
