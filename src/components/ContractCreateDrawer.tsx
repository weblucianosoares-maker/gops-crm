import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icons } from "./Icons";
import { cn, formatCPF, formatCNPJ } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { useLeads } from "../lib/leadsContext";
import { useToast } from "./Toasts";

interface Beneficiary {
  name: string;
  type: string;
  birth_date: string;
  cpf: string;
}

interface ContractCreateDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ContractCreateDrawer({ isOpen, onClose, onSuccess }: ContractCreateDrawerProps) {
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
    status: "Ativo"
  });

  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([
    { name: "", type: "Titular", birth_date: "", cpf: "" }
  ]);

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

      // Se for novo lead, precisamos criá-lo primeiro ou apenas asinar o nome?
      // O usuário pediu "puxar existente OU cadastrar um do zero". 
      // Vou criar um registro em 'leads' se for novo para manter todo o ecossistema conectado.
      if (isNewLead) {
        const { data: newL, error: leadErr } = await supabase.from('leads').insert([{
           name: clientName,
           cnpj: contract.type === 'PJ' ? cnpj.replace(/\D/g, '') : null,
           cpf: contract.type === 'PF' ? cnpj.replace(/\D/g, '') : null,
           lead_type: contract.type,
           status: 'Vendido',
           source: 'Conversão'
        }]).select().single();
        
        if (leadErr) throw leadErr;
        leadId = newL.id;
      }

      // 1. Criar o Contrato
      const { data: newC, error: contractErr } = await supabase.from('contracts').insert([{
        client_name: clientName,
        cnpj: cnpj.replace(/\D/g, ''),
        carrier: contract.carrier,
        product: contract.product,
        lives: beneficiaries.length,
        start_date: contract.start_date,
        monthly_fee: contract.monthly_fee,
        type: contract.type,
        status: contract.status
      }]).select().single();

      if (contractErr) throw contractErr;

      // 2. Criar os Beneficiários
      if (beneficiaries.length > 0) {
        const beneficiariesToSave = beneficiaries.map(b => ({
          contract_id: newC.id,
          lead_id: leadId || null,
          name: b.name,
          type: b.type,
          birth_date: b.birth_date || null,
          cpf: b.cpf.replace(/\D/g, ''),
          initials: b.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
        }));

        const { error: benErr } = await supabase.from('beneficiaries').insert(beneficiariesToSave);
        if (benErr) throw benErr;
      }

      success("Contrato cadastrado com sucesso!");
      onSuccess();
      onClose();
    } catch (err: any) {
      error("Erro ao salvar: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const SectionHeader = ({ icon: Icon, title, colorClass }: any) => (
    <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
      <div className={cn("p-2 rounded-lg", colorClass)}>
        <Icon className="w-4 h-4" />
      </div>
      <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">{title}</h4>
    </div>
  );

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden">
      <div onClick={onClose} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} className="absolute right-0 top-0 h-[100dvh] w-full max-w-2xl bg-white shadow-2xl flex flex-col">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-100">
              <Icons.Contracts className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Novo Contrato</h2>
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
                           setContract({
                             ...contract, 
                             lead_id: l.id, 
                             client_name: l.name, 
                             cnpj: l.lead_type === 'PJ' ? (l.cnpj || "") : (l.cpf || ""),
                             type: l.lead_type || 'PF'
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
            </div>
          </section>

          {/* Plano & Valores */}
          <section>
            <SectionHeader icon={Icons.Target} title="Plano & Vigência" colorClass="bg-amber-100 text-amber-700" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
               <InputField label="Valor da Mensalidade (R$)" type="number" required value={contract.monthly_fee} onChange={(v:any) => setContract({...contract, monthly_fee: Number(v)})} />
               <InputField label="Data de Início" type="date" required value={contract.start_date} onChange={(v:any) => setContract({...contract, start_date: v})} />
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
              {isSaving ? "Gravando Contrato..." : "Finalizar Cadastro de Contrato"}
           </button>
        </div>
      </motion.div>
    </div>
  );
}
