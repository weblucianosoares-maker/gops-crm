const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://vwwzbtxfegkgpzaafmva.supabase.co";
const SUPABASE_KEY = "sb_publishable_7hGF"; 

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkData() {
  console.log("--- CHECK DATA DETAILED ---");
  const contractsRes = await supabase.from('contracts').select('id, client_name');
  if (contractsRes.error) console.error("Erro Contratos:", contractsRes.error);
  else console.log("Contratos:", contractsRes.data?.length);
  
  const beneficiariesRes = await supabase.from('beneficiaries').select('id, name').limit(5);
  if (beneficiariesRes.error) console.error("Erro Beneficiários:", beneficiariesRes.error);
  else console.log("Beneficiários (primeiros 5):", beneficiariesRes.data?.length);
}

checkData();
