import { supabase } from '../src/lib/supabase';

async function debugData() {
  const { data: contracts, error: cErr } = await supabase.from('contracts').select('*');
  const { data: beneficiaries, error: bErr } = await supabase.from('beneficiaries').select('*');

  if (cErr) console.error("Erro Contratos:", cErr);
  if (bErr) console.error("Erro Beneficiários:", bErr);

  console.log("--- DEBUG DATA ---");
  console.log("Total Contratos:", contracts?.length);
  console.log("Contratos Detalhes:", (contracts || []).map(c => ({ id: c.id, name: c.client_name, status: c.status, lives: c.lives })));
  
  const active = (contracts || []).filter(c => c.status === 'Ativo');
  console.log("Contratos com status 'Ativo':", active.length);
  
  console.log("Total Beneficiários:", beneficiaries?.length);
  const activeLives = active.reduce((acc, c) => acc + (Number(c.lives) || 0), 0);
  console.log("Soma de 'lives' nos ativos:", activeLives);
  
  // Verificar se há beneficiários vinculados por contract_id
  const bCount = (beneficiaries || []).filter(b => active.some(c => c.id === b.id)).length; // Ajustado b.id ou b.contract_id? No LeadsContext era b.lead_id?
  console.log("Beneficiários (total):", beneficiaries?.length);
}

debugData();
