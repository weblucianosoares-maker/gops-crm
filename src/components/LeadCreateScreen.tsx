import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icons } from "./Icons";
import { cn, formatCPF, formatPhone, formatCNPJ, formatCEP, formatCurrencyValue, parseCurrencyValue } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { useLeads } from "../lib/leadsContext";
import { useToast } from "./Toasts";
import { validateLeadWhatsApp } from "../lib/evolution";
import { DatePicker } from "./DatePicker";

interface LeadCreateScreenProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const SectionHeader = ({ icon: Icon, title, colorClass }: { icon: any, title: string, colorClass: string }) => (
  <div className="flex items-center gap-3 border-b border-slate-100 pb-3 mb-4 md:pb-4 md:mb-6">
    <div className={cn("p-1.5 md:p-2 rounded-lg", colorClass)}>
      <Icon className="w-4 h-4 md:w-5 md:h-5" />
    </div>
    <h4 className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">{title}</h4>
  </div>
);

const InputField = ({ label, value, onChange, placeholder, type = "text", required = false, mask }: any) => (
  <div className="space-y-1">
    <label className="block text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">{label}</label>
    <input 
      type={type}
      required={required}
      className="w-full bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl px-4 py-3 md:px-6 md:py-4 outline-none focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all text-sm font-bold text-slate-900 placeholder:text-slate-300"
      placeholder={placeholder}
      value={mask ? mask(value) : value}
      onChange={e => onChange(e.target.value)}
    />
  </div>
);

export function LeadCreateScreen({ isOpen, onClose, onSuccess }: LeadCreateScreenProps) {
   const { 
     stages, 
     jobTitles, 
     contactTypes, 
     carriers, 
     products,
     interactionStatuses 
   } = useLeads();
   const { success, error, toast: showToast } = useToast();
   const [isSaving, setIsSaving] = useState(false);
   const [showSelection, setShowSelection] = useState(true);
   const [isSearchingCNPJ, setIsSearchingCNPJ] = useState(false);
   
   const [newLead, setNewLead] = useState({ 
     name: '', email: '', phone: '', secondary_phone: '', source: 'Manual', status: stages[0]?.name || 'Novo', contact_type: '',
     plan_type: 'Saúde' as 'Saúde' | 'Odonto' | 'Saúde + Odonto',
     has_current_plan: false, interested_lives: 1, current_lives: 0,
     current_carrier: '', current_product: '', current_value: 0,
     contract_expiry_date: '', has_broker: false,
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
     cnae: '',
     opening_date: '',
     // Responsável Empresa
     resp_emp_name: '', resp_emp_job: '', resp_emp_birth_date: '', resp_emp_marital_status: '', 
     resp_emp_marriage_date: '', resp_emp_cpf: '', resp_emp_rg: '', resp_emp_whatsapp: '', 
     resp_emp_phone: '', resp_emp_email: '',
     // Responsável Contrato
     resp_con_name: '', resp_con_job: '', resp_con_birth_date: '', resp_con_marital_status: '', 
     resp_con_marriage_date: '', resp_con_cpf: '', resp_con_rg: '', resp_con_whatsapp: '', 
     resp_con_phone: '', resp_con_email: '',
     temperature: 'Morno',
     interaction_status: 'Sem Status'
   });

   // Reset component when opening
   React.useEffect(() => {
     if (isOpen) {
       setShowSelection(true);
     }
   }, [isOpen]);

   const selectType = (type: 'PF' | 'PJ') => {
     setNewLead(prev => ({ ...prev, lead_type: type }));
     setShowSelection(false);
   };

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
      setIsSearchingCNPJ(true);
      try {
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCNPJ}`);
        const data = await response.json();
        if (response.ok && !data.error) {
          setNewLead(prev => ({
            ...prev,
            company_name: data.razao_social || data.nome_fantasia || prev.company_name,
            name: data.razao_social || data.nome_fantasia || prev.name,
            nickname: data.nome_fantasia || data.razao_social || prev.nickname,
            address_zip: data.cep ? formatCEP(data.cep) : prev.address_zip,
            address_street: data.logradouro || prev.address_street,
            address_neighborhood: data.bairro || prev.address_neighborhood,
            address_city: data.municipio || prev.address_city,
            address_state: data.uf || prev.address_state,
            address_number: data.numero || prev.address_number,
            cnae: data.cnae_fiscal ? `${data.cnae_fiscal}${data.cnae_fiscal_descricao ? ' - ' + data.cnae_fiscal_descricao : ''}` : (data.cnae_fiscal_descricao || prev.cnae),
            opening_date: data.data_abertura || prev.opening_date,
            email: data.email || prev.email,
            phone: data.ddd_telefone_1 ? formatPhone(data.ddd_telefone_1) : prev.phone
          }));
          showToast("Dados do CNPJ carregados com sucesso!", "success");
        }
      } catch (e) {
        console.error("Erro ao buscar CNPJ:", e);
      } finally {
        setIsSearchingCNPJ(false);
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

    const { data, error: supabaseError } = await supabase.from('leads').insert([{
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
      contract_expiry_date: newLead.contract_expiry_date || null,
      has_broker: !!newLead.has_broker,
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
      plan_type: newLead.plan_type,
      cnae: newLead.cnae,
      opening_date: newLead.opening_date || null,
      // PME Data
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
      resp_con_email: newLead.resp_con_email,
      temperature: newLead.temperature,
      interaction_status: newLead.interaction_status || 'Sem Status',
      status_updated_at: new Date().toISOString()
    }]).select();
      
    if (supabaseError) {
      error("Erro ao salvar lead: " + supabaseError.message);
    } else {
      success("Lead cadastrado com sucesso!");
      
      // Validação automática de WhatsApp após o cadastro
      if (data && data[0] && data[0].phone) {
        validateLeadWhatsApp(data[0].id, data[0].phone).then(() => {
          onSuccess(); // Refresh leads again to show the status
        });
      }

      onSuccess();
      onClose();
    }
    setIsSaving(false);
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
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              {showSelection ? "Novo Cadastro" : `Novo Lead ${newLead.lead_type === 'PF' ? "Pessoa Física" : "PME"}`}
            </h2>
         </div>
         {!showSelection && (
           <button 
             onClick={() => setShowSelection(true)}
             className="mr-auto ml-8 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 transition-colors"
           >
             <Icons.ChevronLeft className="w-4 h-4" />
             Voltar para Seleção
           </button>
         )}
         <button onClick={onClose} className="p-3 text-slate-400 hover:text-slate-900 transition-all hover:bg-slate-50 rounded-xl">
           <Icons.X className="w-7 h-7" />
         </button>
       </div>

       {/* Form Area */}
       <div className="flex-1 overflow-y-auto bg-slate-50/50 custom-scrollbar">
         {showSelection ? (
           /* ================= SELECTION SCREEN ================= */
           <div className="max-w-4xl mx-auto px-8 py-20 flex flex-col items-center justify-center min-h-[70vh]">
             <motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className="text-center mb-12"
             >
               <h3 className="text-3xl font-black text-slate-900 mb-2">Qual o perfil do Lead?</h3>
               <p className="text-slate-500 font-medium">Selecione uma das opções para continuar o cadastro</p>
             </motion.div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
               {/* PF CARD */}
               <motion.button
                 whileHover={{ scale: 1.02, y: -4 }}
                 whileTap={{ scale: 0.98 }}
                 onClick={() => selectType('PF')}
                 className="bg-white p-10 rounded-[2.5rem] border-2 border-transparent hover:border-blue-500 shadow-xl shadow-slate-200/50 flex flex-col items-center text-center group transition-all"
               >
                 <div className="w-24 h-24 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mb-8 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-lg shadow-blue-100">
                   <Icons.Users className="w-12 h-12" />
                 </div>
                 <h4 className="text-xl font-black text-slate-900 mb-3">Pessoa Física</h4>
                 <p className="text-slate-500 text-sm leading-relaxed">
                   Cadastro simplificado para indivíduos, <br />foco em planos de saúde individuais e familiares.
                 </p>
               </motion.button>

               {/* PME CARD */}
               <motion.button
                 whileHover={{ scale: 1.02, y: -4 }}
                 whileTap={{ scale: 0.98 }}
                 onClick={() => selectType('PJ')}
                 className="bg-white p-10 rounded-[2.5rem] border-2 border-transparent hover:border-blue-500 shadow-xl shadow-slate-200/50 flex flex-col items-center text-center group transition-all"
               >
                 <div className="w-24 h-24 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-8 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-lg shadow-indigo-100">
                   <Icons.Building2 className="w-12 h-12" />
                 </div>
                 <h4 className="text-xl font-black text-slate-900 mb-3">Corporativo (PME)</h4>
                 <p className="text-slate-500 text-sm leading-relaxed">
                   Cadastro completo para empresas e PJ, <br />com gestão de múltiplos sócios e responsáveis.
                 </p>
               </motion.button>
             </div>
           </div>
         ) : (
           /* ================= ACTUAL FORMS ================= */
           <form onSubmit={handleSave} className="max-w-[1600px] mx-auto p-8 lg:p-12 space-y-8">
             <div className="flex flex-col lg:flex-row gap-8 items-start">
               {/* Main Form Cards */}
               <div className="flex-1 space-y-8 w-full">
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
                         <div>
                           <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Data Nascimento</label>
                           <DatePicker value={newLead.birth_date} onChange={(v:any) => setNewLead(prev => ({...prev, birth_date: v}))} />
                         </div>
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
                         <div>
                           <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Data Casamento</label>
                           <DatePicker value={newLead.marriage_date} onChange={(v:any) => setNewLead(prev => ({...prev, marriage_date: v}))} />
                         </div>
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
                         <InputField label="CNAE" value={newLead.cnae} onChange={(v:any) => setNewLead({...newLead, cnae: v})} />
                         <div>
                           <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Data Abertura</label>
                           <DatePicker value={newLead.opening_date} onChange={(v:any) => setNewLead(prev => ({...prev, opening_date: v}))} />
                         </div>
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
                         <div>
                           <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Data Nascimento</label>
                           <DatePicker value={newLead.resp_emp_birth_date} onChange={(v:any) => setNewLead(prev => ({...prev, resp_emp_birth_date: v}))} />
                         </div>
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
                         <div>
                           <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Data Casamento</label>
                           <DatePicker value={newLead.resp_emp_marriage_date} onChange={(v:any) => setNewLead(prev => ({...prev, resp_emp_marriage_date: v}))} />
                         </div>
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
                         <div>
                           <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Data Nascimento</label>
                           <DatePicker value={newLead.resp_con_birth_date} onChange={(v:any) => setNewLead(prev => ({...prev, resp_con_birth_date: v}))} />
                         </div>
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
                         <div>
                           <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Data Casamento</label>
                           <DatePicker value={newLead.resp_con_marriage_date} onChange={(v:any) => setNewLead(prev => ({...prev, resp_con_marriage_date: v}))} />
                         </div>
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
                         <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="pt-4 border-t border-slate-100 grid gap-6">
                           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                              <InputField label="Operadora Atual" value={newLead.current_carrier} onChange={(v:any) => setNewLead({...newLead, current_carrier: v})} />
                              <InputField label="Produto Atual" value={newLead.current_product} onChange={(v:any) => setNewLead({...newLead, current_product: v})} />
                              <InputField label="Qtde Vidas" type="number" value={newLead.current_lives} onChange={(v:any) => setNewLead({...newLead, current_lives: Number(v)})} />
                              <InputField 
                                label="Valor Pago Atual" 
                                value={newLead.current_value ? Math.round(newLead.current_value * 100).toString() : ""} 
                                mask={formatCurrencyValue}
                                onChange={(v:any) => setNewLead({...newLead, current_value: parseCurrencyValue(v)})} 
                                placeholder="R$ 0,00"
                              />
                           </div>
                           <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                              <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Vencimento Contrato</label>
                                <DatePicker value={newLead.contract_expiry_date} onChange={(v:any) => setNewLead(prev => ({...prev, contract_expiry_date: v}))} />
                              </div>
                              <div className="space-y-4">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Tem Corretor?</label>
                                <div className="flex gap-3">
                                  <button type="button" onClick={() => setNewLead({...newLead, has_broker: true})} className={cn("flex-1 py-3.5 rounded-xl font-bold text-xs transition-all border-2", newLead.has_broker ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100" : "bg-slate-50 border-transparent text-slate-400")}>Sim, possui</button>
                                  <button type="button" onClick={() => setNewLead({...newLead, has_broker: false})} className={cn("flex-1 py-3.5 rounded-xl font-bold text-xs transition-all border-2", !newLead.has_broker ? "bg-slate-700 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-400")}>Não possui</button>
                                </div>
                              </div>
                           </div>
                         </motion.div>
                       )}
                     </AnimatePresence>
                   </div>
                 </div>

                 <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                    <SectionHeader icon={Icons.FileText} title="Proposta Novo Plano" colorClass="bg-blue-50 text-blue-600" />
                    <div className="space-y-8">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-4 ml-1">Tipo de Plano</label>
                        <div className="flex flex-wrap gap-3">
                          {['Saúde', 'Odonto', 'Saúde + Odonto'].map((type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setNewLead({ ...newLead, plan_type: type as any })}
                              className={cn(
                                "px-6 py-3 rounded-2xl font-bold transition-all border-2 text-sm",
                                newLead.plan_type === type 
                                  ? "bg-blue-50 border-blue-500 text-blue-600 shadow-md shadow-blue-100" 
                                  : "bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100"
                              )}
                            >
                              {type}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Status no Funil</label>
                          <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none focus:bg-white focus:border-blue-500 text-sm font-bold text-slate-700" value={newLead.status} onChange={e => setNewLead({...newLead, status: e.target.value})}>
                            {stages.map(s => <option key={s.id} value={s.name}>{s.label}</option>)}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Temperatura</label>
                          <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none focus:bg-white focus:border-blue-500 text-sm font-bold text-slate-700 font-black" value={newLead.temperature} onChange={e => setNewLead({...newLead, temperature: e.target.value})} required>
                            <option value="Muito quente">Muito quente 🔥</option>
                            <option value="Quente">Quente ☀️</option>
                            <option value="Morno">Morno 🌤️</option>
                            <option value="Frio">Frio ❄️</option>
                            <option value="Congelado">Congelado 🧊</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Status de Interação</label>
                          <select 
                             className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none focus:bg-white focus:border-blue-500 text-sm font-bold text-slate-700 transition-all hover:bg-slate-100/50" 
                             value={newLead.interaction_status} 
                             onChange={e => setNewLead({...newLead, interaction_status: e.target.value})}
                           >
                             <option value="">Selecione o Status</option>
                             {interactionStatuses.filter(s => s.active).map(status => (
                               <option key={status.id} value={status.name}>{status.name}</option>
                             ))}
                           </select>
                        </div>
                        
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Operadora Proposta</label>
                          <select 
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none focus:bg-white focus:border-blue-500 text-sm font-bold text-slate-700" 
                            value={newLead.carrier} 
                            onChange={e => setNewLead({...newLead, carrier: e.target.value, product: ''})}
                          >
                            <option value="">Selecione...</option>
                            {carriers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                          </select>
                        </div>

                        <InputField 
                          label="Produto Proposta" 
                          value={newLead.product} 
                          onChange={(v:any) => setNewLead({...newLead, product: v})} 
                          placeholder="Ex: Produto Saúde Master"
                        />

                        <InputField label="Qtde Vidas" type="number" value={newLead.interested_lives} onChange={(v:any) => setNewLead({...newLead, interested_lives: Number(v)})} />
                        <InputField 
                          label="Valor Proposta" 
                          value={newLead.deal_value ? Math.round(newLead.deal_value * 100).toString() : ""} 
                          mask={formatCurrencyValue}
                          onChange={(v:any) => setNewLead({...newLead, deal_value: parseCurrencyValue(v)})} 
                          placeholder="R$ 0,00"
                        />
                      </div>
                    </div>
                  </div>
               </div>

               {/* Sticky Sidebar Summary */}
               <div className="w-full lg:w-[400px] sticky top-8 space-y-6">
                 <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl shadow-slate-200/40">
                   <div className="flex flex-col items-center text-center mb-8">
                     <div className={cn(
                       "w-24 h-24 rounded-[2rem] flex items-center justify-center text-3xl font-black mb-4 shadow-2xl",
                       newLead.lead_type === 'PF' ? "bg-blue-600 text-white shadow-blue-200" : "bg-indigo-600 text-white shadow-indigo-200"
                     )}>
                       {newLead.name ? newLead.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase() : '?'}
                     </div>
                     <h3 className="text-xl font-black text-slate-900 truncate w-full px-4">{newLead.name || "Novo Lead"}</h3>
                     <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-1">{newLead.lead_type === 'PF' ? "Pessoa Física" : "Empresa / PME"}</p>
                     
                     {newLead.status && (
                       <div className="mt-4 px-4 py-1.5 rounded-full bg-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500">
                         Status: {stages.find(s => s.name === newLead.status)?.label || newLead.status}
                       </div>
                     )}
                   </div>

                   <div className="space-y-4 border-t border-slate-50 pt-8">
                     <div className="flex items-center justify-between">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Contato Principal</span>
                       <span className="text-sm font-bold text-slate-700">{newLead.phone || "---"}</span>
                     </div>
                     <div className="flex items-center justify-between">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Email</span>
                       <span className="text-sm font-bold text-slate-700 truncate ml-4" title={newLead.email}>{newLead.email || "---"}</span>
                     </div>
                     <div className="flex items-center justify-between">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Tipo de Plano</span>
                       <span className="text-sm font-bold text-slate-700">{newLead.plan_type}</span>
                     </div>
                     <div className="flex items-center justify-between">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Vidas Presumidas</span>
                       <span className="text-sm font-bold text-slate-700">{newLead.interested_lives}</span>
                     </div>
                     <div className="flex items-center justify-between">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Valor Proposta</span>
                       <span className="text-sm font-bold text-blue-600">
                         {new Intl.NumberFormat("pt-BR", {
                           style: "currency",
                           currency: "BRL",
                           minimumFractionDigits: 2,
                           maximumFractionDigits: 2,
                         }).format(Math.round(newLead.deal_value))}
                       </span>
                     </div>
                   </div>

                   <div className="mt-10 space-y-3">
                     <button 
                       type="submit" 
                       disabled={isSaving}
                       className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl hover:bg-black hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                     >
                       {isSaving ? <Icons.Loader2 className="w-5 h-5 animate-spin" /> : "Finalizar Registro"}
                     </button>
                     <button 
                       type="button" 
                       onClick={onClose}
                       className="w-full bg-white text-slate-400 py-4 rounded-2xl font-black uppercase text-[10px] tracking-[0.15em] border border-slate-100 hover:bg-slate-50 transition-all"
                     >
                       Descartar Alterações
                     </button>
                   </div>
                 </div>

                 {/* Help Card */}
                 <div className="bg-blue-600 rounded-[2rem] p-8 text-white shadow-xl shadow-blue-200">
                    <Icons.Target className="w-8 h-8 mb-4 opacity-50" />
                    <h4 className="text-lg font-black mb-2 leading-tight">Dica de Atendimento</h4>
                    <p className="text-sm font-medium text-blue-100 leading-relaxed">
                      Confirme se o lead já possui plano ativo para oferecer as carências reduzidas e aumentar a conversão.
                    </p>
                 </div>
               </div>
             </div>
           </form>
         )}
       </div>
    </motion.div>
  );
}
