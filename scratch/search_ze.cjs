const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function searchLead() {
  const { data, error } = await supabase
    .from('leads')
    .select('id, name, phone, secondary_phone')
    .or('name.ilike.%ze%,name.ilike.%zé%');

  if (data && data.length > 0) {
    console.log(`Encontrado ${data.length} lead(s):`);
    data.forEach(lead => {
      console.log(`- ID: ${lead.id}, Nome: ${lead.name}, Telefone: ${lead.phone}`);
    });
  } else {
    console.log('Nenhum lead encontrado.');
  }
}

searchLead();
