import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || "",
  process.env.VITE_SUPABASE_ANON_KEY || ""
);

async function checkSchema() {
  const { data, error } = await supabase.from('leads').select('*').limit(1);
  if (error) {
    console.error("Error fetching lead:", error.message);
    return;
  }
  if (data && data.length > 0) {
    console.log("Columns found in 'leads' table:");
    Object.keys(data[0]).sort().forEach(col => console.log(col));
  } else {
    console.log("No leads found to inspect columns.");
    // Try to get columns even if empty? Not easy without RPC.
    // Try to insert a dummy lead with only name?
  }
}

checkSchema();
