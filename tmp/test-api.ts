import fetch from 'node-fetch';

const BASE_URL = 'https://evolution-evolution-api.ugbnxp.easypanel.host';
const API_KEY = '309913DF676D-4933-9F1B-06A2DD349842';
const INSTANCE = 'Luciano Soares - 0247';

async function test() {
  console.log(`🔍 Testando instância: ${INSTANCE}`);
  try {
    const response = await fetch(`${BASE_URL}/instance/connectionState/${encodeURIComponent(INSTANCE)}`, {
      method: 'GET',
      headers: { 'apikey': API_KEY }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log("✅ Conexão OK!", JSON.stringify(data, null, 2));
    } else {
      console.log(`❌ Falha na conexão. Status: ${response.status}`);
      const text = await response.text();
      console.log(`Mensagem da API: ${text}`);
    }
  } catch (e) {
    console.error("❌ Erro de rede:", e);
  }
}

test();
