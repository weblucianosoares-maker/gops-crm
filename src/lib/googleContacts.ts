import { supabase } from './supabase';

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

    const existingPhones = new Set(allExistingLeads.map(l => (l.phone || '').replace(/\D/g, '')).filter(Boolean));
    const existingEmails = new Set(allExistingLeads.map(l => l.email?.toLowerCase().trim()).filter(Boolean));
    const existingNames = new Set(allExistingLeads.map(l => l.name?.toLowerCase().trim()).filter(Boolean));

    let importedCount = 0;
    let duplicatedCount = 0;
    const newLeads: any[] = [];

    connections.forEach((person: any) => {
      const name = person.names?.[0]?.displayName || 'Sem Nome';
      const email = person.emailAddresses?.[0]?.value || '';
      const phone = (person.phoneNumbers?.[0]?.value || '').replace(/\D/g, '');
      
      // Validação: Só importar se houver telefone (conforme solicitado pelo usuário)
      if (!phone || phone.length < 8) {
        return;
      }
      
      // Determinar origem baseada em Labels do Google
      let source = 'Google Contacts';
      if (person.memberships) {
         // Tentar extrair o nome do grupo amigável se disponível
         // Simplificação para o MVP
      }

      // Check duplicidade
      let isDuplicate = false;
      if (phone && existingPhones.has(phone)) isDuplicate = true;
      else if (!phone && email && existingEmails.has(email.toLowerCase().trim())) isDuplicate = true;
      else if (!phone && !email && name !== 'Sem Nome' && existingNames.has(name.toLowerCase().trim())) isDuplicate = true;

      if (isDuplicate) {
        duplicatedCount++;
        return;
      }

      // Gerar iniciais
      const parts = name.split(' ').filter(Boolean);
      const initials = parts.length > 1 
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : name.substring(0, 2).toUpperCase();

      newLeads.push({
        name,
        email,
        phone,
        source: 'Google',
        initials,
        status: ''
      });

      if (phone) existingPhones.add(phone);
      if (email) existingEmails.add(email.toLowerCase().trim());
      if (name) existingNames.add(name.toLowerCase().trim());
      importedCount++;
    });

    if (newLeads.length > 0) {
      const { error } = await supabase.from('leads').insert(newLeads);
      if (error) throw error;
    }

    onSuccess(newLeads.length, duplicatedCount);
  } catch (err) {
    console.error("Erro ao buscar/inserir contatos:", err);
    onError(err);
  }
}

// Global declaration for google object from script tag
declare global {
  var google: any;
}
