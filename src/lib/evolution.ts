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
            count: 50
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
  }
};
