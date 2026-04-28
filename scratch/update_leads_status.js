
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateAllLeads() {
  console.log('Buscando leads para atualizar...');
  
  // Como o Supabase não permite UPDATE sem filtros em algumas configurações de RLS,
  // ou pode haver limites, vamos fazer em batches se necessário, 
  // mas primeiro tentamos o update global.
  
  const { data, error, count } = await supabase
    .from('leads')
    .update({ status: '' })
    .neq('status', '___ESPECIAL___'); // Filtro dummy para permitir o update global se necessário

  if (error) {
    console.error('Erro ao atualizar leads:', error);
  } else {
    console.log('Update solicitado com sucesso.');
    // Note: data might be null depending on select()
  }
}

updateAllLeads();
