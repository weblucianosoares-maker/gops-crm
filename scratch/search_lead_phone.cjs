const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function searchLead() {
  const digits = '981286049';
  console.log(`Buscando leads com os dígitos: ${digits}...`);
  
  const { data, error } = await supabase
    .from('leads')
    .select('*');

  if (error) {
    console.error('Erro ao buscar:', error);
    return;
  }

  const matches = data.filter(lead => 
    (lead.phone && lead.phone.includes(digits)) || 
    (lead.secondary_phone && lead.secondary_phone.includes(digits))
  );

  if (matches.length > 0) {
    console.log(`Encontrado ${matches.length} lead(s):`);
    matches.forEach(lead => {
      console.log(`- ID: ${lead.id}, Nome: ${lead.name}, Telefone: ${lead.phone}, Status: ${lead.status}`);
    });
  } else {
    console.log('Nenhum lead encontrado após varredura completa.');
  }
}

searchLead();
