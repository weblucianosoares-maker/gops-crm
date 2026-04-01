import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
  const { data, error } = await supabase.from('leads').insert([
    {
      name: 'Teste Local Node',
      email: 'teste@email.com',
      source: 'Google Contacts',
      status: 'Novo',
      lastcontact: '12/12/2024',
      initials: 'TL',
      birthday: false
    }
  ]);
  
  if (error) {
    console.error('SUPABASE ERROR:', error);
  } else {
    console.log('SUCCESS:', data);
  }
}

testInsert();
