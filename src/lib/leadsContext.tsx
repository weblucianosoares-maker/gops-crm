import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { supabase } from './supabase';

interface LeadsContextType {
  leads: any[];
  stages: any[];
  contactTypes: any[];
  filter: string;
  setFilter: (filter: string) => void;
  fetchLeads: () => Promise<void>;
  fetchStages: () => Promise<void>;
  fetchContactTypes: () => Promise<void>;
  filterCounts: Record<string, number>;
  loadingStages: boolean;
  loadingContactTypes: boolean;
  interactionStatuses: any[];
  loadingInteractionStatuses: boolean;
  fetchInteractionStatuses: () => Promise<void>;
  jobTitles: any[];
  loadingJobTitles: boolean;
  fetchJobTitles: () => Promise<void>;
  unreadLeads: string[];
  unreadCounts: Record<string, number>;
  carriers: any[];
  products: any[];
  loadingCarriers: boolean;
  loadingProducts: boolean;
  fetchCarriers: () => Promise<void>;
  fetchProducts: () => Promise<void>;
}

const LeadsContext = createContext<LeadsContextType | undefined>(undefined);

export function LeadsProvider({ children }: { children: React.ReactNode }) {
  const [leads, setLeads] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [contactTypes, setContactTypes] = useState<any[]>([]);
  const [filter, setFilter] = useState("Todos");
  const [loadingStages, setLoadingStages] = useState(true);
  const [loadingContactTypes, setLoadingContactTypes] = useState(true);
  const [interactionStatuses, setInteractionStatuses] = useState<any[]>([]);
  const [loadingInteractionStatuses, setLoadingInteractionStatuses] = useState(true);
  const [jobTitles, setJobTitles] = useState<any[]>([]);
  const [loadingJobTitles, setLoadingJobTitles] = useState(true);
  const [unreadLeads, setUnreadLeads] = useState<string[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [carriers, setCarriers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loadingCarriers, setLoadingCarriers] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const fetchStages = async () => {
    setLoadingStages(true);
    const { data, error } = await supabase
      .from('pipeline_stages')
      .select('*')
      .order('order_index', { ascending: true });
    
    if (!error && data) {
      setStages(data);
    }
    setLoadingStages(false);
  };

  const fetchContactTypes = async () => {
    setLoadingContactTypes(true);
    const { data, error } = await supabase
      .from('contact_types')
      .select('*')
      .order('name', { ascending: true });
    
    if (!error && data) {
      setContactTypes(data);
    }
    setLoadingContactTypes(false);
  };
  
  const fetchInteractionStatuses = async () => {
    setLoadingInteractionStatuses(true);
    const { data, error } = await supabase
      .from('interaction_statuses')
      .select('*')
      .order('name', { ascending: true });
    
    if (!error && data) {
      setInteractionStatuses(data);
    }
    setLoadingInteractionStatuses(false);
  };
  
  const fetchJobTitles = async () => {
    setLoadingJobTitles(true);
    const { data, error } = await supabase
      .from('job_titles')
      .select('*')
      .order('name', { ascending: true });
    
    if (!error && data) {
      setJobTitles(data);
    }
    setLoadingJobTitles(false);
  };

  const fetchCarriers = async () => {
    setLoadingCarriers(true);
    const { data, error } = await supabase
      .from('carriers')
      .select('*')
      .eq('active', true)
      .order('name', { ascending: true });
    
    if (!error && data) {
      setCarriers(data);
    }
    setLoadingCarriers(false);
  };

  const fetchProducts = async () => {
    setLoadingProducts(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('status', 'Ativo')
      .order('name', { ascending: true });
    
    if (!error && data) {
      setProducts(data);
    }
    setLoadingProducts(false);
  };

  const fetchLeads = async () => {
    let allLeads: any[] = [];
    let from = 0;
    let to = 999;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to);
        
      if (error) {
        console.error("Erro ao buscar leads:", error);
        break;
      }

      if (data && data.length > 0) {
        allLeads = [...allLeads, ...data];
        if (data.length < 1000) {
          hasMore = false;
        } else {
          from += 1000;
          to += 1000;
        }
      } else {
        hasMore = false;
      }
    }

    // Desduplicação final por ID para garantir integridade caso a paginação oscile
    const uniqueLeads = Array.from(new Map(allLeads.map(lead => [lead.id, lead])).values());
    setLeads(uniqueLeads);
  };

  const fetchUnread = async () => {
    // Busca apenas o contagem e agrupamento de mensagens não lidas
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select('lead_id')
      .eq('is_read', false)
      .eq('is_from_me', false);
    
    if (!error && data) {
      const counts: Record<string, number> = {};
      data.forEach(m => { 
        if(m.lead_id) counts[m.lead_id] = (counts[m.lead_id] || 0) + 1; 
      });
      setUnreadCounts(counts);
      setUnreadLeads(Object.keys(counts));
    }
  };

  useEffect(() => {
    fetchLeads();
    fetchStages();
    fetchContactTypes();
    fetchInteractionStatuses();
    fetchJobTitles();
    fetchCarriers();
    fetchProducts();
    fetchUnread();

    const channel = supabase
      .channel('unread-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_messages' }, (payload) => {
        // Any change (INSERT, UPDATE) should trigger a re-fetch of unread counts
        fetchUnread();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { "Todos": leads.length };
    leads.forEach(l => {
      counts[l.source] = (counts[l.source] || 0) + 1;
    });
    return counts;
  }, [leads]);

  return (
    <LeadsContext.Provider value={{ 
      leads, 
      stages, 
      contactTypes,
      filter, 
      setFilter, 
      fetchLeads, 
      fetchStages, 
      fetchContactTypes,
      filterCounts, 
      loadingStages,
      loadingContactTypes,
      interactionStatuses,
      loadingInteractionStatuses,
      fetchInteractionStatuses,
      jobTitles,
      loadingJobTitles,
      fetchJobTitles,
      unreadLeads,
      unreadCounts,
      carriers,
      products,
      loadingCarriers,
      loadingProducts,
      fetchCarriers,
      fetchProducts
    }}>
      {children}
    </LeadsContext.Provider>
  );
}

export function useLeads() {
  const context = useContext(LeadsContext);
  if (context === undefined) {
    throw new Error('useLeads must be used within a LeadsProvider');
  }
  return context;
}
