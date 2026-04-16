import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icons } from "./Icons";
import { cn, formatCPF, formatPhone, formatCNPJ, formatCEP, formatCurrencyValue, parseCurrencyValue } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { useLeads } from "../lib/leadsContext";
import { evolutionService } from "../lib/evolution";
import { useToast } from "./Toasts";
import { DatePicker } from "./DatePicker";

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

const DetailField = ({ label, value, onChange, placeholder, type = "text", mask, selectOptions, lead, setLead, interactionStatuses }: any) => {
  if (type === "date") {
    return (
      <div className="space-y-1">
        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">{label}</label>
        <DatePicker value={value} onChange={onChange} themeColor="blue-600" />
      </div>
    );
  }

  return (
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
};

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
    contactTypes, 
    interactionStatuses,
    carriers, 
  } = useLeads();
  const { success, error: showError } = useToast();
  const [lead, setLead] = useState(initialLead);
  const [history, setHistory] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [activeTab, setActiveTab] = useState<'details' | 'chat' | 'interview' | 'history' | 'alerts'>('details');
  const [reminders, setReminders] = useState<any[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [reminderDate, setReminderDate] = useState("");
  const [isSavingReminder, setIsSavingReminder] = useState(false);

  const handleCEPChange = async (cep: string) => {
    const cleanCEP = cep.replace(/\D/g, "");
    setLead((prev: any) => ({ ...prev, address_zip: cep }));
    
    if (cleanCEP.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setLead((prev: any) => ({
            ...prev,
            address_street: data.logradouro,
            address_neighborhood: data.bairro,
            address_city: data.localidade,
            address_state: data.uf,
            address_zip: formatCEP(cleanCEP)
          }));
        }
      } catch (e) {
        console.error("Erro ao buscar CEP:", e);
      }
    }
  };
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialLead) {
      setLead(initialLead);
      fetchHistory(initialLead.id);
      setActiveTab('details');
      if (initialLead.phone && !initialLead.profile_picture_url) {
        syncProfilePicture(initialLead.id, initialLead.phone);
      }
      fetchReminders(initialLead.id);
    }
  }, [initialLead]);

  const syncProfilePicture = async (leadId: string, phone: string) => {
    if (!phone || !leadId) return;
    try {
      let targetPhone = phone.replace(/\D/g, '');
      if (targetPhone.length <= 9) {
        const { data: messages } = await supabase.from('whatsapp_messages').select('sender_number').eq('lead_id', leadId).limit(1);
        if (messages && messages.length > 0 && messages[0].sender_number) {
          targetPhone = messages[0].sender_number;
        } else {
          targetPhone = `5521${targetPhone}`;
        }
      }
      const ppUrl = await evolutionService.getProfilePictureUrl(targetPhone);
      if (!ppUrl) return;
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(ppUrl)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error('Falha ao baixar imagem');
      const blob = await response.blob();
      const fileExt = blob.type.split('/')[1] || 'jpg';
      const filePath = `leads/${leadId}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, blob, { contentType: blob.type, upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      await supabase.from('leads').update({ profile_picture_url: publicUrl }).eq('id', leadId);
      setLead(prev => prev?.id === leadId ? { ...prev, profile_picture_url: publicUrl } : prev);
    } catch (e) {
      console.error('Erro ao sincronizar foto:', e);
    }
  };

  const loadMessages = async () => {
    if (!lead?.phone) return;
    setLoadingChat(true);
    try {
      const apiRes = await evolutionService.getMessages(lead.phone);
      const { data: localData } = await supabase.from('whatsapp_messages').select('*').eq('lead_id', lead.id).order('created_at', { ascending: true });
      let rawApi = Array.isArray(apiRes) ? apiRes : (apiRes && (apiRes as any).messages) || [];
      const normalizedApi = rawApi.map((m: any) => {
        const msg = m.message || {};
        let text = msg.conversation || msg.extendedTextMessage?.text || "";
        let mediaType, mimetype, fileName;
        if (msg.imageMessage) { mediaType = 'image'; mimetype = msg.imageMessage.mimetype; text = msg.imageMessage.caption || ""; }
        else if (msg.audioMessage) { mediaType = 'audio'; mimetype = msg.audioMessage.mimetype; }
        else if (msg.videoMessage) { mediaType = 'video'; mimetype = msg.videoMessage.mimetype; text = msg.videoMessage.caption || ""; }
        else if (msg.documentMessage) { mediaType = 'document'; mimetype = msg.documentMessage.mimetype; fileName = msg.documentMessage.fileName; text = msg.documentMessage.caption || ""; }
        return { id: m.key?.id || `api-${Math.random()}`, fromMe: !!m.key?.fromMe, text, timestamp: m.messageTimestamp * 1000, media_type: mediaType, mimetype, file_name: fileName };
      });
      const normalizedLocal = (localData || []).map((m: any) => ({
        id: m.message_id, fromMe: m.is_from_me, text: m.message_body, timestamp: new Date(m.created_at).getTime(), media_type: m.media_type, mimetype: m.mimetype, file_name: m.file_name, is_read: m.is_read ?? true
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
       const markRead = () => supabase.from('whatsapp_messages').update({ is_read: true }).eq('lead_id', lead.id).eq('is_from_me', false).eq('is_read', false);
       markRead();
       const channel = supabase.channel(`chat-${lead.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages', filter: `lead_id=eq.${lead.id}` }, (payload) => {
           const n = payload.new;
           setMessages(prev => prev.find(m => m.id === n.message_id) ? prev : [...prev, { id: n.message_id, fromMe: n.is_from_me, text: n.message_body, timestamp: new Date(n.created_at).getTime(), media_type: n.media_type, mimetype: n.mimetype, file_name: n.file_name, is_read: true }].sort((a,b) => a.timestamp - b.timestamp));
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
        await supabase.from('whatsapp_messages').upsert({ lead_id: lead.id, message_id: res.key.id, sender_number: lead.phone.replace(/\D/g, ''), message_body: txt, is_from_me: true, is_read: true, created_at: now.toISOString() });
        await supabase.from('leads').update({ last_app_message_at: now.toISOString(), lastcontact: formattedDate }).eq('id', lead.id);
        setLead(prev => ({ ...prev, last_app_message_at: now.toISOString(), lastcontact: formattedDate }));
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: res.key.id, status: 'sent' } : m));
        setTimeout(() => onUpdate(), 100);
      }
    } catch (e: any) { 
      showError(e.message || "Erro ao enviar");
      setMessages(prev => prev.filter(m => m.id !== tempId)); 
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
          await supabase.from('whatsapp_messages').upsert({ lead_id: lead.id, message_id: res.key.id, sender_number: lead.phone.replace(/\D/g, ''), message_body: `[Arquivo: ${file.name}]`, is_from_me: true, is_read: true, created_at: now.toISOString(), media_type: type, mimetype: file.type, file_name: file.name });
          await supabase.from('leads').update({ last_app_message_at: now.toISOString(), lastcontact: formattedDate }).eq('id', lead.id);
          setLead(prev => ({ ...prev, last_app_message_at: now.toISOString(), lastcontact: formattedDate }));
          setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: res.key.id, status: 'sent' } : m));
          success("Arquivo enviado!");
          setTimeout(() => onUpdate(), 100);
        }
      } catch (e: any) {
        showError("Erro ao enviar arquivo");
        setMessages(prev => prev.filter(m => m.id !== tempId));
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
    const { error } = await supabase.from('lead_history').insert([{ lead_id: lead.id, content: `[NOTA] ${noteContent}` }]);
    setIsSavingNote(false);
    if (!error) { success("Nota adicionada!"); setNoteContent(""); fetchHistory(lead.id); }
  };

  const handleAddReminder = async (days?: number) => {
    if (!lead?.id) return;
    let finalDate = reminderDate;
    if (days !== undefined) {
      const d = new Date(); d.setDate(d.getDate() + days);
      finalDate = d.toISOString().split('T')[0];
    }
    if (!finalDate) return showError("Selecione uma data");
    setIsSavingReminder(true);
    const { error } = await supabase.from('reminders').insert([{ lead_id: lead.id, title: reminderTitle || "Follow-up", due_date: finalDate, status: 'pendente' }]);
    setIsSavingReminder(false);
    if (!error) { success("Lembrete agendado!"); setReminderTitle(""); setReminderDate(""); onRefreshAlerts?.(); fetchReminders(lead.id); }
  };

  const fetchReminders = async (id: string) => {
    const { data } = await supabase.from('reminders').select('*').eq('lead_id', id).order('due_date', { ascending: false });
    setReminders(data || []);
  };

  const handleResolveReminder = async (remId: string) => {
    const { error } = await supabase.from('reminders').update({ status: 'concluido' }).eq('id', remId);
    if (!error) {
       success("Resolvido!"); fetchReminders(lead.id); onRefreshAlerts?.();
       await supabase.from('lead_history').insert([{ lead_id: lead.id, content: `[AVISO RESOLVIDO] ${reminders.find(r => r.id === remId)?.title}` }]);
       fetchHistory(lead.id);
    }
  };

  const handleSave = async () => {
    if (!lead.name?.trim()) return showError("Nome obrigatório");
    setIsSaving(true);
    const updates = { 
      name: lead.name, 
      email: lead.email, 
      phone: lead.phone?.replace(/\D/g, ''), 
      secondary_phone: lead.secondary_phone?.replace(/\D/g, ''),
      status: lead.status, 
      nickname: lead.nickname, 
      lead_type: lead.lead_type || 'PF', 
      company_name: lead.company_name, 
      contact_person: lead.contact_person, 
      job_title: lead.job_title,
      birth_date: lead.birth_date, 
      marriage_date: lead.marriage_date,
      cnpj: lead.cnpj?.replace(/\D/g, ''), 
      cpf: lead.cpf?.replace(/\D/g, ''),
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
      has_current_plan: lead.has_current_plan,
      contract_expiry_date: lead.contract_expiry_date,
      docs_link: lead.docs_link, 
      plan_type: lead.plan_type, 
      carrier: lead.carrier, 
      product: lead.product,
      interested_lives: lead.interested_lives, 
      deal_value: lead.deal_value,
      temperature: lead.temperature || 'Morno',
      interaction_status: lead.interaction_status || 'Sem Status',
      contact_type: lead.contact_type,
      source: lead.source,
      lastcontact: lead.lastcontact,
      profile_picture_url: lead.profile_picture_url
    };
    const res = lead.id ? await supabase.from('leads').update(updates).eq('id', lead.id) : await supabase.from('leads').insert([updates]);
    setIsSaving(false);
    if (!res.error) { success("Salvo!"); onUpdate(); onClose(); } else showError("Erro ao salvar");
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'details':
        return (
          <div className="p-8 space-y-10 bg-white pb-24">
            {/* IDENTIFICAÇÃO */}
            <section>
              <SectionHeader icon={Icons.Users} title="Identificação do Lead" colorClass="bg-blue-50 text-blue-600" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <DetailField label="Categoria" value={lead.lead_type} selectOptions={['PF', 'PJ']} onChange={(v:any) => setLead({...lead, lead_type: v})} />
                <div className="md:col-span-2">
                   <DetailField label="Nome / Razão Social" value={lead.name} onChange={(v:any) => setLead({...lead, name: v})} />
                </div>
                <DetailField label="Apelido / Fantasia" value={lead.nickname} onChange={(v:any) => setLead({...lead, nickname: v})} />
                <DetailField 
                  label={lead.lead_type === 'PJ' ? "CNPJ" : "CPF"} 
                  value={lead.lead_type === 'PJ' ? lead.cnpj : lead.cpf} 
                  mask={lead.lead_type === 'PJ' ? formatCNPJ : formatCPF}
                  onChange={(v:any) => setLead({...lead, [lead.lead_type === 'PJ' ? 'cnpj' : 'cpf']: v})} 
                />
                <DetailField label="Data Nascimento" type="date" value={lead.birth_date} onChange={(v:any) => setLead({...lead, birth_date: v})} />
              </div>
            </section>

            {/* CICLO DE VENDAS */}
            <section>
              <SectionHeader icon={Icons.Target} title="Ciclo de Vendas e Status" colorClass="bg-indigo-50 text-indigo-600" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <DetailField 
                  label="Status no Funil" 
                  value={lead.status} 
                  selectOptions={stages.map(s => ({ value: s.name, label: s.label }))}
                  onChange={(v:any) => setLead({...lead, status: v})} 
                />
                <DetailField 
                  label="Status de Interação" 
                  value={lead.interaction_status} 
                  lead={lead} 
                  setLead={setLead} 
                  interactionStatuses={interactionStatuses} 
                />
                <DetailField 
                  label="Tipo de Contato" 
                  value={lead.contact_type} 
                  selectOptions={contactTypes?.filter((t: any) => t.active).map((t: any) => t.name)}
                  onChange={(v:any) => setLead({...lead, contact_type: v})} 
                />
                <div className="space-y-1">
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Último Contato</label>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:bg-white focus:border-blue-500 text-sm font-bold text-slate-900"
                      value={lead.lastcontact || ''}
                      onChange={e => setLead({...lead, lastcontact: e.target.value})}
                    />
                    <button 
                      type="button"
                      onClick={() => setLead({...lead, lastcontact: 'Não entrar em contato'})}
                      className={cn(
                        "px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all shadow-sm border whitespace-nowrap",
                        lead.lastcontact === 'Não entrar em contato' 
                          ? "bg-red-500 border-red-500 text-white" 
                          : "bg-white border-slate-200 text-red-500 hover:bg-red-50"
                      )}
                    >
                      Banir Contato
                    </button>
                  </div>
                </div>
                <DetailField label="Origem" value={lead.source} onChange={(v:any) => setLead({...lead, source: v})} />
                <DetailField 
                  label="Temperatura" 
                  value={lead.temperature} 
                  selectOptions={[
                    { value: 'Muito quente', label: 'Muito quente 🔥' },
                    { value: 'Quente', label: 'Quente ☀️' },
                    { value: 'Morno', label: 'Morno 🌤️' },
                    { value: 'Frio', label: 'Frio ❄️' },
                    { value: 'Congelado', label: 'Congelado 🧊' }
                  ]}
                  onChange={(v:any) => setLead({...lead, temperature: v})} 
                />
              </div>
            </section>

            {/* CONTATO */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="space-y-6">
                <SectionHeader icon={Icons.Phone} title="Contato" colorClass="bg-green-50 text-green-600" />
                <DetailField label="WhatsApp Principal" value={lead.phone} mask={formatPhone} onChange={(v:any) => setLead({...lead, phone: v})} />
                <DetailField label="Telefone Secundário" value={lead.secondary_phone} mask={formatPhone} onChange={(v:any) => setLead({...lead, secondary_phone: v})} />
                <DetailField label="E-mail" value={lead.email} onChange={(v:any) => setLead({...lead, email: v})} />
              </div>
              <div className="space-y-6">
                <SectionHeader icon={Icons.MapPin} title="Localização" colorClass="bg-orange-50 text-orange-600" />
                <div className="grid grid-cols-2 gap-4">
                  <DetailField label="CEP" value={lead.address_zip} mask={formatCEP} onChange={handleCEPChange} />
                  <DetailField label="Estado (UF)" value={lead.address_state} onChange={(v:any) => setLead({...lead, address_state: v})} />
                </div>
                <DetailField label="Cidade" value={lead.address_city} onChange={(v:any) => setLead({...lead, address_city: v})} />
                <DetailField label="Logradouro" value={lead.address_street} onChange={(v:any) => setLead({...lead, address_street: v})} />
                <div className="grid grid-cols-2 gap-4">
                  <DetailField label="Número" value={lead.address_number} onChange={(v:any) => setLead({...lead, address_number: v})} />
                  <DetailField label="Bairro" value={lead.address_neighborhood} onChange={(v:any) => setLead({...lead, address_neighborhood: v})} />
                </div>
                <DetailField label="Complemento" value={lead.address_complement} onChange={(v:any) => setLead({...lead, address_complement: v})} />
              </div>
            </section>

            {/* PLANO ATUAL */}
            <section className="pt-10 border-t border-slate-100">
               <SectionHeader icon={Icons.Shield} title="Plano de Saúde Atual" colorClass="bg-amber-50 text-amber-600" />
               <div className="space-y-6">
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Possui plano atualmente?</label>
                    <div className="flex gap-2">
                       <button 
                        onClick={() => setLead({...lead, has_current_plan: true})} 
                        className={cn("flex-1 py-2.5 rounded-xl font-bold text-xs border-2 transition-all", lead.has_current_plan ? "bg-amber-50 border-amber-500 text-amber-600" : "bg-slate-50 border-transparent text-slate-400")}
                       >Sim</button>
                       <button 
                        onClick={() => setLead({...lead, has_current_plan: false})} 
                        className={cn("flex-1 py-2.5 rounded-xl font-bold text-xs border-2 transition-all", !lead.has_current_plan ? "bg-slate-900 border-slate-900 text-white" : "bg-slate-50 border-transparent text-slate-400")}
                       >Não</button>
                    </div>
                  </div>
                  
                  {lead.has_current_plan && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 pt-2">
                      <DetailField label="Operadora Atual" value={lead.current_carrier} onChange={(v:any) => setLead({...lead, current_carrier: v})} />
                      <DetailField label="Produto Atual" value={lead.current_product} onChange={(v:any) => setLead({...lead, current_product: v})} />
                      <DetailField label="Qtde Vidas" type="number" value={lead.current_lives} onChange={(v:any) => setLead({...lead, current_lives: Number(v)})} />
                      <DetailField 
                        label="Valor Pago Atual" 
                        value={lead.current_value ? Math.round(lead.current_value * 100).toString() : ""} 
                        mask={formatCurrencyValue}
                        onChange={(v:any) => setLead({...lead, current_value: parseCurrencyValue(v)})} 
                      />
                      <DetailField label="Vencimento Contrato" type="date" value={lead.contract_expiry_date} onChange={(v:any) => setLead({...lead, contract_expiry_date: v})} />
                    </div>
                  )}
               </div>
            </section>

            {/* NOVA PROPOSTA */}
            <section className="pt-10 border-t border-slate-100">
               <SectionHeader icon={Icons.FileText} title="Proposta / Planejamento" colorClass="bg-emerald-50 text-emerald-600" />
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                  <DetailField label="Tipo de Plano" value={lead.plan_type} selectOptions={['Saúde', 'Odonto', 'Saúde + Odonto']} onChange={(v:any) => setLead({...lead, plan_type: v})} />
                  <DetailField 
                    label="Operadora Proposta" 
                    value={lead.carrier} 
                    selectOptions={carriers.map(c => c.name)}
                    onChange={(v:any) => setLead({...lead, carrier: v})} 
                  />
                  <DetailField label="Produto Proposta" value={lead.product} onChange={(v:any) => setLead({...lead, product: v})} />
                  <DetailField label="Vidas Proposta" type="number" value={lead.interested_lives} onChange={(v:any) => setLead({...lead, interested_lives: Number(v)})} />
                  <DetailField 
                    label="Valor Proposta" 
                    value={lead.deal_value ? Math.round(lead.deal_value * 100).toString() : ""} 
                    mask={formatCurrencyValue}
                    onChange={(v:any) => setLead({...lead, deal_value: parseCurrencyValue(v)})} 
                  />
                  <div className="lg:col-span-2">
                    <DetailField label="Link Documentos (Drive)" value={lead.docs_link} onChange={(v:any) => setLead({...lead, docs_link: v})} placeholder="https://..." />
                  </div>
               </div>
            </section>
            
            <section className="pt-10 border-t border-slate-100 grid grid-cols-1 lg:grid-cols-2 gap-10">
               <div className="space-y-6">
                 <SectionHeader icon={Icons.FileText} title="Nova Anotação" colorClass="bg-blue-50 text-blue-600" />
                 <textarea value={noteContent} onChange={e => setNoteContent(e.target.value)} placeholder="Digite observações importantes sobre o lead..." className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 min-h-[120px] outline-none focus:bg-white focus:border-blue-500 transition-all font-medium text-sm" />
                 <button onClick={handleAddNote} disabled={isSavingNote || !noteContent.trim()} className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50">Salvar Nota no Histórico</button>
               </div>
               <div className="space-y-6">
                 <SectionHeader icon={Icons.Bell} title="Agendar Follow-up" colorClass="bg-amber-50 text-amber-600" />
                 <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                    <input type="text" value={reminderTitle} onChange={e => setReminderTitle(e.target.value)} placeholder="O que precisa ser feito?" className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-amber-500" />
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <DatePicker value={reminderDate} onChange={setReminderDate} themeColor="amber-500" />
                      </div>
                      <button onClick={() => handleAddReminder()} disabled={isSavingReminder} className="px-6 bg-amber-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-amber-600 transition-all shadow-lg shadow-amber-100">Criar Alerta</button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[1,3,7].map(d => (
                        <button 
                          key={d} 
                          type="button"
                          onClick={() => handleAddReminder(d)} 
                          className="py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-500 hover:border-amber-500 hover:text-amber-600 transition-all shadow-sm"
                        >+{d}D</button>
                      ))}
                    </div>
                 </div>
               </div>
            </section>
          </div>
        );
      case 'chat':
        return (
          <div className="h-full flex flex-col bg-[#efe7de]">
             <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 flex flex-col custom-scrollbar">
                {messages.map((msg, idx) => (
                  <div key={msg.id || idx} className={cn("max-w-[85%] p-3 rounded-2xl text-sm shadow-sm", msg.fromMe ? "bg-[#dcf8c6] self-end" : "bg-white self-start border")}>
                     <MediaMessage msg={msg} />
                     <p className="text-[9px] text-slate-400 text-right mt-1 font-bold">{msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : ""}</p>
                  </div>
                ))}
             </div>
             <div className="bg-[#f0f0f0] p-4 flex flex-col gap-3 border-t">
                <div className="flex bg-white rounded-2xl items-center px-4 py-1 border">
                  <textarea rows={1} value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())} placeholder="Mensagem..." className="flex-1 bg-transparent py-3 text-sm outline-none resize-none h-12" />
                  <div className="flex items-center gap-1">
                     <button onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400"><Icons.Paperclip className="w-5 h-5"/></button>
                     <button onClick={handleSendMessage} className="p-2 text-[#00a884]"><Icons.CheckCircle className="w-6 h-6"/></button>
                  </div>
                </div>
             </div>
          </div>
        );
      case 'history':
        return (
          <div className="p-8 space-y-6">
            <SectionHeader icon={Icons.History} title="Histórico" colorClass="bg-amber-50 text-amber-600" />
            <div className="space-y-4">
              {history.map(h => (
                <div key={h.id} className="p-4 bg-white border rounded-3xl shadow-sm">
                   <p className="text-[8px] font-black text-slate-400 uppercase mb-1">{new Date(h.created_at).toLocaleString()}</p>
                   <p className="text-sm font-semibold text-slate-700">{h.content}</p>
                </div>
              ))}
            </div>
          </div>
        );
      case 'alerts':
        return (
          <div className="p-8 space-y-6">
            <SectionHeader icon={Icons.Bell} title="Avisos" colorClass="bg-red-50 text-red-600" />
            <div className="space-y-4">
              {reminders.map(rem => (
                <div key={rem.id} className={cn("p-5 border rounded-3xl", rem.status === 'pendente' ? "bg-white" : "bg-slate-50 opacity-60")}>
                   <div className="flex justify-between items-start mb-2">
                      <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-600">{rem.status}</span>
                      {rem.status === 'pendente' && <button onClick={() => handleResolveReminder(rem.id)} className="text-[8px] font-black uppercase bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-xl">Resolver</button>}
                   </div>
                   <h5 className="text-sm font-black italic">{rem.title}</h5>
                   <p className="text-[10px] text-slate-400 font-bold uppercase mt-2">Vence: {new Date(rem.due_date).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          </div>
        );
      case 'interview':
        return (
          <div className="h-full bg-white relative overflow-hidden">
             <AIGuidedLeadCreate 
               isOpen={true} 
               onClose={() => setActiveTab('details')}
               onSuccess={() => {
                 fetchHistory(lead.id);
                 setActiveTab('history');
               }}
             />
          </div>
        );
      default: return null;
    }
  };

  if (!isOpen || !lead) return null;

  return (
    <div className="fixed inset-0 z-[200] overflow-hidden">
      <div onClick={onClose} className="absolute inset-0 bg-slate-900/95 backdrop-blur-md" />
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} className="absolute right-0 top-0 h-[100dvh] w-full max-w-3xl bg-white shadow-2xl flex flex-col">
        <div className="px-8 py-6 border-b flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white text-xl font-black overflow-hidden shadow-xl">
              {lead.profile_picture_url ? <img src={lead.profile_picture_url} className="w-full h-full object-cover" /> : (lead.name || "?").substring(0,1).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 leading-tight">{lead.name || "Sem Nome"}</h2>
              <div className="flex gap-2 items-center mt-1">
                 <span className="px-2 py-0.5 bg-blue-100 text-blue-600 rounded text-[9px] font-black uppercase">LEAD</span>
                 <span className="text-[10px] text-slate-400 font-bold uppercase">{lead.status}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl text-sm font-black shadow-lg shadow-blue-200 uppercase transition-all flex items-center gap-2">
               {isSaving ? <Icons.Loader2 className="w-4 h-4 animate-spin" /> : <Icons.CheckCircle className="w-4 h-4" />}
               {isSaving ? "Salvando..." : "Salvar"}
            </button>
            <button onClick={onClose} className="p-2 text-slate-300 hover:text-slate-600 transition-colors"><Icons.X className="w-6 h-6"/></button>
          </div>
        </div>

        <div className="flex px-8 border-b bg-white shadow-sm shrink-0">
          {['details', 'chat', 'interview', 'history', 'alerts'].map((tab: any) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={cn("px-6 py-5 text-[10px] font-black uppercase tracking-widest transition-all border-b-2", activeTab === tab ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400")}>
              {tab === 'details' ? 'Ficha' : tab === 'chat' ? 'Chat' : tab === 'interview' ? 'Entrevista IA' : tab === 'history' ? 'Histórico' : 'Avisos'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto relative bg-slate-50 custom-scrollbar">
          {renderTabContent()}
        </div>
      </motion.div>
      <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
    </div>
  );
}
