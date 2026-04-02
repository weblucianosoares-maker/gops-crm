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
      const remoteJid = `${formattedNumber}@s.whatsapp.net`;
      
      const response = await fetch(`${BASE_URL}/chat/findMessages/${encodeURIComponent(INSTANCE)}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          where: {
            remoteJid: remoteJid
          },
          count: 50
        })
      });
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      return data;
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
  }
};
