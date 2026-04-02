const fs = require('fs');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

const envConfig = dotenv.parse(fs.readFileSync('.env', 'utf8'));

const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Updating leads where status = 'Conversando' to ''...");
  const { data, error } = await supabase
    .from('leads')
    .update({ status: '' })
    .eq('status', 'Conversando');

  if (error) {
    console.error("Error updating leads:", error);
  } else {
    console.log("Successfully updated leads.");
  }
}

run();
