import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface AlertNotification {
  id: string;
  type: 'birthday' | 'contract' | 'marriage' | 'reminder' | 'expiry';
  title: string;
  description: string;
  date: Date;
  isToday: boolean;
  severity: 'info' | 'warning' | 'urgent';
  entityId: string;
  leadData?: any; // To allow quick opening
  typeLabel: string;
  statusLabel: string;
}

export function useAlerts() {
  const [alerts, setAlerts] = useState<AlertNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    try {
      const [leadsRes, beneficiariesRes, contractsRes, remindersRes] = await Promise.all([
        supabase.from('leads').select('*'),
        supabase.from('beneficiaries').select('id, name, birth_date, lead_id'),
        supabase.from('contracts').select('id, start_date, leads(name)'),
        supabase.from('reminders').select('*, leads(*)').eq('status', 'pendente')
      ]);

      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const newAlerts: AlertNotification[] = [];

      // HELPER: Check if a date matches today (ignoring year)
      const isEventToday = (dateStr: string) => {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        return d.getUTCDate() === now.getDate() && d.getUTCMonth() === now.getMonth();
      };

      // HELPER: Calculate diff days for specific dates (expiry)
      const getDiffDays = (dateStr: string) => {
        if (!dateStr) return null;
        const target = new Date(dateStr);
        target.setHours(0,0,0,0);
        return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      };

      // 1. Lead Birthdays & Marriage & EXPIRY
      leadsRes.data?.forEach(lead => {
        // Aniversário
        if (isEventToday(lead.birth_date)) {
          newAlerts.push({
            id: `bday-lead-${lead.id}`,
            type: 'birthday',
            title: `Aniversário: ${lead.name}`,
            description: `Parabenize o cliente titular hoje!`,
            date: new Date(lead.birth_date),
            isToday: true,
            severity: 'urgent',
            entityId: lead.id,
            leadData: lead,
            typeLabel: 'Aniversário',
            statusLabel: 'Hoje'
          });
        }
        
        // Bodas
        if (isEventToday(lead.marriage_date)) {
          newAlerts.push({
            id: `marr-lead-${lead.id}`,
            type: 'marriage',
            title: `Bodas: ${lead.name}`,
            description: `Aniversário de casamento do cliente hoje!`,
            date: new Date(lead.marriage_date),
            isToday: true,
            severity: 'info',
            entityId: lead.id,
            leadData: lead,
            typeLabel: 'Bodas',
            statusLabel: 'Hoje'
          });
        }

        // VENCIMENTO DE CONTRATO (Alterado para 90 dias de antecedência)
        if (lead.contract_expiry_date) {
           const daysToExpiry = getDiffDays(lead.contract_expiry_date);
           if (daysToExpiry !== null && daysToExpiry >= -30 && daysToExpiry <= 90) {
              const severity = daysToExpiry <= 0 ? 'urgent' : daysToExpiry <= 30 ? 'warning' : 'info';
              newAlerts.push({
                id: `expiry-lead-${lead.id}`,
                type: 'expiry',
                title: `Vencimento: ${lead.name}`,
                description: daysToExpiry === 0 ? "O contrato vence HOJE!" : daysToExpiry < 0 ? `Vencido há ${Math.abs(daysToExpiry)} dias!` : `O contrato vence em ${daysToExpiry} dias. Renovar?`,
                date: new Date(lead.contract_expiry_date),
                isToday: daysToExpiry === 0,
                severity: severity,
                entityId: lead.id,
                leadData: lead,
                typeLabel: 'Contrato',
                statusLabel: daysToExpiry === 0 ? 'Hoje' : daysToExpiry < 0 ? 'Vencido' : 'A vencer'
              });
           }
        }
      });

      // 2. Dependent Birthdays
      beneficiariesRes.data?.forEach(dep => {
        if (isEventToday(dep.birth_date)) {
          const lead = (leadsRes.data as any[])?.find((l: any)=>l.id===dep.lead_id);
          newAlerts.push({
            id: `bday-dep-${dep.id}`,
            type: 'birthday',
            title: `Aniversário: ${dep.name}`,
            description: `Dependente de ${lead?.name || 'Cliente'} faz anos hoje!`,
            date: new Date(dep.birth_date),
            isToday: true,
            severity: 'urgent',
            entityId: dep.lead_id || '',
            leadData: lead,
            typeLabel: 'Aniversário',
            statusLabel: 'Hoje'
          });
        }
      });

      // 4. Custom Reminders (Compromissos)
      remindersRes.data?.forEach(rem => {
        const remDate = new Date(rem.due_date);
        remDate.setHours(0,0,0,0);
        const diffDays = Math.ceil((remDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 7 && diffDays >= -15) { 
          newAlerts.push({
            id: `rem-${rem.id}`,
            type: 'reminder',
            title: `Compromisso: ${rem.title}`,
            description: diffDays === 0 ? "Ação agendada para HOJE." : diffDays < 0 ? "Compromisso atrasado!" : `Agendado para o lead ${(rem.leads as any)?.name}.`,
            date: remDate,
            isToday: diffDays === 0,
            severity: diffDays <= 0 ? 'urgent' : 'warning',
            entityId: rem.lead_id,
            leadData: rem.leads,
            typeLabel: 'Lembrete',
            statusLabel: diffDays === 0 ? 'Hoje' : diffDays < 0 ? 'Vencido' : 'A vencer'
          });
        }
      });

      setAlerts(newAlerts);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 3600000); // 1h
    return () => clearInterval(interval);
  }, []);

  return { alerts, loading, refresh: fetchAlerts };
}
