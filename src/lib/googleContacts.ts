import { supabase } from './supabase';
import { batchValidateLeadsWhatsApp } from './evolution';
import { normalizePhone } from './utils';

/**
 * Remove caracteres Unicode inválidos (surrogates órfãos) que quebram o tipo JSONB no Postgres
 */
function sanitizeString(str: string): string {
  if (!str) return str;
  // toWellFormed garante que a string não tenha sequências de escape Unicode inválidas
  if ((str as any).toWellFormed) {
    return (str as any).toWellFormed();
  }
  // Fallback para ambientes sem toWellFormed
  return str.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "643139667607-0hj6tkuuk4tprhm6su71sggj2kd6ngj4.apps.googleusercontent.com";

export interface GoogleContact {
  id: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  initials: string;
}

/**
 * Carrega e inicializa a biblioteca Google Identity Services
 */
export async function syncGoogleContacts(onSuccess: (count: number, duplicated: number) => void, onError: (err: any) => void) {
  try {
    if (!GOOGLE_CLIENT_ID) {
      throw new Error("Client ID do Google não configurado nas variáveis de ambiente.");
    }

    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/contacts.readonly',
      callback: async (response: any) => {
        if (response.error !== undefined) {
          throw response;
        }
        await fetchAndInportContacts(response.access_token, onSuccess, onError);
      },
    });

    tokenClient.requestAccessToken();
  } catch (err) {
    console.error("Erro na sincronização Google:", err);
    onError(err);
  }
}

async function fetchAndInportContacts(accessToken: string, onSuccess: (count: number, duplicated: number) => void, onError: (err: any) => void) {
  try {
    let connections: any[] = [];
    let pageToken = '';
    let hasMorePages = true;

    while (hasMorePages) {
      const url = `https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers,memberships&pageSize=1000${pageToken ? `&pageToken=${pageToken}` : ''}`;
      
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Erro na API do Google: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.connections) {
        connections = [...connections, ...data.connections];
      }

      if (data.nextPageToken) {
        pageToken = data.nextPageToken;
      } else {
        hasMorePages = false;
      }
    }

    // Buscar TODOS os leads atuais para checar duplicados (tratando paginação do Supabase)
    let allExistingLeads: any[] = [];
    let from = 0;
    let to = 999;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('leads')
        .select('name, email, phone')
        .range(from, to);
      
      if (error) {
        console.error("Erro ao buscar leads para checar duplicidade:", error);
        break;
      }
      
      if (data && data.length > 0) {
        allExistingLeads = [...allExistingLeads, ...data];
        if (data.length < 1000) hasMore = false;
        else { from += 1000; to += 1000; }
      } else {
        hasMore = false;
      }
    }

    const existingPhones = new Set(allExistingLeads.map(l => normalizePhone(l.phone)).filter(Boolean));
    const existingEmails = new Map(allExistingLeads.map(l => [l.email?.toLowerCase().trim(), l]).filter(([k]) => !!k));
    const existingNames = new Map(allExistingLeads.map(l => [l.name?.toLowerCase().trim(), l]).filter(([k]) => !!k));

    let importedCount = 0;
    let updatedCount = 0;
    let duplicatedCount = 0;
    const newLeads: any[] = [];
    const leadsToUpdate: any[] = [];

    connections.forEach((person: any) => {
      // Extrair nome
      const name = (person.names?.[0]?.displayName || 'Sem Nome').trim();
      
      // Extrair e-mails
      const emails = (person.emailAddresses || []).map((e: any) => e.value?.toLowerCase().trim()).filter(Boolean);
      const primaryEmail = emails[0] || '';
      
      // Extrair e selecionar o melhor telefone
      const allPhoneNumbers = (person.phoneNumbers || []).map((p: any) => normalizePhone(p.value)).filter(Boolean);
      
      // Priorizar números com 11 dígitos (Celular BR) ou 10 dígitos (Fixo BR)
      // Se tiver múltiplos, tentamos pegar o primeiro que tenha 11 dígitos
      let selectedPhone = allPhoneNumbers.find((p: string) => p.length === 11) || allPhoneNumbers[0] || '';
      let secondaryPhone = allPhoneNumbers.length > 1 ? (allPhoneNumbers.find((p: string) => p !== selectedPhone) || '') : '';
      
      if (!selectedPhone && !primaryEmail) return; 

      // Determinar se já existe um lead correspondente
      const existingByEmail = emails.find((e: string) => existingEmails.has(e)) ? existingEmails.get(emails.find((e: string) => existingEmails.has(e))) : null;
      const existingByName = existingNames.get(name.toLowerCase().trim());
      const existingLead = existingByEmail || existingByName;

      if (!existingLead) {
        // Iniciais para o avatar
        const parts = name.split(' ').filter(Boolean);
        let initials = 'SN';
        if (parts.length > 1) {
          initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        } else if (name) {
          initials = name.substring(0, 2).toUpperCase();
        }

        newLeads.push({
          name: sanitizeString(name),
          email: sanitizeString(primaryEmail) || '',
          phone: selectedPhone || '',
          secondary_phone: secondaryPhone || '',
          source: 'Google Contacts',
          initials: sanitizeString(initials),
          status: '',
          lead_type: 'PF',
          birthday: false,
          lastcontact: null
        });
      } else {
        // Se já existe, verificamos se os dados mudaram e preparamos para UPDATE
        const hasChanges = 
          (selectedPhone && existingLead.phone !== selectedPhone) || 
          (primaryEmail && existingLead.email !== primaryEmail) ||
          (secondaryPhone && existingLead.secondary_phone !== secondaryPhone);

        if (hasChanges) {
          leadsToUpdate.push({
            id: existingLead.id,
            phone: selectedPhone || existingLead.phone,
            secondary_phone: secondaryPhone || existingLead.secondary_phone,
            email: primaryEmail || existingLead.email
          });
        } else {
          duplicatedCount++;
        }
      }
    });

    // Inserir novos
    if (newLeads.length > 0) {
      console.log(`Inserindo ${newLeads.length} novos leads...`);
      const { data: insertedData, error } = await supabase.from('leads').insert(newLeads).select();
      if (error) throw new Error(error.message);
      if (insertedData) {
        importedCount = insertedData.length;
        batchValidateLeadsWhatsApp(insertedData.map(l => ({ id: l.id, phone: l.phone })));
      }
    }

    // Atualizar existentes
    if (leadsToUpdate.length > 0) {
      console.log(`Atualizando ${leadsToUpdate.length} leads existentes...`);
      for (const leadUpdate of leadsToUpdate) {
        const { error } = await supabase
          .from('leads')
          .update({
            phone: leadUpdate.phone,
            secondary_phone: leadUpdate.secondary_phone,
            email: leadUpdate.email
          })
          .eq('id', leadUpdate.id);
        
        if (!error) updatedCount++;
      }
    }

    onSuccess(importedCount, updatedCount);
  } catch (err: any) {
    console.error("Erro ao buscar/inserir contatos:", err);
    onError(err);
  }
}

// Global declaration for google object from script tag
declare global {
  var google: any;
}
