const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function listLeads() {
  const { data, error } = await supabase
    .from('leads')
    .select('id, name, phone, secondary_phone')
    .limit(10);

  if (error) {
    console.error('Erro ao listar:', error);
    return;
  }

  console.log('Amostra de leads:');
  data.forEach(lead => {
    console.log(`- ID: ${lead.id}, Nome: ${lead.name}, Telefone: ${lead.phone}, Secundário: ${lead.secondary_phone}`);
  });
}

listLeads();
