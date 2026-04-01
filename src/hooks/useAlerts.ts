import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface AlertNotification {
  id: string;
  type: 'birthday' | 'contract' | 'marriage' | 'reminder';
  title: string;
  description: string;
  date: Date;
  isToday: boolean;
  severity: 'info' | 'warning' | 'urgent';
  entityId: string;
}

export function useAlerts() {
  const [alerts, setAlerts] = useState<AlertNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    try {
      const [leadsRes, beneficiariesRes, contractsRes, remindersRes] = await Promise.all([
        supabase.from('leads').select('id, name, birth_date, marriage_date'),
        supabase.from('beneficiaries').select('id, name, birth_date, lead_id'),
        supabase.from('contracts').select('id, start_date, leads(name)'),
        supabase.from('reminders').select('*, leads(name)').eq('status', 'pendente')
      ]);

      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const newAlerts: AlertNotification[] = [];

      // HELPER: Check if a date matches today (ignoring year)
      const isEventToday = (dateStr: string) => {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        return d.getDate() === now.getDate() && d.getMonth() === now.getMonth();
      };

      // HELPER: Check contract anniversary milestones
      const checkContractMilestone = (startDateStr: string) => {
        if (!startDateStr) return null;
        const d = new Date(startDateStr);
        const anniversary = new Date(now.getFullYear(), d.getMonth(), d.getDate());
        
        // If anniversary passed this year, look at next year
        if (anniversary < now) anniversary.setFullYear(now.getFullYear() + 1);

        const diffDays = Math.ceil((anniversary.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        const milestones = [90, 60, 30, 15, 7, 1];
        if (milestones.includes(diffDays)) return diffDays;
        return null;
      };

      // 1. Lead Birthdays & Marriage
      leadsRes.data?.forEach(lead => {
        if (isEventToday(lead.birth_date)) {
          newAlerts.push({
            id: `bday-lead-${lead.id}`,
            type: 'birthday',
            title: `Aniversário: ${lead.name}`,
            description: `Parabenize o cliente titular hoje!`,
            date: new Date(lead.birth_date),
            isToday: true,
            severity: 'urgent',
            entityId: lead.id
          });
        }
        if (isEventToday(lead.marriage_date)) {
          newAlerts.push({
            id: `marr-lead-${lead.id}`,
            type: 'marriage',
            title: `Bodas: ${lead.name}`,
            description: `Aniversário de casamento do cliente hoje!`,
            date: new Date(lead.marriage_date),
            isToday: true,
            severity: 'info',
            entityId: lead.id
          });
        }
      });

      // 2. Dependent Birthdays
      beneficiariesRes.data?.forEach(dep => {
        if (isEventToday(dep.birth_date)) {
          newAlerts.push({
            id: `bday-dep-${dep.id}`,
            type: 'birthday',
            title: `Aniversário: ${dep.name}`,
            description: `Dependente de ${(leadsRes.data as any[])?.find((l: any)=>l.id===dep.lead_id)?.name || 'Cliente'} faz anos hoje!`,
            date: new Date(dep.birth_date),
            isToday: true,
            severity: 'urgent',
            entityId: dep.lead_id || ''
          });
        }
      });

      // 3. Contract Anniversaries
      contractsRes.data?.forEach(contract => {
        const milestone = checkContractMilestone(contract.start_date);
        if (milestone !== null) {
          newAlerts.push({
            id: `contract-${contract.id}-${milestone}`,
            type: 'contract',
            title: `Vigência: ${(contract.leads as any)?.name || (contract.leads as any[])?.[0]?.name || 'Contrato'}`,
            description: `Faltam ${milestone} dias para o aniversário do contrato.`,
            date: new Date(contract.start_date),
            isToday: false,
            severity: milestone <= 7 ? 'urgent' : milestone <= 30 ? 'warning' : 'info',
            entityId: contract.id
          });
        }
      });

      // 4. Custom Reminders
      remindersRes.data?.forEach(rem => {
        const remDate = new Date(rem.due_date);
        remDate.setHours(0,0,0,0);
        
        const diffDays = Math.ceil((remDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 7) {
          newAlerts.push({
            id: `rem-${rem.id}`,
            type: 'reminder',
            title: rem.title,
            description: `Ação agendada para o lead ${(rem.leads as any)?.name || 'Cliente'}.`,
            date: remDate,
            isToday: diffDays === 0,
            severity: diffDays === 0 ? 'urgent' : 'info',
            entityId: rem.lead_id
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
    // Refresh every hour
    const interval = setInterval(fetchAlerts, 3600000);
    return () => clearInterval(interval);
  }, []);

  return { alerts, loading, refresh: fetchAlerts };
}
