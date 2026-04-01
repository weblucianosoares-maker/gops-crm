import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { supabase } from './supabase';

interface LeadsContextType {
  leads: any[];
  stages: any[];
  filter: string;
  setFilter: (filter: string) => void;
  fetchLeads: () => Promise<void>;
  fetchStages: () => Promise<void>;
  filterCounts: Record<string, number>;
  loadingStages: boolean;
}

const LeadsContext = createContext<LeadsContextType | undefined>(undefined);

export function LeadsProvider({ children }: { children: React.ReactNode }) {
  const [leads, setLeads] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [filter, setFilter] = useState("Todos");
  const [loadingStages, setLoadingStages] = useState(true);

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

  useEffect(() => {
    fetchLeads();
    fetchStages();
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
      filter, 
      setFilter, 
      fetchLeads, 
      fetchStages, 
      filterCounts, 
      loadingStages 
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
