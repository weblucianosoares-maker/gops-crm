const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function search() {
  const phone = '21981286049';
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .ilike('sender_number', `%${phone}%`)
    .order('created_at', { ascending: false });

  if (data && data.length > 0) {
    console.log(`Encontradas ${data.length} mensagens.`);
    data.forEach(m => {
       console.log(`[${m.created_at}] From Me: ${m.is_from_me}, Body: ${m.message_body}`);
    });
  } else {
    console.log('Nenhuma mensagem encontrada.');
  }
}

search();
