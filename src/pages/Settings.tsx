import React, { useState } from "react";
import { motion } from "framer-motion";
import { Icons } from "../components/Icons";
import { useLeads } from "../lib/leadsContext";
import { supabase } from "../lib/supabase";
import { cn } from "../lib/utils";

const COLOR_OPTIONS = [
  "bg-blue-600", "bg-blue-400", "bg-indigo-600", "bg-purple-600",
  "bg-green-600", "bg-green-700", "bg-slate-500", "bg-blue-800",
  "bg-rose-600", "bg-orange-500", "bg-amber-500", "bg-teal-600"
];

export default function Settings() {
  const { stages, fetchStages, loadingStages } = useLeads();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ label: "", color: "" });
  const [isAdding, setIsAdding] = useState(false);
  const [newForm, setNewForm] = useState({ name: "", label: "", color: COLOR_OPTIONS[0] });

  const handleEdit = (stage: any) => {
    setEditingId(stage.id);
    setEditForm({ label: stage.label, color: stage.color });
  };

  const handleSave = async (id: string) => {
    const { error } = await supabase
      .from('pipeline_stages')
      .update({ label: editForm.label, color: editForm.color })
      .eq('id', id);

    if (!error) {
      setEditingId(null);
      await fetchStages();
    }
  };

  const handleAdd = async () => {
    const nextOrder = stages.length > 0 ? Math.max(...stages.map((s: any) => s.order_index)) + 1 : 0;
    const { error } = await supabase
      .from('pipeline_stages')
      .insert([{
        name: newForm.name,
        label: newForm.label,
        color: newForm.color,
        order_index: nextOrder
      }]);

    if (!error) {
      setIsAdding(false);
      setNewForm({ name: "", label: "", color: COLOR_OPTIONS[0] });
      await fetchStages();
    } else {
      alert("Erro ao adicionar etapa. Verifique se o nome interno é único.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja apagar esta etapa? Leads nesta etapa podem ficar invisíveis no funil.")) return;
    
    const { error } = await supabase
      .from('pipeline_stages')
      .delete()
      .eq('id', id);

    if (!error) {
      await fetchStages();
    }
  };

  const moveOrder = async (id: string, currentIndex: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= stages.length) return;

    const targetStage = stages[targetIndex];
    
    // Swap indexes
    const { error: err1 } = await supabase.from('pipeline_stages').update({ order_index: targetIndex }).eq('id', id);
    const { error: err2 } = await supabase.from('pipeline_stages').update({ order_index: currentIndex }).eq('id', targetStage.id);

    if (!err1 && !err2) {
      await fetchStages();
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-blue-900 italic tracking-tight">Configurações</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Personalize o comportamento do seu CRM Efraim</p>
        </div>
      </header>

      <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <Icons.Filter className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900">Etapas do Funil</h2>
              <p className="text-xs text-slate-500">Gerencie as colunas do seu pipeline de vendas</p>
            </div>
          </div>
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-black uppercase tracking-wider rounded-lg hover:bg-blue-700 transition-all shadow-md shadow-blue-100"
          >
            <Icons.Plus className="w-3.5 h-3.5" /> Nova Etapa
          </button>
        </div>

        <div className="p-6">
          {loadingStages ? (
            <div className="py-12 flex justify-center">
              <div className="w-8 h-8 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="space-y-3">
              {stages.map((stage: any, index: number) => (
                <motion.div 
                  layout
                  key={stage.id}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-xl border transition-all",
                    editingId === stage.id ? "border-blue-500 bg-blue-50/30 ring-2 ring-blue-500/10" : "border-slate-100 hover:border-slate-200"
                  )}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex flex-col gap-1">
                      <button 
                        onClick={() => moveOrder(stage.id, index, 'up')}
                        disabled={index === 0}
                        className="p-1 hover:bg-slate-100 rounded disabled:opacity-30"
                      >
                        <Icons.ChevronDown className="w-3 h-3 rotate-180" />
                      </button>
                      <button 
                        onClick={() => moveOrder(stage.id, index, 'down')}
                        disabled={index === stages.length - 1}
                        className="p-1 hover:bg-slate-100 rounded disabled:opacity-30"
                      >
                        <Icons.ChevronDown className="w-3 h-3" />
                      </button>
                    </div>

                    <div className={cn("w-4 h-4 rounded-full", stage.color)}></div>
                    
                    {editingId === stage.id ? (
                      <div className="flex items-center gap-3 flex-1 px-2">
                        <input 
                          className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-bold outline-none focus:border-blue-500"
                          value={editForm.label}
                          onChange={e => setEditForm({ ...editForm, label: e.target.value })}
                        />
                        <div className="flex gap-1.5 p-1 bg-white border rounded-lg">
                          {COLOR_OPTIONS.map(c => (
                            <button 
                              key={c}
                              onClick={() => setEditForm({...editForm, color: c})}
                              className={cn(
                                "w-5 h-5 rounded-md transition-transform",
                                c === editForm.color ? "ring-2 ring-slate-400 ring-offset-1 scale-110" : "hover:scale-110",
                                c
                              )}
                            />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <h3 className="font-bold text-slate-900">{stage.label}</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{stage.name}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {editingId === stage.id ? (
                      <>
                        <button 
                          onClick={() => handleSave(stage.id)}
                          className="px-3 py-1.5 bg-green-600 text-white text-[10px] font-black uppercase rounded-lg hover:bg-green-700"
                        >
                          Salvar
                        </button>
                        <button 
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 bg-slate-100 text-slate-600 text-[10px] font-black uppercase rounded-lg hover:bg-slate-200"
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button 
                          onClick={() => handleEdit(stage)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        >
                          <Icons.Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(stage.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Icons.Trash className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {isAdding && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200"
            >
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nome de Exibição</label>
                  <input 
                    placeholder="Ex: Pós-Venda"
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-blue-500"
                    value={newForm.label}
                    onChange={e => setNewForm({ ...newForm, label: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nome Interno (ID)</label>
                  <input 
                    placeholder="Ex: PosVenda"
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-blue-500"
                    value={newForm.name}
                    onChange={e => setNewForm({ ...newForm, name: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Cor de Destaque</label>
                  <div className="flex flex-wrap gap-2 p-2 bg-white border rounded-xl">
                    {COLOR_OPTIONS.map(c => (
                      <button 
                        key={c}
                        onClick={() => setNewForm({...newForm, color: c})}
                        className={cn(
                          "w-8 h-8 rounded-lg transition-all",
                          c === newForm.color ? "ring-4 ring-blue-500/20 scale-110" : "hover:scale-110",
                          c
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button 
                  onClick={() => setIsAdding(false)}
                  className="px-6 py-2.5 text-slate-600 text-xs font-black uppercase tracking-wider rounded-xl hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleAdd}
                  disabled={!newForm.name || !newForm.label}
                  className="px-6 py-2.5 bg-blue-600 text-white text-xs font-black uppercase tracking-wider rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50"
                >
                  Criar Etapa
                </button>
              </div>
            </motion.div>
          )}

          {!stages.length && !loadingStages && !isAdding && (
            <div className="py-20 text-center space-y-4">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-300">
                <Icons.Filter className="w-10 h-10" />
              </div>
              <div>
                <p className="font-bold text-slate-600">Nenhuma etapa configurada</p>
                <p className="text-sm text-slate-400 mt-1">Crie sua primeira etapa para usar o funil de vendas.</p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
