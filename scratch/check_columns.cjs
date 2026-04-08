
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read env or just use the project URL from previous context if available
// Or better, just try to execute a simple query to check the column.
// I'll use the variables from the project

async function check() {
  // I don't have the key here, but I can try to read it from .env or similar
  // Let's check for .env file
  const envPath = 'c:/Users/weblu/Downloads/efraim-saúde/.env';
  if (fs.existsSync(envPath)) {
    const env = fs.readFileSync(envPath, 'utf8');
    const url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1];
    const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1];
    
    if (url && key) {
      const supabase = createClient(url, key);
      const { data, error } = await supabase.from('leads').select('*').limit(1);
      if (error) {
        console.log('Error:', error.message);
      } else if (data && data.length > 0) {
        console.log('Columns:', Object.keys(data[0]));
      } else {
        console.log('No data found, but table exists.');
      }
    } else {
      console.log('Env variables missing');
    }
  } else {
    console.log('.env file not found');
  }
}

check();
