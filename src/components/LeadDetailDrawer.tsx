import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icons } from "./Icons";
import { cn, formatCPF, formatPhone, formatCNPJ, formatCEP, formatCurrencyValue, parseCurrencyValue } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { useLeads } from "../lib/leadsContext";
import { evolutionService } from "../lib/umclique";
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

const DetailField = ({ label, value, onChange, placeholder, type = "text", selectOptions, mask, className, isLoading }: any) => {
  if (type === "date") {
    return (
      <div className="space-y-1">
        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">{label}</label>
        <DatePicker value={value} onChange={onChange} themeColor="blue-600" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">{label}</label>
      {selectOptions ? (
        <select 
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:bg-white focus:border-blue-500 text-sm font-bold text-slate-700" 
          value={value || ""} 
          onChange={e => onChange(e.target.value)}
        >
          <option value="">Selecione...</option>
          {selectOptions.map((opt:any) => <option key={opt.id || opt} value={opt.value !== undefined ? opt.value : (opt.name || opt)}>{opt.label || opt.name || opt}</option>)}
        </select>
      ) : (
        <div className="relative">
          <input 
            type={type}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:bg-white focus:border-blue-500 text-sm font-bold text-slate-900 placeholder:text-slate-300 pr-10"
            placeholder={placeholder}
            value={mask ? mask(value) : (value || '')}
            onChange={e => onChange(e.target.value)}
          />
          {isLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-600">
              <Icons.Loader2 className="w-4 h-4 animate-spin" />
            </div>
          )}
        </div>
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
  const [activeTab, setActiveTab] = useState<'details' | 'chat' | 'interview' | 'history' | 'alerts' | 'contracts'>('details');
  const [reminders, setReminders] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderDate, setReminderDate] = useState("");
  const [isSearchingCNPJ, setIsSearchingCNPJ] = useState(false);
  const [isSavingReminder, setIsSavingReminder] = useState(false);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);

  const formatDateToISO = (dateStr: string) => {
    if (!dateStr) return null;
    const clean = dateStr.toString().trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) {
      const [d, m, y] = clean.split('/');
      return `${y}-${m}-${d}`;
    }
    if (/^\d{8}$/.test(clean)) {
      return `${clean.substring(0, 4)}-${clean.substring(4, 6)}-${clean.substring(6, 8)}`;
    }
    return clean;
  };

  const handleCNPJChange = async (cnpj: string) => {
    const formatted = formatCNPJ(cnpj);
    const cleanCNPJ = formatted.replace(/\D/g, "");
    setLead((prev: any) => ({ ...prev, cnpj: formatted }));
    
    if (cleanCNPJ.length === 14 && !isSearchingCNPJ) {
      setIsSearchingCNPJ(true);
      try {
        let response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCNPJ}`);
        let data = await response.json();
        
        if (!response.ok || data.error) {
          console.log("BrasilAPI falhou, tentando fallback...");
          response = await fetch(`https://minhareceita.org/${cleanCNPJ}`);
          data = await response.json();
        }

        if (response.ok && !data.error && !data.message) {
          setLead((prev: any) => ({
            ...prev,
            company_name: data.razao_social || data.nome_empresarial || prev.company_name,
            nickname: data.nome_fantasia || prev.nickname,
            address_zip: data.cep ? formatCEP(data.cep) : prev.address_zip,
            address_street: data.logradouro || prev.address_street,
            address_neighborhood: data.bairro || prev.address_neighborhood,
            address_city: data.municipio || data.municipio_descricao || prev.address_city,
            company_city: data.municipio || data.municipio_descricao || prev.company_city,
            address_state: data.uf || prev.address_state,
            company_state: data.uf || prev.company_state,
            address_number: data.numero || prev.address_number,
            cnae: data.cnae_fiscal_descricao || data.cnae_fiscal || prev.cnae,
            opening_date: formatDateToISO(data.data_abertura || data.abertura || data.data_inicio_atividade) || prev.opening_date,
            email: data.email || prev.email,
            phone: data.ddd_telefone_1 ? formatPhone(data.ddd_telefone_1) : (data.telefone || prev.phone),
            share_capital: data.capital_social || prev.share_capital,
            simples_entry_date: data.data_opcao_pelo_simples || null,
            simples_exit_date: data.data_exclusao_do_simples || null,
            mei_entry_date: data.data_opcao_pelo_mei || null,
            mei_exit_date: data.data_exclusao_do_mei || null,
            partner_name: data.qsa?.map((s: any) => s.nome_socio).join('; ') || prev.partner_name,
            qualification: data.qsa?.map((s: any) => s.qualificacao_socio).join('; ') || prev.qualification,
            age_range: data.qsa?.map((s: any) => s.faixa_etaria).join('; ') || prev.age_range,
            lead_type: 'PJ'
          }));
          success("Dados detalhados da empresa carregados!");
        }
      } catch (e) {
        console.error("Erro ao buscar CNPJ:", e);
      } finally {
        setIsSearchingCNPJ(false);
      }
    }
  };

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
      if (initialLead.phone) {
        if (!initialLead.profile_picture_url) {
          syncProfilePicture(initialLead.id, initialLead.phone);
        }
      }
      fetchReminders(initialLead.id);
      fetchContracts(initialLead.id);
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

  const fetchContracts = async (leadId: string) => {
    const { data } = await supabase.from('contracts').select('*').eq('lead_id', leadId).order('created_at', { ascending: false });
    setContracts(data || []);
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
      phone: lead.phone?.toString().replace(/\D/g, ''), 
      secondary_phone: lead.secondary_phone?.toString().replace(/\D/g, ''),
      status: lead.status, 
      nickname: lead.nickname, 
      lead_type: lead.lead_type || 'PF', 
      company_name: lead.company_name, 
      contact_person: lead.contact_person, 
      job_title: lead.job_title,
      birth_date: lead.birth_date || null, 
      marriage_date: lead.marriage_date || null,
      cnpj: lead.cnpj?.toString().replace(/\D/g, ''), 
      cpf: lead.cpf?.toString().replace(/\D/g, ''),
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
      contract_start_date: lead.contract_start_date || null,
      contract_expiry_date: lead.contract_expiry_date || null,
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
      cnae: lead.cnae,
      cnae_text: lead.cnae_text,
      cnae_secondary: lead.cnae_secondary,
      share_capital: lead.share_capital,
      company_size: lead.company_size,
      legal_nature: lead.legal_nature,
      registration_status: lead.registration_status,
      registration_status_date: lead.registration_status_date,
      tax_regime: lead.tax_regime,
      simples_entry_date: lead.simples_entry_date,
      simples_exit_date: lead.simples_exit_date,
      mei_entry_date: lead.mei_entry_date,
      mei_exit_date: lead.mei_exit_date,
      partner_name: lead.partner_name,
      qualification: lead.qualification,
      age_range: lead.age_range,
      resp_emp_phone: lead.resp_emp_phone,
      resp_emp_email: lead.resp_emp_email,
      opening_date: lead.opening_date || null,
      first_contact_date: lead.first_contact_date || null,
      do_not_contact: lead.do_not_contact || false,
      profile_picture_url: lead.profile_picture_url,
      modality: lead.modality || "PME",
      administrator: lead.administrator
    };
    
    console.log("Salvando lead:", updates);
    const res = lead.id ? await supabase.from('leads').update(updates).eq('id', lead.id) : await supabase.from('leads').insert([updates]);
    setIsSaving(false);
    if (!res.error) { 
      success("Salvo com sucesso!"); 
      onUpdate(); 
      onClose(); 
    } else {
      console.error("Erro ao salvar lead:", res.error);
      showError(`Erro ao salvar: ${res.error.message}`);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'details':
        return (
          <div className="p-8 space-y-10 bg-white pb-24">
            {/* IDENTIFICAÇÃO */}
            <section>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                    <Icons.Users className="w-4 h-4" />
                  </div>
                  <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Identificação do Lead</h4>
                </div>
                
                <label className="flex items-center gap-2 cursor-pointer group select-none">
                  <div className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                    lead.do_not_contact ? "bg-red-500 border-red-500 shadow-sm" : "bg-white border-slate-200 group-hover:border-red-300"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    setLead({ ...lead, do_not_contact: !lead.do_not_contact });
                  }}>
                    {lead.do_not_contact && <Icons.Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-wider transition-colors",
                    lead.do_not_contact ? "text-red-600" : "text-slate-400 group-hover:text-red-400"
                  )}>Não realizar contato</span>
                </label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-4">
                {/* LINHA 1 */}
                <div className="md:col-span-2 lg:col-span-1">
                  <DetailField label="Categoria" value={lead.lead_type} selectOptions={['PF', 'PJ']} onChange={(v:any) => setLead({...lead, lead_type: v})} />
                </div>
                <div className="md:col-span-4 lg:col-span-4">
                  <DetailField label="Nome do Lead" value={lead.name} onChange={(v:any) => setLead({...lead, name: v})} />
                </div>
                <div className="md:col-span-3 lg:col-span-2">
                  <DetailField 
                    label="CPF" 
                    value={lead.cpf} 
                    mask={formatCPF}
                    onChange={(v:any) => setLead({...lead, cpf: v})} 
                  />
                </div>
                <div className="md:col-span-3 lg:col-span-3">
                  <DetailField label="WhatsApp Principal" value={lead.phone} mask={formatPhone} onChange={(v:any) => setLead({...lead, phone: v})} />
                </div>
                <div className="md:col-span-3 lg:col-span-2">
                  <DetailField label="Data Nascimento" type="date" value={lead.birth_date} onChange={(v:any) => setLead((prev:any) => ({...prev, birth_date: v || null}))} />
                </div>

                {/* LINHA 2 */}
                <div className="md:col-span-3 lg:col-span-3">
                  <DetailField label="E-mail" value={lead.email} onChange={(v:any) => setLead({...lead, email: v})} />
                </div>
                <div className="md:col-span-3 lg:col-span-2">
                  <DetailField label="Tel. Secundário" value={lead.secondary_phone} mask={formatPhone} onChange={(v:any) => setLead({...lead, secondary_phone: v})} />
                </div>
                <div className="md:col-span-2 lg:col-span-1">
                  <DetailField label="CEP" value={lead.address_zip} mask={formatCEP} onChange={handleCEPChange} />
                </div>
                <div className="md:col-span-3 lg:col-span-2">
                  <DetailField label="Cidade" value={lead.address_city} onChange={(v:any) => setLead({...lead, address_city: v})} />
                </div>
                <div className="md:col-span-1 lg:col-span-1">
                  <DetailField label="UF" value={lead.address_state} onChange={(v:any) => setLead({...lead, address_state: v})} />
                </div>
                <div className="md:col-span-3 lg:col-span-2">
                  <DetailField label="1º Contato" type="date" value={lead.first_contact_date || new Date().toISOString().split('T')[0]} onChange={(v:any) => setLead({...lead, first_contact_date: v})} />
                </div>
                <div className="md:col-span-3 lg:col-span-1">
                   <div className="space-y-1">
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Ciclo</label>
                      <div className="h-[42px] px-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center gap-1.5">
                         <Icons.Clock className="w-3 h-3 text-indigo-600" />
                         <span className="text-xs font-black text-indigo-700">
                           {lead.first_contact_date ? `${Math.floor((new Date().getTime() - new Date(lead.first_contact_date).getTime()) / (1000 * 3600 * 24))}d` : '-'}
                         </span>
                      </div>
                   </div>
                </div>

                {/* LINHA 3 */}
                <div className="md:col-span-4 lg:col-span-4">
                  <DetailField label="Logradouro" value={lead.address_street} onChange={(v:any) => setLead({...lead, address_street: v})} />
                </div>
                <div className="md:col-span-2 lg:col-span-1">
                  <DetailField label="Nº" value={lead.address_number} onChange={(v:any) => setLead({...lead, address_number: v})} />
                </div>
                <div className="md:col-span-3 lg:col-span-3">
                  <DetailField label="Bairro" value={lead.address_neighborhood} onChange={(v:any) => setLead({...lead, address_neighborhood: v})} />
                </div>
                <div className="md:col-span-3 lg:col-span-4">
                  <DetailField label="Complemento" value={lead.address_complement} onChange={(v:any) => setLead({...lead, address_complement: v})} />
                </div>
              </div>
            </section>

            {/* DADOS DA EMPRESA (Somente PJ) */}
            {lead.lead_type === 'PJ' && (
              <section className="bg-slate-50/50 p-8 rounded-[2.5rem] border border-slate-100 space-y-8">
                <SectionHeader icon={Icons.Building2} title="Dados Técnicos da Empresa" colorClass="bg-blue-600 text-white" />
                <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-5">
                  <div className="md:col-span-2 lg:col-span-2">
                    <DetailField 
                      label="CNPJ" 
                      value={lead.cnpj} 
                      mask={formatCNPJ}
                      isLoading={isSearchingCNPJ}
                      onChange={(v:any) => handleCNPJChange(v)} 
                    />
                  </div>
                  <div className="md:col-span-4 lg:col-span-5">
                    <DetailField label="Razão Social" value={lead.company_name} onChange={(v:any) => setLead({...lead, company_name: v})} />
                  </div>
                  <div className="md:col-span-4 lg:col-span-5">
                    <DetailField label="Nome Fantasia" value={lead.nickname} onChange={(v:any) => setLead({...lead, nickname: v})} />
                  </div>

                  <div className="md:col-span-2 lg:col-span-2">
                    <DetailField label="Data de Abertura" type="date" value={lead.opening_date} onChange={(v:any) => setLead({...lead, opening_date: v})} />
                  </div>
                  <div className="md:col-span-2 lg:col-span-3">
                    <DetailField label="Situação Cadastral" value={lead.registration_status} onChange={(v:any) => setLead({...lead, registration_status: v})} />
                  </div>
                  <div className="md:col-span-2 lg:col-span-2">
                    <DetailField label="Capital Social" value={lead.share_capital?.toString()} mask={(v:any) => v ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v)) : ''} onChange={(v:any) => setLead({...lead, share_capital: Number(v)})} />
                  </div>
                  <div className="md:col-span-2 lg:col-span-2">
                    <DetailField label="Porte" value={lead.company_size} onChange={(v:any) => setLead({...lead, company_size: v})} />
                  </div>
                  <div className="md:col-span-4 lg:col-span-3">
                    <DetailField label="Natureza Jurídica" value={lead.legal_nature} onChange={(v:any) => setLead({...lead, legal_nature: v})} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <DetailField label="CNAE Principal" value={`${lead.cnae || ''} - ${lead.cnae_text || ''}`} onChange={(v:any) => setLead({...lead, cnae_text: v})} />
                  <DetailField label="CNAEs Secundários" value={lead.cnae_secondary} onChange={(v:any) => setLead({...lead, cnae_secondary: v})} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-200/50">
                  <div className="md:col-span-3">
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4">Quadro Societário (QSA)</p>
                    <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/50 border-b border-slate-100">
                            <th className="px-6 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Sócio</th>
                            <th className="px-6 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Qualificação</th>
                            <th className="px-6 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Faixa Etária</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {(lead.partner_name || "").split("; ").map((name: string, i: number) => {
                            const quals = (lead.qualification || "").split("; ");
                            const ages = (lead.age_range || "").split("; ");
                            if (!name && !quals[i]) return null;
                            return (
                              <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                                <td className="px-6 py-4 text-xs font-bold text-slate-700">{name || '-'}</td>
                                <td className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">{quals[i] || '-'}</td>
                                <td className="px-6 py-4 text-[10px] font-bold text-slate-400">{ages[i] || '-'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-5 pt-4 border-t border-slate-200/50">
                  <div className="md:col-span-6 lg:col-span-12">
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">Tributação e Contatos Oficiais</p>
                  </div>
                  <div className="md:col-span-3 lg:col-span-2">
                    <DetailField label="Regime Tributário" value={lead.tax_regime} onChange={(v:any) => setLead({...lead, tax_regime: v})} />
                  </div>
                  <div className="md:col-span-3 lg:col-span-2">
                    <DetailField label="Entrada Simples/MEI" type="date" value={lead.simples_entry_date || lead.mei_entry_date} onChange={(v:any) => setLead({...lead, simples_entry_date: v})} />
                  </div>
                  <div className="md:col-span-3 lg:col-span-2">
                    <DetailField label="Saída Simples/MEI" type="date" value={lead.simples_exit_date || lead.mei_exit_date} onChange={(v:any) => setLead({...lead, simples_exit_date: v})} />
                  </div>
                  <div className="md:col-span-3 lg:col-span-2">
                    <DetailField label="Telefone Oficial" value={lead.resp_emp_phone} mask={formatPhone} onChange={(v:any) => setLead({...lead, resp_emp_phone: v})} />
                  </div>
                  <div className="md:col-span-6 lg:col-span-4">
                    <DetailField label="E-mail Oficial" value={lead.resp_emp_email} onChange={(v:any) => setLead({...lead, resp_emp_email: v})} />
                  </div>
                </div>
              </section>
            )}

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
                  selectOptions={interactionStatuses?.filter((s: any) => s.active).map((status: any) => ({ value: status.name, label: status.name }))}
                  onChange={(v:any) => setLead({...lead, interaction_status: v})} 
                />
                <DetailField 
                  label="Tipo de Contato" 
                  value={lead.contact_type} 
                  selectOptions={contactTypes?.filter((t: any) => t.active).map((t: any) => t.name)}
                  onChange={(v:any) => setLead({...lead, contact_type: v})} 
                />
                <div className="space-y-1">
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Última Interação</label>
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
                       <DetailField label="Valor Pago Atual" 
                         value={lead.current_value ? Math.round(lead.current_value * 100).toString() : ""} 
                         mask={formatCurrencyValue}
                         onChange={(v:any) => setLead((prev:any) => ({...prev, current_value: parseCurrencyValue(v)}))} 
                       />
                       <DetailField label="Data Início Vigência" type="date" value={lead.contract_start_date} onChange={(v:any) => setLead((prev:any) => ({...prev, contract_start_date: v || null}))} />
                       <DetailField label="Vencimento Contrato" type="date" value={lead.contract_expiry_date} onChange={(v:any) => setLead((prev:any) => ({...prev, contract_expiry_date: v || null}))} />
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
                    label="Modalidade" 
                    value={lead.modality || "PME"} 
                    selectOptions={['Individual', 'Adesão', 'PME', 'Empresarial']}
                    onChange={(v:any) => setLead({...lead, modality: v, administrator: v === 'Adesão' ? lead.administrator : ""})} 
                  />
                  {lead.modality === 'Adesão' && (
                    <DetailField label="Administradora" value={lead.administrator} onChange={(v:any) => setLead({...lead, administrator: v})} />
                  )}
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
      case 'contracts':
        return (
          <div className="p-8 space-y-8 bg-slate-50 min-h-full pb-24">
            <SectionHeader icon={Icons.Contracts} title="Contratos do Cliente" colorClass="bg-blue-100 text-blue-700" />
            
            {contracts.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-slate-200">
                <Icons.Contracts className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Nenhum contrato ativo encontrado</p>
              </div>
            ) : (
              <div className="space-y-6">
                {contracts.map(contract => {
                  const prevValue = Number(contract.previous_plan_value) || 0;
                  const currentValue = Number(contract.monthly_fee) || 0;
                  const monthlySavings = Math.max(0, prevValue - currentValue);
                  const reductionPercent = prevValue > 0 ? Math.round((monthlySavings / prevValue) * 100) : 0;

                  return (
                    <div key={contract.id} className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm space-y-8">
                      {/* Header do Contrato */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 font-black">
                            {(contract.carrier || 'U').substring(0,2).toUpperCase()}
                          </div>
                          <div>
                            <h5 className="text-lg font-black text-slate-900">{contract.carrier}</h5>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{contract.product || 'Plano de Saúde'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-black text-slate-900">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(currentValue)}</p>
                          <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mt-1">Mensalidade Atual</p>
                        </div>
                      </div>

                      {/* Comparativo com Plano Anterior */}
                      <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100/50 space-y-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icons.TrendingDown className="w-4 h-4 text-emerald-600" />
                            <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Entrega de Economia</span>
                          </div>
                          <div className="px-3 py-1 bg-emerald-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm">
                            -{reductionPercent}% de Redução
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-white/80 backdrop-blur-sm p-4 rounded-2xl border border-emerald-100">
                            <p className="text-[8px] font-black text-emerald-400 uppercase tracking-tighter mb-1">Plano Anterior</p>
                            <p className="text-xs font-black text-slate-700 truncate">{contract.previous_plan_name || 'Não Informado'}</p>
                            <p className="text-sm font-black text-slate-900 mt-1">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(prevValue)}</p>
                          </div>
                          <div className="bg-white/80 backdrop-blur-sm p-4 rounded-2xl border border-emerald-100 shadow-sm">
                            <p className="text-[8px] font-black text-emerald-400 uppercase tracking-tighter mb-1">Economia Mensal</p>
                            <p className="text-lg font-black text-emerald-600">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(monthlySavings)}</p>
                          </div>
                          <div className="bg-emerald-600 p-4 rounded-2xl shadow-lg shadow-emerald-100">
                            <p className="text-[8px] font-black text-emerald-100 uppercase tracking-tighter mb-1">Economia em 12 Meses</p>
                            <p className="text-lg font-black text-white">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(monthlySavings * 12)}</p>
                          </div>
                        </div>
                      </div>

                      {/* Info Adicional */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Vigência</p>
                          <p className="text-xs font-bold text-slate-700">{contract.start_date ? new Date(contract.start_date).toLocaleDateString() : '-'}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Contrato</p>
                          <p className="text-xs font-bold text-slate-700">{contract.contract_number || '---'}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Vidas</p>
                          <p className="text-xs font-bold text-slate-700">{contract.lives || 0} Vidas</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-[9px] font-black uppercase">{contract.status}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
      <motion.div 
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed top-0 right-0 h-full w-full bg-white shadow-2xl z-[100] flex flex-col overflow-hidden"
      >
        <div className="px-8 py-6 border-b flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white text-xl font-black overflow-hidden shadow-xl">
              {lead.profile_picture_url ? (
                <img src={lead.profile_picture_url} className="w-full h-full object-cover" />
              ) : (
                String(lead.nickname || lead.name || "?").substring(0,1).toUpperCase()
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-black text-slate-900 leading-tight break-words pr-2">
                    {String(lead.name || "Sem Nome")}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-600 rounded text-[9px] font-black uppercase shadow-sm">LEAD</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">{String(lead.status || "Sem Status")}</span>
                  </div>
                </div>
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
          {['details', 'chat', 'contracts', 'interview', 'history', 'alerts'].map((tab: any) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={cn("px-6 py-5 text-[10px] font-black uppercase tracking-widest transition-all border-b-2", activeTab === tab ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400")}>
              {tab === 'details' ? 'Ficha' : tab === 'chat' ? 'Chat' : tab === 'contracts' ? 'Contratos' : tab === 'interview' ? 'Entrevista IA' : tab === 'history' ? 'Histórico' : 'Avisos'}
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
