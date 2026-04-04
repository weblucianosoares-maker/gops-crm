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
  unreadLeads: string[];
  unreadCounts: Record<string, number>;
}

const LeadsContext = createContext<LeadsContextType | undefined>(undefined);

export function LeadsProvider({ children }: { children: React.ReactNode }) {
  const [leads, setLeads] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [contactTypes, setContactTypes] = useState<any[]>([]);
  const [filter, setFilter] = useState("Todos");
  const [loadingStages, setLoadingStages] = useState(true);
  const [loadingContactTypes, setLoadingContactTypes] = useState(true);
  const [unreadLeads, setUnreadLeads] = useState<string[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

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

  const fetchLeads = async () => {
    let allData: any[] = [];
    let hasMore = true;
    let start = 0;
    const step = 1000;
    
    while (hasMore) {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .range(start, start + step - 1);
        
      if (error || !data) {
        hasMore = false;
        break;
      }
      allData = [...allData, ...data];
      if (data.length < step) {
        hasMore = false;
      } else {
        start += step;
      }
    }
    setLeads(allData);
  };

  const fetchUnread = async () => {
    const { data } = await supabase
      .from('whatsapp_messages')
      .select('lead_id')
      .eq('is_read', false)
      .eq('is_from_me', false);
    
    if (data) {
      const counts: Record<string, number> = {};
      data.forEach(m => { if(m.lead_id) counts[m.lead_id] = (counts[m.lead_id] || 0) + 1; });
      setUnreadCounts(counts);
      setUnreadLeads(Object.keys(counts));
    }
  };

  useEffect(() => {
    fetchLeads();
    fetchStages();
    fetchContactTypes();
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
      unreadLeads,
      unreadCounts
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
