import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';

export interface Broker {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: string;
  active: boolean;
  avatar_url: string | null;
  carrier_codes: any[];
}

interface BrokerContextType {
  currentBroker: Broker | null;
  loading: boolean;
  fetchCurrentBroker: () => Promise<void>;
  setCurrentBroker: (broker: Broker | null) => void;
}

const BrokerContext = createContext<BrokerContextType | undefined>(undefined);

export function BrokerProvider({ children }: { children: React.ReactNode }) {
  const [currentBroker, setCurrentBroker] = useState<Broker | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCurrentBroker = useCallback(async () => {
    // For now, load the first admin broker or first broker
    const { data } = await supabase
      .from('brokers')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: true })
      .limit(1);

    if (data && data.length > 0) {
      setCurrentBroker(data[0]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCurrentBroker();
  }, [fetchCurrentBroker]);

  return (
    <BrokerContext.Provider value={{ currentBroker, loading, fetchCurrentBroker, setCurrentBroker }}>
      {children}
    </BrokerContext.Provider>
  );
}

export function useBroker() {
  const context = useContext(BrokerContext);
  if (context === undefined) {
    throw new Error('useBroker must be used within a BrokerProvider');
  }
  return context;
}
