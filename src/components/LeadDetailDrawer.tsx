// Version: 2026-04-03-00-00 (Forcing Deployment Refresh)
import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icons } from "./Icons";
import { cn, formatCPF, formatPhone } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { useLeads } from "../lib/leadsContext";
import { evolutionService } from "../lib/evolution";

// Componente para renderizar mensagens com mídia de forma inteligente
const MediaMessage = ({ msg }: { msg: any }) => {
  const [mediaData, setMediaData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isImage = msg.media_type === 'image';
  const isDoc = msg.media_type === 'document';

  useEffect(() => {
    if ((isImage || isDoc) && msg.id && !msg.id.startsWith('temp-')) {
      const loadMedia = async () => {
        setLoading(true);
        const res = await evolutionService.fetchMedia(msg.id);
        if (res && res.base64) setMediaData(res.base64);
        setLoading(false);
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
            alt="WhatsApp Image" 
            className="rounded-lg max-w-full cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => window.open(`data:${msg.mimetype};base64,${mediaData}`, '_blank')}
          />
        ) : (
          <div className="p-2 bg-slate-50 rounded border border-dashed text-[10px] text-slate-400">Imagem não disponível</div>
        )}
        {msg.text && <p className="whitespace-pre-wrap text-slate-800 font-medium">{msg.text}</p>}
      </div>
    );
  }

  if (isDoc) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3 p-3 bg-slate-50/50 rounded-xl border border-slate-100">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Icons.File className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-700 truncate">{msg.file_name || "Documento"}</p>
            <p className="text-[9px] text-slate-400 uppercase">{msg.mimetype?.split('/')[1] || "PDF"}</p>
          </div>
          {mediaData && (
            <button 
              onClick={() => {
                const link = document.createElement('a');
                link.href = `data:${msg.mimetype};base64,${mediaData}`;
                link.download = msg.file_name || 'arquivo';
                link.click();
              }}
              className="p-2 hover:bg-blue-50 text-blue-600 rounded-full transition-colors"
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
  const [isSaving, setIsSaving] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [dependents, setDependents] = useState<any[]>([]);
  const [newDependent, setNewDependent] = useState({ name: '', type: 'Dependente', birth_date: '' });
  const [isAddingDependent, setIsAddingDependent] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'chat'>('details');
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Otimização: Memoizar a lista de mensagens para evitar re-render pesado ao digitar
  const renderedMessages = useMemo(() => {
    if (!messages || messages.length === 0) return null;
    return messages.map((msg, idx) => {
      try {
        if (!msg) return null;
        const isFromMe = msg.fromMe;
        const text = msg.text;
        return (
          <div key={msg.id || `msg-${idx}`} className={cn("max-w-[85%] p-3 rounded-2xl text-sm shadow-sm relative", isFromMe ? "bg-[#dcf8c6] self-end rounded-tr-none" : "bg-white self-start rounded-tl-none")}>
             <MediaMessage msg={msg} />
             <p className="text-[9px] text-slate-400 text-right mt-1 font-bold">{msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ""}</p>
          </div>
        );
      } catch (e) { return null; }
    });
  }, [messages]);

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
    console.log("DEBUG - Buscando mensagens para:", lead.phone);
    setLoadingChat(true);
    try {
      // 1. Buscar do WhatsApp (Evolution API)
      const apiMessages = await evolutionService.getMessages(lead.phone);
      
      // 2. Buscar do Backup Local (Supabase)
      const { data: localMessages } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: true });

      // Normalizar e Unificar de forma ultra-segura
      let rawApi: any[] = [];
      if (apiMessages && Array.isArray(apiMessages)) {
        rawApi = apiMessages;
      } else if (apiMessages && typeof apiMessages === 'object' && Array.isArray((apiMessages as any).messages)) {
        rawApi = (apiMessages as any).messages;
      }

      const normalizedApi = rawApi.map((m: any) => {
        try {
          return {
            id: m.key?.id || `api-${Math.random()}`,
            fromMe: !!m.key?.fromMe,
            text: m.message?.conversation || m.message?.extendedTextMessage?.text || m.message?.imageMessage?.caption || "[Mídia]",
            timestamp: m.messageTimestamp ? m.messageTimestamp * 1000 : Date.now(),
            source: 'api'
          };
        } catch (e) { return null; }
      }).filter(Boolean);

      let rawLocal = Array.isArray(localMessages) ? localMessages : [];
      const normalizedLocal = rawLocal.map((m: any) => ({
        id: m.message_id || `local-${Math.random()}`,
        fromMe: !!m.is_from_me,
        text: m.message_body || "",
        timestamp: m.created_at ? new Date(m.created_at).getTime() : Date.now(),
        source: 'local',
        media_type: m.media_type,
        mimetype: m.mimetype,
        file_name: m.file_name
      }));

      // Merge de arrays removendo duplicados por ID
      const allMessages = [...normalizedApi, ...normalizedLocal].reduce((acc: any[], curr: any) => {
        if (curr && curr.id && !acc.find(m => m.id === curr.id)) {
          acc.push(curr);
        }
        return acc;
      }, []);

      setMessages(allMessages.sort((a,b) => a.timestamp - b.timestamp));
    } catch (e: any) {
      console.error("ERRO CRITICO HISTORICO:", e.message);
    } finally {
      setLoadingChat(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'chat' && lead?.id) {
      loadMessages();

      // Configurar Realtime para novas mensagens
      const channel = supabase
        .channel(`whatsapp-${lead.id}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'whatsapp_messages',
          filter: `lead_id=eq.${lead.id}`
        }, (payload) => {
          const newMsg = payload.new;
          setMessages(prev => {
            if (prev.find(m => m.id === newMsg.message_id)) return prev;
            return [...prev, {
              id: newMsg.message_id,
              fromMe: newMsg.is_from_me,
              text: newMsg.message_body,
              timestamp: new Date(newMsg.created_at).getTime(),
              source: 'realtime',
              media_type: newMsg.media_type,
              mimetype: newMsg.mimetype,
              file_name: newMsg.file_name
            }].sort((a,b) => a.timestamp - b.timestamp);
          });
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [activeTab, lead?.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activeTab]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !lead?.phone) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      const mediatype = file.type.startsWith('image/') ? 'image' : 'document';
      const tempId = `temp-${Date.now()}`;
      
      // Optimistic Update
      setMessages(prev => [...prev, {
        id: tempId,
        fromMe: true,
        text: file.name,
        timestamp: Date.now(),
        status: 'sending',
        media_type: mediatype,
        mimetype: file.type,
        file_name: file.name
      }]);

      try {
        const response = await evolutionService.sendMedia(lead.phone, base64, mediatype, file.type, file.name);
        if (response && response.key?.id) {
          await supabase.from('whatsapp_messages').upsert({
            lead_id: lead.id,
            message_id: response.key.id,
            sender_number: lead.phone.replace(/\D/g, ''),
            message_body: file.name,
            is_from_me: true,
            created_at: new Date().toISOString(),
            media_type: mediatype,
            mimetype: file.type,
            file_name: file.name
          }, { onConflict: 'message_id' });

          setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: response.key.id, status: 'sent' } : m));
        }
      } catch (err) {
        setMessages(prev => prev.filter(m => m.id !== tempId));
        alert("Erro ao enviar arquivo");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !lead?.phone) return;
    const currentMsgText = newMessage;
    setNewMessage("");
    
    // Atualização Otimista: Adicionar na tela imediatamente
    const tempId = `temp-${Date.now()}`;
    const tempMsg = {
      id: tempId,
      fromMe: true,
      text: currentMsgText,
      timestamp: Date.now(),
      status: 'sending'
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      const response = await evolutionService.sendMessage(lead.phone, currentMsgText);
      console.log("DEBUG - Resposta Evolution:", response);
      
      // Persistência Imediata no Supabase para evitar sumiço ao fechar/abrir
      if (response && response.key?.id) {
        await supabase.from('whatsapp_messages').upsert({
          lead_id: lead.id,
          message_id: response.key.id,
          sender_number: lead.phone.replace(/\D/g, ''),
          message_body: currentMsgText,
          is_from_me: true,
          created_at: new Date().toISOString()
        }, { onConflict: 'message_id' });

        // ATUALIZAÇÃO CRUCIAL: Trocar o ID temporário pelo ID REAL
        // Isso evita duplicidade quando o Webhook/Realtime retornar a mesma mensagem
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: response.key.id, status: 'sent' } : m));
      }
      
      // O Refresh real virá pelo Webhook/loadMessages, mas mantemos o otimista até lá
    } catch (e: any) {
      console.error("DEBUG - Erro detalhado:", e);
      // Remover a mensagem otimista em caso de erro
      setMessages(prev => prev.filter(m => m.id !== tempId));
      alert(`Erro ao enviar: ${e.message || "Verifique a conexão da instância"}`);
    }
  };

  const fetchHistory = async (leadId: string) => {
    const { data } = await supabase.from('lead_history').select('*').eq('lead_id', leadId).order('created_at', { ascending: false });
    if (data) setHistory(data);
  };

  const fetchDependents = async (leadId: string) => {
    const { data } = await supabase.from('beneficiaries').select('*').eq('lead_id', leadId);
    if (data) setDependents(data);
  };

  const handleSave = async () => {
    setIsSaving(true);
    const { error } = await supabase.from('leads').update({
      name: lead.name, email: lead.email, phone: lead.phone, status: lead.status 
    }).eq('id', lead.id);
    setIsSaving(false);
    if (!error) { onUpdate(); onClose(); }
  };

  const handleDelete = async () => {
    if (window.confirm(`Tem certeza que deseja excluir o lead "${lead.name}"? Esta ação é irreversível e removerá todo o histórico associado.`)) {
      setIsSaving(true);
      const { error } = await supabase.from('leads').delete().eq('id', lead.id);
      setIsSaving(false);
      
      if (error) {
        alert("Erro ao excluir o lead: " + error.message);
      } else {
        onUpdate();
        onClose();
      }
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setIsAddingNote(true);
    const { error } = await supabase.from('lead_history').insert([{ lead_id: lead.id, content: newNote }]);
    setIsAddingNote(false);
    if (!error) { setNewNote(""); fetchHistory(lead.id); }
  };

  const handleAddDependent = async () => {
    if (!newDependent.name.trim()) return;
    const { error } = await supabase.from('beneficiaries').insert([{ lead_id: lead.id, name: newDependent.name, type: newDependent.type }]);
    if (!error) { setNewDependent({ name: '', type: 'Dependente', birth_date: '' }); setIsAddingDependent(false); fetchDependents(lead.id); }
  };

  const handleRemoveDependent = async (id: string) => {
    await supabase.from('beneficiaries').delete().eq('id', id);
    fetchDependents(lead.id);
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
              {(lead.name || "N").substring(0,2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-black text-blue-900 leading-tight">{lead.name || "Sem Nome"}</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{lead.status || "Novo"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <button 
                onClick={handleDelete} 
                disabled={isSaving} 
                className="bg-red-50 text-red-600 px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm disabled:opacity-50 hover:bg-red-100 transition-colors"
             >
                Excluir
             </button>
             <button onClick={handleSave} disabled={isSaving} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm disabled:opacity-50">
                {isSaving ? "Salvando..." : "Salvar"}
             </button>
             <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600"><Icons.X className="w-6 h-6" /></button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-8 border-b border-slate-100 bg-white">
          <button 
            onClick={() => setActiveTab('details')}
            className={cn("px-6 py-4 text-xs font-black uppercase tracking-[0.2em] transition-all border-b-2", activeTab === 'details' ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400")}
          >
            Ficha do Lead
          </button>
          <button 
            onClick={() => setActiveTab('chat')}
            className={cn("px-6 py-4 text-xs font-black uppercase tracking-[0.2em] transition-all border-b-2 flex items-center gap-2", activeTab === 'chat' ? "border-green-500 text-green-600" : "border-transparent text-slate-400")}
          >
            Chat WhatsApp
            {activeTab !== 'chat' && <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col relative bg-slate-50">
          {activeTab === 'details' ? (
            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
               {/* Sections - Simplified for now to ensure reliability */}
               <section className="space-y-4">
                  <div className="flex items-center gap-2 border-b pb-2"><Icons.Users className="w-4 h-4 text-blue-600" /><h3 className="text-xs font-black uppercase text-slate-400">Dados Gerais</h3></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1"><label className="text-[10px] uppercase font-black text-slate-400">Nome</label><input className="w-full bg-white border p-2.5 rounded-lg text-sm" value={lead.name || ""} onChange={e => setLead({...lead, name: e.target.value})} /></div>
                    <div className="space-y-1"><label className="text-[10px] uppercase font-black text-slate-400">Email</label><input className="w-full bg-white border p-2.5 rounded-lg text-sm" value={lead.email || ""} onChange={e => setLead({...lead, email: e.target.value})} /></div>
                    <div className="space-y-1"><label className="text-[10px] uppercase font-black text-slate-400">Telefone</label><input className="w-full bg-white border p-2.5 rounded-lg text-sm" value={formatPhone(lead.phone) || ""} onChange={e => setLead({...lead, phone: e.target.value})} /></div>
                    <div className="space-y-1"><label className="text-[10px] uppercase font-black text-slate-400">Status</label>
                      <select className="w-full bg-white border p-2.5 rounded-lg text-sm font-bold text-slate-700" value={String(lead.status || "")} onChange={e => setLead({...lead, status: e.target.value})}>
                        {(stages || []).map(s => <option key={s.id} value={s.name}>{s.label}</option>)}
                      </select>
                    </div>
                  </div>
               </section>

               <section className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2"><div className="flex items-center gap-2"><Icons.Users className="w-4 h-4 text-blue-600"/><h3 className="text-xs font-black uppercase text-slate-400">Dependentes</h3></div><button onClick={() => setIsAddingDependent(!isAddingDependent)} className="text-[10px] text-blue-600 uppercase font-black">+ Adicionar</button></div>
                  {isAddingDependent && (
                    <div className="bg-white p-3 border rounded-xl space-y-3">
                      <input className="w-full border p-2 text-sm" placeholder="Nome" value={newDependent.name} onChange={e => setNewDependent({...newDependent, name: e.target.value})} />
                      <button onClick={handleAddDependent} className="w-full bg-blue-600 text-white p-2 rounded-lg text-xs font-bold">Salvar</button>
                    </div>
                  )}
                  {(dependents || []).map(dep => <div key={dep.id} className="bg-white p-3 border rounded-xl flex justify-between"><span className="text-sm font-bold text-slate-700">{dep.name}</span><button onClick={() => handleRemoveDependent(dep.id)}><Icons.X className="w-4 h-4 text-slate-300" /></button></div>)}
               </section>

               <section className="space-y-4">
                  <div className="flex items-center gap-2 border-b pb-2"><Icons.History className="w-4 h-4 text-blue-600" /><h3 className="text-xs font-black uppercase text-slate-400">Histórico</h3></div>
                  <div className="space-y-4">
                    <textarea value={newNote} onChange={e => setNewNote(e.target.value)} className="w-full border p-3 rounded-xl text-sm" placeholder="Adicionar nota..." />
                    <button onClick={handleAddNote} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold float-right">Registrar</button>
                    <div className="clear-both space-y-3 pt-4">
                      {(history || []).map(h => <div key={h.id} className="bg-white p-3 border rounded-xl"><p className="text-[10px] text-slate-400 uppercase font-black">{new Date(h.created_at).toLocaleString('pt-BR')}</p><p className="text-sm mt-1 text-slate-600 font-medium">{h.content}</p></div>)}
                    </div>
                  </div>
               </section>
            </div>
          ) : (
            <div className="flex-1 flex flex-col bg-[#e5ddd5] relative overflow-hidden h-[calc(100dvh-150px)]">
               <div className="absolute inset-0 opacity-[0.06] pointer-events-none" style={{ backgroundImage: 'url("https://wweb.dev/assets/whatsapp-chat-back.png")' }}></div>
               
               <div className="bg-[#ededed] px-6 py-3 flex items-center justify-between border-b border-slate-200 z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-300 flex items-center justify-center font-bold">{(lead.name || "N").substring(0,2).toUpperCase()}</div>
                    <div>
                      <p className="text-sm font-black text-slate-700">{lead.name}</p>
                      <p className="text-[10px] text-green-600 font-bold uppercase tracking-tight flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        Online via Evolution Hub
                      </p>
                    </div>
                  </div>
                  <button onClick={loadMessages} className="p-2 bg-white rounded-lg border hover:text-blue-600">
                    <Icons.History className={cn("w-5 h-5", loadingChat && "animate-spin")} />
                  </button>
               </div>

                <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 bg-[#efe7de] dark:bg-slate-900/50 space-y-3 flex flex-col">
                  {(!messages || messages.length === 0) && !loadingChat && (
                    <div className="m-auto text-slate-400 text-xs font-black uppercase text-center">
                      <Icons.MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-20" />
                      Nenhuma conversa encontrada
                    </div>
                  )}
                  {renderedMessages}
                  {loadingChat && <div className="mx-auto bg-white/80 px-4 py-1 rounded-full text-[10px] font-black uppercase shadow-sm">Carregando mensagens...</div>}
               </div>

               <div className="bg-[#f0f0f0] p-4 flex items-center gap-3 border-t z-10">
                  <textarea 
                      rows={1}
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                      placeholder="Digite sua mensagem..."
                      className="w-full bg-transparent border-none focus:ring-0 text-sm resize-none py-3 pr-12"
                   />
                   <div className="absolute right-2 bottom-2 flex items-center gap-1">
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        onChange={handleFileSelect} 
                      />
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                      >
                        <Icons.Paperclip className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={handleSendMessage}
                        className="p-2 text-blue-600 hover:scale-110 transition-transform"
                      >
                        <Icons.CheckCircle className="w-6 h-6" />
                      </button>
                   </div>
                </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
