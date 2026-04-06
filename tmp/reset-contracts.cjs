const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://vwwzbtxfegkgpzaafmva.supabase.co";
const SUPABASE_KEY = "sb_publishable_7hGF"; // This is the ANON KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function resetTables() {
  console.log("Iniciando limpeza de tabelas (versão hardcoded)...");
  
  try {
    // Nota: O .neq('id', '0') é apenas para satisfazer o requerimento do .delete() de ter um filtro
    const { error: bErr } = await supabase.from('beneficiaries').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (bErr) console.log("Nota: Beneficiários já vazios ou restritos:", bErr.message);
    else console.log("Tabela 'beneficiaries' limpa.");

    const { error: fErr } = await supabase.from('financial_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (fErr) console.log("Nota: Financeiro já vazio ou restrito:", fErr.message);
    else console.log("Tabela 'financial_history' limpa.");

    const { error: cErr } = await supabase.from('contracts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (cErr) console.log("Nota: Contratos já vazios ou restritos:", cErr.message);
    else console.log("Tabela 'contracts' limpa.");

    console.log("Limpeza concluída!");
  } catch (e) {
    console.error("Falha catastrófica:", e);
  }
}

resetTables();
