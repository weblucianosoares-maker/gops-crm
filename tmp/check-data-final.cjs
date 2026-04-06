const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://vwwzbtxfegkgpzaafmva.supabase.co";
const SUPABASE_KEY = "sb_publishable_7hGF"; 

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkData() {
  console.log("--- CHECK DATA ---");
  const { data: c } = await supabase.from('contracts').select('id, client_name');
  console.log("Contratos:", c?.length, c);
  
  const { data: b } = await supabase.from('beneficiaries').select('id, name').limit(5);
  console.log("Beneficiários (primeiros 5):", b?.length, b);
}

checkData();
