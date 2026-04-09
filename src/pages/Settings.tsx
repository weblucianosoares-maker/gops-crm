import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icons } from "../components/Icons";
import { useLeads } from "../lib/leadsContext";
import { supabase } from "../lib/supabase";
import { cn } from "../lib/utils";
import { useToast } from "../components/Toasts";
import SmartNetworkImport from "../components/SmartNetworkImport";

const COLOR_OPTIONS = [
  "bg-blue-600", "bg-blue-400", "bg-indigo-600", "bg-purple-600",
  "bg-green-600", "bg-green-700", "bg-slate-500", "bg-blue-800",
  "bg-rose-600", "bg-orange-500", "bg-amber-500", "bg-teal-600"
];

// ─── Brokers Section ────────────────────────────────
function BrokersSection({ isOpen, onToggle }: { isOpen: boolean, onToggle: () => void }) {
  const { success, error, toast: showToast } = useToast();
  const [brokers, setBrokers] = useState<any[]>([]);
  const [carriers, setCarriers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", phone: "", email: "", password: "", avatar_url: "", carrier_codes: [] as any[] });
  const [isAdding, setIsAdding] = useState(false);
  const [newForm, setNewForm] = useState({ name: "", phone: "", email: "", password: "", avatar_url: "", carrier_codes: [] as any[] });
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null);
  const editFileRef = React.useRef<HTMLInputElement>(null);
  const newFileRef = React.useRef<HTMLInputElement>(null);

  const handlePhotoUpload = async (file: File, target: 'edit' | 'new') => {
    const uploadId = target === 'edit' ? editingId || 'edit' : 'new';
    setUploadingPhoto(uploadId);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `broker_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { cacheControl: '3600', upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl;
      if (target === 'edit') {
        setEditForm(prev => ({ ...prev, avatar_url: publicUrl }));
      } else {
        setNewForm(prev => ({ ...prev, avatar_url: publicUrl }));
      }
    } catch (err: any) {
      console.error('Erro ao enviar foto:', err);
      error('Erro ao enviar foto: ' + (err?.message || 'Erro desconhecido'));
    } finally {
      setUploadingPhoto(null);
    }
  };

  const fetchData = useCallback(async () => {
    const [bRes, cRes] = await Promise.all([
      supabase.from('brokers').select('*').order('created_at', { ascending: true }),
      supabase.from('carriers').select('*').order('name', { ascending: true })
    ]);
    setBrokers(bRes.data || []);
    setCarriers(cRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleEdit = (broker: any) => {
    setEditingId(broker.id);
    setEditForm({
      name: broker.name || "",
      phone: broker.phone || "",
      email: broker.email || "",
      password: broker.password || "",
      avatar_url: broker.avatar_url || "",
      carrier_codes: Array.isArray(broker.carrier_codes) ? broker.carrier_codes : []
    });
  };

  const handleSave = async (id: string) => {
    if (!editForm.name.trim()) { showToast("Nome do corretor é obrigatório.", "warning"); return; }
    const { error: supabaseError } = await supabase
      .from('brokers')
      .update({ name: editForm.name, phone: editForm.phone, email: editForm.email, password: editForm.password, avatar_url: editForm.avatar_url || null, carrier_codes: editForm.carrier_codes })
      .eq('id', id);
    if (!supabaseError) { success("Corretor atualizado!"); setEditingId(null); fetchData(); }
    else error("Erro ao salvar corretor.");
  };

  const handleAdd = async () => {
    if (!newForm.name.trim()) { showToast("Nome do corretor é obrigatório.", "warning"); return; }
    const { error: supabaseError } = await supabase
      .from('brokers')
      .insert([{ name: newForm.name, phone: newForm.phone, email: newForm.email, password: newForm.password, avatar_url: newForm.avatar_url || null, carrier_codes: newForm.carrier_codes }]);
    if (!supabaseError) {
      setIsAdding(false);
      setNewForm({ name: "", phone: "", email: "", password: "", avatar_url: "", carrier_codes: [] });
      success("Corretor cadastrado!");
      fetchData();
    } else error("Erro ao adicionar corretor.");
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja apagar este corretor?")) return;
    const { error: supabaseError } = await supabase.from('brokers').delete().eq('id', id);
    if (!supabaseError) { success("Corretor removido."); fetchData(); }
  };

  const updateCarrierCode = (codes: any[], index: number, field: string, value: string) => {
    const updated = [...codes];
    updated[index] = { ...updated[index], [field]: value };
    return updated;
  };

  const addCarrierCode = (codes: any[]) => [...codes, { carrier_name: "", code: "" }];
  const removeCarrierCode = (codes: any[], index: number) => codes.filter((_: any, i: number) => i !== index);

  const renderCarrierCodesEditor = (codes: any[], onChange: (codes: any[]) => void) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Códigos nas Operadoras</p>
        <button
          type="button"
          onClick={() => onChange(addCarrierCode(codes))}
          className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          <Icons.Plus className="w-3 h-3" /> Adicionar
        </button>
      </div>
      {codes.length === 0 && (
        <p className="text-xs text-slate-400 italic ml-1">Nenhum código cadastrado</p>
      )}
      {codes.map((cc: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <select
            className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-500"
            value={cc.carrier_name || ""}
            onChange={e => onChange(updateCarrierCode(codes, i, 'carrier_name', e.target.value))}
          >
            <option value="">Selecionar operadora...</option>
            {carriers.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
          <input
            className="w-36 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-mono outline-none focus:border-blue-500"
            placeholder="Código"
            value={cc.code || ""}
            onChange={e => onChange(updateCarrierCode(codes, i, 'code', e.target.value))}
          />
          <button
            type="button"
            onClick={() => onChange(removeCarrierCode(codes, i))}
            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
          >
            <Icons.X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <button 
        onClick={onToggle}
        className="w-full text-left p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50 hover:bg-slate-100/50 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <Icons.UserPlus className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">Corretores</h2>
            <p className="text-xs text-slate-500">Cadastre e gerencie os corretores da equipe</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!isOpen) onToggle();
              setIsAdding(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-black uppercase tracking-wider rounded-lg hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100"
          >
            <Icons.Plus className="w-3.5 h-3.5" /> Novo Corretor
          </button>
          <Icons.ChevronDown className={cn(
            "w-5 h-5 text-slate-400 transition-transform duration-300",
            isOpen ? "rotate-180" : ""
          )} />
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <div className="p-6">
        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-3">
            {brokers.map((broker: any) => (
              <motion.div
                layout
                key={broker.id}
                className={cn(
                  "p-4 rounded-xl border transition-all",
                  editingId === broker.id ? "border-indigo-500 bg-indigo-50/30 ring-2 ring-indigo-500/10" : "border-slate-100 hover:border-slate-200"
                )}
              >
                {editingId === broker.id ? (
                  <div className="space-y-4">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      ref={editFileRef}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handlePhotoUpload(file, 'edit');
                        if (editFileRef.current) editFileRef.current.value = '';
                      }}
                    />
                    <div className="flex items-start gap-4">
                      <div className="flex flex-col items-center gap-2">
                        <button
                          type="button"
                          onClick={() => editFileRef.current?.click()}
                          className="relative w-16 h-16 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold overflow-hidden border-2 border-indigo-200 hover:border-indigo-400 hover:shadow-lg transition-all cursor-pointer group"
                        >
                          {uploadingPhoto === (editingId || 'edit') ? (
                            <div className="w-6 h-6 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin"></div>
                          ) : editForm.avatar_url ? (
                            <>
                              <img src={editForm.avatar_url} alt="" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Icons.Camera className="w-5 h-5 text-white" />
                              </div>
                            </>
                          ) : (
                            <div className="flex flex-col items-center">
                              <Icons.Camera className="w-5 h-5 text-indigo-400 group-hover:text-indigo-600 transition-colors" />
                              <span className="text-[7px] font-bold text-indigo-400 mt-0.5">ENVIAR</span>
                            </div>
                          )}
                        </button>
                        <p className="text-[8px] font-black text-slate-400 uppercase">Clique p/ foto</p>
                      </div>
                      <div className="flex-1 grid md:grid-cols-3 gap-3">
                        <div className="space-y-0.5">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome</p>
                          <input
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-bold outline-none focus:border-indigo-500"
                            value={editForm.name}
                            onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Telefone</p>
                          <input
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-indigo-500"
                            value={editForm.phone}
                            onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                          />
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail</p>
                          <input
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-indigo-500"
                            value={editForm.email}
                            onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="grid md:grid-cols-1 gap-3">
                      <div className="space-y-0.5">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Senha</p>
                        <div className="relative">
                          <Icons.Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                          <input
                            type={showPassword[broker.id] ? "text" : "password"}
                            className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-9 py-1.5 text-sm outline-none focus:border-indigo-500"
                            value={editForm.password}
                            onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                            placeholder="••••••••"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(p => ({ ...p, [broker.id]: !p[broker.id] }))}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 p-1"
                          >
                            {showPassword[broker.id] ? <Icons.EyeOff className="w-3.5 h-3.5" /> : <Icons.Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                    {renderCarrierCodesEditor(editForm.carrier_codes, (codes) => setEditForm({ ...editForm, carrier_codes: codes }))}
                    <div className="flex items-center gap-2 justify-end pt-2">
                      <button
                        onClick={() => handleSave(broker.id)}
                        className="px-3 py-1.5 bg-green-600 text-white text-[10px] font-black uppercase rounded-lg hover:bg-green-700"
                      >Salvar</button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 bg-slate-100 text-slate-600 text-[10px] font-black uppercase rounded-lg hover:bg-slate-200"
                      >Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm overflow-hidden">
                        {broker.avatar_url ? (
                          <img src={broker.avatar_url} alt={broker.name} className="w-full h-full object-cover" />
                        ) : (
                          (broker.name || "C").substring(0, 2).toUpperCase()
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">{broker.name}</h3>
                        <div className="flex items-center gap-4 mt-0.5">
                          {broker.phone && (
                            <span className="flex items-center gap-1 text-[11px] text-slate-500">
                              <Icons.Phone className="w-3 h-3" /> {broker.phone}
                            </span>
                          )}
                          {broker.email && (
                            <span className="flex items-center gap-1 text-[11px] text-slate-500">
                              <Icons.Mail className="w-3 h-3" /> {broker.email}
                            </span>
                          )}
                        </div>
                        {Array.isArray(broker.carrier_codes) && broker.carrier_codes.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {broker.carrier_codes.map((cc: any, i: number) => (
                              <span key={i} className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                                {cc.carrier_name}: {cc.code}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(broker)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                      ><Icons.Edit className="w-4 h-4" /></button>
                      <button
                        onClick={() => handleDelete(broker.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      ><Icons.Trash className="w-4 h-4" /></button>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        <AnimatePresence>
          {isAdding && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-6 p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200"
            >
              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={newFileRef}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handlePhotoUpload(file, 'new');
                  if (newFileRef.current) newFileRef.current.value = '';
                }}
              />
              <div className="flex items-start gap-6">
                <div className="flex flex-col items-center gap-2">
                  <button
                    type="button"
                    onClick={() => newFileRef.current?.click()}
                    className="relative w-20 h-20 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-700 overflow-hidden border-2 border-dashed border-indigo-300 hover:border-indigo-500 hover:shadow-lg transition-all cursor-pointer group"
                  >
                    {uploadingPhoto === 'new' ? (
                      <div className="w-8 h-8 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin"></div>
                    ) : newForm.avatar_url ? (
                      <>
                        <img src={newForm.avatar_url} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Icons.Camera className="w-6 h-6 text-white" />
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <Icons.Camera className="w-7 h-7 text-indigo-300 group-hover:text-indigo-500 transition-colors" />
                        <span className="text-[8px] font-bold text-indigo-400 group-hover:text-indigo-600">ENVIAR FOTO</span>
                      </div>
                    )}
                  </button>
                  <p className="text-[9px] font-black text-slate-400 uppercase">Clique p/ foto</p>
                </div>
                <div className="flex-1 space-y-4">
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nome do Corretor</label>
                      <input
                        placeholder="Ex: João Silva"
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-indigo-500"
                        value={newForm.name}
                        onChange={e => setNewForm({ ...newForm, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Telefone</label>
                      <input
                        placeholder="(11) 99999-9999"
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
                        value={newForm.phone}
                        onChange={e => setNewForm({ ...newForm, phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">E-mail</label>
                      <input
                        placeholder="corretor@email.com"
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
                        value={newForm.email}
                        onChange={e => setNewForm({ ...newForm, email: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-1 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Senha</label>
                      <div className="relative">
                        <Icons.Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type={showPassword['new'] ? "text" : "password"}
                          placeholder="Defina uma senha"
                          className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-10 py-2.5 text-sm outline-none focus:border-indigo-500"
                          value={newForm.password}
                          onChange={e => setNewForm({ ...newForm, password: e.target.value })}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(p => ({ ...p, new: !p['new'] }))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600"
                        >
                          {showPassword['new'] ? <Icons.EyeOff className="w-4 h-4" /> : <Icons.Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                {renderCarrierCodesEditor(newForm.carrier_codes, (codes) => setNewForm({ ...newForm, carrier_codes: codes }))}
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setIsAdding(false)}
                  className="px-6 py-2.5 text-slate-600 text-xs font-black uppercase tracking-wider rounded-xl hover:bg-slate-200 transition-all"
                >Cancelar</button>
                <button
                  onClick={handleAdd}
                  disabled={!newForm.name.trim()}
                  className="px-6 py-2.5 bg-indigo-600 text-white text-xs font-black uppercase tracking-wider rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
                >Cadastrar Corretor</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

          {!brokers.length && !loading && !isAdding && (
            <div className="py-16 text-center space-y-4">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-300">
                <Icons.UserPlus className="w-10 h-10" />
              </div>
              <div>
                <p className="font-bold text-slate-600">Nenhum corretor cadastrado</p>
                <p className="text-sm text-slate-400 mt-1">Cadastre o primeiro corretor da equipe.</p>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    )}
  </AnimatePresence>
</section>
);
}

// ─── Carriers Settings Section ─────────────────────
function CarriersSettingsSection({ isOpen, onToggle }: { isOpen: boolean, onToggle: () => void }) {
  const { success, error, toast: showToast } = useToast();
  const [carriers, setCarriers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", active: true });
  const [isAdding, setIsAdding] = useState(false);
  const [newForm, setNewForm] = useState({ name: "", active: true });

  const fetchCarriers = useCallback(async () => {
    const { data } = await supabase.from('carriers').select('*').order('name', { ascending: true });
    setCarriers(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchCarriers(); }, [fetchCarriers]);

  const handleEdit = (carrier: any) => {
    setEditingId(carrier.id);
    setEditForm({ name: carrier.name || "", active: carrier.active ?? true });
  };

  const handleSave = async (id: string) => {
    if (!editForm.name.trim()) { showToast("Nome da operadora é obrigatório.", "warning"); return; }
    const { error: supabaseError } = await supabase
      .from('carriers')
      .update({ name: editForm.name, active: editForm.active })
      .eq('id', id);
    if (!supabaseError) { success("Operadora atualizada!"); setEditingId(null); fetchCarriers(); }
    else error("Erro ao salvar operadora.");
  };

  const handleAdd = async () => {
    if (!newForm.name.trim()) { showToast("Nome da operadora é obrigatório.", "warning"); return; }
    const isDuplicate = carriers.some(c => c.name.toLowerCase() === newForm.name.trim().toLowerCase());
    if (isDuplicate) { showToast("Já existe uma operadora com este nome.", "warning"); return; }
    const { error: supabaseError } = await supabase
      .from('carriers')
      .insert([{ name: newForm.name.trim(), active: newForm.active }]);
    if (!supabaseError) {
      setIsAdding(false);
      setNewForm({ name: "", active: true });
      success("Operadora cadastrada!");
      fetchCarriers();
    } else error("Erro ao adicionar operadora.");
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja apagar esta operadora? Produtos vinculados podem ser afetados.")) return;
    const { error: supabaseError } = await supabase.from('carriers').delete().eq('id', id);
    if (!supabaseError) { success("Operadora removida."); fetchCarriers(); }
    else error("Erro ao apagar. Verifique se há produtos vinculados.");
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    await supabase.from('carriers').update({ active: !currentActive }).eq('id', id);
    fetchCarriers();
  };

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <button 
        onClick={onToggle}
        className="w-full text-left p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50 hover:bg-slate-100/50 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-lg shadow-teal-200">
            <Icons.Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">Operadoras de Saúde</h2>
            <p className="text-xs text-slate-500">Cadastre as operadoras de planos de saúde</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!isOpen) onToggle();
              setIsAdding(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-xs font-black uppercase tracking-wider rounded-lg hover:bg-teal-700 transition-all shadow-md shadow-teal-100"
          >
            <Icons.Plus className="w-3.5 h-3.5" /> Nova Operadora
          </button>
          <Icons.ChevronDown className={cn(
            "w-5 h-5 text-slate-400 transition-transform duration-300",
            isOpen ? "rotate-180" : ""
          )} />
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <div className="p-6">
        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-teal-600/20 border-t-teal-600 rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-3">
            {carriers.map((carrier: any) => (
              <motion.div
                layout
                key={carrier.id}
                className={cn(
                  "p-4 rounded-xl border transition-all",
                  editingId === carrier.id ? "border-teal-500 bg-teal-50/30 ring-2 ring-teal-500/10" : "border-slate-100 hover:border-slate-200"
                )}
              >
                {editingId === carrier.id ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 space-y-0.5">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome da Operadora</p>
                        <input
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-bold outline-none focus:border-teal-500"
                          value={editForm.name}
                          onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</p>
                        <button
                          onClick={() => setEditForm({ ...editForm, active: !editForm.active })}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                            editForm.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                          )}
                        >
                          {editForm.active ? "Ativa" : "Inativa"}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => handleSave(carrier.id)}
                        className="px-3 py-1.5 bg-green-600 text-white text-[10px] font-black uppercase rounded-lg hover:bg-green-700"
                      >Salvar</button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 bg-slate-100 text-slate-600 text-[10px] font-black uppercase rounded-lg hover:bg-slate-200"
                      >Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-sm">
                        {(carrier.name || "O").substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">{carrier.name}</h3>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full",
                            carrier.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                          )}>
                            {carrier.active ? "● Ativa" : "○ Inativa"}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {carrier.products_count || 0} produtos
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleActive(carrier.id, carrier.active)}
                        className={cn(
                          "p-2 rounded-lg transition-all",
                          carrier.active
                            ? "text-green-500 hover:text-slate-500 hover:bg-slate-50"
                            : "text-slate-400 hover:text-green-500 hover:bg-green-50"
                        )}
                        title={carrier.active ? "Desativar" : "Ativar"}
                      >
                        <Icons.CheckCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(carrier)}
                        className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-all"
                      ><Icons.Edit className="w-4 h-4" /></button>
                      <button
                        onClick={() => handleDelete(carrier.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      ><Icons.Trash className="w-4 h-4" /></button>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        <AnimatePresence>
          {isAdding && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-6 p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200"
            >
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nome da Operadora</label>
                  <input
                    placeholder="Ex: AMIL, Bradesco Saúde"
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-teal-500"
                    value={newForm.name}
                    onChange={e => setNewForm({ ...newForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Status</label>
                  <button
                    onClick={() => setNewForm({ ...newForm, active: !newForm.active })}
                    className={cn(
                      "w-full px-4 py-2.5 rounded-xl text-sm font-bold transition-all border",
                      newForm.active
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-slate-50 text-slate-500 border-slate-200"
                    )}
                  >
                    {newForm.active ? "● Ativa" : "○ Inativa"}
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setIsAdding(false)}
                  className="px-6 py-2.5 text-slate-600 text-xs font-black uppercase tracking-wider rounded-xl hover:bg-slate-200 transition-all"
                >Cancelar</button>
                <button
                  onClick={handleAdd}
                  disabled={!newForm.name.trim()}
                  className="px-6 py-2.5 bg-teal-600 text-white text-xs font-black uppercase tracking-wider rounded-xl hover:bg-teal-700 transition-all shadow-lg shadow-teal-200 disabled:opacity-50"
                >Cadastrar Operadora</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!carriers.length && !loading && !isAdding && (
          <div className="py-16 text-center space-y-4">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-300">
              <Icons.Shield className="w-10 h-10" />
            </div>
            <div>
              <p className="font-bold text-slate-600">Nenhuma operadora cadastrada</p>
              <p className="text-sm text-slate-400 mt-1">Cadastre a primeira operadora de saúde.</p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )}
</AnimatePresence>
</section>
);
}

// ─── Contact Types Settings Section ─────────────────────
function ContactTypesSettingsSection({ isOpen, onToggle }: { isOpen: boolean, onToggle: () => void }) {
  const { contactTypes, fetchContactTypes, loadingContactTypes } = useLeads();
  const { success, error, toast: showToast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", active: true });
  const [isAdding, setIsAdding] = useState(false);
  const [newForm, setNewForm] = useState({ name: "", active: true });

  const handleEdit = (typeObj: any) => {
    setEditingId(typeObj.id);
    setEditForm({ name: typeObj.name || "", active: typeObj.active ?? true });
  };

  const handleSave = async (id: string) => {
    if (!editForm.name.trim()) { showToast("Nome do tipo é obrigatório.", "warning"); return; }
    const { error: supabaseError } = await supabase
      .from('contact_types')
      .update({ name: editForm.name, active: editForm.active })
      .eq('id', id);
    if (!supabaseError) { success("Tipo de contato salvo!"); setEditingId(null); fetchContactTypes(); }
    else error("Erro ao salvar tipo.");
  };

  const handleAdd = async () => {
    if (!newForm.name.trim()) { showToast("Nome do tipo é obrigatório.", "warning"); return; }
    const isDuplicate = contactTypes.some((c: any) => c.name.toLowerCase() === newForm.name.trim().toLowerCase());
    if (isDuplicate) { showToast("Já existe um tipo com este nome.", "warning"); return; }
    const { error: supabaseError } = await supabase
      .from('contact_types')
      .insert([{ name: newForm.name.trim(), active: newForm.active }]);
    
    if (!supabaseError) {
      setIsAdding(false);
      setNewForm({ name: "", active: true });
      fetchContactTypes();
      success("Tipo de contato cadastrado!");
    } else {
      console.error('Erro ao adicionar tipo:', supabaseError);
      error("Erro ao adicionar tipo: " + (supabaseError.message || "Erro desconhecido"));
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja apagar este tipo?")) return;
    const { error: err } = await supabase.from('contact_types').delete().eq('id', id);
    if (!err) fetchContactTypes();
    else error("Erro ao apagar tipo. Verifique se está em uso.");
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    await supabase.from('contact_types').update({ active: !currentActive }).eq('id', id);
    fetchContactTypes();
  };

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <button 
        onClick={onToggle}
        className="w-full text-left p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50 hover:bg-slate-100/50 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center text-white shadow-lg shadow-orange-200">
            <Icons.Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">Tipos de Contato</h2>
            <p className="text-xs text-slate-500">Agrupe ou diferencie leads (Amigo, Cliente, etc.)</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!isOpen) onToggle();
              setIsAdding(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white text-xs font-black uppercase tracking-wider rounded-lg hover:bg-orange-600 transition-all shadow-md shadow-orange-200"
          >
            <Icons.Plus className="w-3.5 h-3.5" /> Novo Tipo
          </button>
          <Icons.ChevronDown className={cn(
            "w-5 h-5 text-slate-400 transition-transform duration-300",
            isOpen ? "rotate-180" : ""
          )} />
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <div className="p-6">
        {loadingContactTypes ? (
          <div className="py-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-3">
            {contactTypes.map((typeObj: any) => (
              <motion.div
                layout
                key={typeObj.id}
                className={cn(
                  "p-4 rounded-xl border transition-all",
                  editingId === typeObj.id ? "border-orange-500 bg-orange-50/30 ring-2 ring-orange-500/10" : "border-slate-100 hover:border-slate-200"
                )}
              >
                {editingId === typeObj.id ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 space-y-0.5">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome do Tipo</p>
                        <input
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-bold outline-none focus:border-orange-500"
                          value={editForm.name}
                          onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</p>
                        <button
                          onClick={() => setEditForm({ ...editForm, active: !editForm.active })}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                            editForm.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                          )}
                        >
                          {editForm.active ? "Ativo" : "Inativo"}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => handleSave(typeObj.id)}
                        className="px-3 py-1.5 bg-green-600 text-white text-[10px] font-black uppercase rounded-lg hover:bg-green-700"
                      >Salvar</button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 bg-slate-100 text-slate-600 text-[10px] font-black uppercase rounded-lg hover:bg-slate-200"
                      >Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-sm">
                        {(typeObj.name || "T").substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">{typeObj.name}</h3>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full",
                            typeObj.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                          )}>
                            {typeObj.active ? "● Ativo" : "○ Inativo"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleActive(typeObj.id, typeObj.active)}
                        className={cn(
                          "p-2 rounded-lg transition-all",
                          typeObj.active
                            ? "text-green-500 hover:text-slate-500 hover:bg-slate-50"
                            : "text-slate-400 hover:text-green-500 hover:bg-green-50"
                        )}
                        title={typeObj.active ? "Desativar" : "Ativar"}
                      >
                        <Icons.CheckCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(typeObj)}
                        className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
                      ><Icons.Edit className="w-4 h-4" /></button>
                      <button
                        onClick={() => handleDelete(typeObj.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      ><Icons.Trash className="w-4 h-4" /></button>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        <AnimatePresence>
          {isAdding && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-6 p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200"
            >
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nome do Tipo</label>
                  <input
                    placeholder="Ex: Cliente Parceiro"
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-orange-500"
                    value={newForm.name}
                    onChange={e => setNewForm({ ...newForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Status</label>
                  <button
                    onClick={() => setNewForm({ ...newForm, active: !newForm.active })}
                    className={cn(
                      "w-full px-4 py-2.5 rounded-xl text-sm font-bold transition-all border",
                      newForm.active
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-slate-50 text-slate-500 border-slate-200"
                    )}
                  >
                    {newForm.active ? "● Ativo" : "○ Inativo"}
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setIsAdding(false)}
                  className="px-6 py-2.5 text-slate-600 text-xs font-black uppercase tracking-wider rounded-xl hover:bg-slate-200 transition-all"
                >Cancelar</button>
                <button
                  onClick={handleAdd}
                  disabled={!newForm.name.trim()}
                  className="px-6 py-2.5 bg-orange-600 text-white text-xs font-black uppercase tracking-wider rounded-xl hover:bg-orange-700 transition-all shadow-lg shadow-orange-200 disabled:opacity-50"
                >Cadastrar Tipo</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!contactTypes.length && !loadingContactTypes && !isAdding && (
          <div className="py-16 text-center space-y-4">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-300">
              <Icons.Users className="w-10 h-10" />
            </div>
            <div>
              <p className="font-bold text-slate-600">Nenhum tipo cadastrado</p>
              <p className="text-sm text-slate-400 mt-1">Crie o primeiro tipo (ex: Amigo, Cliente).</p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )}
</AnimatePresence>
</section>
);
}

// ─── Job Titles Section ─────────────────────────────
function JobTitlesSettingsSection({ isOpen, onToggle }: { isOpen: boolean, onToggle: () => void }) {
  const { jobTitles, fetchJobTitles, loadingJobTitles } = useLeads();
  const { success, error, toast: showToast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "" });
  const [isAdding, setIsAdding] = useState(false);
  const [newForm, setNewForm] = useState({ name: "" });

  const handleEdit = (title: any) => {
    setEditingId(title.id);
    setEditForm({ name: title.name });
  };

  const handleSave = async (id: string) => {
    if (!editForm.name.trim()) return;
    const { error: err } = await supabase
      .from('job_titles')
      .update({ name: editForm.name })
      .eq('id', id);

    if (!err) {
      success("Cargo atualizado!");
      setEditingId(null);
      fetchJobTitles();
    } else error("Erro ao salvar cargo.");
  };

  const handleAdd = async () => {
    if (!newForm.name.trim()) return;
    const { error: err } = await supabase
      .from('job_titles')
      .insert([{ name: newForm.name }]);

    if (!err) {
      success("Cargo adicionado!");
      setIsAdding(false);
      setNewForm({ name: "" });
      fetchJobTitles();
    } else error("Erro ao adicionar cargo.");
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Excluir este cargo?")) return;
    const { error: err } = await supabase
      .from('job_titles')
      .delete()
      .eq('id', id);

    if (!err) {
      success("Cargo removido.");
      fetchJobTitles();
    } else error("Erro ao remover cargo.");
  };

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <button 
        onClick={onToggle}
        className="w-full text-left p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50 hover:bg-slate-100/50 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <Icons.Briefcase className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">Cargos Corporativos</h2>
            <p className="text-xs text-slate-500">Gerencie os cargos para Leads de Empresas</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              if (!isOpen) onToggle();
              setIsAdding(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-black uppercase tracking-wider rounded-lg hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100"
          >
            <Icons.Plus className="w-3.5 h-3.5" /> Novo Cargo
          </button>
          <Icons.ChevronDown className={cn(
            "w-5 h-5 text-slate-400 transition-transform duration-300",
            isOpen ? "rotate-180" : ""
          )} />
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="p-6"
          >
            {loadingJobTitles ? (
              <div className="py-12 flex justify-center">
                <div className="w-8 h-8 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {jobTitles.map((title: any) => (
                  <div key={title.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                    {editingId === title.id ? (
                      <input 
                        className="flex-1 bg-white border border-indigo-200 rounded-lg px-3 py-1.5 text-sm font-bold outline-none"
                        value={editForm.name}
                        onChange={e => setEditForm({ name: e.target.value })}
                        autoFocus
                      />
                    ) : (
                      <span className="text-sm font-bold text-slate-700 px-2">{title.name}</span>
                    )}

                    <div className="flex items-center gap-1 ml-2">
                       {editingId === title.id ? (
                         <>
                           <button onClick={() => handleSave(title.id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"><Icons.Check className="w-4 h-4" /></button>
                           <button onClick={() => setEditingId(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><Icons.X className="w-4 h-4" /></button>
                         </>
                       ) : (
                         <>
                           <button onClick={() => handleEdit(title)} className="p-1.5 text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-all"><Icons.Edit className="w-4 h-4" /></button>
                           <button onClick={() => handleDelete(title.id)} className="p-1.5 text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"><Icons.Trash className="w-4 h-4" /></button>
                         </>
                       )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {isAdding && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                <input 
                  placeholder="Nome do cargo (ex: Gerente Financeiro)"
                  className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-2 text-sm font-bold outline-none"
                  value={newForm.name}
                  onChange={e => setNewForm({ name: e.target.value })}
                />
                <div className="flex justify-end gap-2 mt-3">
                  <button onClick={() => setIsAdding(false)} className="px-4 py-2 text-slate-500 text-[10px] font-black uppercase">Cancelar</button>
                  <button onClick={handleAdd} className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-lg shadow-md shadow-indigo-100">Adicionar</button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

// ─── Network Management Section ────────────────────────
function NetworkManagementSection({ isOpen, onToggle }: { isOpen: boolean, onToggle: () => void }) {
  const { carriers, products: allProducts } = useLeads();
  const { success, error, toast: showToast } = useToast();
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isSmartImportOpen, setIsSmartImportOpen] = useState(false);
  const [newForm, setNewForm] = useState({ name: "", type: "Hospital", uf: "RJ", city: "", neighborhood: "", address: "" });
  
  const [coverageEditingId, setCoverageEditingId] = useState<string | null>(null);
  const [newCoverage, setNewCoverage] = useState({ carrier_id: "", product_id: "", details: "" });

  const fetchProviders = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('medical_providers')
      .select(`
        *,
        coverage:network_coverage(
          id,
          carrier_id,
          product_id,
          coverage_details,
          carrier:carriers(name),
          product:products(name)
        )
      `)
      .order('name');
    setProviders(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) fetchProviders();
  }, [isOpen]);

  const handleAddProvider = async () => {
    if (!newForm.name.trim() || !newForm.city.trim()) return;
    const { error: err } = await supabase.from('medical_providers').insert([newForm]);
    if (!err) { success("Estabelecimento cadastrado!"); setIsAdding(false); setNewForm({ name: "", type: "Hospital", uf: "RJ", city: "", neighborhood: "", address: "" }); fetchProviders(); }
    else error("Erro ao cadastrar.");
  };

  const handleDeleteProvider = async (id: string) => {
    if (!window.confirm("Excluir este estabelecimento?")) return;
    const { error: err } = await supabase.from('medical_providers').delete().eq('id', id);
    if (!err) { success("Removido!"); fetchProviders(); }
    else error("Erro ao remover.");
  };

  const handleAddCoverage = async (providerId: string) => {
    if (!newCoverage.carrier_id || !newCoverage.product_id) return;
    const { error: err } = await supabase.from('network_coverage').insert([{
      provider_id: providerId,
      carrier_id: newCoverage.carrier_id,
      product_id: newCoverage.product_id,
      coverage_details: newCoverage.details
    }]);
    if (!err) { success("Vínculo adicionado!"); setNewCoverage({ carrier_id: "", product_id: "", details: "" }); fetchProviders(); }
    else error("Erro ao vincular. Verifique se já não existe este vínculo.");
  };

  const handleDeleteCoverage = async (id: string) => {
    const { error: err } = await supabase.from('network_coverage').delete().eq('id', id);
    if (!err) { success("Vínculo removido."); fetchProviders(); }
  };

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <button onClick={onToggle} className="w-full text-left p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50 hover:bg-slate-100/50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-200">
            <Icons.MapPin className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">Gestão de Rede Médica</h2>
            <p className="text-xs text-slate-500">Cadastre hospitais e vincule-os aos planos</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={(e) => { e.stopPropagation(); if (!isOpen) onToggle(); setIsSmartImportOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-xs font-black uppercase tracking-wider rounded-lg hover:bg-slate-800 transition-all shadow-md">
            <Icons.Rocket className="w-3.5 h-3.5 text-indigo-400" /> IA Import
          </button>
          <button onClick={(e) => { e.stopPropagation(); if (!isOpen) onToggle(); setIsAdding(true); }} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-xs font-black uppercase tracking-wider rounded-lg hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100">
            <Icons.Plus className="w-3.5 h-3.5" /> Novo Local
          </button>
          <Icons.ChevronDown className={cn("w-5 h-5 text-slate-400 transition-transform duration-300", isOpen ? "rotate-180" : "")} />
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="p-6">
            {loading ? (
              <div className="py-12 flex justify-center"><div className="w-8 h-8 border-4 border-emerald-600/20 border-t-emerald-600 rounded-full animate-spin"></div></div>
            ) : (
              <div className="space-y-6">
                {providers.map((provider) => (
                  <div key={provider.id} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 group">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn(
                            "text-[8px] font-black uppercase px-2 py-0.5 rounded-full border",
                            provider.type === 'Hospital' ? "bg-red-50 text-red-600 border-red-200" :
                            provider.type === 'Clínica' ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-emerald-50 text-emerald-600 border-emerald-200"
                          )}>{provider.type}</span>
                          <span className="text-[10px] font-bold text-slate-400">{provider.city} - {provider.uf}</span>
                        </div>
                        <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">{provider.name}</h3>
                      </div>
                      <button onClick={() => handleDeleteProvider(provider.id)} className="p-2 text-slate-300 hover:text-red-600 transition-colors"><Icons.Trash className="w-4 h-4"/></button>
                    </div>

                    {/* Subseção de Cobertura */}
                    <div className="mt-4 pt-4 border-t border-slate-200">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Planos Credenciados</p>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                         {provider.coverage?.map((cov: any) => (
                           <div key={cov.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                              <div>
                                <p className="text-[10px] font-black text-blue-900 uppercase leading-none">{cov.carrier?.name}</p>
                                <p className="text-[9px] font-bold text-slate-500 uppercase mt-1">{cov.product?.name}</p>
                              </div>
                              <button onClick={() => handleDeleteCoverage(cov.id)} className="text-slate-300 hover:text-red-500"><Icons.X className="w-4 h-4"/></button>
                           </div>
                         ))}
                       </div>

                       {/* Botão para abrir form de novo vínculo no card */}
                       <div className="p-4 bg-white/50 rounded-xl border-2 border-dashed border-slate-200">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                             <select className="bg-white border rounded-lg px-3 py-1.5 text-xs font-bold" value={newCoverage.carrier_id} onChange={(e) => setNewCoverage({...newCoverage, carrier_id: e.target.value, product_id: ""})}>
                               <option value="">Operadora</option>
                               {carriers.map((c:any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                             </select>
                             <select className="bg-white border rounded-lg px-3 py-1.5 text-xs font-bold" value={newCoverage.product_id} onChange={(e) => setNewCoverage({...newCoverage, product_id: e.target.value})}>
                               <option value="">Produto / Plano</option>
                               {allProducts.filter((p:any) => p.carrier_id === newCoverage.carrier_id).map((p:any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                             </select>
                             <button onClick={() => handleAddCoverage(provider.id)} className="bg-slate-800 text-white text-[10px] font-black uppercase rounded-lg px-2 py-1.5">Vincular Plano</button>
                          </div>
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {isAdding && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-emerald-200">
                <div className="grid md:grid-cols-2 gap-4">
                   <div className="space-y-1.5 md:col-span-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase">Nome do Estabelecimento</label>
                     <input className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold" value={newForm.name} onChange={e => setNewForm({...newForm, name: e.target.value})} placeholder="Ex: Hospital Samaritano" />
                   </div>
                   <div className="space-y-1.5">
                     <label className="text-[10px] font-black text-slate-400 uppercase">Tipo</label>
                     <select className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold" value={newForm.type} onChange={e => setNewForm({...newForm, type: e.target.value})}>
                        <option value="Hospital">Hospital</option>
                        <option value="Clínica">Clínica</option>
                        <option value="Laboratório">Laboratório</option>
                     </select>
                   </div>
                   <div className="space-y-1.5">
                     <label className="text-[10px] font-black text-slate-400 uppercase">Cidade</label>
                     <input className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold" value={newForm.city} onChange={e => setNewForm({...newForm, city: e.target.value})} placeholder="Ex: Niterói" />
                   </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button onClick={() => setIsAdding(false)} className="px-6 py-2 text-slate-600 text-[10px] font-black uppercase">Cancelar</button>
                  <button onClick={handleAddProvider} className="px-6 py-2 bg-emerald-600 text-white text-[10px] font-black uppercase rounded-xl shadow-lg shadow-emerald-200">Cadastrar</button>
                </div>
              </motion.div>
            )}

            <SmartNetworkImport 
               isOpen={isSmartImportOpen} 
               onClose={() => setIsSmartImportOpen(false)} 
               onRefresh={fetchProviders} 
            />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

// ─── Interaction Statuses Section ──────────────────────
function InteractionStatusesSettingsSection({ isOpen, onToggle }: { isOpen: boolean, onToggle: () => void }) {
  const { interactionStatuses, fetchInteractionStatuses, loadingInteractionStatuses } = useLeads();
  const { success, error, toast: showToast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", active: true });
  const [isAdding, setIsAdding] = useState(false);
  const [newForm, setNewForm] = useState({ name: "", active: true });

  const handleEdit = (status: any) => {
    setEditingId(status.id);
    setEditForm({ name: status.name || "", active: status.active ?? true });
  };

  const handleSave = async (id: string) => {
    if (!editForm.name.trim()) { showToast("Nome do status é obrigatório.", "warning"); return; }
    const { error: supabaseError } = await supabase
      .from('interaction_statuses')
      .update({ name: editForm.name, active: editForm.active })
      .eq('id', id);
    if (!supabaseError) { success("Status salvo!"); setEditingId(null); fetchInteractionStatuses(); }
    else error("Erro ao salvar status.");
  };

  const handleAdd = async () => {
    if (!newForm.name.trim()) { showToast("Nome do status é obrigatório.", "warning"); return; }
    const isDuplicate = interactionStatuses.some((s: any) => s.name.toLowerCase() === newForm.name.trim().toLowerCase());
    if (isDuplicate) { showToast("Já existe um status com este nome.", "warning"); return; }
    const { error: supabaseError } = await supabase
      .from('interaction_statuses')
      .insert([{ name: newForm.name.trim(), active: newForm.active }]);
    
    if (!supabaseError) {
      setIsAdding(false);
      setNewForm({ name: "", active: true });
      fetchInteractionStatuses();
      success("Status cadastrado!");
    } else error("Erro ao adicionar status.");
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja apagar este status?")) return;
    const { error: supabaseError } = await supabase.from('interaction_statuses').delete().eq('id', id);
    if (!supabaseError) { success("Status removido."); fetchInteractionStatuses(); }
    else error("Erro ao apagar status.");
  };

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <button 
        onClick={onToggle}
        className="w-full text-left p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50 hover:bg-slate-100/50 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center text-white shadow-lg shadow-blue-200">
            <Icons.CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">Status de Interação</h2>
            <p className="text-xs text-slate-500">Gerencie os status de contato (ex: Aguardando Retorno)</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!isOpen) onToggle();
              setIsAdding(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white text-xs font-black uppercase tracking-wider rounded-lg hover:bg-blue-600 transition-all shadow-md shadow-blue-100"
          >
            <Icons.Plus className="w-3.5 h-3.5" /> Novo Status
          </button>
          <Icons.ChevronDown className={cn(
            "w-5 h-5 text-slate-400 transition-transform duration-300",
            isOpen ? "rotate-180" : ""
          )} />
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <div className="p-6">
        {loadingInteractionStatuses ? (
          <div className="py-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {interactionStatuses.map((status: any) => (
              <motion.div
                layout
                key={status.id}
                className={cn(
                  "p-4 rounded-xl border transition-all flex items-center justify-between",
                  editingId === status.id ? "border-blue-500 bg-blue-50/30 ring-2 ring-blue-500/10" : "border-slate-100 hover:border-slate-200"
                )}
              >
                {editingId === status.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-bold outline-none focus:border-blue-500"
                      value={editForm.name}
                      onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                      autoFocus
                    />
                    <button
                      onClick={() => setEditForm({ ...editForm, active: !editForm.active })}
                      className={cn(
                        "px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap",
                        editForm.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                      )}
                    >
                      {editForm.active ? "Ativo" : "Inativo"}
                    </button>
                    <button onClick={() => handleSave(status.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"><Icons.Check className="w-4 h-4" /></button>
                    <button onClick={() => setEditingId(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><Icons.X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <div className={cn("w-2 h-2 rounded-full", status.active ? "bg-green-500" : "bg-slate-300")}></div>
                      <span className="text-sm font-bold text-slate-700">{status.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleEdit(status)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"><Icons.Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(status.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><Icons.Trash className="w-4 h-4" /></button>
                    </div>
                  </>
                )}
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
            <div className="flex items-center gap-4">
              <input
                placeholder="Ex: Novo Contato, Aguardando Proposta..."
                className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-blue-500"
                value={newForm.name}
                onChange={e => setNewForm({ ...newForm, name: e.target.value })}
              />
              <button
                onClick={() => setNewForm({ ...newForm, active: !newForm.active })}
                className={cn(
                  "px-4 py-2.5 rounded-xl text-sm font-bold transition-all border",
                  newForm.active ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-50 text-slate-500 border-slate-200"
                )}
              >
                {newForm.active ? "● Ativo" : "○ Inativo"}
              </button>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setIsAdding(false)} className="px-6 py-2.5 text-slate-600 text-xs font-black uppercase tracking-wider rounded-xl hover:bg-slate-200 transition-all">Cancelar</button>
              <button onClick={handleAdd} disabled={!newForm.name.trim()} className="px-6 py-2.5 bg-blue-500 text-white text-xs font-black uppercase tracking-wider rounded-xl hover:bg-blue-600 transition-all shadow-lg shadow-blue-200 disabled:opacity-50">Adicionar Status</button>
            </div>
          </motion.div>
        )}
      </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

// ─── Main Settings Page ─────────────────────────────
export default function Settings() {
  const { stages, fetchStages, loadingStages } = useLeads();
  const { success, error, toast: showToast } = useToast();
  const [activeSection, setActiveSection] = useState<string | null>("funnel");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ label: "", name: "", color: "" });
  const [isAdding, setIsAdding] = useState(false);
  const [newForm, setNewForm] = useState({ name: "", label: "", color: COLOR_OPTIONS[0] });

  const toggleSection = (section: string) => {
    setActiveSection(prev => prev === section ? null : section);
  };

  const handleEdit = (stage: any) => {
    setEditingId(stage.id);
    setEditForm({ label: stage.label, name: stage.name, color: stage.color });
  };

  const handleSave = async (id: string) => {
    const isDuplicate = stages.some((s: any) => s.name === editForm.name && s.id !== id);
    if (isDuplicate) {
      showToast("Erro: Já existe uma etapa com este Nome Interno.", "error");
      return;
    }

    const { error: supabaseError } = await supabase
      .from('pipeline_stages')
      .update({ label: editForm.label, name: editForm.name, color: editForm.color })
      .eq('id', id);

    if (!supabaseError) {
      success("Etapa atualizada!");
      setEditingId(null);
      await fetchStages();
    } else {
      error("Erro ao salvar etapa. Verifique se o nome interno é único.");
    }
  };

  const handleAdd = async () => {
    const isDuplicate = stages.some((s: any) => s.name === newForm.name);
    if (isDuplicate) {
      showToast("Erro: Já existe uma etapa com este Nome Interno.", "error");
      return;
    }

    const nextOrder = stages.length > 0 ? Math.max(...stages.map((s: any) => s.order_index)) + 1 : 0;
    const { error: supabaseError } = await supabase
      .from('pipeline_stages')
      .insert([{
        name: newForm.name,
        label: newForm.label,
        color: newForm.color,
        order_index: nextOrder
      }]);

    if (!supabaseError) {
      success("Etapa criada com sucesso!");
      setIsAdding(false);
      setNewForm({ name: "", label: "", color: COLOR_OPTIONS[0] });
      await fetchStages();
    } else {
      error("Erro ao adicionar etapa. Nome interno deve ser único.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja apagar esta etapa? Leads nesta etapa podem ficar invisíveis no funil.")) return;
    
    const { error: err } = await supabase
      .from('pipeline_stages')
      .delete()
      .eq('id', id);

    if (!err) {
      await fetchStages();
    } else {
      error("Erro ao apagar etapa. Verifique se há leads vinculados.");
    }
  };

  const moveOrder = async (id: string, currentIndex: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= stages.length) return;

    const targetStage = stages[targetIndex];
    
    const { error: err1 } = await supabase.from('pipeline_stages').update({ order_index: targetIndex }).eq('id', id);
    const { error: err2 } = await supabase.from('pipeline_stages').update({ order_index: currentIndex }).eq('id', targetStage.id);

    if (!err1 && !err2) {
      await fetchStages();
    }
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-8 max-w-4xl mx-auto space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-blue-900 italic tracking-tight">Configurações</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Personalize o comportamento do seu CRM Efraim</p>
        </div>
      </header>

      {/* ── Section 1: Etapas do Funil ── */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <button 
          onClick={() => toggleSection("funnel")}
          className="w-full text-left p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50 hover:bg-slate-100/50 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <Icons.Filter className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900">Etapas do Funil</h2>
              <p className="text-xs text-slate-500">Gerencie as colunas do seu pipeline de vendas</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                if (activeSection !== "funnel") toggleSection("funnel");
                setIsAdding(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-black uppercase tracking-wider rounded-lg hover:bg-blue-700 transition-all shadow-md shadow-blue-100"
            >
              <Icons.Plus className="w-3.5 h-3.5" /> Nova Etapa
            </button>
            <Icons.ChevronDown className={cn(
              "w-5 h-5 text-slate-400 transition-transform duration-300",
              activeSection === "funnel" ? "rotate-180" : ""
            )} />
          </div>
        </button>

        <AnimatePresence>
          {activeSection === "funnel" && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
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
                      <div className="flex flex-col gap-2 flex-1 px-2">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 space-y-0.5">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome de Exibição</p>
                            <input 
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-bold outline-none focus:border-blue-500"
                              value={editForm.label}
                              onChange={e => setEditForm({ ...editForm, label: e.target.value })}
                            />
                          </div>
                          <div className="flex-1 space-y-0.5">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Interno</p>
                            <input 
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-bold outline-none focus:border-blue-500 font-mono"
                              value={editForm.name}
                              onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                            />
                          </div>
                        </div>
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
        </motion.div>
        )}
        </AnimatePresence>
      </section>

      {/* ── Section 2: Corretores ── */}
      <BrokersSection 
        isOpen={activeSection === "brokers"} 
        onToggle={() => toggleSection("brokers")} 
      />

      {/* ── Section 3: Operadoras de Saúde ── */}
      <CarriersSettingsSection 
        isOpen={activeSection === "carriers"} 
        onToggle={() => toggleSection("carriers")} 
      />

      {/* ── Section 4: Tipos de Contato ── */}
      <ContactTypesSettingsSection 
        isOpen={activeSection === "contact_types"} 
        onToggle={() => toggleSection("contact_types")} 
      />

      {/* ── Section 5: Cargos Corporativos ── */}
      <JobTitlesSettingsSection 
        isOpen={activeSection === "job_titles"} 
        onToggle={() => toggleSection("job_titles")} 
      />

      {/* ── Section 6: Status de Interação ── */}
      <InteractionStatusesSettingsSection 
        isOpen={activeSection === "interaction_statuses"} 
        onToggle={() => toggleSection("interaction_statuses")} 
      />

      {/* ── Section 7: Rede Médica ── */}
      <NetworkManagementSection 
        isOpen={activeSection === "network"} 
        onToggle={() => toggleSection("network")} 
      />
    </div>
  );
}
