import { supabase } from './supabase';

const BASE_URL = 'https://evolution-evolution-api.ugbnxp.easypanel.host';
const API_KEY = '309913DF676D-4933-9F1B-06A2DD349842';
const INSTANCE = 'Luciano Soares - 0247';

const headers = {
  'apikey': API_KEY,
  'Content-Type': 'application/json'
};

export const evolutionService = {
  // Enviar mensagem de texto
  async sendMessage(number: string, text: string) {
    try {
      const cleanNumber = number.replace(/\D/g, '');
      const formattedNumber = cleanNumber.startsWith('55') ? cleanNumber : `55${cleanNumber}`;
      
      const response = await fetch(`${BASE_URL}/message/sendText/${encodeURIComponent(INSTANCE)}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          number: formattedNumber,
          options: {
            delay: 1200,
            presence: 'composing',
            linkPreview: false
          },
          text: text
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => "Erro desconhecido");
        console.error('ERRO API EVOLUTION:', errorText);
        throw new Error(`API: ${errorText || response.statusText}`);
      }
      return await response.json();
    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error);
      throw error;
    }
  },

  // Buscar histórico de mensagens
  async getMessages(number: string) {
    try {
      const cleanNumber = number.replace(/\D/g, '');
      const formattedNumber = cleanNumber.startsWith('55') ? cleanNumber : `55${cleanNumber}`;
      
      const fetchFromApi = async (num: string) => {
        const remoteJid = `${num}@s.whatsapp.net`;
        const response = await fetch(`${BASE_URL}/chat/findMessages/${encodeURIComponent(INSTANCE)}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            where: { remoteJid },
            count: 100
          })
        });
        if (!response.ok) return [];
        return await response.json();
      };

      let messages = await fetchFromApi(formattedNumber);

      // Fallback para o Nono Dígito (Brasil)
      // Se houver 13 dígitos e começar por 55 + DDD + 9, tentamos remover o 9.
      if ((!messages || messages.length === 0) && formattedNumber.length === 13 && formattedNumber.startsWith('55')) {
        const fallbackNumber = formattedNumber.slice(0, 4) + formattedNumber.slice(5);
        console.log(`Tentando fallback sem o 9 para: ${fallbackNumber}`);
        messages = await fetchFromApi(fallbackNumber);
      }

      return messages;
    } catch (error) {
      console.error('Erro ao buscar mensagens:', error);
      return [];
    }
  },

  // Verificar estado da conexão
  async getConnectionStatus() {
    try {
      const response = await fetch(`${BASE_URL}/instance/connectionState/${encodeURIComponent(INSTANCE)}`, {
        method: 'GET',
        headers
      });
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      return { instance: { state: 'DISCONNECTED' } };
    }
  },

  // Enviar mídia (Imagem, PDF, etc)
  async sendMedia(number: string, media: string, mediatype: string, mimetype: string, fileName?: string, caption?: string) {
    try {
      const cleanNumber = number.replace(/\D/g, '');
      const formattedNumber = cleanNumber.startsWith('55') ? cleanNumber : `55${cleanNumber}`;
      
      const response = await fetch(`${BASE_URL}/message/sendMedia/${encodeURIComponent(INSTANCE)}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          number: formattedNumber,
          mediatype: mediatype,
          mimetype: mimetype,
          media: media.includes('base64,') ? media.split('base64,')[1] : media,
          fileName: fileName || 'arquivo',
          caption: caption || ''
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API: ${errorText || response.statusText}`);
      }
      return await response.json();
    } catch (error: any) {
      console.error('Erro ao enviar mídia:', error);
      throw error;
    }
  },

  // Buscar conteúdo Base64 de uma mensagem de mídia
  async fetchMedia(messageId: string) {
    try {
      const response = await fetch(`${BASE_URL}/chat/getBase64FromMediaMessage/${encodeURIComponent(INSTANCE)}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ messageId })
      });
      
      if (!response.ok) throw new Error('Erro ao buscar mídia');
      return await response.json(); // Retorna { base64: "...", mimetype: "..." }
    } catch (error) {
      console.error('Erro ao buscar mídia:', error);
      return null;
    }
  },

  // Verificar se o número possui WhatsApp
  async checkWhatsApp(number: string) {
    try {
      const cleanNumber = number.replace(/\D/g, '');
      const formattedNumber = cleanNumber.startsWith('55') ? cleanNumber : `55${cleanNumber}`;
      
      const response = await fetch(`${BASE_URL}/chat/whatsappNumbers/${encodeURIComponent(INSTANCE)}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          numbers: [formattedNumber]
        })
      });

      if (!response.ok) {
        console.error('Erro ao verificar WhatsApp:', await response.text());
        return null;
      }

      const data = await response.json();
      // Retorno esperado: [{ exists: true, jid: '...', number: '...' }]
      if (Array.isArray(data) && data.length > 0) {
        return data[0].exists;
      }
      
      return false;
    } catch (error) {
      console.error('Erro ao verificar WhatsApp:', error);
      return null;
    }
  },

  // Verificar múltiplos números
  async checkWhatsAppBatch(numbers: string[]) {
    try {
      const formattedNumbers = numbers.map(n => {
        const clean = n.replace(/\D/g, '');
        return clean.startsWith('55') ? clean : `55${clean}`;
      });
      
      const response = await fetch(`${BASE_URL}/chat/whatsappNumbers/${encodeURIComponent(INSTANCE)}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          numbers: formattedNumbers
        })
      });

      if (!response.ok) return [];
      return await response.json();
    } catch (error) {
      console.error('Erro ao verificar batch WhatsApp:', error);
      return [];
    }
  },

  // Buscar URL da foto de perfil
  async getProfilePictureUrl(number: string) {
    try {
      const cleanNumber = number.replace(/\D/g, '');
      const formattedNumber = cleanNumber.startsWith('55') ? cleanNumber : `55${cleanNumber}`;
      
      const response = await fetch(`${BASE_URL}/chat/fetchProfilePictureUrl/${encodeURIComponent(INSTANCE)}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          number: formattedNumber
        })
      });

      if (!response.ok) return null;
      const data = await response.json();
      return data.profilePictureUrl || null;
    } catch (error) {
      console.error('Erro ao buscar foto do perfil:', error);
      return null;
    }
  },

  // Buscar perfil detalhado (Tipo de conta, Business, etc)
  async fetchProfile(number: string) {
    try {
      const cleanNumber = number.replace(/\D/g, '');
      const formattedNumber = cleanNumber.startsWith('55') ? cleanNumber : `55${cleanNumber}`;
      
      const response = await fetch(`${BASE_URL}/chat/fetchProfile/${encodeURIComponent(INSTANCE)}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ number: formattedNumber })
      });

      if (!response.ok) return null;
      const data = await response.json();
      
      return {
        isBusiness: !!(data.isBusiness || data.businessProfile || data.profile?.isBusiness)
      };
    } catch (error) {
      console.error('Erro ao buscar perfil WhatsApp:', error);
      return null;
    }
  }
};

// Helper para validar e atualizar um lead no banco
export const validateLeadWhatsApp = async (leadId: string, phone: string) => {
  if (!phone) return null;
  
  const hasWhatsApp = await evolutionService.checkWhatsApp(phone);
  
  if (hasWhatsApp !== null) {
    const { error } = await supabase
      .from('leads')
      .update({ whatsapp_exists: hasWhatsApp })
      .eq('id', leadId);
      
    if (error) {
      console.error(`Erro ao atualizar lead ${leadId}:`, error);
    }
    return hasWhatsApp;
  }
  
  return null;
};

// Helper para validar múltiplos leads
export const batchValidateLeadsWhatsApp = async (leads: {id: string, phone: string}[]) => {
  if (leads.length === 0) return;
  
  // Limite de 50 por vez para segurança
  const chunkSize = 50;
  for (let i = 0; i < leads.length; i += chunkSize) {
    const chunk = leads.slice(i, i + chunkSize);
    const numbers = chunk.map(l => l.phone).filter(Boolean);
    
    if (numbers.length === 0) continue;
    
    const results = await evolutionService.checkWhatsAppBatch(numbers);
    
    // Atualizar cada lead com o resultado
    for (const res of results) {
      // O Evolution API retorna o número formatado no resultado. 
      // Precisamos encontrar o ID do lead correspondente.
      // O número retornado pode ter ou não o 9º dígito dependendo de como o WhatsApp o registra.
      // Vamos tentar um match aproximado ou exato.
      const resNum = res.number.replace(/\D/g, '');
      const lead = chunk.find(l => {
        const lNum = l.phone.replace(/\D/g, '');
        const lNumFull = lNum.startsWith('55') ? lNum : `55${lNum}`;
        return lNumFull === resNum || lNumFull.replace('55', '559') === resNum || resNum.replace('55', '559') === lNumFull;
      });
      
      if (lead) {
        await supabase
          .from('leads')
          .update({ whatsapp_exists: res.exists })
          .eq('id', lead.id);
      }
    }
    
    // Pequeno delay para evitar sobrecarga
    if (i + chunkSize < leads.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
};
