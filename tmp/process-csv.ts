import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import Papa from 'papaparse';

const supabaseUrl = "https://vwwzbtxfegkgpzaaljrw.supabase.co";
const supabaseKey = "sb_publishable_7hGFMv9vGa2yh5One7z96w_xPo-c8AF"; 

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("🚀 Iniciando cruzamento de dados...");

  // 1. Buscar leads sem telefone
  const { data: leads, error: fetchError } = await supabase
    .from('leads')
    .select('id, name, email')
    .or('phone.is.null,phone.eq."",phone.eq."null"');

  if (fetchError) {
    console.error("❌ Erro ao buscar leads:", fetchError);
    return;
  }

  // Filtrar mais agressivamente os leads que de fato não tem telefone válido
  const targetLeads = leads.filter(l => !l.phone || l.phone.length < 8);
  console.log(`📡 Encontrados ${targetLeads.length} leads sem telefone no banco.`);

  // 2. Ler e parsear CSV
  const csvPath = 'c:\\Users\\weblu\\Downloads\\contacts (9).csv';
  const csvFile = fs.readFileSync(csvPath, 'utf8');
  
  const { data: csvRows } = Papa.parse(csvFile, {
    header: true,
    skipEmptyLines: true
  });

  console.log(`📄 CSV lido com ${csvRows.length} linhas.`);

  const updates = [];
  let matchesByEmail = 0;
  let matchesByName = 0;

  // 3. Mapear Leads por Nome e Email para busca rápida
  const leadNames = new Map();
  const leadEmails = new Map();

  targetLeads.forEach(l => {
    if (l.name) leadNames.set(normalize(l.name), l.id);
    if (l.email) leadEmails.set(l.email.toLowerCase().trim(), l.id);
  });

  // 4. Cruzar dados
  for (const row of csvRows) {
    let foundPhone = extractPhone(row);
    if (!foundPhone) continue;

    let leadId = null;

    // Tentar match por E-mail 1 - Value
    const csvEmail = (row['E-mail 1 - Value'] || "").toLowerCase().trim();
    if (csvEmail && leadEmails.has(csvEmail)) {
      leadId = leadEmails.get(csvEmail);
      matchesByEmail++;
    } else {
      // Tentar match por Nome (limpando prefixos)
      const csvName = normalize(row['First Name'] || "" + " " + (row['Last Name'] || ""));
      if (leadNames.has(csvName)) {
        leadId = leadNames.get(csvName);
        matchesByName++;
      }
    }

    if (leadId) {
      updates.push({ id: leadId, phone: foundPhone });
      // Remover do mapa para evitar duplicidade de match
      leadNames.delete(normalize(row['First Name'] || ""));
    }
  }

  console.log(`✅ Cruzamento concluído!`);
  console.log(`📩 Matches por Email: ${matchesByEmail}`);
  console.log(`👤 Matches por Nome: ${matchesByName}`);
  console.log(`📊 Total de updates a realizar: ${updates.length}`);

  // 5. Executar Updates em chunks de 20
  for (let i = 0; i < updates.length; i += 20) {
    const chunk = updates.slice(i, i + 20);
    const promises = chunk.map(update => 
      supabase.from('leads').update({ phone: update.phone }).eq('id', update.id)
    );
    await Promise.all(promises);
    process.stdout.write(`\r🚀 Evolução: ${Math.min(i + 20, updates.length)} / ${updates.length}`);
  }

  console.log("\n✨ Processo finalizado com sucesso!");
}

function normalize(str) {
  if (!str) return "";
  return str.toLowerCase()
    .replace(/\[.*?\]/g, "") // remove [Lead], [NÃO QUER], etc
    .replace(/[^\w\s]/gi, "") // remove caracteres especiais
    .trim();
}

function extractPhone(row) {
  // Regex para capturar números brasileiros com ou sem DDD
  // Procura em todas as colunas
  const phoneRegex = /(?:55|0)?(?:[1-9][1-9])?9?[6-9]\d{7}/g;
  
  for (const key in row) {
    const val = String(row[key]);
    const matches = val.replace(/\D/g, "").match(phoneRegex);
    if (matches && matches[0]) {
      let num = matches[0];
      // Garantir formato 55+DDD+NUMERO
      if (num.length === 8 || num.length === 9) {
        // Se faltar o DDD, é difícil saber qual é, mas usaremos o padrão local se possível
        // No momento vamos priorizar números com DDD (10 ou 11 dígitos)
        continue; 
      }
      if (num.length === 10 || num.length === 11) {
         return num.startsWith("55") ? num : `55${num}`;
      }
      if (num.length === 12 || num.length === 13) {
         if (num.startsWith("55")) return num;
      }
    }
  }
  return null;
}

run();
