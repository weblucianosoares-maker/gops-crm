import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icons } from "./Icons";
import { cn, formatCPF, formatCNPJ, formatCurrencyValue, parseCurrencyValue } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { useLeads } from "../lib/leadsContext";
import { useToast } from "./Toasts";

interface Beneficiary {
  name: string;
  type: string;
  birth_date: string;
  cpf: string;
}

const InputField = ({ label, value, onChange, placeholder, type = "text", mask, required = false }: any) => (
  <div className="space-y-1">
    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">{label}</label>
    <input 
      type={type}
      required={required}
      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:bg-white focus:ring-4 focus:ring-blue-100/10 focus:border-blue-500 transition-all text-sm font-bold text-slate-900"
      placeholder={placeholder}
      value={mask ? mask(value) : (value || '')}
      onChange={e => onChange(e.target.value)}
    />
  </div>
);

const SectionHeader = ({ icon: Icon, title, colorClass }: any) => (
  <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
    <div className={cn("p-2 rounded-lg", colorClass)}>
      <Icon className="w-4 h-4" />
    </div>
    <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">{title}</h4>
  </div>
);

interface ContractCreateDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editContract?: any;
}

export function ContractCreateDrawer({ isOpen, onClose, onSuccess, editContract }: ContractCreateDrawerProps) {
  const { leads, carriers, products } = useLeads();
  const { success, error } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isNewLead, setIsNewLead] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [contract, setContract] = useState({
    lead_id: "",
    client_name: "",
    cnpj: "",
    type: "PF",
    carrier: "",
    product: "",
    lives: 1,
    monthly_fee: 0,
    start_date: new Date().toISOString().split('T')[0],
    status: "Ativo",
    contract_number: "",
    accommodation: "Enfermaria",
    contract_duration: "12",
    grace_periods_data: {} as Record<string, string>,
    end_date: "",
    sale_date: new Date().toISOString().split('T')[0],
    readjustment_percentage: 0,
    readjustment_new_value: 0,
    previous_plan_name: "",
    previous_plan_value: 0,
    modality: "PME",
    administrator: "",
    first_contact_date: "",
    is_paid: false,
    is_anticipated: false,
    has_amil_dental: false
  });

  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([
    { name: "", type: "Titular", birth_date: "", cpf: "" }
  ]);

  useEffect(() => {
    if (editContract) {
      setContract({
        lead_id: editContract.lead_id || "",
        client_name: editContract.client_name || "",
        cnpj: editContract.cnpj || "",
        type: editContract.type || "PF",
        carrier: editContract.carrier || "",
        product: editContract.product || "",
        lives: editContract.lives || 1,
        monthly_fee: editContract.monthly_fee || 0,
        start_date: editContract.start_date || new Date().toISOString().split('T')[0],
        status: editContract.status || "Ativo",
        contract_number: editContract.contract_number || "",
        accommodation: editContract.accommodation || "Enfermaria",
        contract_duration: editContract.contract_duration || "12",
        grace_periods_data: editContract.grace_periods_data || {},
        end_date: editContract.end_date || "",
        sale_date: editContract.sale_date || (editContract.start_date || new Date().toISOString().split('T')[0]),
        readjustment_percentage: editContract.readjustment_percentage || 0,
        readjustment_new_value: editContract.readjustment_new_value || 0,
        previous_plan_name: editContract.previous_plan_name || "",
        previous_plan_value: editContract.previous_plan_value || 0,
        modality: editContract.modality || "PME",
        administrator: editContract.administrator || "",
        first_contact_date: editContract.first_contact_date || "",
        is_paid: editContract.is_paid || false,
        is_anticipated: editContract.is_anticipated || false,
        commission_received_date: editContract.commission_received_date || "",
        has_amil_dental: editContract.has_amil_dental || false
      });
      setIsNewLead(!!editContract.client_name && !editContract.lead_id);
      fetchBeneficiaries(editContract.id);
    } else {
      setContract({
        lead_id: "",
        client_name: "",
        cnpj: "",
        type: "PF",
        carrier: "",
        product: "",
        lives: 1,
        monthly_fee: 0,
        start_date: new Date().toISOString().split('T')[0],
        status: "Ativo",
        contract_number: "",
        accommodation: "Enfermaria",
        grace_periods: "",
        end_date: "",
        previous_plan_name: "",
        previous_plan_value: 0,
        modality: "PME",
        administrator: "",
        first_contact_date: "",
        is_paid: false,
        is_anticipated: false,
        commission_received_date: "",
        has_amil_dental: false
      });
      setBeneficiaries([{ name: "", type: "Titular", birth_date: "", cpf: "" }]);
    }
  }, [editContract, isOpen]);

  useEffect(() => {
    if (contract.start_date && contract.contract_duration) {
      const start = new Date(contract.start_date);
      if (!isNaN(start.getTime())) {
        const end = new Date(start);
        end.setMonth(end.getMonth() + parseInt(contract.contract_duration));
        const formattedEnd = end.toISOString().split('T')[0];
        if (formattedEnd !== contract.end_date) {
          setContract(prev => ({ ...prev, end_date: formattedEnd }));
        }
      }
    }
  }, [contract.start_date, contract.contract_duration]);

  useEffect(() => {
    const percentage = Number(contract.readjustment_percentage) || 0;
    const currentFee = Number(contract.monthly_fee) || 0;
    const newValue = currentFee + (currentFee * (percentage / 100));
    if (newValue !== contract.readjustment_new_value) {
      setContract(prev => ({ ...prev, readjustment_new_value: newValue }));
    }
  }, [contract.readjustment_percentage, contract.monthly_fee]);

  const fetchBeneficiaries = async (contractId: string) => {
    const { data, error: benErr } = await supabase
      .from('beneficiaries')
      .select('*')
      .eq('contract_id', contractId);
    
    if (!benErr && data) {
      setBeneficiaries(data.map(b => ({
        name: b.name,
        type: b.type,
        birth_date: b.birth_date,
        cpf: b.cpf
      })));
    }
  };

  const filteredLeads = leads.filter(l => 
    l.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    l.cpf?.includes(searchTerm) || 
    l.cnpj?.includes(searchTerm)
  );

  const addBeneficiary = () => {
    setBeneficiaries([...beneficiaries, { name: "", type: "Dependente", birth_date: "", cpf: "" }]);
  };

  const removeBeneficiary = (index: number) => {
    setBeneficiaries(beneficiaries.filter((_, i) => i !== index));
  };

  const updateBeneficiary = (index: number, field: keyof Beneficiary, value: string) => {
    const newList = [...beneficiaries];
    newList[index][field] = value;
    setBeneficiaries(newList);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      let leadId = contract.lead_id;
      let clientName = contract.client_name;
      let cnpj = contract.cnpj;

      if (isNewLead) {
        const { data: newL, error: leadErr } = await supabase.from('leads').insert([{
           name: clientName,
           cnpj: contract.type === 'PJ' ? cnpj.replace(/\D/g, '') : null,
           cpf: contract.type === 'PF' ? cnpj.replace(/\D/g, '') : null,
           lead_type: contract.type,
           status: 'Vendido',
           source: 'Conversão',
           email: '' // Campo obrigatório no banco
        }]).select().single();
        
        if (leadErr) throw leadErr;
        leadId = newL.id;
      }

      const contractPayload = {
        client_name: clientName,
        cnpj: cnpj.replace(/\D/g, ''),
        carrier: contract.carrier,
        product: contract.product,
        lives: beneficiaries.length,
        start_date: contract.start_date,
        monthly_fee: contract.monthly_fee,
        type: contract.type,
        status: contract.status,
        lead_id: leadId || null,
        contract_number: contract.contract_number,
        accommodation: contract.accommodation,
        contract_duration: contract.contract_duration,
        grace_periods_data: contract.grace_periods_data,
        end_date: contract.end_date || null,
        sale_date: contract.sale_date,
        readjustment_percentage: contract.readjustment_percentage,
        readjustment_new_value: contract.readjustment_new_value,
        previous_plan_name: contract.previous_plan_name,
        previous_plan_value: contract.previous_plan_value,
        modality: contract.modality,
        administrator: contract.administrator,
        first_contact_date: contract.first_contact_date || null,
        is_paid: contract.is_paid,
        is_anticipated: contract.is_anticipated,
        commission_received_date: contract.commission_received_date || null,
        has_amil_dental: contract.has_amil_dental
      };

      let currentContractId = editContract?.id;

      if (editContract?.is_pending_lead) {
        const { error: leadErr } = await supabase
          .from('leads')
          .update({
            first_invoice_date: contract.sale_date,
            is_first_invoice_paid: contract.is_paid,
            is_anticipated: contract.is_anticipated,
            contract_start_date: contract.start_date,
            carrier: contract.carrier,
            product: contract.product,
            deal_value: contract.monthly_fee,
            interested_lives: beneficiaries.length,
            lead_type: contract.type,
            modality: contract.modality,
            is_contract_active: contract.status === 'Ativo',
            has_amil_dental: contract.has_amil_dental
          })
          .eq('id', editContract.id);
        
        if (leadErr) throw leadErr;
      } else if (editContract) {
        const { error: contractErr } = await supabase
          .from('contracts')
          .update(contractPayload)
          .eq('id', editContract.id);
        
        if (contractErr) throw contractErr;
      } else {
        const { data: newC, error: contractErr } = await supabase.from('contracts').insert([contractPayload]).select().single();
        if (contractErr) throw contractErr;
        currentContractId = newC.id;
      }

      if (editContract) {
        await supabase.from('beneficiaries').delete().eq('contract_id', editContract.id);
      }

      if (beneficiaries.length > 0) {
        const beneficiariesToSave = beneficiaries.map(b => ({
          contract_id: currentContractId,
          lead_id: leadId || null,
          name: b.name,
          type: b.type,
          birth_date: b.birth_date || null,
          cpf: (b.cpf || '').replace(/\D/g, ''),
          initials: b.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
        }));

        const { error: benErr } = await supabase.from('beneficiaries').insert(beneficiariesToSave);
        if (benErr) throw benErr;
      }

      success(editContract ? "Contrato atualizado com sucesso!" : "Contrato cadastrado com sucesso!");
      onSuccess();
      onClose();
    } catch (err: any) {
      error("Erro ao salvar: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden">
      <div onClick={onClose} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} className="absolute right-0 top-0 h-[100dvh] w-full max-w-5xl bg-white shadow-2xl flex flex-col">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-100">
              <Icons.Contracts className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">{editContract ? "Editar Contrato" : "Novo Contrato"}</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Gestão de Vidas & Vigência</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><Icons.X className="w-7 h-7" /></button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
          
          {/* Cliente */}
          <section>
            <SectionHeader icon={Icons.Users} title="Dados do Cliente" colorClass="bg-blue-100 text-blue-700" />
            <div className="space-y-6">
              {editContract ? (
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest mb-1">Cliente Vinculado</p>
                    <p className="text-sm font-black text-blue-900">{contract.client_name}</p>
                  </div>
                  <div className="p-2 bg-white rounded-lg text-blue-600 shadow-sm">
                    <Icons.CheckCircle className="w-5 h-5" />
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex gap-4 p-1 bg-slate-100 rounded-2xl">
                    <button type="button" onClick={() => setIsNewLead(false)} className={cn("flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", !isNewLead ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}>Lead Existente</button>
                    <button type="button" onClick={() => setIsNewLead(true)} className={cn("flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", isNewLead ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}>Novo Cliente (Avulso)</button>
                  </div>

                  {isNewLead ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                       <div className="md:col-span-2">
                          <InputField label="Razão Social / Nome Completo" required value={contract.client_name} onChange={(v:any) => setContract({...contract, client_name: v})} />
                       </div>
                       <InputField label={contract.type === 'PJ' ? "CNPJ" : "CPF"} required value={contract.cnpj} mask={contract.type === 'PJ' ? formatCNPJ : formatCPF} onChange={(v:any) => setContract({...contract, cnpj: v})} />
                       <div>
                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2">Perfil</label>
                          <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700" value={contract.type} onChange={e => setContract({...contract, type: e.target.value})}>
                            <option value="PF">Pessoa Física (PF)</option>
                            <option value="PJ">Corporativo (PME)</option>
                          </select>
                       </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="relative">
                        <Icons.Search className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
                        <input 
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 outline-none focus:bg-white text-sm font-bold" 
                          placeholder="Pesquisar por nome ou documento..."
                          value={searchTerm}
                          onChange={e => setSearchTerm(e.target.value)}
                        />
                      </div>
                      <div className="max-h-[150px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                        {filteredLeads.map(l => (
                          <button 
                            key={l.id} 
                            type="button"
                            onClick={() => {
                               const leadCreatedAt = l.created_at ? new Date(l.created_at).toISOString().split('T')[0] : "";
                               setContract({
                                 ...contract, 
                                 lead_id: l.id, 
                                 client_name: l.name, 
                                 cnpj: l.lead_type === 'PJ' ? (l.cnpj || "") : (l.cpf || ""),
                                 type: l.lead_type || 'PF',
                                 modality: l.modality || 'PME',
                                 is_anticipated: l.is_anticipated || false,
                                 commission_received_date: l.commission_received_date || "",
                                 first_contact_date: leadCreatedAt
                               });
                               success(`Cliente ${l.name} selecionado!`);
                               setSearchTerm("");
                            }}
                            className={cn("w-full p-3 rounded-xl text-left border flex items-center justify-between transition-all group", 
                              contract.lead_id === l.id ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100" : "bg-white border-slate-100 hover:border-blue-200")
                            }
                          >
                             <div>
                                <p className="text-[11px] font-black uppercase tracking-tight group-hover:translate-x-1 transition-transform">{l.name}</p>
                                <p className={cn("text-[8px] font-bold uppercase mt-0.5", contract.lead_id === l.id ? "text-blue-100" : "text-slate-400")}>
                                   {l.lead_type || 'PF'} • {l.cnpj || l.cpf || "Sem doc"}
                                </p>
                             </div>
                             {contract.lead_id === l.id && <Icons.CheckCircle className="w-4 h-4" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          {/* Plano & Valores */}
          <section>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
                  <Icons.Target className="w-4 h-4" />
                </div>
                <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Plano & Vigência</h4>
              </div>
              <div 
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all cursor-pointer",
                  contract.status === 'Ativo' 
                    ? "bg-emerald-50 border-emerald-100 text-emerald-700" 
                    : "bg-slate-50 border-slate-200 text-slate-400 hover:border-emerald-200"
                )}
                onClick={() => setContract({...contract, status: contract.status === 'Ativo' ? 'Inativo' : 'Ativo'})}
              >
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full transition-all",
                  contract.status === 'Ativo' ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
                )} />
                <span className="text-[9px] font-black uppercase tracking-widest">
                  {contract.status === 'Ativo' ? 'Contrato Ativo' : 'Contrato Inativo'}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
               <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Modalidade</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700" value={contract.modality} onChange={e => setContract({...contract, modality: e.target.value, administrator: e.target.value === 'Adesão' ? contract.administrator : ""})}>
                    <option value="Individual">Individual</option>
                    <option value="Adesão">Adesão</option>
                    <option value="PME">PME</option>
                    <option value="Empresarial">Empresarial</option>
                  </select>
               </div>
               {contract.modality === 'Adesão' && (
                 <InputField label="Administradora" value={contract.administrator} onChange={(v:any) => setContract({...contract, administrator: v})} placeholder="Ex: Qualicorp, Elo..." />
               )}
               <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Operadora</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700" value={contract.carrier} onChange={e => setContract({...contract, carrier: e.target.value, product: ''})}>
                    <option value="">Selecione...</option>
                    {carriers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
               </div>
               <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Produto</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700" value={contract.product} disabled={!contract.carrier} onChange={e => setContract({...contract, product: e.target.value})}>
                    <option value="">{contract.carrier ? "Selecione..." : "Selecione a Operadora..."}</option>
                    {products.filter((p:any) => !contract.carrier || p.carrier_id === carriers.find(c => c.name === contract.carrier)?.id).map((p:any) => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
               </div>
               <InputField label="Valor da Mensalidade (R$)" 
                 required 
                 value={contract.monthly_fee ? Math.round(contract.monthly_fee * 100).toString() : ""} 
                 mask={formatCurrencyValue}
                 onChange={(v:any) => setContract({...contract, monthly_fee: parseCurrencyValue(v)})} 
               />
                               <div className="relative group">
                  <InputField label="Data do Pagamento / Taxa de Adesão" type="date" required value={contract.sale_date} onChange={(v:any) => setContract({...contract, sale_date: v})} />
                  <div 
                    className={cn(
                      "absolute right-2 top-[26px] flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer",
                      contract.is_paid 
                        ? "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-100" 
                        : "bg-white border-slate-200 text-slate-400 hover:border-emerald-300"
                    )}
                    onClick={() => setContract({...contract, is_paid: !contract.is_paid})}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded border-2 flex items-center justify-center transition-all",
                      contract.is_paid ? "bg-white border-white" : "border-slate-200"
                    )}>
                      {contract.is_paid && <Icons.Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Boleto Pago</span>
                  </div>
                </div>

                <div className="relative group">
                   <div 
                    className={cn(
                      "flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all cursor-pointer h-full",
                      contract.is_anticipated 
                        ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100" 
                        : "bg-slate-50 border-slate-200 text-slate-500 hover:border-blue-300"
                    )}
                    onClick={() => setContract({...contract, is_anticipated: !contract.is_anticipated})}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all",
                      contract.is_anticipated ? "bg-white border-white" : "border-slate-300"
                    )}>
                      {contract.is_anticipated && <Icons.Zap className="w-3.5 h-3.5 text-blue-600" />}
                    </div>
                    <div>
                       <p className="text-[10px] font-black uppercase tracking-widest">Antecipação Total</p>
                    </div>
                  </div>
                </div>

                <div className="relative group">
                   <div 
                    className={cn(
                      "flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all cursor-pointer h-full",
                      contract.has_amil_dental 
                        ? "bg-purple-600 border-purple-600 text-white shadow-lg shadow-purple-100" 
                        : "bg-slate-50 border-slate-200 text-slate-500 hover:border-purple-300"
                    )}
                    onClick={() => setContract({...contract, has_amil_dental: !contract.has_amil_dental})}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all",
                      contract.has_amil_dental ? "bg-white border-white" : "border-slate-300"
                    )}>
                      {contract.has_amil_dental && <Icons.AlertCircle className="w-3.5 h-3.5 text-purple-600" />}
                    </div>
                    <div>
                       <p className="text-[10px] font-black uppercase tracking-widest">Monitorar Amil Dental</p>
                       <p className={cn("text-[8px] font-bold", contract.has_amil_dental ? "text-purple-100" : "text-slate-400")}>Gerar alerta de cancelamento aos 11 meses</p>
                    </div>
                  </div>
                </div>
               <InputField label="Data que caiu na conta" type="date" value={contract.commission_received_date} onChange={(v:any) => setContract({...contract, commission_received_date: v})} />
               <InputField label="Início da Vigência" type="date" required value={contract.start_date} onChange={(v:any) => setContract({...contract, start_date: v})} />
               <InputField label="Número do Contrato" value={contract.contract_number} onChange={(v:any) => setContract({...contract, contract_number: v})} />

               {/* Sales Cycle Block */}
               <div className="space-y-1">
                 <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Data do Primeiro Contato</label>
                 <input 
                   type="date" 
                   className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:bg-white focus:ring-4 focus:ring-blue-100/10 focus:border-blue-500 transition-all text-sm font-bold text-slate-900"
                   value={contract.first_contact_date || ""}
                   onChange={e => setContract({...contract, first_contact_date: e.target.value})}
                 />
                 <p className="text-[8px] text-slate-400 ml-1">Auto-preenchido ao selecionar o lead. Editável se necessário.</p>
               </div>

               {/* Sales Cycle Read-only */}
               {(() => {
                 const d1 = contract.first_contact_date ? new Date(contract.first_contact_date) : null;
                 const d2 = contract.sale_date ? new Date(contract.sale_date) : null;
                 const days = d1 && d2 && !isNaN(d1.getTime()) && !isNaN(d2.getTime()) 
                   ? Math.max(0, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)))
                   : null;
                 return (
                   <div className="space-y-1">
                     <label className="block text-[9px] font-black text-blue-600 uppercase tracking-wider ml-1">Ciclo de Vendas (dias)</label>
                     <div className={cn(
                       "flex items-center gap-3 px-4 py-2.5 rounded-xl border font-black text-base",
                       days === null ? "bg-slate-50 border-slate-200 text-slate-300" :
                       days <= 7 ? "bg-emerald-50 border-emerald-100 text-emerald-700" :
                       days <= 30 ? "bg-amber-50 border-amber-100 text-amber-700" :
                       "bg-red-50 border-red-100 text-red-700"
                     )}>
                       <Icons.Clock className="w-4 h-4 opacity-60" />
                       {days === null ? (
                         <span className="text-sm font-bold text-slate-400">Defina as datas acima</span>
                       ) : (
                         <>
                           <span>{days} dias</span>
                           <span className="text-[9px] font-black uppercase tracking-widest opacity-60">
                             {days <= 7 ? '🚀 Ciclo Rápido' : days <= 30 ? '✅ Ciclo Normal' : '⚠️ Ciclo Longo'}
                           </span>
                         </>
                       )}
                     </div>
                   </div>
                 );
               })()}
               <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Acomodação</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700" value={contract.accommodation} onChange={e => setContract({...contract, accommodation: e.target.value})}>
                    <option value="Enfermaria">Enfermaria</option>
                    <option value="Apartamento">Apartamento</option>
                  </select>
               </div>
               <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Tempo de Contrato</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700" 
                    value={contract.contract_duration} 
                    onChange={e => setContract({...contract, contract_duration: e.target.value})}
                  >
                    <option value="12">12 Meses</option>
                    <option value="24">24 Meses</option>
                    <option value="36">36 Meses</option>
                  </select>
               </div>
               <div className="space-y-1">
                  <label className="block text-[9px] font-black text-blue-600 uppercase tracking-wider ml-1">Data de Encerramento (Auto)</label>
                  <input 
                    type="date" 
                    readOnly
                    className="w-full bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 text-sm font-black text-blue-700 outline-none cursor-not-allowed"
                    value={contract.end_date} 
                  />
               </div>
            </div>

            {/* PLANO ANTERIOR & ECONOMIA */}
            <div className="mt-8 p-6 bg-emerald-50/50 rounded-[2rem] border border-emerald-100 space-y-6">
               <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                    <Icons.TrendingDown className="w-4 h-4" />
                  </div>
                  <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-emerald-600">Comparativo: Plano Anterior</h4>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <InputField 
                    label="Operadora / Plano Anterior" 
                    value={contract.previous_plan_name} 
                    onChange={(v:any) => setContract({...contract, previous_plan_name: v})} 
                  />
                  <InputField 
                    label="Valor Plano Anterior (R$)" 
                    value={contract.previous_plan_value ? Math.round(contract.previous_plan_value * 100).toString() : ""} 
                    mask={formatCurrencyValue}
                    onChange={(v:any) => setContract({...contract, previous_plan_value: parseCurrencyValue(v)})} 
                  />
               </div>

               {/* Cards de Economia */}
               {contract.previous_plan_value > 0 && contract.monthly_fee > 0 && (
                 <div className="grid grid-cols-3 gap-3 animate-in fade-in slide-in-from-bottom-2">
                   <div className="bg-white p-3 rounded-2xl border border-emerald-100 text-center">
                     <p className="text-[8px] font-black text-emerald-400 uppercase tracking-tighter mb-1">Redução</p>
                     <p className="text-sm font-black text-emerald-600">
                       {Math.max(0, Math.round(((contract.previous_plan_value - contract.monthly_fee) / contract.previous_plan_value) * 100))}%
                     </p>
                   </div>
                   <div className="bg-white p-3 rounded-2xl border border-emerald-100 text-center">
                     <p className="text-[8px] font-black text-emerald-400 uppercase tracking-tighter mb-1">Mensal</p>
                     <p className="text-sm font-black text-emerald-600">
                       {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.max(0, contract.previous_plan_value - contract.monthly_fee))}
                     </p>
                   </div>
                   <div className="bg-white p-3 rounded-2xl border border-emerald-100 text-center shadow-sm">
                     <p className="text-[8px] font-black text-emerald-400 uppercase tracking-tighter mb-1">12 Meses</p>
                     <p className="text-sm font-black text-emerald-600">
                       {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.max(0, (contract.previous_plan_value - contract.monthly_fee) * 12))}
                     </p>
                   </div>
                 </div>
               )}
            </div>

            {/* GESTÃO DE REAJUSTE */}
            <div className="mt-8 p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-6">
               <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-100 text-red-600">
                    <Icons.TrendingUp className="w-4 h-4" />
                  </div>
                  <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Projeção de Reajuste (Gestão)</h4>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Percentual de Reajuste (%)</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        step="0.01"
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-red-400 transition-all"
                        placeholder="Ex: 15.5"
                        value={contract.readjustment_percentage || ""}
                        onChange={(e) => setContract({...contract, readjustment_percentage: Number(e.target.value)})}
                      />
                      <span className="absolute right-4 top-2.5 text-slate-400 font-bold text-sm">%</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Novo Valor Estimado (R$)</label>
                    <div className="w-full bg-white border border-slate-100 rounded-xl px-4 py-2.5 text-sm font-black text-red-600">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(contract.readjustment_new_value || 0)}
                    </div>
                  </div>
               </div>
               <p className="text-[9px] text-slate-400 font-medium italic">* Este campo é apenas informativo para controle interno do corretor.</p>
            </div>

            {/* TABELA DE CARÊNCIAS */}
            <div className="mt-8 space-y-4">
               <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
                  <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
                    <Icons.FileText className="w-4 h-4" />
                  </div>
                  <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Tabela de Carências (Prazos)</h4>
               </div>

               <div className="overflow-hidden border border-slate-200 rounded-2xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-500 w-16 text-center">Alínea</th>
                        <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-500">Eventos</th>
                        <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-blue-600">Carências</th>
                        <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Ref. ANS (PME)</th>
                        <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Ref. ANS (PF)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[
                        { a: 'A', e: 'Urgência e Emergência', pme: '24h', pf: '24h' },
                        { a: 'B', e: 'Consultas, exames simples e pequenas cirurgias (porte zero)', pme: '30 dias', pf: '30 dias' },
                        { a: 'C', e: 'Terapias Simples e Fisioterapias', pme: '180 dias', pf: '180 dias' },
                        { a: 'D', e: 'Terapias especiais', pme: '180 dias', pf: '180 dias' },
                        { a: 'E', e: 'Internações clínicas e/ou cirúrgicas (incl. psiquiátricas)', pme: '180 dias', pf: '180 dias' },
                        { a: 'F', e: 'Partos a Termo', pme: '300 dias', pf: '300 dias' },
                        { a: 'G', e: 'Exames especiais e cirurgias oftalmológicas', pme: '180 dias', pf: '180 dias' },
                        { a: 'H', e: 'Cobertura Parcial Temporária (CPT)', pme: '24 meses', pf: '24 meses' },
                      ].map((row) => (
                        <tr key={row.a} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 text-[10px] font-black text-slate-400 text-center">{row.a}</td>
                          <td className="px-4 py-3 text-[11px] font-bold text-slate-700 leading-tight">{row.e}</td>
                          <td className="px-4 py-3">
                             <input 
                               type="text" 
                               className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[11px] font-black text-blue-600 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100/10"
                               placeholder="Ex: 30 dias"
                               value={contract.grace_periods_data?.[row.a] || ""}
                               onChange={(e) => setContract({
                                 ...contract, 
                                 grace_periods_data: {
                                   ...(contract.grace_periods_data || {}),
                                   [row.a]: e.target.value
                                 }
                               })}
                             />
                          </td>
                          <td className="px-4 py-3 text-[10px] font-bold text-slate-400 text-center uppercase tracking-tighter">{row.pme}</td>
                          <td className="px-4 py-3 text-[10px] font-bold text-slate-400 text-center uppercase tracking-tighter">{row.pf}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
               </div>
            </div>
          </section>

          {/* Vidas (Beneficiários) */}
          <section className="pb-10">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
               <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100 text-green-700">
                    <Icons.Users className="w-4 h-4" />
                  </div>
                  <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Pessoas Inclusas (Vidas)</h4>
               </div>
               <button type="button" onClick={addBeneficiary} className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700 transition-colors">
                  <Icons.Plus className="w-3.5 h-3.5" /> Adicionar Vida
               </button>
            </div>
            
            <div className="space-y-4">
               {beneficiaries.map((ben, idx) => (
                 <div key={idx} className="p-5 bg-slate-50 border border-slate-100 rounded-2xl relative group animate-in zoom-in-95 duration-200">
                    <button type="button" onClick={() => removeBeneficiary(idx)} className="absolute -top-2 -right-2 p-1.5 bg-white text-red-500 rounded-full shadow-md border border-red-50 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Icons.Trash className="w-3.5 h-3.5" />
                    </button>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                       <div className="md:col-span-5">
                          <InputField label="Nome Completo" required value={ben.name} onChange={(v:any) => updateBeneficiary(idx, 'name', v)} />
                       </div>
                       <div className="md:col-span-2">
                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Tipo</label>
                          <select className="w-full bg-white border border-slate-200 rounded-xl px-2 py-2.5 text-xs font-bold text-slate-700" value={ben.type} onChange={e => updateBeneficiary(idx, 'type', e.target.value)}>
                            <option value="Titular">Titular</option>
                            <option value="Dependente">Dependente</option>
                          </select>
                       </div>
                       <div className="md:col-span-3">
                          <InputField label="Data Nasc." type="date" value={ben.birth_date} onChange={(v:any) => updateBeneficiary(idx, 'birth_date', v)} />
                       </div>
                       <div className="md:col-span-2">
                          <InputField label="CPF" value={ben.cpf} mask={formatCPF} onChange={(v:any) => updateBeneficiary(idx, 'cpf', v)} />
                       </div>
                    </div>
                 </div>
               ))}
            </div>
          </section>
        </form>

        {/* Footer */}
        <div className="p-8 border-t border-slate-100 bg-white sticky bottom-0">
           <button 
             onClick={handleSave} 
             disabled={isSaving || (!contract.client_name && !contract.lead_id) || !contract.carrier} 
             className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl hover:bg-blue-600 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
           >
              {isSaving ? <Icons.Loader2 className="w-5 h-5 animate-spin" /> : <Icons.Save className="w-5 h-5" />}
              {isSaving ? "Gravando Alterações..." : (editContract ? "Salvar Alterações" : "Finalizar Cadastro de Contrato")}
           </button>
        </div>
      </motion.div>
    </div>
  );
}
