import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icons } from "../components/Icons";
import { cn } from "../lib/utils";

import Papa from "papaparse";
import { supabase } from "../lib/supabase";
import { useLeads } from "../lib/leadsContext";
import { LeadDetailDrawer } from "../components/LeadDetailDrawer";

export default function Leads() {
  const { leads, filter, fetchLeads, stages, contactTypes } = useLeads();
  const [isUploading, setIsUploading] = useState(false);
  const [ufFilter, setUfFilter] = useState("Todos");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [importResult, setImportResult] = useState<{imported: number, duplicated: number} | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [newLead, setNewLead] = useState({ 
    name: '', email: '', phone: '', source: 'Manual', status: stages[0]?.name || 'Novo', contact_type: '',
    has_current_plan: false, interested_lives: 1, current_lives: 0,
    current_carrier: '', current_product: '', current_value: 0,
    rg: '', address_zip: '', address_street: '', address_neighborhood: '',
    address_city: '', address_state: '', address_number: '', address_complement: '',
    docs_link: '', product: '', carrier: '', nickname: '', has_cnpj: false, is_mei: false, cnpj: ''
  });
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
                lastcontact: cleanString(row.lastContact || row['Último Contato'] || new Date().toLocaleDateString('pt-BR')),
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
            alert('Nenhum dado válido encontrado para importar.');
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
          }

          const chunkSize = 50;
          for (let i = 0; i < parsedData.length; i += chunkSize) {
            const chunk = parsedData.slice(i, i + chunkSize);
            const { error } = await supabase.from('leads').insert(chunk);
            if (error) {
              console.error(`Erro inserindo lote ${i}:`, error);
              throw error;
            }
          }
          
          await fetchLeads();
          setImportResult({ imported: parsedData.length, duplicated: duplicateCount });
        } catch (error: any) {
          console.error("Erro ao importar CSV:", error);
          alert(`Erro ao importar CSV: ${error?.message || JSON.stringify(error)}`);
        } finally {
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      }
    });
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
            address_zip: cep
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
            name: prev.name || data.razao_social,
            nickname: prev.nickname || data.nome_fantasia,
            cnpj: cnpj
          }));
        }
      } catch (e) {
        console.error("Erro ao buscar CNPJ:", e);
      }
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    const normalizedPhone = newLead.phone.replace(/\D/g, '');
    if (normalizedPhone) {
      const isDuplicate = leads.some((l: any) => l.phone && l.phone.replace(/\D/g, '') === normalizedPhone);
      if (isDuplicate) {
        alert("Já existe um lead cadastrado com este telefone!");
        setIsSaving(false);
        return;
      }
    }
    
    const parts = newLead.name.split(' ').filter(Boolean);
    let initials = 'SN';
    if (parts.length > 1) {
      initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    } else if (newLead.name) {
      initials = newLead.name.substring(0, 2).toUpperCase();
    }

    const { error } = await supabase.from('leads').insert([{
      name: newLead.name,
      email: newLead.email,
      phone: normalizedPhone,
      source: newLead.source,
      status: newLead.status,
      initials: initials,
      lastcontact: new Date().toLocaleDateString('pt-BR'),
      birthday: false,
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
      contact_type: newLead.contact_type
    }]);

    setIsSaving(false);
    
    if (error) {
      alert("Erro ao salvar lead: " + error.message);
    } else {
      setIsModalOpen(false);
      setNewLead({ 
        name: '', email: '', phone: '', source: 'Manual', status: stages[0]?.name || 'Novo', contact_type: '',
        has_current_plan: false, interested_lives: 1, current_lives: 0,
        current_carrier: '', current_product: '', current_value: 0,
        rg: '', address_zip: '', address_street: '', address_neighborhood: '',
        address_city: '', address_state: '', address_number: '', address_complement: '',
        docs_link: '', product: '', carrier: '', nickname: '', has_cnpj: false, is_mei: false, cnpj: ''
      });
      fetchLeads();
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
    
    return result;
  }, [leads, filter, ufFilter, statusFilter]);

  const totalPages = Math.ceil(filteredLeads.length / perPage);
  const paginatedLeads = React.useMemo(() => {
    const start = (currentPage - 1) * perPage;
    return filteredLeads.slice(start, start + perPage);
  }, [filteredLeads, currentPage, perPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, ufFilter, statusFilter, perPage]);

  return (
    <div className="px-8 pb-8 pt-2 space-y-8">
      {/* Popup de Resultado da Importação */}
      <AnimatePresence>
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

      {/* Hero Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-6">
        <div>
          <span className="text-[0.6875rem] uppercase tracking-[0.1em] text-blue-600 font-bold mb-2 block">CRM & Prospecção</span>
          <h1 className="text-5xl font-extrabold tracking-tight text-slate-900 leading-none">
            {leads.length} <span className="text-2xl font-light text-slate-400">Leads Ativos</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 text-white px-6 py-3.5 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-sm h-fit"
          >
            <Icons.Plus className="w-5 h-5" />
            Novo Lead
          </button>
          <div 
            className={cn("bg-slate-50 p-6 rounded-xl flex items-center space-x-6 min-w-[240px] border border-slate-100 cursor-pointer hover:border-blue-300 transition-colors", isUploading && "opacity-50 pointer-events-none")}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            <div className="p-3 bg-white rounded-lg shadow-sm">
              <Icons.Upload className={cn("w-8 h-8 text-blue-600", isUploading && "animate-bounce")} />
            </div>
            <div>
              <p className="text-[0.6875rem] uppercase tracking-wider text-slate-400 mb-1">Processamento</p>
              <p className="font-bold text-slate-900">{isUploading ? "Importando..." : "Importar Planilha"}</p>
              <div className="w-32 h-1 bg-slate-200 rounded-full mt-2 overflow-hidden">
                <div className="w-3/4 h-full bg-blue-600"></div>
              </div>
              <p className="text-[10px] text-blue-600 mt-1 font-medium">{leads.length} leads processados</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Section */}
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
      </div>

      {/* Main Content Grid */}
      <div className="bg-white rounded-xl p-2 border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-y-2">
            <thead>
              <tr className="text-[0.6875rem] uppercase tracking-[0.1em] text-slate-400">
                <th className="px-6 py-4 font-semibold">Nome do Lead</th>
                <th className="px-6 py-4 font-semibold">Tipo</th>
                <th className="px-6 py-4 font-semibold">Origem</th>
                <th className="px-6 py-4 font-semibold text-center">Último Contato</th>
                <th className="px-6 py-4 font-semibold text-center">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Ações</th>
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
                  <td className="px-6 py-5 rounded-l-lg border-l-2 border-transparent group-hover:border-blue-600">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                        {lead.initials}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{lead.name}</p>
                        <p className="text-xs text-slate-500">{lead.email}</p>
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
                  <td className="px-6 py-5">
                    {lead.contact_type ? (
                      <span className="inline-flex items-center text-[10px] font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm border border-orange-200">
                        {lead.contact_type}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-medium italic">Sem tipo</span>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    <span className="text-sm font-medium text-slate-600">{lead.source}</span>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span className="text-sm text-slate-500">{lead.lastcontact || lead.lastContact || lead.last_contact}</span>
                  </td>
                  <td className="px-6 py-5 text-center">
                    {(() => {
                      const currentStage = stages.find(s => s.name === lead.status);
                      return (
                        <span className={cn(
                          "text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full",
                          currentStage ? currentStage.color : "bg-blue-100 text-blue-700"
                        )}>
                          {currentStage ? currentStage.label : (lead.status || "Novo")}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-5 rounded-r-lg text-right">
                    <div className="flex items-center justify-end gap-2">
                       <button className="text-slate-400 hover:text-blue-600 transition-colors p-2 hover:bg-blue-50 rounded-lg">
                        <Icons.Mail className="w-5 h-5" />
                      </button>
                      <button className="text-slate-400 hover:text-blue-600 transition-colors p-2 hover:bg-blue-50 rounded-lg">
                        <Icons.FileText className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between px-6 py-4 gap-4">
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

      {/* Modal Novo Lead */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col"
          >
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800">Cadastrar Novo Lead</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <Icons.X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateLead} className="p-6 space-y-6 overflow-y-auto max-h-[85vh] custom-scrollbar">
              {/* Seção: Dados Pessoais */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Icons.Leads className="w-4 h-4 text-blue-600" />
                  <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Dados Pessoais</h4>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Nome Completo</label>
                  <input 
                    required
                    type="text" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:bg-white transition-all text-sm font-bold text-slate-900"
                    placeholder="Ex: João da Silva"
                    value={newLead.name}
                    onChange={e => setNewLead({...newLead, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Apelido</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:bg-white transition-all text-sm font-bold text-slate-900"
                    placeholder="Como prefere ser chamado"
                    value={newLead.nickname}
                    onChange={e => setNewLead({...newLead, nickname: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Telefone</label>
                    <input 
                      required
                      type="text" 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:bg-white transition-all text-sm font-bold text-slate-900"
                      placeholder="(00) 00000-0000"
                      value={newLead.phone}
                      onChange={e => setNewLead({...newLead, phone: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 ml-1">E-mail</label>
                    <input 
                      type="email" 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:bg-white transition-all text-sm font-bold text-slate-900"
                      placeholder="joao@email.com"
                      value={newLead.email}
                      onChange={e => setNewLead({...newLead, email: e.target.value})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 ml-1">RG</label>
                    <input 
                      type="text" 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:bg-white transition-all text-sm font-bold text-slate-900"
                      placeholder="00.000.000-0"
                      value={newLead.rg}
                      onChange={e => setNewLead({...newLead, rg: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Possui CNPJ?</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:bg-white transition-all text-sm font-bold text-slate-900"
                      value={newLead.has_cnpj ? "Sim" : "Não"}
                      onChange={e => setNewLead({...newLead, has_cnpj: e.target.value === "Sim"})}
                    >
                      <option value="Não">Não</option>
                      <option value="Sim">Sim</option>
                    </select>
                  </div>
                </div>

                {newLead.has_cnpj && (
                  <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-blue-100 animate-in fade-in slide-in-from-top-2">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Para MEI?</label>
                      <select 
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-all text-sm font-bold text-slate-900"
                        value={newLead.is_mei ? "Sim" : "Não"}
                        onChange={e => setNewLead({...newLead, is_mei: e.target.value === "Sim"})}
                      >
                        <option value="Não">Não</option>
                        <option value="Sim">Sim</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 ml-1">CNPJ</label>
                      <input 
                        type="text" 
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-all text-sm font-bold text-slate-900"
                        placeholder="00.000.000/0000-00"
                        value={newLead.cnpj}
                        onChange={e => handleCNPJChange(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Seção: Endereço */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Icons.MapPin className="w-4 h-4 text-blue-600" />
                  <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Endereço</h4>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 ml-1">CEP</label>
                    <input 
                      type="text" 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:bg-white transition-all text-sm font-bold text-slate-900"
                      placeholder="00000-000"
                      value={newLead.address_zip}
                      onChange={e => handleCEPChange(e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Rua / Logradouro</label>
                    <input 
                      type="text" 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:bg-white transition-all text-sm font-bold text-slate-900"
                      value={newLead.address_street}
                      onChange={e => setNewLead({...newLead, address_street: e.target.value})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Número</label>
                    <input 
                      type="text" 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:bg-white transition-all text-sm font-bold text-slate-900"
                      placeholder="123"
                      value={newLead.address_number}
                      onChange={e => setNewLead({...newLead, address_number: e.target.value})}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Complemento</label>
                    <input 
                      type="text" 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:bg-white transition-all text-sm font-bold text-slate-900"
                      placeholder="Apto, Bloco, etc."
                      value={newLead.address_complement}
                      onChange={e => setNewLead({...newLead, address_complement: e.target.value})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Bairro</label>
                    <input 
                      type="text" 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:bg-white transition-all text-sm font-bold text-slate-900"
                      value={newLead.address_neighborhood}
                      onChange={e => setNewLead({...newLead, address_neighborhood: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Cidade / UF</label>
                    <div className="flex gap-2">
                       <input 
                        type="text" 
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:bg-white transition-all text-sm font-bold text-slate-900"
                        value={newLead.address_city}
                        onChange={e => setNewLead({...newLead, address_city: e.target.value})}
                      />
                      <input 
                        type="text" 
                        maxLength={2}
                        className="w-12 bg-slate-50 border border-slate-200 rounded-xl px-2 py-3 outline-none focus:border-blue-500 focus:bg-white transition-all text-sm font-bold text-slate-900 text-center uppercase"
                        value={newLead.address_state}
                        onChange={e => setNewLead({...newLead, address_state: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Seção: Perfil do Plano */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Icons.Target className="w-4 h-4 text-blue-600" />
                  <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Perfil do Plano</h4>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Operadora</label>
                    <input 
                      type="text" 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:bg-white transition-all text-sm font-bold text-slate-900"
                      placeholder="Ex: Unimed"
                      value={newLead.carrier}
                      onChange={e => setNewLead({...newLead, carrier: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Produto</label>
                    <input 
                      type="text" 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:bg-white transition-all text-sm font-bold text-slate-900"
                      placeholder="Ex: Regional"
                      value={newLead.product}
                      onChange={e => setNewLead({...newLead, product: e.target.value})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Tipo de Contato</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:bg-white transition-all text-sm font-bold text-slate-700"
                      value={newLead.contact_type || ""}
                      onChange={e => setNewLead({...newLead, contact_type: e.target.value})}
                    >
                      <option value="">Não definido</option>
                      {contactTypes?.filter(t => t.active).map(t => (
                        <option key={t.id} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Origem</label>
                    <input 
                      type="text" 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:bg-white transition-all text-sm font-bold text-slate-900"
                      value={newLead.source}
                      onChange={e => setNewLead({...newLead, source: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Status</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:bg-white transition-all text-sm font-bold text-slate-900"
                      value={newLead.status}
                      onChange={e => setNewLead({...newLead, status: e.target.value})}
                    >
                      {stages.map(s => (
                        <option key={s.id} value={s.name}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Link Docs (Drive)</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:bg-white transition-all text-sm font-bold text-blue-600"
                    placeholder="https://drive.google.com/..."
                    value={newLead.docs_link}
                    onChange={e => setNewLead({...newLead, docs_link: e.target.value})}
                  />
                </div>
              </div>

              {/* Seção Situação Atual */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Icons.Info className="w-4 h-4 text-blue-600" />
                  <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Situação Atual</h4>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Possui Plano?</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:bg-white transition-all text-sm font-bold text-slate-900"
                      value={newLead.has_current_plan ? "Sim" : "Não"}
                      onChange={e => setNewLead({...newLead, has_current_plan: e.target.value === "Sim"})}
                    >
                      <option value="Não">Não</option>
                      <option value="Sim">Sim</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Vidas Int.</label>
                    <input 
                      type="number" 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:bg-white transition-all text-sm font-bold text-slate-900"
                      value={newLead.interested_lives}
                      min={1}
                      onChange={e => setNewLead({...newLead, interested_lives: parseInt(e.target.value) || 1})}
                    />
                  </div>
                </div>
              </div>

              {newLead.has_current_plan && (
                <div className="pt-4 mt-2 border-t border-slate-100 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Operadora Atual</label>
                      <input 
                        type="text" 
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 outline-none focus:border-blue-500 focus:bg-white transition-all text-sm font-medium"
                        placeholder="Ex: SulAmérica"
                        value={newLead.current_carrier}
                        onChange={e => setNewLead({...newLead, current_carrier: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Produto Atual</label>
                      <input 
                        type="text" 
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 outline-none focus:border-blue-500 focus:bg-white transition-all text-sm font-medium"
                        placeholder="Ex: Top Nacional"
                        value={newLead.current_product}
                        onChange={e => setNewLead({...newLead, current_product: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Vidas Atuais</label>
                      <input 
                        type="number" 
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 outline-none focus:border-blue-500 focus:bg-white transition-all text-sm font-medium"
                        value={newLead.current_lives}
                        onChange={e => setNewLead({...newLead, current_lives: parseInt(e.target.value) || 0})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Valor Pago R$</label>
                      <input 
                        type="number" 
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 outline-none focus:border-blue-500 focus:bg-white transition-all text-sm font-medium"
                        placeholder="0.00"
                        value={newLead.current_value || ""}
                        onChange={e => setNewLead({...newLead, current_value: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 mt-2 border-t border-slate-100 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center min-w-[120px] shadow-sm"
                >
                  {isSaving ? <Icons.Upload className="w-4 h-4 animate-spin" /> : "Salvar Lead"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
