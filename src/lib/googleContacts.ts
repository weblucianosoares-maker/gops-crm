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
    const existingEmails = new Set(allExistingLeads.map(l => l.email?.toLowerCase().trim()).filter(Boolean));
    const existingNames = new Set(allExistingLeads.map(l => l.name?.toLowerCase().trim()).filter(Boolean));

    let importedCount = 0;
    let duplicatedCount = 0;
    const newLeads: any[] = [];

    connections.forEach((person: any) => {
      // Extrair nome
      const name = (person.names?.[0]?.displayName || 'Sem Nome').trim();
      
      // Extrair e-mail principal
      const email = (person.emailAddresses?.[0]?.value || '').toLowerCase().trim();
      
      // Extrair telefone principal (normalizado)
      const phone = normalizePhone(person.phoneNumbers?.[0]?.value || '');
      
      if (!phone && !email) return; // Pular contatos sem contato

      // Determinar origem baseada em Labels do Google
      let source = 'Google Contacts';
      
      // Checar duplicidade (por telefone, e-mail ou nome exato)
      const isDuplicated = (phone && existingPhones.has(phone)) || 
                          (email && existingEmails.has(email)) ||
                          existingNames.has(name.toLowerCase().trim());

      if (!isDuplicated) {
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
          email: sanitizeString(email) || '',
          phone: phone || '',
          source: sanitizeString(source),
          initials: sanitizeString(initials),
          status: '',
          lead_type: 'PF',
          birthday: false,
          lastcontact: null
        });
      } else {
        duplicatedCount++;
      }
    });

    if (newLeads.length > 0) {
      console.log(`Tentando inserir ${newLeads.length} novos leads...`);
      const { data: insertedData, error } = await supabase.from('leads').insert(newLeads).select();
      
      if (error) {
        console.error("Erro detalhado do Supabase:", error);
        throw new Error(error.message);
      }

      if (insertedData) {
        importedCount = insertedData.length;
        // Tentar validar WhatsApp em segundo plano
        batchValidateLeadsWhatsApp(insertedData.map(l => ({ id: l.id, phone: l.phone })));
      }
    }

    onSuccess(importedCount, duplicatedCount);
  } catch (err: any) {
    console.error("Erro ao buscar/inserir contatos:", err);
    onError(err);
  }
}

// Global declaration for google object from script tag
declare global {
  var google: any;
}
