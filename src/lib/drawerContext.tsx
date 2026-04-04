import React, { createContext, useContext, useState } from 'react';

interface DrawerContextType {
  selectedLead: any | null;
  isOpen: boolean;
  openDrawer: (lead: any, tab?: 'details' | 'chat') => void;
  closeDrawer: () => void;
  initialTab: 'details' | 'chat';
}

const DrawerContext = createContext<DrawerContextType | undefined>(undefined);

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<'details' | 'chat'>('details');

  const openDrawer = (lead: any, tab: 'details' | 'chat' = 'details') => {
    setSelectedLead(lead);
    setInitialTab(tab);
    setIsOpen(true);
  };

  const closeDrawer = () => {
    setIsOpen(false);
    // Don't clear selectedLead immediately to avoid flickering during exit animation
  };

  return (
    <DrawerContext.Provider value={{ selectedLead, isOpen, openDrawer, closeDrawer, initialTab }}>
      {children}
    </DrawerContext.Provider>
  );
}

export function useDrawer() {
  const context = useContext(DrawerContext);
  if (context === undefined) {
    throw new Error('useDrawer must be used within a DrawerProvider');
  }
  return context;
}
