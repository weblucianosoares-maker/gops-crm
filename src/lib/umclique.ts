import { supabase } from './supabase';

// ─── UmClique Digital – WhatsApp Business API Oficial ─────────────────────────
// Documentação: Settings → API & Webhooks na plataforma connect.umcliquedigital.com
// Endpoint: https://czduqujgtziamxuvzaue.supabase.co/functions/v1/public-send-message
// Autenticação: header X-API-Key
// ──────────────────────────────────────────────────────────────────────────────

const UMCLIQUE_API_URL = 'https://czduqujgtziamxuvzaue.supabase.co/functions/v1/public-send-message';
const UMCLIQUE_API_KEY  = import.meta.env.VITE_UMCLIQUE_API_KEY  || '';
const UMCLIQUE_CHANNEL_ID = import.meta.env.VITE_UMCLIQUE_CHANNEL_ID || '';

const headers = () => ({
  'X-API-Key': UMCLIQUE_API_KEY,
  'Content-Type': 'application/json',
});

// Utilitário: normaliza telefone para o formato 55DDNÚMERO
const formatPhone = (number: string): string => {
  const clean = number.replace(/\D/g, '');
  return clean.startsWith('55') ? clean : `55${clean}`;
};

// ─── Serviço principal ─────────────────────────────────────────────────────────
export const umcliqueService = {

  /** Envia mensagem de texto simples */
  async sendMessage(number: string, text: string) {
    const to = formatPhone(number);
    const body = {
      channel_id: UMCLIQUE_CHANNEL_ID,
      to,
      type: 'text',
      content: text,
    };

    const response = await fetch(UMCLIQUE_API_URL, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => response.statusText);
      console.error('[UmClique] Erro ao enviar mensagem:', err);
      throw new Error(`UmClique API: ${err}`);
    }
    return response.json();
  },

  /** Envia imagem, PDF ou outro arquivo por URL pública */
  async sendMedia(
    number: string,
    mediaUrl: string,
    mediatype: 'image' | 'video' | 'audio' | 'document',
    _mimetype?: string,
    fileName?: string,
    caption?: string
  ) {
    const to = formatPhone(number);
    const body: Record<string, any> = {
      channel_id: UMCLIQUE_CHANNEL_ID,
      to,
      type: mediatype,
      url: mediaUrl,
    };
    if (caption) body.caption = caption;
    if (fileName) body.filename = fileName;

    const response = await fetch(UMCLIQUE_API_URL, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => response.statusText);
      console.error('[UmClique] Erro ao enviar mídia:', err);
      throw new Error(`UmClique API: ${err}`);
    }
    return response.json();
  },

  /** Envia uma mensagem usando template pré-aprovado pela Meta */
  async sendTemplate(
    number: string,
    templateName: string,
    languageCode: string,
    variables?: any[],
    headerImage?: string
  ) {
    const to = formatPhone(number);
    const body: Record<string, any> = {
      channel_id: UMCLIQUE_CHANNEL_ID,
      to,
      type: 'template',
      template_name: templateName,
      template_language: languageCode,
    };
    
    if (variables && variables.length > 0) {
      body.template_variables = variables;
    }
    
    if (headerImage) {
      body.template_header = {
        type: "image",
        url: headerImage
      };
    }

    const response = await fetch(UMCLIQUE_API_URL, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => response.statusText);
      console.error('[UmClique] Erro ao enviar template:', err);
      throw new Error(`UmClique API: ${err}`);
    }
    return response.json();
  },

  /**
   * Verifica o status de conexão do canal.
   * Retorna objeto compatível com a interface anterior (Evolution).
   */
  async getConnectionStatus() {
    if (!UMCLIQUE_API_KEY || !UMCLIQUE_CHANNEL_ID) {
      return { instance: { state: 'NOT_CONFIGURED' } };
    }
    // A UmClique não expõe endpoint de status público;
    // fazemos um envio fictício para validar a chave.
    try {
      const response = await fetch(UMCLIQUE_API_URL, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ channel_id: UMCLIQUE_CHANNEL_ID, to: '5500000000000', type: 'text', content: '__ping__' }),
      });
      // 400/422 = chave OK mas payload inválido → canal conectado
      if (response.status === 400 || response.status === 422 || response.ok) {
        return { instance: { state: 'CONNECTED' } };
      }
      if (response.status === 401 || response.status === 403) {
        return { instance: { state: 'UNAUTHORIZED' } };
      }
      return { instance: { state: 'DISCONNECTED' } };
    } catch {
      return { instance: { state: 'DISCONNECTED' } };
    }
  },

  /** Histórico de mensagens – não disponível na UmClique via API pública */
  async getMessages(_number: string) {
    console.warn('[UmClique] getMessages não disponível na API oficial. Use o painel da UmClique para ver histórico.');
    return [];
  },

  /** Verificação se número possui WhatsApp – não disponível na UmClique via API pública */
  async checkWhatsApp(_number: string) {
    console.warn('[UmClique] checkWhatsApp não disponível na API oficial da Meta.');
    return null;
  },

  async checkWhatsAppBatch(_numbers: string[]) {
    return [];
  },

  async fetchMedia(_messageId: string) {
    return null;
  },

  async getProfilePictureUrl(_number: string) {
    return null;
  },
};

// ─── Helpers de banco (mesma interface que evolution.ts) ───────────────────────

export const validateLeadWhatsApp = async (leadId: string, phone: string) => {
  if (!phone) return null;
  const hasWhatsApp = await umcliqueService.checkWhatsApp(phone);
  if (hasWhatsApp !== null) {
    await supabase.from('leads').update({ whatsapp_exists: hasWhatsApp }).eq('id', leadId);
    return hasWhatsApp;
  }
  return null;
};

export const batchValidateLeadsWhatsApp = async (leads: { id: string; phone: string }[]) => {
  // A API oficial da Meta não fornece lookup em massa gratuito.
  // Mantemos a função vazia para não quebrar o código existente.
  console.warn('[UmClique] batchValidateLeadsWhatsApp: não disponível na API oficial.');
};

// ─── Re-exporta com o alias antigo para compatibilidade ───────────────────────
// Isso garante que qualquer arquivo que importa "evolutionService" continue funcionando
// sem precisar mudar todos os imports de uma vez.
export { umcliqueService as evolutionService };
