import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icons } from "../components/Icons";
import { cn, formatDateTime } from "../lib/utils";

import Papa from "papaparse";
import { supabase } from "../lib/supabase";
import { useLeads } from "../lib/leadsContext";
import { LeadDetailDrawer } from "../components/LeadDetailDrawer";
import { LeadCreateScreen } from "../components/LeadCreateScreen";
import { useToast } from "../components/Toasts";
import { syncGoogleContacts } from "../lib/googleContacts";
import { batchValidateLeadsWhatsApp } from "../lib/evolution";

const interactionStatusOptions = [
  { label: 'Sem Status', value: 'Sem Status', color: 'bg-slate-100 text-slate-500' },
  { label: 'Aguardando Retorno', value: 'Aguardando Retorno', color: 'bg-amber-100 text-amber-700' },
  { label: 'Não Responde', value: 'Não Responde', color: 'bg-red-100 text-red-700' },
  { label: 'Analisando Cotação', value: 'Analisando Cotação', color: 'bg-indigo-100 text-indigo-700' },
  { label: 'Realizei Contato', value: 'Realizei Contato', color: 'bg-emerald-100 text-emerald-700' },
];

export default function Leads() {
  const { leads, filter, fetchLeads, stages, contactTypes, jobTitles } = useLeads();
  const { success, error, toast: showToast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [ufFilter, setUfFilter] = useState("Todos");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [importResult, setImportResult] = useState<{imported: number, duplicated: number} | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [leadToDelete, setLeadToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSyncingGoogle, setIsSyncingGoogle] = useState(false);
  const [whatsappFilter, setWhatsappFilter] = useState("Todos");
  const [isValidatingAll, setIsValidatingAll] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const cleanString = (str: any) => {
            if (typeof str !== 'string') return str;
            let s = str.replace(/\0/g, ''); 
            s = s.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, ''); 
            s = s.replace(/(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '$1'); 
            return s;
          };
          const existingPhones = new Set(leads.map((l: any) => l.phone).filter(Boolean).map((p: string) => p.replace(/\D/g, '')));
          const existingEmails = new Set(leads.map((l: any) => l.email?.toLowerCase().trim()).filter(Boolean));
          const existingNames = new Set(leads.map((l: any) => l.name?.toLowerCase().trim()).filter(Boolean));
          let duplicateCount = 0;

          const parsedData = results.data
            .filter((row: any) => {
               const hasName = row['First Name'] || row.Name || row.Nome || row['Given Name'] || row.name || row['Organization Name'];
               const hasEmail = row['E-mail 1 - Value'] || row.Email || row.email;
               const hasPhone = row['Phone 1 - Value'] || row['Phone 1 - Formatted'] || row.Phone || row.Telefone || row.Celular;
               return Object.keys(row).length > 1 && (hasName || hasEmail || hasPhone);
            })
            .map((row: any) => {
              let rawName = row.name || row.Nome || row.Name || '';
              if (!rawName) {
                const parts = [row['First Name'], row['Middle Name'], row['Last Name']].filter(Boolean);
                rawName = parts.join(' ');
              }
              
              rawName = rawName.replace(/NÃƒO/gi, 'NÃO').replace(/Ã‚/gi, 'Â').replace(/Ãµ/gi, 'õ').replace(/Ã©/gi, 'é').replace(/Ã£/gi, 'ã');
              rawName = rawName.replace(/^[*#,]/g, '').trim();
              if (rawName.startsWith('- ')) rawName = rawName.substring(2).trim();

              let status = '';
              const nameUpper = rawName.toUpperCase();
              if (nameUpper.includes('NÃO TEM INTERESSE') || nameUpper.includes('SEM INTERESSE') || nameUpper.includes('NÃO QUER CONTATO')) {
                status = 'Desqualificado';
              }
              rawName = rawName.replace(/^\[.*?\]\s*/, '').trim(); 
              if (!rawName) rawName = 'Sem Nome';

              const email = row.email || row.Email || row['E-mail 1 - Value'] || '';

              let source = row.source || row.Origem || 'Google Contacts';
              if (row.Labels) {
                const labels = row.Labels.split(':::').map((l: string) => l.trim().replace('* ', ''));
                const validLabels = labels.filter((l: string) => l !== 'myContacts' && l !== 'Other' && l !== 'starred');
                if (validLabels.length > 0) source = validLabels[0];
              }

              let initials = row.initials || row.Iniciais || '';
              if (!initials) {
                const parts = rawName.split(' ').filter(Boolean);
                if (parts.length > 1) {
                  initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                } else if (rawName !== 'Sem Nome') {
                  initials = rawName.substring(0, 2).toUpperCase();
                } else {
                  initials = 'SN';
                }
              }
              const phoneRaw = row['Phone 1 - Value'] || row['Phone 1 - Formatted'] || row.Phone || row.Telefone || row.Celular || '';
              const normalizedPhone = cleanString(phoneRaw).replace(/\D/g, '');

              return {
                name: cleanString(rawName),
                email: cleanString(email),
                phone: normalizedPhone,
                source: cleanString(source),
                status: cleanString(status),
                lastcontact: cleanString(row.lastContact || row['Último Contato'] || null),
                initials: cleanString(initials),
                birthday: row.birthday === 'true' || row.Aniversário === 'true' || !!row.Birthday
              };
            })
            .filter((lead: any) => {
              let isDuplicate = false;
              if (lead.phone && existingPhones.has(lead.phone)) isDuplicate = true;
              else if (!lead.phone && lead.email && existingEmails.has(lead.email.toLowerCase().trim())) isDuplicate = true;
              else if (!lead.phone && !lead.email && lead.name && existingNames.has(lead.name.toLowerCase().trim())) isDuplicate = true;

              if (isDuplicate) {
                duplicateCount++;
                return false;
              }

              if (lead.phone) existingPhones.add(lead.phone);
              if (lead.email) existingEmails.add(lead.email.toLowerCase().trim());
              if (lead.name) existingNames.add(lead.name.toLowerCase().trim());
              
              return true;
            });

          if (parsedData.length === 0) {
            showToast('Nenhum dado válido encontrado para importar.', 'warning');
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
          }

          for (let i = 0; i < parsedData.length; i += chunkSize) {
            const chunk = parsedData.slice(i, i + chunkSize);
            const { data: insertedData, error: supabaseError } = await supabase.from('leads').insert(chunk).select();
            if (supabaseError) {
              console.error(`Erro inserindo lote ${i}:`, supabaseError);
              throw supabaseError;
            }
            
            if (insertedData) {
              batchValidateLeadsWhatsApp(insertedData.map(l => ({ id: l.id, phone: l.phone })));
            }
          }
          
          await fetchLeads();
          setImportResult({ imported: parsedData.length, duplicated: duplicateCount });
        } catch (err: any) {
          console.error("Erro ao importar CSV:", err);
          error(`Erro ao importar CSV: ${err?.message || 'Erro desconhecido'}`);
        } finally {
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      }
    });
  };

  const handleGoogleSync = () => {
    setIsSyncingGoogle(true);
    syncGoogleContacts(
      (imported, duplicated) => {
        setIsSyncingGoogle(false);
        setImportResult({ imported, duplicated });
        fetchLeads();
        success(`Sincronização com Google concluída: ${imported} novos contatos.`);
      },
      (err) => {
        setIsSyncingGoogle(false);
        error("Erro na sincronização Google: " + (err?.message || "Erro de conexão"));
      }
    );
  };


  const handleDeleteLead = async () => {
    if (!leadToDelete) return;
    setIsDeleting(true);
    
    const { error: supabaseError } = await supabase
      .from('leads')
      .delete()
      .eq('id', leadToDelete.id);
      
    setIsDeleting(false);
    if (supabaseError) {
      error("Erro ao excluir lead: " + supabaseError.message);
    } else {
      success("Lead removido permanentemente.");
      setLeadToDelete(null);
      fetchLeads();
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
      fetchLeads(); // Refresh leads
    }
  };

  const availableUFs = React.useMemo(() => {
    const ufs = new Set(leads.map((l: any) => l.address_state).filter(Boolean));
    return Array.from(ufs).sort();
  }, [leads]);

  const filteredLeads = React.useMemo(() => {
    let result = filter === "Todos" ? leads : leads.filter((l: any) => l.source === filter);

    if (ufFilter !== "Todos") {
      result = result.filter((l: any) => l.address_state === ufFilter);
    }
    
    if (statusFilter !== "Todos") {
      result = result.filter((l: any) => l.status === statusFilter);
    }
    
    if (whatsappFilter !== "Todos") {
      if (whatsappFilter === "Válido") result = result.filter((l: any) => l.whatsapp_exists === true);
      else if (whatsappFilter === "Inválido") result = result.filter((l: any) => l.whatsapp_exists === false);
      else if (whatsappFilter === "Não Verificado") result = result.filter((l: any) => l.whatsapp_exists === null);
    }

    if (searchTerm.trim()) {
      const words = searchTerm.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().split(/\s+/);
      result = result.filter((l: any) => {
        const searchTarget = `
          ${l.name || ""} 
          ${l.email || ""} 
          ${l.phone || ""} 
          ${l.cpf || ""} 
          ${l.cnpj || ""} 
          ${l.nickname || ""} 
          ${l.company_name || ""} 
          ${l.source || ""} 
          ${l.contact_type || ""}
        `.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        return words.every(word => searchTarget.includes(word));
      });
    }

    if (sortConfig) {
      result = [...result].sort((a, b) => {
        let aVal = a[sortConfig.key] || "";
        let bVal = b[sortConfig.key] || "";
        if (typeof aVal === 'string') aVal = aVal.toLowerCase();
        if (typeof bVal === 'string') bVal = bVal.toLowerCase();
        
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    return result;
  }, [leads, filter, ufFilter, statusFilter, sortConfig, searchTerm]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const duplicatedNames = React.useMemo(() => {
    const nameCounts = new Map<string, number>();
    leads.forEach(l => {
      const name = (l.name || "").trim().toLowerCase();
      if (name && name !== "sem nome") {
        nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
      }
    });
    
    const duplicates = new Set<string>();
    nameCounts.forEach((count, name) => {
      if (count > 1) duplicates.add(name);
    });
    return duplicates;
  }, [leads]);

  const totalPages = Math.ceil(filteredLeads.length / perPage);
  const paginatedLeads = React.useMemo(() => {
    const start = (currentPage - 1) * perPage;
    return filteredLeads.slice(start, start + perPage);
  }, [filteredLeads, currentPage, perPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, ufFilter, statusFilter, perPage, searchTerm]);

  useEffect(() => {
    if (isModalOpen || selectedLead) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isModalOpen, selectedLead]);

  return (
    <div className="h-full flex flex-col px-4 pb-2 pt-1 gap-2 overflow-hidden">
      {/* Popup de Resultado da Importação */}
      <AnimatePresence mode="wait">
        {importResult && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100"
            >
              <div className="p-6 text-center space-y-4">
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2 shadow-inner">
                  <Icons.Check className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">Atualização Concluída!</h3>
                  <p className="text-slate-500 text-sm mt-1">
                    Comparamos a planilha com a sua base atual.
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-center shadow-sm">
                    <p className="text-3xl font-black text-emerald-600">{importResult.imported}</p>
                    <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider mt-1">Novos Cadastros</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center shadow-sm">
                    <p className="text-3xl font-black text-slate-600">{importResult.duplicated}</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">Já Existentes</p>
                  </div>
                </div>
                
                <button 
                  onClick={() => setImportResult(null)}
                  className="w-full py-3.5 bg-blue-600 text-white font-black uppercase text-xs tracking-wider rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 mt-6"
                >
                  Entendi
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Confirmação de Exclusão */}
      <AnimatePresence mode="wait">
        {leadToDelete && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-100"
            >
              <div className="p-8 text-center space-y-5">
                <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <Icons.Trash className="w-10 h-10" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 leading-tight">Excluir este Lead?</h3>
                  <p className="text-slate-500 text-sm mt-2 px-4">
                    Você está prestes a remover o lead <span className="font-bold text-slate-900">{leadToDelete.name}</span>. Esta ação não pode ser desfeita.
                  </p>
                </div>
                
                <div className="flex flex-col gap-3 pt-2">
                  <button 
                    onClick={handleDeleteLead}
                    disabled={isDeleting}
                    className="w-full py-4 bg-red-600 text-white font-black uppercase text-xs tracking-widest rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-200 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isDeleting ? <Icons.Loader2 className="w-4 h-4 animate-spin" /> : "Sim, Excluir Lead"}
                  </button>
                  <button 
                    onClick={() => setLeadToDelete(null)}
                    disabled={isDeleting}
                    className="w-full py-4 bg-slate-100 text-slate-600 font-black uppercase text-xs tracking-widest rounded-xl hover:bg-slate-200 transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hero Header Section */}
      <div className="flex flex-row justify-between items-start gap-4 mb-2">
        <div className="pt-1">
          <span className="text-[10px] uppercase tracking-widest text-blue-600 font-bold mb-1 block">CRM & Prospecção</span>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 leading-none">
            {filteredLeads.length} <span className="text-sm font-medium text-slate-400">Leads Filtrados</span>
          </h1>
          {searchTerm && (
            <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-tight font-semibold">Total: {leads.length}</p>
          )}
        </div>
        <div className="flex items-start gap-2 h-fit">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 text-white px-4 py-2.5 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-sm h-fit text-xs"
          >
            <Icons.Plus className="w-4 h-4" />
            Novo Lead
          </button>

          <button 
            onClick={handleGoogleSync}
            disabled={isSyncingGoogle}
            className="bg-white text-slate-700 border border-slate-200 px-4 py-2 rounded-lg font-bold flex items-center gap-2.5 hover:bg-slate-50 transition-all shadow-sm h-fit disabled:opacity-50 group"
          >
            {isSyncingGoogle ? (
              <Icons.Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            ) : (
              <Icons.Google className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
            )}
            <div className="text-left">
              <p className="text-[9px] uppercase tracking-tighter text-slate-400 leading-none mb-0.5">Direto do</p>
              <p className="text-xs">Google Contacts</p>
            </div>
          </button>
          <div 
            className={cn("bg-slate-50 p-2.5 rounded-lg flex items-center space-x-3 border border-slate-100 cursor-pointer hover:border-blue-300 transition-colors h-fit", isUploading && "opacity-50 pointer-events-none")}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            <div className="p-1.5 bg-white rounded shadow-sm">
              <Icons.Upload className={cn("w-5 h-5 text-blue-600", isUploading && "animate-bounce")} />
            </div>
            <div>
              <p className="text-[8px] uppercase tracking-tight text-slate-400 mb-0.5 font-bold">Importar</p>
              <p className="text-xs font-bold text-slate-900">{isUploading ? "Importando..." : "CSV"}</p>
            </div>
          </div>
          
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "p-2.5 rounded-lg font-bold flex items-center justify-center transition-all border shadow-sm",
              showFilters 
                ? "bg-blue-50 text-blue-600 border-blue-200" 
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            )}
            title={showFilters ? "Esconder Filtros" : "Mostrar Filtros"}
          >
            <Icons.Filter className={cn("w-5 h-5", !showFilters && "animate-pulse")} />
          </button>
        </div>
      </div>

      {/* Filters & Search Section */}
      <AnimatePresence>
        {showFilters && (
          <motion.div 
            initial={{ height: 0, opacity: 0, marginBottom: 0 }}
            animate={{ height: "auto", opacity: 1, marginBottom: 16 }}
            exit={{ height: 0, opacity: 0, marginBottom: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col gap-1.5 hover:border-blue-300 transition-colors">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5"><Icons.MapPin className="w-3 h-3 text-blue-600"/> Estado (UF)</label>
                <select
                  value={ufFilter}
                  onChange={(e) => setUfFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-500 transition-all text-sm font-bold text-slate-700 cursor-pointer"
                >
                  <option value="Todos">Todos os Estados</option>
                  {availableUFs.map((uf: any) => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col gap-1.5 hover:border-blue-300 transition-colors">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5"><Icons.Target className="w-3 h-3 text-blue-600"/> Status no Funil</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-500 transition-all text-sm font-bold text-slate-700 cursor-pointer"
                >
                  <option value="Todos">Todos os Status</option>
                  {stages.map((stage: any) => (
                    <option key={stage.id} value={stage.name}>{stage.label}</option>
                  ))}
                </select>
              </div>

              {/* Global Search Box */}
              <div className="md:col-span-2 bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col gap-1.5 hover:border-blue-300 transition-colors">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5 whitespace-nowrap overflow-hidden">
                  <Icons.Search className="w-3 h-3 text-blue-600"/> Pesquisa Global (Nome, CPF, Empresa, etc)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Pesquise qualquer informação do lead..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-2 outline-none focus:border-blue-500 focus:bg-white transition-all text-sm font-bold text-slate-700"
                  />
                  <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col gap-1.5 hover:border-blue-300 transition-colors">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5"><Icons.WhatsApp className="w-3 h-3 text-emerald-600"/> Status WhatsApp</label>
                <select
                  value={whatsappFilter}
                  onChange={(e) => setWhatsappFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-500 transition-all text-sm font-bold text-slate-700 cursor-pointer"
                >
                  <option value="Todos">Todos</option>
                  <option value="Válido">Válido</option>
                  <option value="Inválido">Inválido</option>
                  <option value="Não Verificado">Não Verificado</option>
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Grid */}
      <div className="flex-1 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 overflow-x-auto overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
          <table className="min-w-[1400px] w-full text-left border-separate border-spacing-y-2">
            <thead className="sticky top-0 z-20 bg-white">
              <tr className="text-[0.6875rem] uppercase tracking-[0.1em] text-slate-400">
                <th onClick={() => handleSort("name")} className="px-4 py-2 font-semibold cursor-pointer select-none group hover:text-blue-600 transition-colors">
                  <div className="flex items-center gap-1">
                    Nome do Lead
                    {sortConfig?.key === "name" ? (
                      sortConfig.direction === 'asc' ? <Icons.ChevronUp className="w-3 h-3 text-blue-600" /> : <Icons.ChevronDown className="w-3 h-3 text-blue-600" />
                    ) : <Icons.ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-50" />}
                  </div>
                </th>
                <th onClick={() => handleSort("contact_type")} className="px-4 py-2 font-semibold cursor-pointer select-none group hover:text-blue-600 transition-colors">
                  <div className="flex items-center gap-1">
                    Tipo
                    {sortConfig?.key === "contact_type" ? (
                      sortConfig.direction === 'asc' ? <Icons.ChevronUp className="w-3 h-3 text-blue-600" /> : <Icons.ChevronDown className="w-3 h-3 text-blue-600" />
                    ) : <Icons.ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-50" />}
                  </div>
                </th>
                <th onClick={() => handleSort("source")} className="px-4 py-2 font-semibold cursor-pointer select-none group hover:text-blue-600 transition-colors">
                  <div className="flex items-center gap-1">
                    Origem
                    {sortConfig?.key === "source" ? (
                      sortConfig.direction === 'asc' ? <Icons.ChevronUp className="w-3 h-3 text-blue-600" /> : <Icons.ChevronDown className="w-3 h-3 text-blue-600" />
                    ) : <Icons.ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-50" />}
                  </div>
                </th>
                <th onClick={() => handleSort("lastcontact")} className="px-4 py-2 font-semibold text-center cursor-pointer select-none group hover:text-blue-600 transition-colors">
                  <div className="flex items-center justify-center gap-1">
                    Último Contato
                    {sortConfig?.key === "lastcontact" ? (
                      sortConfig.direction === 'asc' ? <Icons.ChevronUp className="w-3 h-3 text-blue-600" /> : <Icons.ChevronDown className="w-3 h-3 text-blue-600" />
                    ) : <Icons.ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-50" />}
                  </div>
                </th>
                <th onClick={() => handleSort("status")} className="px-4 py-2 font-semibold text-center cursor-pointer select-none group hover:text-blue-600 transition-colors">
                  <div className="flex items-center justify-center gap-1">
                    Funil
                    {sortConfig?.key === "status" ? (
                      sortConfig.direction === 'asc' ? <Icons.ChevronUp className="w-3 h-3 text-blue-600" /> : <Icons.ChevronDown className="w-3 h-3 text-blue-600" />
                    ) : <Icons.ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-50" />}
                  </div>
                </th>
                <th onClick={() => handleSort("last_app_message_at")} className="px-4 py-2 font-semibold text-center cursor-pointer select-none group hover:text-blue-600 transition-colors">
                  <div className="flex items-center justify-center gap-1">
                    Chat App
                    {sortConfig?.key === "last_app_message_at" ? (
                      sortConfig.direction === 'asc' ? <Icons.ChevronUp className="w-3 h-3 text-blue-600" /> : <Icons.ChevronDown className="w-3 h-3 text-blue-600" />
                    ) : <Icons.ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-50" />}
                  </div>
                </th>
                <th className="px-4 py-2 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLeads.map((lead, idx) => (
                <motion.tr 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={lead.id} 
                  onClick={() => setSelectedLead(lead)}
                  className="bg-slate-50 hover:bg-white hover:shadow-md hover:scale-[1.005] transition-all group cursor-pointer"
                >
                  <td className="px-4 py-2 rounded-l-lg border-l-2 border-transparent group-hover:border-blue-600">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold shrink-0">
                        {lead.initials}
                      </div>
                      <div className="flex flex-col gap-1 py-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-900 truncate max-w-[300px] leading-tight" title={lead.name}>{lead.name}</p>
                          {duplicatedNames.has((lead.name || "").trim().toLowerCase()) && (
                            <div className="flex items-center gap-1 bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded border border-amber-100 animate-pulse shadow-sm" title="Possível Lead Duplicado">
                              <Icons.AlertCircle className="w-3 h-3" />
                              <span className="text-[8px] font-black uppercase tracking-tighter">Duplicado</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Interaction Status Tag - Logo Abaixo do Nome */}
                        <div className="relative group/status shrink-0 w-fit">
                          <select 
                            value={lead.interaction_status || 'Sem Status'}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateInteractionStatus(lead.id, e.target.value);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className={cn(
                              "text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border-0 cursor-pointer outline-none transition-all appearance-none text-center",
                              interactionStatusOptions.find(o => o.value === (lead.interaction_status || 'Sem Status'))?.color || 'bg-slate-100 text-slate-500'
                            )}
                          >
                            {interactionStatusOptions.map(opt => (
                              <option key={opt.value} value={opt.value} className="bg-white text-slate-900 uppercase font-bold text-[10px]">{opt.label}</option>
                            ))}
                          </select>
                        </div>
                        
                        <p className="text-[10px] text-slate-400 truncate max-w-[150px] leading-tight" title={lead.email}>{lead.email}</p>
                        
                        {lead.phone && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] font-bold text-slate-500">{formatPhone(lead.phone)}</span>
                            {lead.whatsapp_exists === true && (
                              <Icons.WhatsApp className="w-3.5 h-3.5 text-emerald-500" title="WhatsApp Válido" />
                            )}
                            {lead.whatsapp_exists === false && (
                              <Icons.WhatsApp className="w-3.5 h-3.5 text-red-500" title="WhatsApp Inválido" />
                            )}
                            {lead.whatsapp_exists === null && (
                              <Icons.WhatsApp className="w-3.5 h-3.5 text-slate-300 opacity-50" title="Não Verificado" />
                            )}
                          </div>
                        )}
                      </div>
                      {lead.birthday && (
                        <div className="ml-2 flex gap-1">
                          <span className="bg-green-100 text-green-700 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full flex items-center">
                            <Icons.Cake className="w-3 h-3 mr-0.5" /> Aniversário
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    {lead.contact_type ? (
                      <span className="inline-flex items-center text-[10px] font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm border border-orange-200">
                        {lead.contact_type}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-medium italic">Sem tipo</span>
                    )}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <span className="text-sm font-medium text-slate-600">{lead.source}</span>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className="text-sm text-slate-500">{lead.lastcontact || lead.lastContact || lead.last_contact}</span>
                  </td>
                  <td className="px-4 py-2 text-center">
                    {(() => {
                      const currentStage = stages.find(s => s.name === lead.status);
                      if (currentStage) {
                        return (
                          <span className={cn(
                            "text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg whitespace-nowrap shadow-sm",
                            currentStage.color
                          )}>
                            {currentStage.label}
                          </span>
                        );
                      }
                      return (
                        <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-slate-200 text-slate-500 whitespace-nowrap border border-slate-300">
                          Não está no funil
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {lead.last_app_message_at ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-tighter">Mensagem enviada em</span>
                        <span className="text-[11px] font-bold text-slate-700">{formatDateTime(lead.last_app_message_at)}</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-medium italic">Sem envio</span>
                    )}
                  </td>
                  <td className="px-4 py-2 rounded-r-lg text-right">
                    <div className="flex items-center justify-end gap-2">
                       <button className="text-slate-400 hover:text-blue-600 transition-colors p-2 hover:bg-blue-50 rounded-lg">
                        <Icons.Mail className="w-5 h-5" />
                      </button>
                      <button className="text-slate-400 hover:text-blue-600 transition-colors p-2 hover:bg-blue-50 rounded-lg">
                        <Icons.FileText className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setLeadToDelete(lead);
                        }}
                        className="text-slate-400 hover:text-red-600 transition-colors p-2 hover:bg-red-50 rounded-lg"
                      >
                        <Icons.Trash className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination - Fixed at bottom of container */}
        <div className="border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between px-4 py-2 gap-4">
          <div className="flex items-center gap-4">
            <p className="text-xs text-slate-400">
              Mostrando {filteredLeads.length > 0 ? (currentPage - 1) * perPage + 1 : 0}-
              {Math.min(currentPage * perPage, filteredLeads.length)} de <span className="font-bold text-slate-600">{filteredLeads.length} leads</span>
            </p>
            <select 
              value={perPage} 
              onChange={(e) => setPerPage(Number(e.target.value))}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none text-slate-600 font-medium cursor-pointer"
            >
              <option value={10}>10 por página</option>
              <option value={30}>30 por página</option>
              <option value={50}>50 por página</option>
              <option value={100}>100 por página</option>
            </select>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 border border-slate-200 text-slate-500 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Icons.ChevronLeft className="w-5 h-5" />
            </button>
            
            <div className="px-4 py-2 bg-slate-50 text-slate-600 text-xs font-bold rounded-lg border border-slate-200 flex items-center shadow-sm">
              Página {currentPage} de {totalPages || 1}
            </div>

            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="p-2 border border-slate-200 text-slate-500 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Icons.ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Drawer Detalhes do Lead */}
      <AnimatePresence mode="wait">
        {selectedLead && (
          <LeadDetailDrawer 
            lead={selectedLead}
            isOpen={!!selectedLead}
            onClose={() => setSelectedLead(null)}
            onUpdate={fetchLeads}
          />
        )}
      </AnimatePresence>

      {/* Tela Novo Lead (Full Screen) */}
      <AnimatePresence mode="wait">
        {isModalOpen && (
          <LeadCreateScreen 
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onSuccess={fetchLeads}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
