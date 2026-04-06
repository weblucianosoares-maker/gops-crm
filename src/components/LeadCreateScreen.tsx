import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icons } from "./Icons";
import { cn, formatCPF, formatPhone, formatCNPJ, formatCEP } from "../lib/utils";
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
    name: '', email: '', phone: '', secondary_phone: '', source: 'Manual', status: stages[0]?.name || 'Novo', contact_type: '',
    has_current_plan: false, interested_lives: 1, current_lives: 0,
    current_carrier: '', current_product: '', current_value: 0,
    rg: '', cpf: '', marital_status: '',
    address_zip: '', address_street: '', address_neighborhood: '',
    address_city: '', address_state: '', address_number: '', address_complement: '',
    docs_link: '', product: '', carrier: '', nickname: '', has_cnpj: false, is_mei: false, cnpj: '',
    lead_type: 'PF' as 'PF' | 'PJ',
    company_name: '',
    contact_person: '',
    job_title: '',
    birth_date: '',
    marriage_date: '',
    deal_value: 0,
    // Responsável Empresa
    resp_emp_name: '', resp_emp_job: '', resp_emp_birth_date: '', resp_emp_marital_status: '', 
    resp_emp_marriage_date: '', resp_emp_cpf: '', resp_emp_rg: '', resp_emp_whatsapp: '', 
    resp_emp_phone: '', resp_emp_email: '',
    // Responsável Contrato
    resp_con_name: '', resp_con_job: '', resp_con_birth_date: '', resp_con_marital_status: '', 
    resp_con_marriage_date: '', resp_con_cpf: '', resp_con_rg: '', resp_con_whatsapp: '', 
    resp_con_phone: '', resp_con_email: ''
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
            address_state: data.uf,
            address_zip: formatCEP(cleanCEP)
          }));
        }
      } catch (e) {
        console.error("Erro ao buscar CEP:", e);
      }
    }
  };

  const handleCNPJChange = async (cnpj: string) => {
    const formatted = formatCNPJ(cnpj);
    const cleanCNPJ = formatted.replace(/\D/g, "");
    setNewLead(prev => ({ ...prev, cnpj: formatted }));
    
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
            address_zip: data.cep || prev.address_zip,
            address_street: data.logradouro || prev.address_street,
            address_neighborhood: data.bairro || prev.address_neighborhood,
            address_city: data.municipio || prev.address_city,
            address_state: data.uf || prev.address_state,
            address_number: data.numero || prev.address_number,
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
      secondary_phone: newLead.secondary_phone.replace(/\D/g, ''),
      source: newLead.source,
      status: newLead.status,
      initials: initials,
      current_lives: newLead.current_lives,
      interested_lives: newLead.interested_lives,
      current_carrier: newLead.current_carrier,
      current_product: newLead.current_product,
      current_value: newLead.current_value,
      rg: newLead.rg,
      cpf: newLead.cpf.replace(/\D/g, ''),
      marital_status: newLead.marital_status,
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
      cnpj: newLead.cnpj.replace(/\D/g, ''),
      contact_type: newLead.contact_type,
      lead_type: newLead.lead_type,
      company_name: newLead.company_name,
      contact_person: newLead.contact_person,
      job_title: newLead.job_title,
      birth_date: newLead.birth_date || null,
      marriage_date: newLead.marriage_date || null,
      deal_value: newLead.deal_value,
      has_current_plan: newLead.has_current_plan,
      // PME Data
      resp_emp_name: newLead.resp_emp_name,
      resp_emp_job: newLead.resp_emp_job,
      resp_emp_birth_date: newLead.resp_emp_birth_date || null,
      resp_emp_marital_status: newLead.resp_emp_marital_status,
      resp_emp_marriage_date: newLead.resp_emp_marriage_date || null,
      resp_emp_cpf: newLead.resp_emp_cpf.replace(/\D/g, ''),
      resp_emp_rg: newLead.resp_emp_rg,
      resp_emp_whatsapp: newLead.resp_emp_whatsapp.replace(/\D/g, ''),
      resp_emp_phone: newLead.resp_emp_phone.replace(/\D/g, ''),
      resp_emp_email: newLead.resp_emp_email,
      resp_con_name: newLead.resp_con_name,
      resp_con_job: newLead.resp_con_job,
      resp_con_birth_date: newLead.resp_con_birth_date || null,
      resp_con_marital_status: newLead.resp_con_marital_status,
      resp_con_marriage_date: newLead.resp_con_marriage_date || null,
      resp_con_cpf: newLead.resp_con_cpf.replace(/\D/g, ''),
      resp_con_rg: newLead.resp_con_rg,
      resp_con_whatsapp: newLead.resp_con_whatsapp.replace(/\D/g, ''),
      resp_con_phone: newLead.resp_con_phone.replace(/\D/g, ''),
      resp_con_email: newLead.resp_con_email
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

  const SectionHeader = ({ icon: Icon, title, colorClass }: { icon: any, title: string, colorClass: string }) => (
    <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
      <div className={cn("p-2 rounded-lg", colorClass)}>
        <Icon className="w-5 h-5" />
      </div>
      <h4 className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">{title}</h4>
    </div>
  );

  const InputField = ({ label, value, onChange, placeholder, type = "text", required = false, mask }: any) => (
    <div>
      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">{label}</label>
      <input 
        type={type}
        required={required}
        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all text-sm font-bold text-slate-900 placeholder:text-slate-300"
        placeholder={placeholder}
        value={mask ? mask(value) : value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );

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

          {newLead.lead_type === 'PF' ? (
            /* ================= PF FORM FLOW ================= */
            <div className="space-y-8">
              {/* DADOS PESSOAIS */}
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                <SectionHeader icon={Icons.Users} title="Dados Pessoais" colorClass="bg-blue-50 text-blue-600" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="lg:col-span-2">
                    <InputField label="Nome Completo" value={newLead.name} onChange={(v:any) => setNewLead({...newLead, name: v})} placeholder="Ex: João da Silva" required />
                  </div>
                  <InputField label="Data Nascimento" type="date" value={newLead.birth_date} onChange={(v:any) => setNewLead({...newLead, birth_date: v})} />
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Estado Civil</label>
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none focus:bg-white focus:border-blue-500 text-sm font-bold text-slate-700" value={newLead.marital_status} onChange={e => setNewLead({...newLead, marital_status: e.target.value})}>
                      <option value="">Selecione...</option>
                      <option value="Solteiro(a)">Solteiro(a)</option>
                      <option value="Casado(a)">Casado(a)</option>
                      <option value="Divorciado(a)">Divorciado(a)</option>
                      <option value="Viúvo(a)">Viúvo(a)</option>
                      <option value="União Estável">União Estável</option>
                    </select>
                  </div>
                  <InputField label="Data Casamento" type="date" value={newLead.marriage_date} onChange={(v:any) => setNewLead({...newLead, marriage_date: v})} />
                  <InputField label="CPF" value={newLead.cpf} mask={formatCPF} onChange={(v:any) => setNewLead({...newLead, cpf: v})} placeholder="000.000.000-00" />
                  <InputField label="RG" value={newLead.rg} onChange={(v:any) => setNewLead({...newLead, rg: v})} placeholder="00.000.000-0" />
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Tipo de Contato</label>
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none focus:bg-white focus:border-blue-500 text-sm font-bold text-slate-700" value={newLead.contact_type} onChange={e => setNewLead({...newLead, contact_type: e.target.value})}>
                      <option value="">Selecione...</option>
                      {contactTypes.filter(t => t.active).map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                    </select>
                  </div>
                  <InputField label="Origem Lead" value={newLead.source} onChange={(v:any) => setNewLead({...newLead, source: v})} />
                </div>
              </div>

              {/* CONTATO */}
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                <SectionHeader icon={Icons.Phone} title="Contato" colorClass="bg-green-50 text-green-600" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <InputField label="WhatsApp" value={newLead.phone} mask={formatPhone} onChange={(v:any) => setNewLead({...newLead, phone: v})} placeholder="(00) 00000-0000" required />
                  <InputField label="Telefone Contato (Opcional)" value={newLead.secondary_phone} mask={formatPhone} onChange={(v:any) => setNewLead({...newLead, secondary_phone: v})} placeholder="(00) 0000-0000" />
                  <InputField label="E-mail" type="email" value={newLead.email} onChange={(v:any) => setNewLead({...newLead, email: v})} placeholder="exemplo@email.com" />
                </div>
              </div>

              {/* ENDEREÇO */}
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                <SectionHeader icon={Icons.MapPin} title="Endereço" colorClass="bg-orange-50 text-orange-600" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                  <InputField label="CEP" value={newLead.address_zip} mask={formatCEP} onChange={(v:any) => handleCEPChange(v)} placeholder="00000-000" />
                  <div className="lg:col-span-2">
                    <InputField label="Logradouro / Rua" value={newLead.address_street} onChange={(v:any) => setNewLead({...newLead, address_street: v})} />
                  </div>
                  <InputField label="Número" value={newLead.address_number} onChange={(v:any) => setNewLead({...newLead, address_number: v})} />
                  <InputField label="UF / Estado" value={newLead.address_state} onChange={(v:any) => setNewLead({...newLead, address_state: v})} />
                  <div className="lg:col-span-2">
                    <InputField label="Complemento / Apto / Bloco" value={newLead.address_complement} onChange={(v:any) => setNewLead({...newLead, address_complement: v})} />
                  </div>
                  <InputField label="Cidade" value={newLead.address_city} onChange={(v:any) => setNewLead({...newLead, address_city: v})} />
                  <InputField label="Bairro" value={newLead.address_neighborhood} onChange={(v:any) => setNewLead({...newLead, address_neighborhood: v})} />
                  <InputField label="Link Documentos" value={newLead.docs_link} onChange={(v:any) => setNewLead({...newLead, docs_link: v})} placeholder="G-Drive / Dropbox..." />
                </div>
              </div>
            </div>
          ) : (
            /* ================= PME FORM FLOW ================= */
            <div className="space-y-8">
              {/* DADOS DA EMPRESA */}
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                <SectionHeader icon={Icons.Building2} title="Dados da Empresa" colorClass="bg-blue-50 text-blue-600" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <InputField label="CNPJ" value={newLead.cnpj} mask={formatCNPJ} onChange={(v:any) => handleCNPJChange(v)} placeholder="00.000.000/0000-00" required />
                  <div className="md:col-span-2">
                    <InputField label="Razão Social" value={newLead.company_name} onChange={(v:any) => setNewLead({...newLead, company_name: v, name: v})} required />
                  </div>
                  <InputField label="Nome Fantasia" value={newLead.nickname} onChange={(v:any) => setNewLead({...newLead, nickname: v})} />
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Tipo de Contato</label>
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none focus:bg-white focus:border-blue-500 text-sm font-bold text-slate-700" value={newLead.contact_type} onChange={e => setNewLead({...newLead, contact_type: e.target.value})}>
                      <option value="">Selecione...</option>
                      {contactTypes.filter(t => t.active).map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                    </select>
                  </div>
                  <InputField label="Origem Lead" value={newLead.source} onChange={(v:any) => setNewLead({...newLead, source: v})} />
                </div>
              </div>

              {/* DADOS DO RESPONSÁVEL PELA EMPRESA */}
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                <SectionHeader icon={Icons.Users} title="Responsável pela Empresa" colorClass="bg-indigo-50 text-indigo-600" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="lg:col-span-2">
                    <InputField label="Nome Completo" value={newLead.resp_emp_name} onChange={(v:any) => setNewLead({...newLead, resp_emp_name: v, contact_person: v})} />
                  </div>
                  <InputField label="Cargo" value={newLead.resp_emp_job} onChange={(v:any) => setNewLead({...newLead, resp_emp_job: v, job_title: v})} />
                  <InputField label="Data Nascimento" type="date" value={newLead.resp_emp_birth_date} onChange={(v:any) => setNewLead({...newLead, resp_emp_birth_date: v})} />
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Estado Civil</label>
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none focus:bg-white focus:border-blue-500 text-sm font-bold text-slate-700" value={newLead.resp_emp_marital_status} onChange={e => setNewLead({...newLead, resp_emp_marital_status: e.target.value})}>
                      <option value="">Selecione...</option>
                      <option value="Solteiro(a)">Solteiro(a)</option>
                      <option value="Casado(a)">Casado(a)</option>
                      <option value="Divorciado(a)">Divorciado(a)</option>
                      <option value="Viúvo(a)">Viúvo(a)</option>
                      <option value="União Estável">União Estável</option>
                    </select>
                  </div>
                  <InputField label="Data Casamento" type="date" value={newLead.resp_emp_marriage_date} onChange={(v:any) => setNewLead({...newLead, resp_emp_marriage_date: v})} />
                  <InputField label="CPF" value={newLead.resp_emp_cpf} mask={formatCPF} onChange={(v:any) => setNewLead({...newLead, resp_emp_cpf: v})} placeholder="000.000.000-00" />
                  <InputField label="RG" value={newLead.resp_emp_rg} onChange={(v:any) => setNewLead({...newLead, resp_emp_rg: v})} />
                  <InputField label="WhatsApp" value={newLead.resp_emp_whatsapp} mask={formatPhone} onChange={(v:any) => setNewLead({...newLead, resp_emp_whatsapp: v})} placeholder="(00) 00000-0000" />
                  <InputField label="Telefone" value={newLead.resp_emp_phone} mask={formatPhone} onChange={(v:any) => setNewLead({...newLead, resp_emp_phone: v})} placeholder="(00) 0000-0000" />
                  <InputField label="E-mail" type="email" value={newLead.resp_emp_email} onChange={(v:any) => setNewLead({...newLead, resp_emp_email: v})} placeholder="contato@empresa.com" />
                </div>
              </div>

              {/* DADOS DO RESPONSÁVEL PELO CONTRATO */}
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                <SectionHeader icon={Icons.FileText} title="Responsável pelo Contrato" colorClass="bg-emerald-50 text-emerald-600" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="lg:col-span-2">
                    <InputField label="Nome Completo" value={newLead.resp_con_name} onChange={(v:any) => setNewLead({...newLead, resp_con_name: v})} />
                  </div>
                  <InputField label="Cargo" value={newLead.resp_con_job} onChange={(v:any) => setNewLead({...newLead, resp_con_job: v})} />
                  <InputField label="Data Nascimento" type="date" value={newLead.resp_con_birth_date} onChange={(v:any) => setNewLead({...newLead, resp_con_birth_date: v})} />
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Estado Civil</label>
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none focus:bg-white focus:border-blue-500 text-sm font-bold text-slate-700" value={newLead.resp_con_marital_status} onChange={e => setNewLead({...newLead, resp_con_marital_status: e.target.value})}>
                      <option value="">Selecione...</option>
                      <option value="Solteiro(a)">Solteiro(a)</option>
                      <option value="Casado(a)">Casado(a)</option>
                      <option value="Divorciado(a)">Divorciado(a)</option>
                      <option value="Viúvo(a)">Viúvo(a)</option>
                      <option value="União Estável">União Estável</option>
                    </select>
                  </div>
                  <InputField label="Data Casamento" type="date" value={newLead.resp_con_marriage_date} onChange={(v:any) => setNewLead({...newLead, resp_con_marriage_date: v})} />
                  <InputField label="CPF" value={newLead.resp_con_cpf} mask={formatCPF} onChange={(v:any) => setNewLead({...newLead, resp_con_cpf: v})} placeholder="000.000.000-00" />
                  <InputField label="RG" value={newLead.resp_con_rg} onChange={(v:any) => setNewLead({...newLead, resp_con_rg: v})} />
                  <InputField label="WhatsApp" value={newLead.resp_con_whatsapp} mask={formatPhone} onChange={(v:any) => setNewLead({...newLead, resp_con_whatsapp: v})} placeholder="(00) 00000-0000" />
                  <InputField label="Telefone" value={newLead.resp_con_phone} mask={formatPhone} onChange={(v:any) => setNewLead({...newLead, resp_con_phone: v})} placeholder="(00) 0000-0000" />
                  <InputField label="E-mail" type="email" value={newLead.resp_con_email} onChange={(v:any) => setNewLead({...newLead, resp_con_email: v})} placeholder="contato@empresa.com" />
                </div>
              </div>

              {/* ENDEREÇO DA EMPRESA */}
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                <SectionHeader icon={Icons.MapPin} title="Endereço da Empresa" colorClass="bg-orange-50 text-orange-600" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                  <InputField label="CEP" value={newLead.address_zip} mask={formatCEP} onChange={(v:any) => handleCEPChange(v)} placeholder="00000-000" />
                  <div className="lg:col-span-2">
                    <InputField label="Logradouro / Rua" value={newLead.address_street} onChange={(v:any) => setNewLead({...newLead, address_street: v})} />
                  </div>
                  <InputField label="Número" value={newLead.address_number} onChange={(v:any) => setNewLead({...newLead, address_number: v})} />
                  <InputField label="UF / Estado" value={newLead.address_state} onChange={(v:any) => setNewLead({...newLead, address_state: v})} />
                  <div className="lg:col-span-2">
                    <InputField label="Complemento / Apto / Bloco" value={newLead.address_complement} onChange={(v:any) => setNewLead({...newLead, address_complement: v})} />
                  </div>
                  <InputField label="Cidade" value={newLead.address_city} onChange={(v:any) => setNewLead({...newLead, address_city: v})} />
                  <InputField label="Bairro" value={newLead.address_neighborhood} onChange={(v:any) => setNewLead({...newLead, address_neighborhood: v})} />
                  <InputField label="Link Documentos" value={newLead.docs_link} onChange={(v:any) => setNewLead({...newLead, docs_link: v})} />
                </div>
              </div>
            </div>
          )}

          {/* ================= COMMON SECTIONS (Plano Atual & Proposta) ================= */}
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <SectionHeader icon={Icons.Target} title="Plano Atual" colorClass="bg-amber-50 text-amber-600" />
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3 ml-1">Tem plano atualmente?</label>
                <div className="flex gap-4">
                  <button type="button" onClick={() => setNewLead({...newLead, has_current_plan: true})} className={cn("flex-1 py-4 rounded-2xl font-bold transition-all border-2", newLead.has_current_plan ? "bg-amber-50 border-amber-500 text-amber-600 shadow-lg shadow-amber-100" : "bg-slate-50 border-transparent text-slate-400")}>Sim, possui</button>
                  <button type="button" onClick={() => setNewLead({...newLead, has_current_plan: false})} className={cn("flex-1 py-4 rounded-2xl font-bold transition-all border-2", !newLead.has_current_plan ? "bg-slate-900 border-slate-900 text-white" : "bg-slate-50 border-transparent text-slate-400")}>Não possui</button>
                </div>
              </div>

              <AnimatePresence>
                {newLead.has_current_plan && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-4 border-t border-slate-100">
                    <InputField label="Operadora Atual" value={newLead.current_carrier} onChange={(v:any) => setNewLead({...newLead, current_carrier: v})} />
                    <InputField label="Produto Atual" value={newLead.current_product} onChange={(v:any) => setNewLead({...newLead, current_product: v})} />
                    <InputField label="Qtde Vidas" type="number" value={newLead.current_lives} onChange={(v:any) => setNewLead({...newLead, current_lives: v})} />
                    <InputField label="Valor Pago Atual" type="number" value={newLead.current_value} onChange={(v:any) => setNewLead({...newLead, current_value: v})} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <SectionHeader icon={Icons.FileText} title="Proposta Novo Plano" colorClass="bg-blue-50 text-blue-600" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Status no Funil</label>
                <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none focus:bg-white focus:border-blue-500 text-sm font-bold text-slate-700" value={newLead.status} onChange={e => setNewLead({...newLead, status: e.target.value})}>
                  {stages.map(s => <option key={s.id} value={s.name}>{s.label}</option>)}
                </select>
              </div>
              <InputField label="Operadora Proposta" value={newLead.carrier} onChange={(v:any) => setNewLead({...newLead, carrier: v})} />
              <InputField label="Produto Proposta" value={newLead.product} onChange={(v:any) => setNewLead({...newLead, product: v})} />
              <InputField label="Qtde Vidas" type="number" value={newLead.interested_lives} onChange={(v:any) => setNewLead({...newLead, interested_lives: v})} />
              <InputField label="Valor Proposta" type="number" value={newLead.deal_value} onChange={(v:any) => setNewLead({...newLead, deal_value: v})} />
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
