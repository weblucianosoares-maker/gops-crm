import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { extractNetworkData } from '../src/lib/geminiService.js';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || "",
  process.env.VITE_SUPABASE_ANON_KEY || ""
);

const IMPORT_DIR = 'import_network';
const CARRIER_MAPPING: Record<string, string[]> = {
  'Assim': ['1de8d77c-b0ef-4d0d-9a90-94a65a88c7e8'],
  'Amil': ['675a35ce-ff0a-44b1-9638-c2eb8153eed6'],
  'Leve': ['96b4117d-7664-45cf-a066-445c5afca39c'],
  'MedSenior': ['e3ee708e-fbd1-469a-890e-19d7980fe891'],
  'Bradesco': ['ad4e6410-dc7b-4973-bfb1-2131fe3c4c63'],
  'porto': ['b86ee63a-d80a-4f5e-bf76-09438a8d0f52'],
  'SulAmerica': ['10242c9b-4364-406d-b850-a9186ab3df26']
};

async function processFile(filePath: string) {
  const fileName = path.basename(filePath);
  console.log(`\n[BATCH] Processando: ${fileName}...`);

  // Identificar operadoras no arquivo
  const matchedCarriers: string[] = [];
  for (const [keyword, ids] of Object.entries(CARRIER_MAPPING)) {
    if (fileName.toLowerCase().includes(keyword.toLowerCase())) {
        matchedCarriers.push(...ids);
    }
  }

  if (matchedCarriers.length === 0) {
    console.warn(`[SKIP] Nenhuma operadora mapeada para: ${fileName}`);
    return;
  }

  const fileBuffer = fs.readFileSync(filePath);
  const mimeType = 'application/pdf';

  for (const carrierId of matchedCarriers) {
    try {
      // Buscar nome da operadora para o prompt
      const { data: carrier } = await supabase.from('carriers').select('name').eq('id', carrierId).single();
      const carrierName = carrier?.name || "Desconhecida";
      
      console.log(`   -> Extraindo dados para: ${carrierName}...`);
      const extractedData = await extractNetworkData(fileBuffer, mimeType, carrierName);

      if (!extractedData || extractedData.length === 0) {
        console.warn(`   -> [!] Nenhum dado extraído para ${carrierName}`);
        continue;
      }

      console.log(`   -> [OK] ${extractedData.length} itens extraídos. Salvando no banco...`);

      for (const item of extractedData) {
        // 1. Upsert Provider
        let providerId;
        const { data: existing } = await supabase
          .from('medical_providers')
          .select('id')
          .ilike('name', `%${item.name}%`)
          .limit(1);

        if (existing && existing.length > 0) {
          providerId = existing[0].id;
          // Atualizar dados básicos (endereço, etc)
          await supabase.from('medical_providers').update({
            address: item.address,
            neighborhood: item.neighborhood,
            city: item.city,
            uf: item.uf,
            type: item.type
          }).eq('id', providerId);
        } else {
          const { data: newProv, error: insErr } = await supabase
            .from('medical_providers')
            .insert([{
              name: item.name,
              type: item.type,
              uf: item.uf,
              city: item.city,
              neighborhood: item.neighborhood,
              address: item.address
            }])
            .select()
            .single();
          
          if (insErr) {
            console.error(`      ERROR inserting provider ${item.name}:`, insErr.message);
            continue;
          }
          providerId = newProv.id;
        }

        // 2. Process Products & Coverage
        if (item.products && item.products.length > 0) {
          for (const prodData of item.products) {
            const productName = typeof prodData === 'string' ? prodData : prodData.name;
            const modality = typeof prodData === 'string' ? 'PME' : (prodData.modality || 'PME');

            // Find or Create Product
            const { data: existingProd } = await supabase
              .from('products')
              .select('id')
              .eq('carrier_id', carrierId)
              .ilike('name', `%${productName}%`)
              .limit(1);

            let productId;
            if (existingProd && existingProd.length > 0) {
              productId = existingProd[0].id;
            } else {
              const { data: newProd, error: pErr } = await supabase
                .from('products')
                .insert([{
                  carrier_id: carrierId,
                  name: productName,
                  modality: modality,
                  status: 'Ativo'
                }])
                .select()
                .single();
              
              if (pErr) continue;
              productId = newProd.id;
            }

            // Upsert Coverage
            await supabase.from('network_coverage').upsert({
              provider_id: providerId,
              carrier_id: carrierId,
              product_id: productId,
              coverage_details: item.coverage_details || "*NE"
            }, { onConflict: 'provider_id, product_id' });
          }
        }
      }
      console.log(`   -> [FINISH] Dados de ${carrierName} processados.`);
    } catch (err: any) {
      console.error(`   -> [FATAL] Erro ao processar ${carrierId} para o arquivo ${fileName}:`, err.message);
    }
  }
}

async function run() {
  console.log("=== INICIANDO PROCESSAMENTO EM MASSA ===");
  if (!fs.existsSync(IMPORT_DIR)) {
    console.error(`Diretório ${IMPORT_DIR} não encontrado.`);
    return;
  }

  const files = fs.readdirSync(IMPORT_DIR).filter(f => f.endsWith('.pdf'));
  console.log(`Encontrados ${files.length} arquivos.`);

  for (const file of files) {
    await processFile(path.join(IMPORT_DIR, file));
  }

  console.log("\n=== PROCESSAMENTO CONCLUÍDO! ===");
}

run();
