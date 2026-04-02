import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icons } from "./Icons";
import { cn, formatCPF, formatPhone } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { useLeads } from "../lib/leadsContext";

interface LeadDetailDrawerProps {
  lead: any;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export function LeadDetailDrawer({ lead: initialLead, isOpen, onClose, onUpdate }: LeadDetailDrawerProps) {
  const { stages, contactTypes } = useLeads();
  const [lead, setLead] = useState(initialLead);
  const [isSaving, setIsSaving] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [dependents, setDependents] = useState<any[]>([]);
  const [newDependent, setNewDependent] = useState({ name: '', type: 'Dependente', birth_date: '' });
  const [isAddingDependent, setIsAddingDependent] = useState(false);
  const [reminders, setReminders] = useState<any[]>([]);
  const [isAddingReminder, setIsAddingReminder] = useState(false);
  const [newReminder, setNewReminder] = useState({ title: '', due_date: '' });
  const [editingDependentId, setEditingDependentId] = useState<string | null>(null);
  const [editingDependentData, setEditingDependentData] = useState<any>(null);

  useEffect(() => {
    if (initialLead) {
      setLead(initialLead);
      fetchHistory(initialLead.id);
      fetchDependents(initialLead.id);
      fetchReminders(initialLead.id);
    }
  }, [initialLead]);

  const fetchDependents = async (leadId: string) => {
    const { data, error } = await supabase
      .from('beneficiaries')
      .select('*')
      .eq('lead_id', leadId);
    if (!error && data) setDependents(data);
  };

  const fetchHistory = async (leadId: string) => {
    const { data, error } = await supabase
      .from('lead_history')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setHistory(data);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    const { error } = await supabase
      .from('leads')
      .update({
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        secondary_phone: lead.secondary_phone,
        cpf: lead.cpf,
        birth_date: lead.birth_date,
        marital_status: lead.marital_status,
        profession: lead.profession,
        address_street: lead.address_street,
        address_neighborhood: lead.address_neighborhood,
        address_city: lead.address_city,
        address_state: lead.address_state,
        address_zip: lead.address_zip,
        plan_type: lead.plan_type,
        status: lead.status,
        source: lead.source,
        deal_value: lead.deal_value,
        carrier: lead.carrier,
        has_current_plan: lead.has_current_plan,
        current_carrier: lead.current_carrier,
        current_product: lead.current_product,
        current_value: lead.current_value,
        interested_lives: lead.interested_lives,
        current_lives: lead.current_lives,
        rg: lead.rg,
        address_number: lead.address_number,
        address_complement: lead.address_complement,
        docs_link: lead.docs_link,
        product: lead.product,
        nickname: lead.nickname,
        has_cnpj: lead.has_cnpj,
        is_mei: lead.is_mei,
        cnpj: lead.cnpj,
        marriage_date: lead.marriage_date,
        company_name: lead.company_name,
        trading_name: lead.trading_name,
        cnae: lead.cnae,
        company_address: lead.company_address,
        proposal_number: lead.proposal_number,
        savings_value: lead.savings_value,
        savings_percent: lead.savings_percent,
        opening_date: lead.opening_date,
        contact_type: lead.contact_type,
      })
      .eq('id', lead.id);

    setIsSaving(false);
    if (!error) {
      onUpdate();
      onClose(); // FECHA A TELA AO SALVAR
    } else {
      alert("Erro ao salvar: " + error.message);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setIsAddingNote(true);
    const { error } = await supabase
      .from('lead_history')
      .insert([{ lead_id: lead.id, content: newNote }]);
    
    setIsAddingNote(false);
    if (!error) {
      setNewNote("");
      fetchHistory(lead.id);
    }
  };

  const handleAddDependent = async () => {
    if (!newDependent.name.trim()) {
      alert("Por favor, informe o nome do dependente.");
      return;
    }
    if (!newDependent.birth_date) {
      alert("Por favor, informe a data de nascimento.");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('beneficiaries')
        .insert([{ 
          lead_id: lead.id, 
          name: newDependent.name.trim(), 
          type: newDependent.type, 
          birth_date: newDependent.birth_date,
          initials: newDependent.name.trim().substring(0, 2).toUpperCase()
        }]);
      
      if (error) throw error;

      setNewDependent({ name: '', type: 'Dependente', birth_date: '' });
      setIsAddingDependent(false);
      fetchDependents(lead.id);
    } catch (e: any) {
      console.error("Erro ao adicionar dependente:", e);
      alert("Erro ao salvar dependente: " + (e.message || "Verifique sua conexão ou permissões no banco."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveDependent = async (id: string) => {
    const { error } = await supabase.from('beneficiaries').delete().eq('id', id);
    if (!error) fetchDependents(lead.id);
  };

  const handleEditDependent = (dep: any) => {
    setEditingDependentId(dep.id);
    setEditingDependentData({ ...dep });
  };

  const handleUpdateDependent = async () => {
    if (!editingDependentData.name.trim() || !editingDependentData.birth_date) {
      alert("Nome e data de nascimento são obrigatórios.");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('beneficiaries')
        .update({
          name: editingDependentData.name.trim(),
          type: editingDependentData.type,
          birth_date: editingDependentData.birth_date,
          initials: editingDependentData.name.trim().substring(0, 2).toUpperCase()
        })
        .eq('id', editingDependentId);

      if (error) throw error;
      setEditingDependentId(null);
      setEditingDependentData(null);
      fetchDependents(lead.id);
    } catch (e: any) {
      console.error("Erro ao atualizar dependente:", e);
      alert("Erro ao salvar: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const fetchReminders = async (leadId: string) => {
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('lead_id', leadId)
      .eq('status', 'pendente')
      .order('due_date', { ascending: true });
    if (!error && data) setReminders(data);
  };

  const handleAddReminder = async () => {
    if (!newReminder.title || !newReminder.due_date) return;
    setIsSaving(true);
    const { error } = await supabase
      .from('reminders')
      .insert([{
        lead_id: lead.id,
        title: newReminder.title,
        due_date: new Date(newReminder.due_date).toISOString(),
        status: 'pendente'
      }]);
    
    if (!error) {
      setNewReminder({ title: '', due_date: '' });
      setIsAddingReminder(false);
      fetchReminders(lead.id);
    }
    setIsSaving(false);
  };

  const handleCompleteReminder = async (id: string) => {
    const { error } = await supabase
      .from('reminders')
      .update({ status: 'concluido' })
      .eq('id', id);
    if (!error) fetchReminders(lead.id);
  };

  const setQuickDate = (days: number) => {
    const target = new Date();
    target.setDate(target.getDate() + days);
    setNewReminder({ ...newReminder, due_date: target.toISOString().split('T')[0] });
  };

  const handleCEPChange = async (cep: string) => {
    const cleanCEP = cep.replace(/\D/g, "");
    setLead({ ...lead, address_zip: cep });
    
    if (cleanCEP.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setLead(prev => ({
            ...prev,
            address_street: data.logradouro,
            address_neighborhood: data.bairro,
            address_city: data.localidade,
            address_state: data.uf,
            address_zip: cep
          }));
        }
      } catch (e) {
        console.error("Erro ao buscar CEP:", e);
      }
    }
  };

  const handleCNPJChange = async (cnpj: string) => {
    const cleanCNPJ = cnpj.replace(/\D/g, "");
    setLead({ ...lead, cnpj: cnpj });
    
    if (cleanCNPJ.length === 14) {
      try {
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCNPJ}`);
        if (!response.ok) {
          if (response.status === 404) throw new Error("CNPJ não encontrado.");
          throw new Error("Erro na API de dados.");
        }
        
        const data = await response.json();
        const fullAddress = `${data.logradouro}, ${data.numero}${data.complemento ? ' - ' + data.complemento : ''}, ${data.bairro}, ${data.municipio} - ${data.uf}`;
        
        setLead(prev => ({
          ...prev,
          name: prev.name || data.razao_social,
          nickname: prev.nickname || data.nome_fantasia,
          company_name: data.razao_social,
          trading_name: data.nome_fantasia,
          cnae: `${data.cnae_fiscal} - ${data.cnae_fiscal_descricao}`,
          company_address: fullAddress,
          opening_date: data.data_inicio_atividade,
          is_mei: data.opcao_pelo_mei === true,
          cnpj: cnpj
        }));
      } catch (e: any) {
        console.error("Erro ao buscar CNPJ:", e);
        // Não alertar para não interromper a digitação, mas logar
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
      />

      {/* Drawer */}
      <motion.div 
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl flex flex-col"
      >
          {/* Header */}
          <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-blue-200">
                {lead.initials || lead.name?.substring(0, 2)?.toUpperCase() || "L"}
              </div>
              <div>
                <h2 className="text-xl font-black text-blue-900 leading-tight">{lead.name || "Sem Nome"}</h2>
                <div className="flex items-center gap-2 mt-1">
                  {(() => {
                    const currentStage = stages.find(s => s.name === lead.status);
                    return (
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full",
                        currentStage ? currentStage.color : "bg-blue-100 text-blue-700"
                      )}>
                        {currentStage ? currentStage.label : (lead.status || "Novo")}
                      </span>
                    );
                  })()}
                  {lead.contact_type && (
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                      {lead.contact_type}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Desde {lead.created_at ? new Date(lead.created_at).toLocaleDateString('pt-BR') : "N/D"}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                {isSaving ? <Icons.Upload className="w-4 h-4 animate-spin" /> : <Icons.Check className="w-4 h-4" />}
                Salvar Alterações
              </button>
              <button onClick={onClose} className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
                <Icons.X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
            {/* Section: Personal Info */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
                <Icons.Leads className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Dados Pessoais</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-400 ml-1">Nome Completo</label>
                  <input 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                    value={lead.name || ""}
                    onChange={e => setLead({...lead, name: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-400 ml-1">Apelido</label>
                  <input 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                    placeholder="Como prefere ser chamado"
                    value={lead.nickname || ""}
                    onChange={e => setLead({...lead, nickname: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-400 ml-1">CPF</label>
                  <input 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                    placeholder="000.000.000-00"
                    value={formatCPF(lead.cpf) || ""}
                    onChange={e => setLead({...lead, cpf: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-400 ml-1">RG</label>
                  <input 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                    placeholder="00.000.000-0"
                    value={lead.rg || ""}
                    onChange={e => setLead({...lead, rg: e.target.value})}
                  />
                </div>

                <div className="md:col-span-2 space-y-6 pt-6 border-t border-slate-100">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-black text-slate-400 ml-1">Possui CNPJ?</label>
                      <select 
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                        value={lead.has_cnpj ? "Sim" : "Não"}
                        onChange={e => setLead({...lead, has_cnpj: e.target.value === "Sim"})}
                      >
                        <option value="Não">Não</option>
                        <option value="Sim">Sim</option>
                      </select>
                    </div>

                    {lead.has_cnpj && (
                      <>
                        <div className="space-y-1.5 animate-in fade-in zoom-in-95 fill-mode-both duration-300">
                          <label className="text-[10px] uppercase font-black text-slate-400 ml-1">É MEI?</label>
                          <select 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                            value={lead.is_mei ? "Sim" : "Não"}
                            onChange={e => setLead({...lead, is_mei: e.target.value === "Sim"})}
                          >
                            <option value="Não">Não</option>
                            <option value="Sim">Sim</option>
                          </select>
                        </div>
                        <div className="space-y-1.5 animate-in fade-in zoom-in-95 fill-mode-both duration-400">
                          <label className="text-[10px] uppercase font-black text-slate-400 ml-1">CNPJ</label>
                          <input 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                            placeholder="00.000.000/0000-00"
                            value={lead.cnpj || ""}
                            onChange={e => handleCNPJChange(e.target.value)}
                          />
                          {lead.opening_date && (
                            <div className="mt-2 px-1">
                              {(() => {
                                const opening = new Date(lead.opening_date);
                                const today = new Date();
                                const diffDays = Math.floor((today.getTime() - opening.getTime()) / (1000 * 60 * 60 * 24));
                                
                                if (lead.is_mei) {
                                  if (diffDays > 180) {
                                    return <p className="text-[11px] text-blue-600 font-extrabold flex items-center gap-1">
                                      <Icons.Check className="w-3 h-3" />
                                      Liberado: MEI tem mais de 180 dias de existência!
                                    </p>;
                                  } else {
                                    return <p className="text-[11px] text-red-500 font-bold flex items-center gap-1">
                                      <Icons.AlertCircle className="w-3 h-3" />
                                      Atenção: MEI com apenas {diffDays} dias. Necessário 180 dias para PME.
                                    </p>;
                                  }
                                } else {
                                  if (diffDays > 90) {
                                    return <p className="text-[11px] text-blue-600 font-extrabold flex items-center gap-1">
                                      <Icons.Check className="w-3 h-3" />
                                      Liberado: CNPJ tem mais de 90 dias de existência!
                                    </p>;
                                  } else {
                                    return <p className="text-[11px] text-red-500 font-bold flex items-center gap-1">
                                      <Icons.AlertCircle className="w-3 h-3" />
                                      Atenção: CNPJ com apenas {diffDays} dias. Necessário 90 dias para PME.
                                    </p>;
                                  }
                                }
                              })()}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {lead.has_cnpj && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500 fill-mode-both">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-black text-slate-400 ml-1">Razão Social</label>
                          <input 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                            value={lead.company_name || ""}
                            onChange={e => setLead({...lead, company_name: e.target.value})}
                          />
                        </div>
                        <div className="space-y-1.5 text-left">
                          <label className="text-[10px] uppercase font-black text-slate-400 ml-1">Nome Fantasia</label>
                          <input 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                            value={lead.trading_name || ""}
                            onChange={e => setLead({...lead, trading_name: e.target.value})}
                          />
                        </div>
                        <div className="space-y-1.5 text-left">
                          <label className="text-[10px] uppercase font-black text-slate-400 ml-1">Data de Abertura</label>
                          <input 
                            type="date"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                            value={lead.opening_date || ""}
                            onChange={e => setLead({...lead, opening_date: e.target.value})}
                          />
                        </div>
                        <div className="space-y-1.5 text-left">
                          <label className="text-[10px] uppercase font-black text-slate-400 ml-1">Tempo de Existência</label>
                          <div className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-600">
                            {(() => {
                              if (!lead.opening_date) return "N/D";
                              const opening = new Date(lead.opening_date);
                              const today = new Date();
                              const diff = Math.floor((today.getTime() - opening.getTime()) / (1000 * 60 * 60 * 24));
                              return diff > 0 ? `${diff} dias` : "0 dias";
                            })()}
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-black text-slate-400 ml-1">CNAE (Atividade Principal)</label>
                        <input 
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                          value={lead.cnae || ""}
                          onChange={e => setLead({...lead, cnae: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-black text-slate-400 ml-1">Endereço da Empresa (Sede)</label>
                        <input 
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                          value={lead.company_address || ""}
                          onChange={e => setLead({...lead, company_address: e.target.value})}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-400 ml-1">Data de Nascimento</label>
                  <input 
                    type="date"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                    value={lead.birth_date || ""}
                    onChange={e => setLead({...lead, birth_date: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-400 ml-1">Estado Civil</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                    value={lead.marital_status || ""}
                    onChange={e => setLead({...lead, marital_status: e.target.value})}
                  >
                    <option value="">Selecione...</option>
                    <option value="Solteiro">Solteiro(a)</option>
                    <option value="Casado">Casado(a)</option>
                    <option value="Divorciado">Divorciado(a)</option>
                    <option value="Viúvo">Viúvo(a)</option>
                    <option value="União Estável">União Estável</option>
                  </select>
                </div>
                {lead.marital_status === "Casado" && (
                  <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
                    <label className="text-[10px] uppercase font-black text-slate-400 ml-1">Data de Casamento</label>
                    <input 
                      type="date"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                      value={lead.marriage_date || ""}
                      onChange={e => setLead({...lead, marriage_date: e.target.value})}
                    />
                  </div>
                )}
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-400 ml-1">Profissão</label>
                  <div className="relative">
                    <Icons.Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                      placeholder="Ex: Consultor de TI"
                      value={lead.profession || ""}
                      onChange={e => setLead({...lead, profession: e.target.value})}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Section: Contacts */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
                <Icons.Phone className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Contatos</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-400 ml-1">Telefone Principal</label>
                  <input 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                    value={formatPhone(lead.phone) || ""}
                    onChange={e => setLead({...lead, phone: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-400 ml-1">WhatsApp / Secundário</label>
                  <input 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                    value={formatPhone(lead.secondary_phone) || ""}
                    onChange={e => setLead({...lead, secondary_phone: e.target.value})}
                  />
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-400 ml-1">Email</label>
                  <div className="relative">
                    <Icons.Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                      value={lead.email || ""}
                      onChange={e => setLead({...lead, email: e.target.value})}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Section: Address */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
                <Icons.MapPin className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Endereço</h3>
              </div>
              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-4 space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-400 ml-1">CEP</label>
                  <input 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                    value={lead.address_zip || ""}
                    onChange={e => handleCEPChange(e.target.value)}
                  />
                </div>
                <div className="col-span-8 space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-400 ml-1">Rua / Logradouro</label>
                  <input 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                    value={lead.address_street || ""}
                    onChange={e => setLead({...lead, address_street: e.target.value})}
                  />
                </div>
                <div className="col-span-12 md:col-span-4 space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-400 ml-1">Número</label>
                  <input 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                    placeholder="123"
                    value={lead.address_number || ""}
                    onChange={e => setLead({...lead, address_number: e.target.value})}
                  />
                </div>
                <div className="col-span-12 md:col-span-8 space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-400 ml-1">Complemento</label>
                  <input 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                    placeholder="Apto, Bloco, etc."
                    value={lead.address_complement || ""}
                    onChange={e => setLead({...lead, address_complement: e.target.value})}
                  />
                </div>
                <div className="col-span-12 md:col-span-5 space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-400 ml-1">Bairro</label>
                  <input 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                    value={lead.address_neighborhood || ""}
                    onChange={e => setLead({...lead, address_neighborhood: e.target.value})}
                  />
                </div>
                <div className="col-span-12 md:col-span-5 space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-400 ml-1">Cidade</label>
                  <input 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                    value={lead.address_city || ""}
                    onChange={e => setLead({...lead, address_city: e.target.value})}
                  />
                </div>
                <div className="col-span-12 md:col-span-2 space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-400 ml-1">Estado</label>
                  <input 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none uppercase"
                    maxLength={2}
                    value={lead.address_state || ""}
                    onChange={e => setLead({...lead, address_state: e.target.value})}
                  />
                </div>
                <div className="col-span-12 space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-400 ml-1">Link da Documentação (Google Drive)</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Icons.Upload className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm font-bold text-blue-600 focus:bg-white focus:border-blue-500 transition-all outline-none"
                        placeholder="https://drive.google.com/..."
                        value={lead.docs_link || ""}
                        onChange={e => setLead({...lead, docs_link: e.target.value})}
                      />
                    </div>
                    {lead.docs_link && (
                      <button 
                        onClick={() => window.open(lead.docs_link, '_blank')}
                        className="px-6 bg-blue-50 text-blue-600 text-xs font-black uppercase rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm border border-blue-100 flex items-center gap-2"
                      >
                        <Icons.Logout className="w-4 h-4 rotate-[-90deg]" />
                        Abrir
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Section: Current Insurance Situation */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
                <Icons.Info className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Situação Atual e Interesse</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-400 ml-1">Possui plano atualmente?</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                    value={lead.has_current_plan ? "Sim" : "Não"}
                    onChange={e => setLead({...lead, has_current_plan: e.target.value === "Sim"})}
                  >
                    <option value="Não">Não</option>
                    <option value="Sim">Sim</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-400 ml-1">Vidas de Interesse</label>
                  <input 
                    type="number"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                    value={lead.interested_lives ?? 1}
                    onChange={e => setLead({...lead, interested_lives: parseInt(e.target.value) || 0})}
                  />
                </div>

                {lead.has_current_plan && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-black text-slate-400 ml-1">Operadora Atual</label>
                      <input 
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                        placeholder="Nome da Operadora"
                        value={lead.current_carrier || ""}
                        onChange={e => setLead({...lead, current_carrier: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-black text-slate-400 ml-1">Produto / Plano Atual</label>
                      <input 
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                        placeholder="Ex: Top Nacional, Flex, etc."
                        value={lead.current_product || ""}
                        onChange={e => setLead({...lead, current_product: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-black text-slate-400 ml-1">Vidas no Contrato Atual</label>
                      <input 
                        type="number"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                        value={lead.current_lives ?? 0}
                        onChange={e => setLead({...lead, current_lives: parseInt(e.target.value) || 0})}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-black text-slate-400 ml-1">Valor Atual Pago (Total R$)</label>
                      <input 
                        type="text"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                        placeholder="R$ 0,00"
                        value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(lead.current_value?.toString() || "0"))}
                        onChange={e => {
                          const numericStr = e.target.value.replace(/\D/g, "");
                          const val = numericStr ? parseInt(numericStr, 10) / 100 : 0;
                          setLead({ ...lead, current_value: val });
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
            </section>

            {/* Nova Seção: Análise de Economia */}
            {(() => {
              const currVal = parseFloat(lead.current_value?.toString() || "0");
              const dealVal = parseFloat(lead.deal_value?.toString() || "0");
              if (currVal <= 0 && dealVal <= 0) return null;
              
              const savings = currVal - dealVal;
              let percent = 0;
              if (currVal > 0) percent = (savings / currVal) * 100;
              else if (dealVal > 0) percent = -100; // was 0, now effectively 100% increase if no previous plan

              return (
                <section className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
                    <Icons.TrendingUp className="w-5 h-5 text-emerald-600" />
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Análise de Economia</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex justify-between items-center">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Economia Mensal</p>
                        <p className={cn(
                          "text-xl font-black",
                          savings >= 0 ? "text-emerald-600" : "text-rose-600"
                        )}>
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(savings)}
                        </p>
                      </div>
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center bg-white shadow-sm border",
                        savings >= 0 ? "border-emerald-100 text-emerald-600" : "border-rose-100 text-rose-600"
                      )}>
                        {savings >= 0 ? <Icons.TrendingUp className="w-6 h-6" /> : <Icons.TrendingUp className="w-6 h-6 rotate-180" />}
                      </div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex justify-between items-center">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Performance (%)</p>
                        <p className={cn(
                          "text-xl font-black",
                          percent >= 0 ? "text-emerald-600" : "text-rose-600"
                        )}>
                          {percent.toFixed(1)}%
                        </p>
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase text-right max-w-[80px]">
                        {percent >= 0 ? "Redução de custo" : "Aumento de custo"}
                      </p>
                    </div>
                  </div>
                </section>
              );
            })()}

            {/* Section: Sale Profile */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
                <Icons.Target className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Perfil do Plano</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-400 ml-1">Tipo de Plano</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                    value={lead.plan_type || ""}
                    onChange={e => setLead({...lead, plan_type: e.target.value})}
                  >
                    <option value="">Selecione...</option>
                    <option value="Empresarial">Plano Empresarial (PME/PJ)</option>
                    <option value="Adesão">Adesão por Categoria</option>
                    <option value="Individual">Individual / Familiar</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-400 ml-1">Status no Pipeline</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                    value={lead.status || ""}
                    onChange={e => setLead({...lead, status: e.target.value})}
                  >
                    {stages.map(s => (
                      <option key={s.id} value={s.name}>{s.label}</option>
                    ))}
                    {!stages.find(s => s.name === lead.status) && lead.status && (
                      <option value={lead.status}>{lead.status} (Legado)</option>
                    )}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-400 ml-1">Tipo de Contato</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                    value={lead.contact_type || ""}
                    onChange={e => setLead({...lead, contact_type: e.target.value})}
                  >
                    <option value="">Não definido</option>
                    {contactTypes?.filter(t => t.active).map(t => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-400 ml-1">Origem (Fonte)</label>
                  <input 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                    placeholder="Ex: WhatsApp, Google, etc."
                    value={lead.source || ""}
                    onChange={e => setLead({...lead, source: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-400 ml-1">Valor da Proposta (R$)</label>
                  <div className="relative">
                    <Icons.CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                      placeholder="R$ 0,00"
                      value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(lead.deal_value?.toString() || "0"))}
                      onChange={e => {
                        const numericStr = e.target.value.replace(/\D/g, "");
                        const val = numericStr ? parseInt(numericStr, 10) / 100 : 0;
                        setLead({ ...lead, deal_value: val });
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-400 ml-1">Número da Proposta</label>
                  <div className="relative">
                    <Icons.FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                      placeholder="Nº da Proposta na Operadora"
                      value={lead.proposal_number || ""}
                      onChange={e => setLead({...lead, proposal_number: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-400 ml-1">Operadora / Convênio</label>
                  <div className="relative">
                    <Icons.Heart className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                      placeholder="Ex: SulAmérica, Unimed, etc."
                      value={lead.carrier || ""}
                      onChange={e => setLead({...lead, carrier: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-400 ml-1">Produto Ofertado</label>
                  <div className="relative">
                    <Icons.Check className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                      placeholder="Ex: Top Nacional, Flex, etc."
                      value={lead.product || ""}
                      onChange={e => setLead({...lead, product: e.target.value})}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Section: Dependents */}
            <section className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-3">
                  <Icons.Users className="w-5 h-5 text-blue-600" />
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Dependentes & Agregados</h3>
                </div>
                <button 
                  onClick={() => setIsAddingDependent(!isAddingDependent)}
                  className="text-[10px] font-black text-blue-600 uppercase px-3 py-1 bg-blue-50 rounded-lg hover:bg-blue-600 hover:text-white transition-all"
                >
                  {isAddingDependent ? "Cancelar" : "+ Adicionar"}
                </button>
              </div>

              {isAddingDependent && (
                <div className="bg-slate-50 p-6 rounded-2xl border border-blue-100 space-y-4 animate-in zoom-in-95 duration-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-black text-slate-400 ml-1">Nome</label>
                      <input 
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-blue-500 transition-all font-bold"
                        placeholder="Nome do dependente"
                        value={newDependent.name}
                        onChange={e => setNewDependent({...newDependent, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-black text-slate-400 ml-1">Parentesco</label>
                      <select 
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-blue-500"
                        value={newDependent.type}
                        onChange={e => setNewDependent({...newDependent, type: e.target.value})}
                      >
                        <option value="Dependente">Dependente</option>
                        <option value="Cônjuge">Cônjuge</option>
                        <option value="Filho(a)">Filho(a)</option>
                        <option value="Pai/Mãe">Pai/Mãe</option>
                        <option value="Sócio">Sócio</option>
                        <option value="Funcionário">Funcionário</option>
                      </select>
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-[10px] uppercase font-black text-slate-400 ml-1">Data de Nascimento</label>
                      <input 
                        type="date"
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-blue-500"
                        value={newDependent.birth_date}
                        onChange={e => setNewDependent({...newDependent, birth_date: e.target.value})}
                      />
                    </div>
                  </div>
                  <button 
                    onClick={handleAddDependent}
                    disabled={isSaving}
                    className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSaving && <Icons.Clock className="w-4 h-4 animate-spin" />}
                    {isSaving ? "Salvando..." : "Confirmar Cadastro"}
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3">
                {dependents.map((dep) => (
                  <div key={dep.id} className="group bg-white p-4 rounded-xl border border-slate-100 flex items-center justify-between hover:border-blue-200 transition-all shadow-sm">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                        {dep.initials}
                      </div>
                      {editingDependentId === dep.id ? (
                        <div className="flex-1 grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-left-2">
                           <input 
                             className="bg-slate-50 border rounded-lg px-3 py-1 text-xs font-bold focus:bg-white outline-none"
                             value={editingDependentData.name}
                             onChange={e => setEditingDependentData({...editingDependentData, name: e.target.value})}
                           />
                           <select 
                             className="bg-slate-50 border rounded-lg px-2 py-1 text-xs font-bold outline-none"
                             value={editingDependentData.type}
                             onChange={e => setEditingDependentData({...editingDependentData, type: e.target.value})}
                           >
                             <option value="Dependente">Dependente</option>
                             <option value="Cônjuge">Cônjuge</option>
                             <option value="Filho(a)">Filho(a)</option>
                             <option value="Pai/Mãe">Pai/Mãe</option>
                             <option value="Sócio">Sócio</option>
                             <option value="Funcionário">Funcionário</option>
                           </select>
                           <input 
                             type="date"
                             className="bg-slate-50 border rounded-lg px-3 py-1 text-xs font-bold focus:bg-white outline-none col-span-2"
                             value={editingDependentData.birth_date}
                             onChange={e => setEditingDependentData({...editingDependentData, birth_date: e.target.value})}
                           />
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm font-bold text-slate-900 leading-none mb-1">{dep.name}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{dep.type}</span>
                            <span className="w-1 h-1 rounded-full bg-slate-200" />
                            <span className="text-[10px] font-bold text-blue-600 uppercase">
                              Nasc: {new Date(dep.birth_date).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {editingDependentId === dep.id ? (
                        <>
                          <button 
                            onClick={handleUpdateDependent}
                            className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                          >
                            <Icons.Check className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => { setEditingDependentId(null); setEditingDependentData(null); }}
                            className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg transition-all"
                          >
                            <Icons.X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button 
                            onClick={() => handleEditDependent(dep)}
                            className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Icons.Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleRemoveDependent(dep.id)}
                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Icons.X className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {dependents.length === 0 && !isAddingDependent && (
                  <div className="text-center py-8 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center bg-slate-50/30">
                    <Icons.Users className="w-8 h-8 text-slate-200 mb-2" />
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Nenhum dependente</p>
                  </div>
                )}
              </div>
            </section>

            {/* Section: Reminders */}
            <section className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-3">
                  <Icons.Calendar className="w-5 h-5 text-blue-600" />
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Lembretes & Agendamentos</h3>
                </div>
                <button 
                  onClick={() => setIsAddingReminder(!isAddingReminder)}
                  className="text-[10px] font-black text-blue-600 uppercase px-3 py-1 bg-blue-50 rounded-lg hover:bg-blue-600 hover:text-white transition-all transition-colors"
                >
                  {isAddingReminder ? "Cancelar" : "+ Agendar Ação"}
                </button>
              </div>

              {isAddingReminder && (
                <div className="bg-slate-50 p-6 rounded-2xl border border-blue-100 space-y-4 animate-in slide-in-from-top-2 duration-300">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black text-slate-400 ml-1">O que deve ser feito?</label>
                    <input 
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 transition-all font-bold text-slate-900 placeholder:font-normal"
                      placeholder="Ex: Entrar em contato para realizar a nova cotação..."
                      value={newReminder.title}
                      onChange={e => setNewReminder({...newReminder, title: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black text-slate-400 ml-1">Data do Lembrete</label>
                    <input 
                      type="date"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                      value={newReminder.due_date}
                      onChange={e => setNewReminder({...newReminder, due_date: e.target.value})}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setQuickDate(30)} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-slate-500 hover:border-blue-500 hover:text-blue-600 transition-all uppercase">+30 Dias</button>
                    <button onClick={() => setQuickDate(60)} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-slate-500 hover:border-blue-500 hover:text-blue-600 transition-all uppercase">+60 Dias</button>
                    <button onClick={() => setQuickDate(90)} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-slate-500 hover:border-blue-500 hover:text-blue-600 transition-all uppercase">+90 Dias</button>
                  </div>
                  <button 
                    onClick={handleAddReminder}
                    className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 active:scale-[0.98]"
                  >
                    Salvar Agendamento
                  </button>
                </div>
              )}

              <div className="space-y-3">
                {reminders.map((rem) => (
                  <div key={rem.id} className="group bg-white p-4 rounded-xl border border-slate-100 flex items-center justify-between hover:border-blue-200 transition-all shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                        <Icons.Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 leading-tight mb-1">{rem.title}</p>
                        <div className="flex items-center gap-2">
                           <span className={cn(
                             "text-[10px] font-bold uppercase px-2 py-0.5 rounded",
                             new Date(rem.due_date) < new Date() ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600"
                           )}>
                             {new Date(rem.due_date).toLocaleDateString('pt-BR')}
                           </span>
                           <span className="text-[10px] text-slate-400 font-bold uppercase">Agendado</span>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleCompleteReminder(rem.id)}
                      className="p-2.5 text-slate-300 hover:text-green-500 hover:bg-green-50 rounded-xl transition-all"
                      title="Marcar como concluído"
                    >
                      <Icons.Check className="w-5 h-5" />
                    </button>
                  </div>
                ))}
                {reminders.length === 0 && !isAddingReminder && (
                  <div className="text-center py-8 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center bg-slate-50/30">
                    <Icons.Calendar className="w-8 h-8 text-slate-200 mb-2" />
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Sem agendamentos futuros</p>
                  </div>
                )}
              </div>
            </section>

            {/* Section: History */}
            <section className="space-y-6 pb-12">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-3">
                  <Icons.History className="w-5 h-5 text-blue-600" />
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Últimas Interações</h3>
                </div>
                <span className="text-[10px] font-black text-blue-600 uppercase px-2 py-0.5 bg-blue-50 rounded">{history.length} Notas</span>
              </div>
              
              <div className="space-y-4">
                {/* Note Input */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 focus-within:border-blue-500 transition-all">
                  <textarea 
                    rows={2}
                    className="w-full bg-transparent border-none outline-none text-sm font-medium text-slate-700 placeholder:text-slate-400 resize-none"
                    placeholder="Adicionar nota de contato..."
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                  />
                  <div className="flex justify-end mt-2 pt-2 border-t border-slate-200">
                    <button 
                      onClick={handleAddNote}
                      disabled={isAddingNote || !newNote.trim()}
                      className="bg-white border border-slate-200 text-blue-600 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-600 hover:text-white transition-all shadow-sm disabled:opacity-50"
                    >
                      {isAddingNote ? "Enviando..." : "Registrar Nota"}
                    </button>
                  </div>
                </div>

                {/* Timeline */}
                <div className="space-y-4 relative before:absolute before:left-5 before:top-2 before:bottom-0 before:w-0.5 before:bg-slate-100">
                  {history.map((item) => (
                    <div key={item.id} className="relative pl-12">
                      <div className="absolute left-3.5 top-2 w-3.5 h-3.5 rounded-full bg-white border-4 border-blue-600 shadow-sm" />
                      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            {item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : "N/D"}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 font-medium leading-relaxed">{item.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </motion.div>
      </div>
  );
}
