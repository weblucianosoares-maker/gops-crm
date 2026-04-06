import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icons } from "./Icons";
import { cn } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { useLeads } from "../lib/leadsContext";
import { useToast } from "./Toasts";

interface LeadCreateScreenProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function LeadCreateScreen({ isOpen, onClose, onSuccess }: LeadCreateScreenProps) {
  const { stages, jobTitles, contactTypes } = useLeads();
  const { success, error, toast: showToast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  
  const [newLead, setNewLead] = useState({ 
    name: '', email: '', phone: '', source: 'Manual', status: stages[0]?.name || 'Novo', contact_type: '',
    has_current_plan: false, interested_lives: 1, current_lives: 0,
    current_carrier: '', current_product: '', current_value: 0,
    rg: '', address_zip: '', address_street: '', address_neighborhood: '',
    address_city: '', address_state: '', address_number: '', address_complement: '',
    docs_link: '', product: '', carrier: '', nickname: '', has_cnpj: false, is_mei: false, cnpj: '',
    lead_type: 'PF' as 'PF' | 'PJ',
    company_name: '',
    contact_person: '',
    job_title: '',
    birth_date: '',
    marriage_date: ''
  });

  const handleCEPChange = async (cep: string) => {
    const cleanCEP = cep.replace(/\D/g, "");
    setNewLead(prev => ({ ...prev, address_zip: cep }));
    
    if (cleanCEP.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setNewLead(prev => ({
            ...prev,
            address_street: data.logradouro,
            address_neighborhood: data.bairro,
            address_city: data.localidade,
            address_state: data.uf
          }));
        }
      } catch (e) {
        console.error("Erro ao buscar CEP:", e);
      }
    }
  };

  const handleCNPJChange = async (cnpj: string) => {
    const cleanCNPJ = cnpj.replace(/\D/g, "");
    setNewLead(prev => ({ ...prev, cnpj: cnpj }));
    
    if (cleanCNPJ.length === 14) {
      try {
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCNPJ}`);
        const data = await response.json();
        if (response.ok && !data.error) {
          setNewLead(prev => ({
            ...prev,
            company_name: data.razao_social,
            name: data.razao_social,
            nickname: data.nome_fantasia || prev.nickname,
          }));
        }
      } catch (e) {
        console.error("Erro ao buscar CNPJ:", e);
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    const normalizedPhone = newLead.phone.replace(/\D/g, '');
    const parts = newLead.name.split(' ').filter(Boolean);
    let initials = 'SN';
    if (parts.length > 1) {
      initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    } else if (newLead.name) {
      initials = newLead.name.substring(0, 2).toUpperCase();
    }

    const { error: supabaseError } = await supabase.from('leads').insert([{
      name: newLead.name,
      email: newLead.email,
      phone: normalizedPhone,
      source: newLead.source,
      status: newLead.status,
      initials: initials,
      current_lives: newLead.current_lives,
      current_carrier: newLead.current_carrier,
      current_product: newLead.current_product,
      current_value: newLead.current_value,
      rg: newLead.rg,
      address_zip: newLead.address_zip,
      address_street: newLead.address_street,
      address_neighborhood: newLead.address_neighborhood,
      address_city: newLead.address_city,
      address_state: newLead.address_state,
      address_number: newLead.address_number,
      address_complement: newLead.address_complement,
      docs_link: newLead.docs_link,
      product: newLead.product,
      carrier: newLead.carrier,
      nickname: newLead.nickname,
      has_cnpj: newLead.has_cnpj,
      is_mei: newLead.is_mei,
      cnpj: newLead.cnpj,
      contact_type: newLead.contact_type,
      lead_type: newLead.lead_type,
      company_name: newLead.company_name,
      contact_person: newLead.contact_person,
      job_title: newLead.job_title,
      birth_date: newLead.birth_date || null,
      marriage_date: newLead.marriage_date || null
    }]);

    setIsSaving(false);
    if (supabaseError) {
      error("Erro ao salvar lead: " + supabaseError.message);
    } else {
      success("Lead cadastrado com sucesso!");
      onSuccess();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, x: '100%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '100%' }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="fixed inset-0 z-[120] bg-white flex flex-col"
    >
      {/* Header */}
      <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-4">
           <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
             <Icons.Plus className="w-6 h-6" />
           </div>
           <h2 className="text-2xl font-black text-slate-900 tracking-tight">Cadastrar Novo Lead</h2>
        </div>
        <button onClick={onClose} className="p-3 text-slate-400 hover:text-slate-900 transition-all hover:bg-slate-50 rounded-xl">
          <Icons.X className="w-7 h-7" />
        </button>
      </div>

      {/* Form Area */}
      <div className="flex-1 overflow-y-auto bg-slate-50/50 custom-scrollbar">
        <form onSubmit={handleSave} className="max-w-[1600px] mx-auto p-8 lg:p-12 space-y-8">
          
          {/* Top Bar with Selector and Quick Stats */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex bg-slate-200/50 p-1.5 rounded-2xl relative shadow-inner w-full md:max-w-sm">
              <button 
                type="button" 
                onClick={() => setNewLead({...newLead, lead_type: 'PF'})}
                className={cn("flex-1 py-3 text-[11px] font-black uppercase tracking-[0.2em] relative z-10 transition-colors", newLead.lead_type === 'PF' ? "text-blue-600" : "text-slate-400")}
              >
                Pessoa Física
              </button>
              <button 
                type="button" 
                onClick={() => setNewLead({...newLead, lead_type: 'PJ'})}
                className={cn("flex-1 py-3 text-[11px] font-black uppercase tracking-[0.2em] relative z-10 transition-colors", newLead.lead_type === 'PJ' ? "text-blue-600" : "text-slate-400")}
              >
                Corporativo (PJ)
              </button>
              <motion.div 
                layoutId="selector"
                className="absolute inset-y-1.5 bg-white rounded-xl shadow-md border border-black/5"
                style={{ 
                  width: 'calc(50% - 6px)',
                  left: newLead.lead_type === 'PF' ? '6px' : 'calc(50%)'
                }}
              />
            </div>
            
            <div className="hidden lg:flex items-center gap-6">
               <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tempo Médio</p>
                  <p className="text-sm font-bold text-slate-600">65s de Cadastro</p>
               </div>
               <div className="w-px h-8 bg-slate-200" />
               <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dica</p>
                  <p className="text-sm font-bold text-blue-600 italic">Pressione TAB para navegar</p>
               </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Coluna Principal (Identificação e Perfil) */}
            <div className="lg:col-span-3 space-y-8">
              
              {/* Seção: Dados de Identificação */}
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-8">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    {newLead.lead_type === 'PF' ? <Icons.Users className="w-5 h-5 text-blue-600" /> : <Icons.Building2 className="w-5 h-5 text-blue-600" />}
                  </div>
                  <h4 className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
                    {newLead.lead_type === 'PF' ? "Dados Pessoais" : "Dados da Empresa"}
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="lg:col-span-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Nome Completo / Razão Social</label>
                    <input 
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all text-sm font-bold text-slate-900"
                      placeholder="Ex: João da Silva / Efraim Saúde LTDA"
                      value={newLead.name}
                      onChange={e => setNewLead({...newLead, name: e.target.value, company_name: e.target.value})}
                    />
                  </div>

                  {newLead.lead_type === 'PF' ? (
                    <>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Data Nascimento</label>
                        <div className="relative">
                          <input 
                            type="date" 
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none focus:bg-white focus:border-blue-500 transition-all text-sm font-bold text-slate-900"
                            value={newLead.birth_date}
                            onChange={e => setNewLead({...newLead, birth_date: e.target.value})}
                          />
                          <Icons.Calendar className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 pointer-events-none" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Data Casamento</label>
                        <div className="relative">
                          <input 
                            type="date" 
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none focus:bg-white focus:border-blue-500 transition-all text-sm font-bold text-slate-900"
                            value={newLead.marriage_date}
                            onChange={e => setNewLead({...newLead, marriage_date: e.target.value})}
                          />
                          <Icons.Calendar className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 pointer-events-none" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">RG</label>
                        <input 
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none focus:bg-white focus:border-blue-500 transition-all text-sm font-bold text-slate-900"
                          placeholder="00.000.000-0"
                          value={newLead.rg}
                          onChange={e => setNewLead({...newLead, rg: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Informações Adic. (Apelido)</label>
                        <input 
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none focus:bg-white focus:border-blue-500 transition-all text-sm font-bold text-slate-900"
                          placeholder="Ex: Juca"
                          value={newLead.nickname}
                          onChange={e => setNewLead({...newLead, nickname: e.target.value})}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">CNPJ</label>
                        <input 
                          required
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none focus:bg-white focus:border-blue-500 transition-all text-sm font-bold text-slate-900"
                          placeholder="00.000.000/0000-00"
                          value={newLead.cnpj}
                          onChange={e => handleCNPJChange(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Nome Fantasia</label>
                        <input 
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none focus:bg-white focus:border-blue-500 transition-all text-sm font-bold text-slate-900"
                          placeholder="Ex: Efraim Consultoria"
                          value={newLead.nickname}
                          onChange={e => setNewLead({...newLead, nickname: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Responsável</label>
                        <input 
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none focus:bg-white focus:border-blue-500 transition-all text-sm font-bold text-slate-900"
                          placeholder="Ex: Maria Souza"
                          value={newLead.contact_person}
                          onChange={e => setNewLead({...newLead, contact_person: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Cargo</label>
                        <select 
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none focus:bg-white focus:border-blue-500 transition-all text-sm font-bold text-slate-700"
                          value={newLead.job_title}
                          onChange={e => setNewLead({...newLead, job_title: e.target.value})}
                        >
                          <option value="">Selecione...</option>
                          {jobTitles.map(jt => <option key={jt.id} value={jt.name}>{jt.name}</option>)}
                        </select>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Seção: Endereço (Expandida) */}
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-8">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="p-2 bg-orange-50 rounded-lg">
                    <Icons.MapPin className="w-5 h-5 text-orange-600" />
                  </div>
                  <h4 className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">Localização</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">CEP</label>
                    <input 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none focus:bg-white focus:border-blue-500 transition-all text-sm font-bold text-slate-900"
                      placeholder="00000-000"
                      value={newLead.address_zip}
                      onChange={e => handleCEPChange(e.target.value)}
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Logradouro / Rua</label>
                    <input 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none focus:bg-white focus:border-blue-500 transition-all text-sm font-bold text-slate-900"
                      value={newLead.address_street}
                      onChange={e => setNewLead({...newLead, address_street: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Número</label>
                    <input 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none focus:bg-white focus:border-blue-500 transition-all text-sm font-bold text-slate-900"
                      value={newLead.address_number}
                      onChange={e => setNewLead({...newLead, address_number: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">UF / Estado</label>
                    <input 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none focus:bg-white focus:border-blue-500 transition-all text-sm font-bold text-slate-900"
                      value={newLead.address_state}
                      onChange={e => setNewLead({...newLead, address_state: e.target.value})}
                    />
                  </div>
                  <div className="lg:col-span-3">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Complemento / Apto / Bloco</label>
                    <input 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none focus:bg-white focus:border-blue-500 transition-all text-sm font-bold text-slate-900"
                      placeholder="Ex: Apto 123, Bloco B"
                      value={newLead.address_complement}
                      onChange={e => setNewLead({...newLead, address_complement: e.target.value})}
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Cidade / Bairro</label>
                    <div className="flex gap-2">
                       <input 
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none focus:bg-white focus:border-blue-500 transition-all text-sm font-bold text-slate-900"
                        placeholder="Cidade"
                        value={newLead.address_city}
                        onChange={e => setNewLead({...newLead, address_city: e.target.value})}
                      />
                      <input 
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none focus:bg-white focus:border-blue-500 transition-all text-sm font-bold text-slate-900"
                        placeholder="Bairro"
                        value={newLead.address_neighborhood}
                        onChange={e => setNewLead({...newLead, address_neighborhood: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Coluna Lateral (Contato e Perfil Rápido) */}
            <div className="lg:col-span-1 space-y-8">
              
              {/* Seção: Contato */}
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="p-2 bg-green-50 rounded-lg">
                    <Icons.Phone className="w-5 h-5 text-green-600" />
                  </div>
                  <h4 className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">Contato</h4>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">WhatsApp</label>
                    <div className="relative">
                      <input 
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none focus:bg-white focus:border-blue-500 transition-all text-sm font-bold text-slate-900"
                        placeholder="(00) 00000-0000"
                        value={newLead.phone}
                        onChange={e => setNewLead({...newLead, phone: e.target.value})}
                      />
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 bg-green-100 rounded-lg">
                        <Icons.Phone className="w-4 h-4 text-green-600" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">E-mail</label>
                    <input 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none focus:bg-white focus:border-blue-500 transition-all text-sm font-bold text-slate-900"
                      placeholder="exemplo@email.com"
                      value={newLead.email}
                      onChange={e => setNewLead({...newLead, email: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* Seção: Perfil Operacional */}
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="p-2 bg-purple-50 rounded-lg">
                    <Icons.Target className="w-5 h-5 text-purple-600" />
                  </div>
                  <h4 className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">Operacional</h4>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Status Inicial</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none focus:bg-white focus:border-blue-500 transition-all text-sm font-bold text-slate-700"
                      value={newLead.status}
                      onChange={e => setNewLead({...newLead, status: e.target.value})}
                    >
                      {stages.map(s => <option key={s.id} value={s.name}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Tipo de Contato</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none focus:bg-white focus:border-blue-500 transition-all text-sm font-bold text-slate-700"
                      value={newLead.contact_type}
                      onChange={e => setNewLead({...newLead, contact_type: e.target.value})}
                    >
                      <option value="">Selecione...</option>
                      {contactTypes.filter(t => t.active).map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Origem do Lead</label>
                    <input 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none focus:bg-white focus:border-blue-500 transition-all text-sm font-bold text-slate-900"
                      value={newLead.source}
                      onChange={e => setNewLead({...newLead, source: e.target.value})}
                    />
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Seção Perfil e Produto (Full Width na parte inferior) */}
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
             <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-8">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Icons.FileText className="w-5 h-5 text-blue-600" />
              </div>
              <h4 className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">Produto e Plano de Interesse</h4>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Operadora / Carrier</label>
                <input 
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none focus:bg-white focus:border-blue-500 transition-all text-sm font-bold text-slate-900"
                  placeholder="Ex: SulAmérica"
                  value={newLead.carrier}
                  onChange={e => setNewLead({...newLead, carrier: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Produto específico</label>
                <input 
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none focus:bg-white focus:border-blue-500 transition-all text-sm font-bold text-slate-900"
                  placeholder="Ex: Top Nacional Plus"
                  value={newLead.product}
                  onChange={e => setNewLead({...newLead, product: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Vidas Estimadas</label>
                <input 
                  type="number"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none focus:bg-white focus:border-blue-500 transition-all text-sm font-bold text-slate-900"
                  value={newLead.current_lives}
                  onChange={e => setNewLead({...newLead, current_lives: Number(e.target.value)})}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Link de Documentos</label>
                <input 
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none focus:bg-white focus:border-blue-500 transition-all text-sm font-bold text-blue-600"
                  placeholder="https://drive.google.com/..."
                  value={newLead.docs_link}
                  onChange={e => setNewLead({...newLead, docs_link: e.target.value})}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-4 pt-12 pb-24">
            <button 
              type="button" 
              onClick={onClose}
              className="px-10 py-5 text-slate-400 font-black uppercase text-[11px] tracking-widest hover:text-slate-600 transition-all"
            >
              Cancelar Registro
            </button>
            <button 
              type="submit" 
              disabled={isSaving}
              className="bg-blue-600 text-white px-16 py-5 rounded-3xl font-black uppercase text-[11px] tracking-[0.2em] shadow-2xl shadow-blue-200 hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-3"
            >
              {isSaving ? (
                <>
                  <Icons.Loader2 className="w-5 h-5 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Icons.Plus className="w-5 h-5" />
                  Finalizar Cadastro
                </>
              )}
            </button>
          </div>

        </form>
      </div>

    </motion.div>
  );
}
