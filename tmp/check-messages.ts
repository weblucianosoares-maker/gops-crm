import fetch from 'node-fetch';

const BASE_URL = 'https://evolution-evolution-api.ugbnxp.easypanel.host';
const API_KEY = '309913DF676D-4933-9F1B-06A2DD349842';
const INSTANCE = 'Luciano Soares - 0247';

async function test() {
  console.log('🔍 Buscando mensagens recentes...');
  try {
    const res = await fetch(`${BASE_URL}/chat/fetchMessages/${encodeURIComponent(INSTANCE)}`, {
      method: 'POST',
      headers: { 
        'apikey': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        page: 1,
        count: 5
      })
    });
    
    if (res.ok) {
      const data = await res.json();
      console.log('✅ Resultado:', JSON.stringify(data, null, 2));
    } else {
      console.log('❌ Erro:', res.status, await res.text());
    }
  } catch (e) {
    console.error('❌ Erro de rede:', e);
  }
}

test();
