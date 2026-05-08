import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default async function handler(req: any, res: any) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = req.body;
    console.log('[Webhook UmClique] Recebido:', JSON.stringify(payload, null, 2));

    // Variáveis que vamos tentar extrair
    let from = '';
    let text = '';
    let messageId = '';
    let timestamp = new Date();
    let type = 'text';
    let mediaUrl = '';
    let mimeType = '';

    // Flag para identificar se a mensagem é nossa (outbound via WhatsApp Web/UmClique)
    let isFromMe = false;

    // 1. Tentar parsear formato Oficial da Meta (WhatsApp Cloud API)
    if (payload.object === 'whatsapp_business_account' && payload.entry) {
      const change = payload.entry[0]?.changes[0]?.value;
      let msgObj = null;

      if (change?.messages && change.messages.length > 0) {
        msgObj = change.messages[0];
        isFromMe = false;
      } else if (change?.message_echoes && change.message_echoes.length > 0) {
        msgObj = change.message_echoes[0];
        isFromMe = true;
      }

      if (msgObj) {
        // Se for de nós para o cliente, o lead é o 'to'. Se for do cliente para nós, é o 'from'.
        from = isFromMe ? msgObj.to : msgObj.from;
        messageId = msgObj.id;
        timestamp = new Date(parseInt(msgObj.timestamp) * 1000);
        type = msgObj.type;
        
        if (type === 'text') {
          text = msgObj.text?.body || '';
        } else if (['image', 'document', 'audio', 'video'].includes(type)) {
          const mediaObj = msgObj[type];
          messageId = mediaObj?.id || messageId;
          text = mediaObj?.caption || '';
          mediaUrl = mediaObj?.link || mediaObj?.id || '';
          mimeType = mediaObj?.mime_type || '';
        }
      } else {
        // Pode ser um evento de status (sent, delivered, read), ignorar por enquanto
        return res.status(200).send('Event received');
      }
    }
    // 2. Tentar parsear formato UmClique Simplificado ou Evolution-like
    else if (payload.data?.message || payload.message) {
      const msg = payload.data?.message || payload.message || payload.data;
      from = msg.from || msg.remoteJid?.split('@')[0] || payload.data?.from || '';
      text = msg.text?.body || msg.text || msg.conversation || msg.extendedTextMessage?.text || payload.data?.content || '';
      messageId = msg.id || payload.data?.id || `webhook-${Date.now()}`;
      type = msg.type || payload.data?.type || 'text';
      
      if (payload.data?.timestamp) {
        timestamp = new Date(payload.data.timestamp * 1000);
      }
    }
    // 3. Formato direto genérico
    else if (payload.from && (payload.text || payload.content || payload.body)) {
      from = payload.from;
      text = payload.text || payload.content || payload.body;
      messageId = payload.messageId || payload.id || `webhook-${Date.now()}`;
      type = payload.type || 'text';
    }

    if (!from) {
      console.log('[Webhook UmClique] Payload ignorado (sem from):', payload);
      return res.status(200).send('Ignored');
    }

    // Limpar o telefone para buscar no banco
    let cleanPhone = from.replace(/\D/g, '');
    
    // Tentar encontrar o lead
    let leadId = null;
    
    // Busca robusta: pega os últimos 8 dígitos (que geralmente são 9999-9999 ou 999-9999)
    // e faz uma busca flexível para ignorar parênteses e traços no banco.
    if (cleanPhone.length >= 8) {
      const part1 = cleanPhone.slice(-8, -4);
      const part2 = cleanPhone.slice(-4);
      
      const { data: leads } = await supabase
        .from('leads')
        .select('id, phone')
        .ilike('phone', `%${part1}%${part2}%`);
        
      if (leads && leads.length > 0) {
        // Se encontrar múltiplos, tenta o que tem o DDD mais parecido, ou simplesmente pega o primeiro
        leadId = leads[0].id;
      }
    }

    // Inserir no banco de mensagens
    const { error: insertError } = await supabase.from('whatsapp_messages').upsert({
      message_id: messageId,
      lead_id: leadId,
      sender_number: cleanPhone,
      message_body: text,
      media_type: type !== 'text' ? type : null,
      file_name: null,
      mimetype: mimeType,
      is_from_me: isFromMe,
      is_read: isFromMe ? true : false,
      created_at: timestamp.toISOString()
    }, { onConflict: 'message_id' });

    if (insertError) {
      console.error('[Webhook UmClique] Erro ao salvar mensagem:', insertError);
    } else if (leadId) {
      // Atualizar last_app_message_at do lead
      const now = new Date();
      const formattedDate = `${now.getDate()} ${now.toLocaleString('pt-BR', { month: 'short' }).replace('.', '')}, ${now.getFullYear()}`;
      await supabase.from('leads').update({
        last_app_message_at: now.toISOString(),
        lastcontact: formattedDate
      }).eq('id', leadId);
    }

    return res.status(200).json({ success: true, messageId });
  } catch (err: any) {
    console.error('[Webhook UmClique] Erro interno:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
