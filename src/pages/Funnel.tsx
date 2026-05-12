// @ts-nocheck
import React, { useState, useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Icons } from "../components/Icons";
import { cn, formatCurrency } from "../lib/utils";
import { useLeads } from "../lib/leadsContext";
import { LeadDetailDrawer } from "../components/LeadDetailDrawer";
import { supabase } from "../lib/supabase";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useToast } from "../components/Toasts";
import { AIGuidedLeadCreate } from "../components/AIGuidedLeadCreate";

const interactionStatusOptions = [
  { label: 'Sem Status', value: 'Sem Status', color: 'bg-slate-100 text-slate-500' },
  { label: 'Aguardando Retorno', value: 'Aguardando Retorno', color: 'bg-amber-100 text-amber-700' },
  { label: 'Não Responde', value: 'Não Responde', color: 'bg-red-100 text-red-700' },
  { label: 'Analisando Cotação', value: 'Analisando Cotação', color: 'bg-indigo-100 text-indigo-700' },
  { label: 'Realizei Contato', value: 'Realizei Contato', color: 'bg-emerald-100 text-emerald-700' },
];

export default function Funnel() {
  const { leads, fetchLeads, stages, loadingStages } = useLeads();
  const { success, error } = useToast();
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isAIInterviewOpen, setIsAIInterviewOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const columns = stages.map(col => {
    const stageLeads = leads.filter(l => l.status === col.name && !l.do_not_contact);
    return {
      ...col,
      count: stageLeads.length,
      totalValue: stageLeads.reduce((sum, l) => sum + Number(l.deal_value || l.current_value || 0), 0)
    };
  });

  const openStatuses = stages.map(s => s.name);
  const openOpportunities = leads.filter(l => 
    openStatuses.includes(l.status) && l.status !== 'Perdido' && l.status !== 'Plano Ativo'
  );
  
  const activeCount = openOpportunities.length;
  const totalValue = openOpportunities.reduce((sum, l) => sum + Number(l.deal_value || l.current_value || 0), 0);

  const stats = {
    quotesSent: leads.filter(l => l.status === 'Cotação Enviada').reduce((sum, l) => sum + Number(l.deal_value || l.current_value || 0), 0),
    quotesApproved: leads.filter(l => l.status === 'Cotação Aprovada').reduce((sum, l) => sum + Number(l.deal_value || l.current_value || 0), 0),
    inCarrier: leads.filter(l => l.status === 'Proposta Operadora').reduce((sum, l) => sum + Number(l.deal_value || l.current_value || 0), 0),
    contractReleased: leads.filter(l => l.status === 'Contrato').reduce((sum, l) => sum + Number(l.deal_value || l.current_value || 0), 0),
    invoiceGenerated: leads.filter(l => l.status === 'Boleto Pago').reduce((sum, l) => sum + Number(l.deal_value || l.current_value || 0), 0),
    activeDeployment: leads.filter(l => l.status === 'Plano Ativo').reduce((sum, l) => sum + Number(l.deal_value || l.current_value || 0), 0)
  };
  
  const filteredLeadsForSearch = leads.filter(l => {
    const searchLower = searchTerm.toLowerCase();
    const nameMatch = (l.name || "").toLowerCase().includes(searchLower);
    const phoneMatch = (l.phone || "").includes(searchTerm);
    const isNotInFunnel = !openStatuses.includes(l.status);
    
    return (searchTerm === "" || nameMatch || phoneMatch) && isNotInFunnel;
  }).slice(0, 100);

  // Navegação por teclado (Setas Esquerda/Direita)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!scrollRef.current) return;
      const scrollAmount = 350; 
      if (e.key === 'ArrowRight') {
        scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      } else if (e.key === 'ArrowLeft') {
        scrollRef.current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelectExistingLead = async (lead: any) => {
    const initialStatus = stages[0]?.name || "Novo";
    const now = new Date().toISOString();
    await supabase.from('leads').update({ 
      status: initialStatus,
      status_updated_at: now
    }).eq('id', lead.id);
    await fetchLeads();
    setIsSearchModalOpen(false);
    setIsSelectionModalOpen(false);
    const updatedLead = { ...lead, status: initialStatus, status_updated_at: now };
    setSelectedLead(updatedLead);
  };

  const onDragEnd = async (result: any) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const now = new Date().toISOString();
    const { error: supabaseError } = await supabase
      .from('leads')
      .update({ 
        status: destination.droppableId,
        status_updated_at: now
      })
      .eq('id', draggableId);

    if (supabaseError) {
      error("Erro ao mover lead: " + supabaseError.message);
    } else {
      success("Lead movido!");
      
      // Automação: Se mover para "Plano Ativo", criar contrato
      if (destination.droppableId === 'Plano Ativo') {
        createContractFromLead(draggableId);
      }
    }
    await fetchLeads();
  };

  const createContractFromLead = async (leadId: string) => {
    try {
      // 1. Buscar dados completos do lead
      const { data: lead, error: leadErr } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single();
      
      if (leadErr || !lead) throw new Error("Não foi possível carregar os dados do lead.");

      // 2. Verificar se já existe um contrato para este Lead (Anti-Duplicidade)
      const { data: existingContract } = await supabase
        .from('contracts')
        .select('id')
        .eq('lead_id', leadId)
        .single();

      const contractData = {
        client_name: lead.name,
        cnpj: (lead.cnpj || lead.cpf || '').replace(/\D/g, ''),
        carrier: lead.carrier || 'Não Informado',
        product: lead.product || 'Não Informado',
        lives: 1,
        start_date: new Date().toISOString().split('T')[0],
        monthly_fee: Number(lead.deal_value || lead.current_value || 0),
        type: lead.lead_type || 'PF',
        status: 'Ativo',
        lead_id: lead.id
      };

      let contractId;

      if (existingContract) {
        // Se já existe, apenas atualiza para garantir que os dados estão batendo
        const { error: updateErr } = await supabase
          .from('contracts')
          .update(contractData)
          .eq('id', existingContract.id);
        
        if (updateErr) throw updateErr;
        contractId = existingContract.id;
      } else {
        // Se não existe, cria um novo
        const { data: newC, error: contractErr } = await supabase
          .from('contracts')
          .insert([contractData])
          .select()
          .single();
        
        if (contractErr) throw contractErr;
        contractId = newC.id;
      }

      // 3. Garantir que o Beneficiário Titular existe
      const { data: existingBen } = await supabase
        .from('beneficiaries')
        .select('id')
        .eq('contract_id', contractId)
        .eq('type', 'Titular')
        .single();

      if (!existingBen) {
        const { error: benErr } = await supabase.from('beneficiaries').insert([{
          contract_id: contractId,
          lead_id: lead.id,
          name: lead.name,
          type: 'Titular',
          birth_date: lead.birth_date || null,
          cpf: (lead.cpf || lead.cnpj || '').replace(/\D/g, ''),
          initials: lead.name.split(' ').filter(Boolean).map((n:any) => n[0]).join('').substring(0, 2).toUpperCase()
        }]);
        
        if (benErr) console.error("Erro ao criar beneficiário automático:", benErr);
      }

      success(`Contrato para ${lead.name} gerado com sucesso!`);
    } catch (err: any) {
      console.error("Erro na automação de contrato:", err);
      error("Erro ao gerar contrato automático: " + err.message);
    }
  };
  
  const updateInteractionStatus = async (leadId: string, newStatus: string) => {
    const { error: supabaseError } = await supabase
      .from('leads')
      .update({ interaction_status: newStatus })
      .eq('id', leadId);
    
    if (supabaseError) {
      error("Erro ao atualizar status: " + supabaseError.message);
    } else {
      fetchLeads();
    }
  };
  
  const handleDeleteLead = async (e: React.MouseEvent, leadId: string, leadName: string) => {
    e.stopPropagation(); 
    const confirmed = window.confirm(`Tem certeza que deseja apagar a oportunidade de "${leadName || "Sem Nome"}"? Esta ação não pode ser desfeita.`);
    if (!confirmed) return;

    const { error: supabaseError } = await supabase.from('leads').delete().eq('id', leadId);
    if (!supabaseError) {
      success("Oportunidade removida.");
      await fetchLeads();
    } else {
      error("Erro ao apagar oportunidade: " + supabaseError.message);
    }
  };

  const handleRemoveFromFunnel = async (e: React.MouseEvent, leadId: string, leadName: string) => {
    e.stopPropagation();
    const confirmed = window.confirm(`Deseja retirar "${leadName || "este lead"}" do funil de vendas? Ele continuará salvo na sua base de dados.`);
    if (!confirmed) return;

    const { error: supabaseError } = await supabase
      .from('leads')
      .update({ status: '' })
      .eq('id', leadId);

    if (!supabaseError) {
      success("Lead retirado do funil.");
      await fetchLeads();
    } else {
      error("Erro ao retirar do funil: " + supabaseError.message);
    }
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Kanban Header */}
      <header className="w-full px-8 py-5 bg-white border-b shrink-0 z-20 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          
          <div className="flex flex-row items-center gap-6 lg:gap-10 flex-1 overflow-x-auto no-scrollbar">
            {/* Card: Oportunidades Totais */}
            <div className="flex flex-col p-3 px-4 bg-slate-50 border border-slate-100 rounded-2xl min-w-[160px] shrink-0">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total em Aberto</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-800">{activeCount}</span>
                <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">
                  {formatCurrency(totalValue)}
                </span>
              </div>
            </div>

            {/* Card: Pipeline de Vendas */}
            <div className="flex flex-col p-3 px-4 bg-slate-50 border border-slate-100 rounded-2xl min-w-[220px] shrink-0">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pipeline de Cotação</span>
              <div className="flex items-center gap-6">
                <div className="flex flex-col">
                   <div className="flex items-center gap-1.5 mb-0.5">
                     <div className="w-2 h-2 rounded-full bg-blue-500 shadow-sm shadow-blue-200"></div>
                     <span className="text-[9px] font-black text-slate-500 uppercase">Enviadas</span>
                   </div>
                   <span className="text-sm font-black text-slate-700">{formatCurrency(stats.quotesSent)}</span>
                </div>
                <Icons.ChevronRight className="w-4 h-4 text-slate-200" />
                <div className="flex flex-col">
                   <div className="flex items-center gap-1.5 mb-0.5">
                     <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200"></div>
                     <span className="text-[9px] font-black text-slate-500 uppercase">Aprovadas</span>
                   </div>
                   <span className="text-sm font-black text-emerald-600">{formatCurrency(stats.quotesApproved)}</span>
                </div>
              </div>
            </div>

            {/* Card: Status de Implantação */}
            <div className="flex flex-col p-3 px-4 bg-slate-50 border border-slate-100 rounded-2xl min-w-[340px] shrink-0">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Fluxo de Implantação</span>
              <div className="flex items-center gap-6">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-slate-400 uppercase mb-0.5">Na Op</span>
                  <span className="text-xs font-black text-slate-700">{formatCurrency(stats.inCarrier)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-slate-500 uppercase mb-0.5 text-emerald-500">Liberado</span>
                  <span className="text-xs font-black text-emerald-700">{formatCurrency(stats.contractReleased)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-orange-500 uppercase mb-0.5">Boleto</span>
                  <span className="text-xs font-black text-orange-700">{formatCurrency(stats.invoiceGenerated)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-blue-500 uppercase mb-0.5">Ativo</span>
                  <span className="text-xs font-black text-blue-700">{formatCurrency(stats.activeDeployment)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button 
              onClick={() => setIsSelectionModalOpen(true)}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 active:scale-95 group"
            >
              <Icons.Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" /> 
              <span>Nova Oportunidade</span>
            </button>
          </div>
        </div>
      </header>

      {/* IA Interview Modal */}
      <AIGuidedLeadCreate 
        isOpen={isAIInterviewOpen} 
        onClose={() => setIsAIInterviewOpen(false)}
        onSuccess={(id) => {
          fetchLeads();
          // Opcional: abrir o drawer do novo lead
        }}
      />

      {/* Main Kanban Content */}
      <DragDropContext onDragEnd={onDragEnd}>
        <section 
          ref={scrollRef}
          className="flex-1 overflow-x-auto p-8 flex items-start gap-6 bg-slate-50 kanban-scrollbar relative pb-12 h-screen"
        >
          {loadingStages ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
          ) : stages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-4">
              <Icons.Filter className="w-16 h-16 opacity-20" />
              <p className="font-bold">Nenhuma etapa configurada no funil.</p>
              <NavLink to="/settings" className="text-blue-600 hover:underline text-sm font-bold">Ir para Configurações</NavLink>
            </div>
          ) : (
            columns.map((col) => (
              <div key={col.name} className="flex flex-col min-w-[320px] max-w-[320px] h-full max-h-[80vh]">
                 {/* Column Header */}
                 <div className="flex flex-col mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shrink-0">
                    <div className={cn("h-1 w-full", col.color)}></div>
                    <div className="flex items-center justify-between p-3">
                       <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                             <div className={cn("w-2.5 h-2.5 rounded-full shadow-sm", col.color)}></div>
                             <h3 className="font-black text-[10px] uppercase tracking-[0.1em] text-slate-700 truncate max-w-[150px]">{col.label}</h3>
                          </div>
                          <span className="text-[10px] font-black text-blue-600 pl-[18px]">
                            {formatCurrency(col.totalValue)}
                          </span>
                       </div>
                       <span className="text-[10px] font-black text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                         {col.count}
                       </span>
                    </div>
                 </div>

                 {/* Column Content with Independent Scroll */}
                 <Droppable droppableId={col.name}>
                   {(provided, snapshot) => (
                     <div 
                       {...provided.droppableProps}
                       ref={provided.innerRef}
                       className={cn(
                         "flex-1 flex flex-col gap-4 overflow-y-auto p-2 rounded-xl custom-scrollbar min-h-[50px] pb-10 transition-colors duration-300",
                         snapshot.isDraggingOver ? "bg-slate-200/50 shadow-inner" : cn(col.color.replace('bg-', 'bg-') + "/5")
                       )}
                     >
                       {leads
                         .filter(l => l.status === col.name)
                         .sort((a, b) => {
                           const weights: Record<string, number> = {
                             'Muito quente': 5,
                             'Quente': 4,
                             'Morno': 3,
                             'Frio': 2,
                             'Congelado': 1
                           };
                           return (weights[b.temperature || 'Morno'] || 0) - (weights[a.temperature || 'Morno'] || 0);
                         })
                         .map((lead: any, index: number) => (
                           <Draggable key={`lead-${lead.id}`} draggableId={String(lead.id)} index={index}>
                             {(provided, snapshot) => (
                               <div
                                 ref={provided.innerRef}
                                 {...provided.draggableProps}
                                 {...provided.dragHandleProps}
                                 style={{
                                   ...provided.draggableProps.style,
                                   zIndex: snapshot.isDragging ? 99 : 1
                                 }}
                               >
                                 <motion.div 
                                   layoutId={`card-${lead.id}`}
                                   onClick={() => setSelectedLead(lead)}
                                   className={cn(
                                     "bg-white rounded-xl p-3 md:p-5 shadow-sm border group cursor-pointer transition-all",
                                     snapshot.isDragging ? "shadow-2xl border-blue-600 ring-4 ring-blue-500/10 rotate-1 scale-105" : "border-slate-100 hover:shadow-md shadow-sm", col.color.replace('bg-', 'hover:border-') + "/30",
                                     !snapshot.isDragging && "hover:-translate-y-1"
                                   )}
                                 >
                                    <div className="flex justify-between items-start mb-3">
                                      <div className="flex flex-col items-start gap-1">
                                        <div className="flex items-center gap-1.5">
                                          <span className={cn(
                                            "text-[10px] font-black px-2.5 py-1 rounded-lg",
                                            (!lead.deal_value || Number(lead.deal_value) === 0) 
                                              ? "bg-red-50 text-red-600" 
                                              : "bg-blue-50 text-blue-600"
                                          )}>
                                            {formatCurrency(Number(lead.deal_value || lead.current_value || 0))}
                                          </span>
                                          {(!lead.deal_value || Number(lead.deal_value) === 0) && (
                                            <span className="text-[7px] font-black uppercase text-red-500 tracking-widest">Potencial</span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        {/* Contador de Dias na Etapa */}
                                        {(() => {
                                          const statusDate = lead.status_updated_at || lead.created_at;
                                          if (!statusDate) return null;
                                          
                                          const now = new Date();
                                          const sDate = new Date(statusDate);
                                          
                                          // Cálculo baseado em dias do calendário (zera as horas para comparar apenas os dias)
                                          const d1 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                                          const d2 = new Date(sDate.getFullYear(), sDate.getMonth(), sDate.getDate());
                                          const days = Math.round((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));

                                          return (
                                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-100 text-[8px] font-black uppercase text-slate-400 group-hover:bg-blue-50 group-hover:border-blue-100 group-hover:text-blue-500 transition-colors">
                                              <Icons.Clock className="w-2.5 h-2.5" />
                                              {days <= 0 ? 'Hoje' : `${days} ${days === 1 ? 'dia' : 'dias'}`}
                                            </div>
                                          );
                                        })()}

                                        <div className={cn(
                                          "px-2 py-0.5 rounded-full text-[8px] font-black uppercase ring-2 ring-white shadow-sm shrink-0 transition-transform group-hover:scale-110",
                                          lead.lead_type === 'PJ' ? "bg-indigo-600 text-white" : "bg-blue-600 text-white"
                                        )}>
                                          {lead.lead_type === 'PJ' ? 'PME' : 'PF'}
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Nome e Origem (Parsing inteligente) */}
                                    {(() => {
                                      const name = lead.name || "Sem Nome";
                                      const sourceMatch = name.match(/^\[(.*?)\]\s*(.*)$/);
                                      const displayName = sourceMatch ? sourceMatch[2] : name;
                                      const rawSource = sourceMatch ? sourceMatch[1] : (lead.source || null);
                                      const sourceLabel = typeof rawSource === 'object' ? null : rawSource;

                                      return (
                                        <div className="space-y-1.5 mb-3">
                                          {sourceLabel && (
                                            <span className="inline-block px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[7px] font-black uppercase rounded tracking-wider border border-slate-200/50">
                                              {sourceLabel}
                                            </span>
                                          )}
                                          <h4 className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors uppercase text-[11px] tracking-tight line-clamp-1 truncate leading-tight">
                                            {displayName}
                                          </h4>
                                          {lead.phone && (
                                            <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold">
                                              <Icons.Phone className="w-2.5 h-2.5" />
                                              {lead.phone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })()}
                                    
                                    {/* Tags de Status & Temperatura */}
                                    <div className="mb-3 flex flex-wrap items-center gap-1.5 overflow-hidden">
                                      {/* Interaction Status Picker */}
                                      <div className="relative group/status shrink-0">
                                        <select 
                                          value={lead.interaction_status || 'Sem Status'}
                                          onChange={(e) => {
                                            e.stopPropagation();
                                            updateInteractionStatus(lead.id, e.target.value);
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                          className={cn(
                                            "text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border-0 cursor-pointer outline-none transition-all appearance-none text-center hover:scale-105 active:scale-95",
                                            interactionStatusOptions.find(o => o.value === (lead.interaction_status || 'Sem Status'))?.color || 'bg-slate-100 text-slate-500'
                                          )}
                                        >
                                          {interactionStatusOptions.map(opt => (
                                            <option key={opt.value} value={opt.value} className="bg-white text-slate-900 uppercase font-bold text-[10px]">{opt.label}</option>
                                          ))}
                                        </select>
                                      </div>

                                      <div className={cn(
                                        "px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest flex items-center gap-1 shrink-0",
                                        lead.temperature === 'Muito quente' ? "bg-red-50 text-red-600 border border-red-100" :
                                        lead.temperature === 'Quente' ? "bg-orange-50 text-orange-600 border border-orange-100" :
                                        lead.temperature === 'Morno' ? "bg-amber-50 text-amber-600 border border-amber-100" :
                                        lead.temperature === 'Frio' ? "bg-blue-50 text-blue-600 border border-blue-100" :
                                        "bg-slate-50 text-slate-400 border border-slate-100"
                                      )}>
                                        <span className="shrink-0">{
                                          lead.temperature === 'Muito quente' ? '🔥' :
                                          lead.temperature === 'Quente' ? '☀️' :
                                          lead.temperature === 'Morno' ? '🌤️' :
                                          lead.temperature === 'Frio' ? '❄️' : '🧊'
                                        }</span>
                                        <span className="truncate">{lead.temperature || 'Morno'}</span>
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center justify-between gap-1.5">
                                      <div className="flex flex-col gap-0.5">
                                        {lead.current_carrier && lead.current_carrier !== lead.carrier && (
                                          <div className="flex items-center gap-1 text-[8px] text-slate-400 font-bold uppercase italic">
                                            <span className="opacity-50">De:</span>
                                            <span className="truncate max-w-[80px]">{lead.current_carrier}</span>
                                          </div>
                                        )}
                                        <div className="flex items-center gap-1.5 text-[9px] text-slate-600 font-black uppercase tracking-tight">
                                          <Icons.Heart className="w-3 h-3 text-blue-500" />
                                          <span className="truncate">{lead.carrier || "Cotação em aberto"}</span>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                         <button 
                                           onClick={(e) => handleRemoveFromFunnel(e, lead.id, lead.name)} 
                                           className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all" 
                                           title="Retirar do Funil (Arquivar)"
                                         >
                                           <Icons.Inbox className="w-3.5 h-3.5" />
                                         </button>
                                         <button 
                                           onClick={(e) => handleDeleteLead(e, lead.id, lead.name)} 
                                           className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" 
                                           title="Apagar Oportunidade Permanentemente"
                                         >
                                           <Icons.Trash className="w-3.5 h-3.5" />
                                         </button>
                                      </div>
                                    </div>

                                    {lead.lastcontact && (
                                      <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between">
                                        <div className="flex items-center gap-1 text-[9px] text-slate-400 font-black uppercase tracking-tighter">
                                          <Icons.History className="w-3 h-3" /> {lead.lastcontact}
                                        </div>
                                        <Icons.MessageSquare className="w-3.5 h-3.5 text-slate-200" />
                                      </div>
                                    )}
                                 </motion.div>
                               </div>
                             )}
                           </Draggable>
                       ))}
                       {provided.placeholder}
                     </div>
                   )}
                 </Droppable>
              </div>
            ))
          )}
        </section>
      </DragDropContext>

      {/* Modals preserved */}
      {isSelectionModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center"><h3 className="font-bold text-slate-800">Nova Oportunidade</h3><button onClick={() => setIsSelectionModalOpen(false)}><Icons.X className="w-4 h-4 text-slate-400" /></button></div>
            <div className="p-6 grid gap-4">
              <button onClick={() => { setIsSelectionModalOpen(false); setIsSearchModalOpen(true); setSearchTerm(""); }} className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:border-blue-500 hover:bg-blue-50 transition-all text-left group">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold group-hover:bg-blue-600 group-hover:text-white transition-colors"><Icons.Search className="w-6 h-6" /></div>
                <div><p className="font-bold text-slate-900">Selecionar Lead</p><p className="text-xs text-slate-500">Puxar do cadastro existente</p></div>
              </button>
              <button onClick={() => { setIsSelectionModalOpen(false); setIsAIInterviewOpen(true); }} className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:border-blue-500 hover:bg-blue-50 transition-all text-left group">
                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold group-hover:bg-indigo-600 group-hover:text-white transition-colors"><Icons.Sparkles className="w-6 h-6" /></div>
                <div><p className="font-bold text-slate-900">Criar com IA</p><p className="text-xs text-slate-500">Iniciar entrevista guiada</p></div>
              </button>
              <button onClick={() => { setIsSelectionModalOpen(false); setSelectedLead({ name: '', source: 'Manual', status: stages[0]?.name || 'Novo', deal_value: 0 }); }} className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:border-blue-500 hover:bg-blue-50 transition-all text-left group">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold group-hover:bg-blue-600 group-hover:text-white transition-colors"><Icons.Plus className="w-6 h-6" /></div>
                <div><p className="font-bold text-slate-900">Criar do Zero</p><p className="text-xs text-slate-500">Cadastrar manualmente</p></div>
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {isSearchModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col h-[600px]">
            <div className="p-6 border-b border-slate-100 space-y-4">
              <div className="flex justify-between items-center"><h3 className="font-bold text-slate-800">Selecionar Lead</h3><button onClick={() => setIsSearchModalOpen(false)}><Icons.X className="w-5 h-5 text-slate-400" /></button></div>
              <div className="relative"><Icons.Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" /><input autoFocus className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 py-3 outline-none focus:border-blue-500 transition-all" placeholder="Buscar por nome ou telefone..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <div className="grid gap-2">{filteredLeadsForSearch.map(lead => (<button key={lead.id} onClick={() => handleSelectExistingLead(lead)} className="flex items-center justify-between p-4 rounded-xl border border-slate-50 hover:border-blue-200 hover:bg-slate-50 transition-all text-left"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold">{lead.initials || lead.name?.substring(0, 2).toUpperCase()}</div><div><p className="font-bold text-slate-900">{lead.name}</p><p className="text-xs text-slate-500">{lead.phone}</p></div></div><Icons.ChevronRight className="w-5 h-5 text-slate-300" /></button>))}</div>
            </div>
          </motion.div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {selectedLead && (
          <LeadDetailDrawer lead={selectedLead} isOpen={!!selectedLead} onClose={() => setSelectedLead(null)} onUpdate={(updatedLead) => { fetchLeads(); if (updatedLead) setSelectedLead(updatedLead); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

