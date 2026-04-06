import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://vwwzbtxfegkgpzaafmva.supabase.co";
const SUPABASE_KEY = "sb_publishable_7hGF"; // Note: This is an anon key, it might require Service Role or RLS bypass to DELETE everything depending on policies. 

// Better use the env approach if I can, but I'll try to just use the one from src/lib/supabase.ts logic.
// Actually, I'll write a script that imports the client.

import { supabase } from '../src/lib/supabase';

async function resetTables() {
  console.log("Iniciando limpeza de tabelas...");
  
  try {
    const { error: bErr } = await supabase.from('beneficiaries').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (bErr) console.error("Erro deletando beneficiários:", bErr);
    else console.log("Tabela 'beneficiaries' limpa.");

    const { error: fErr } = await supabase.from('financial_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (fErr) console.error("Erro deletando histórico financeiro:", fErr);
    else console.log("Tabela 'financial_history' limpa.");

    const { error: cErr } = await supabase.from('contracts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (cErr) console.error("Erro deletando contratos:", cErr);
    else console.log("Tabela 'contracts' limpa.");

    console.log("Limpeza concluída!");
  } catch (e) {
    console.error("Falha catastrófica:", e);
  }
}

resetTables();
