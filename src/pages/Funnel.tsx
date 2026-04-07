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

export default function Funnel() {
  const { leads, fetchLeads, stages, loadingStages } = useLeads();
  const { success, error } = useToast();
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const columns = stages.map(col => ({
    ...col,
    count: leads.filter(l => l.status === col.name).length
  }));

  const openStatuses = stages.map(s => s.name);
  const openOpportunities = leads.filter(l => 
    openStatuses.includes(l.status)
  );
  
  const activeCount = openOpportunities.length;
  const totalValue = openOpportunities.reduce((sum, l) => sum + Number(l.deal_value || 0), 0);
  
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
    await supabase.from('leads').update({ status: initialStatus }).eq('id', lead.id);
    await fetchLeads();
    setIsSearchModalOpen(false);
    setIsSelectionModalOpen(false);
    const updatedLead = { ...lead, status: initialStatus };
    setSelectedLead(updatedLead);
  };

  const onDragEnd = async (result: any) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const { error: supabaseError } = await supabase.from('leads').update({ status: destination.droppableId }).eq('id', draggableId);
    if (supabaseError) {
      error("Erro ao mover lead: " + supabaseError.message);
    } else {
      success("Lead movido!");
    }
    await fetchLeads();
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

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Kanban Header */}
      <header className="w-full px-8 py-4 bg-white border-b shrink-0 z-10 shadow-sm">
        <div className="flex justify-between items-start">
          <div className="flex items-start gap-6">
            <div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Oportunidades Ativas</span>
                <div className="flex flex-col gap-0.5 mt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700">{activeCount} no total</span>
                    <span className="text-xs font-bold text-blue-600">{formatCurrency(totalValue)}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-slate-100 h-16 w-px mt-1 hidden sm:block"></div>
            <div className="flex flex-col mt-1 hidden sm:flex">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Valor em Negociação</span>
              <span className="text-lg font-extrabold text-blue-600 mt-0.5">{formatCurrency(totalValue)}</span>
            </div>
          </div>
          <button 
            onClick={() => setIsSelectionModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Icons.Plus className="w-4 h-4" /> Nova Oportunidade
          </button>
        </div>
      </header>

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
                 <div className="flex items-center justify-between mb-4 px-2 shrink-0">
                    <div className="flex items-center gap-2">
                       <div className={cn("w-2 h-2 rounded-full", col.color)}></div>
                       <h3 className="font-black text-xs uppercase tracking-widest text-slate-500">{col.label}</h3>
                    </div>
                    <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">{col.count}</span>
                 </div>

                 {/* Column Content with Independent Scroll */}
                 <Droppable droppableId={col.name}>
                   {(provided) => (
                     <div 
                       {...provided.droppableProps}
                       ref={provided.innerRef}
                       className="flex-1 flex flex-col gap-4 overflow-y-auto p-1 custom-scrollbar min-h-[50px] pb-10"
                     >
                       {leads
                         .filter(l => l.status === col.name)
                         .map((lead: any, index: number) => (
                           <Draggable key={`lead-${lead.id}`} draggableId={String(lead.id)} index={index}>
                             {(draggableProvided, draggableSnapshot) => (
                               <div
                                 ref={draggableProvided.innerRef}
                                 {...draggableProvided.draggableProps}
                                 {...draggableProvided.dragHandleProps}
                                 style={{
                                   ...draggableProvided.draggableProps.style,
                                   zIndex: draggableSnapshot.isDragging ? 99 : 1
                                 }}
                               >
                                 <motion.div 
                                   layoutId={`card-${lead.id}`}
                                   onClick={() => setSelectedLead(lead)}
                                   className={cn(
                                     "bg-white rounded-xl p-5 shadow-sm border group cursor-pointer transition-all",
                                     draggableSnapshot.isDragging ? "shadow-2xl border-blue-600 ring-4 ring-blue-500/10 rotate-1 scale-105" : "border-slate-100 hover:shadow-md hover:border-blue-200/50 shadow-sm",
                                     !draggableSnapshot.isDragging && "hover:-translate-y-1"
                                   )}
                                 >
                                    <div className="flex justify-between items-start mb-3">
                                      <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
                                        {formatCurrency(Number(lead.deal_value || 0))}
                                      </span>
                                      <div className="flex items-center gap-2">
                                        <button onClick={(e) => handleDeleteLead(e, lead.id, lead.name)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100" title="Apagar Oportunidade"><Icons.Trash className="w-3.5 h-3.5" /></button>
                                        <div className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-600">{lead.initials || lead.name?.substring(0, 2).toUpperCase()}</div>
                                      </div>
                                    </div>
                                    
                                    <h4 className="font-bold text-slate-900 mb-1 group-hover:text-blue-700 transition-colors uppercase text-[11px] tracking-tight">{lead.name || "Sem Nome"}</h4>
                                    
                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold uppercase">
                                      <Icons.Heart className="w-3.5 h-3.5 text-slate-400" />
                                      <span className="truncate">{lead.carrier || "---"}</span>
                                    </div>

                                    {lead.last_contact && (
                                      <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                                        <div className="flex items-center gap-1 text-[9px] text-slate-400 font-black uppercase tracking-tighter">
                                          <Icons.History className="w-3 h-3" /> {lead.last_contact}
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
              <button onClick={() => { setIsSelectionModalOpen(false); setSelectedLead({ name: '', source: 'Manual', status: stages[0]?.name || 'Novo', deal_value: 0 }); }} className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:border-blue-500 hover:bg-blue-50 transition-all text-left group">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold group-hover:bg-blue-600 group-hover:text-white transition-colors"><Icons.Plus className="w-6 h-6" /></div>
                <div><p className="font-bold text-slate-900">Criar do Zero</p><p className="text-xs text-slate-500">Cadastrar novo registro</p></div>
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
