import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://vwwzbtxfegkgpzaaljrw.supabase.co";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_7hGFMv9vGa2yh5One7z96w_xPo-c8AF";

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { count: cNovo } = await supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'Novo');
    const { count: cConv } = await supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'Conversando');
    const { count: cNull } = await supabase.from('leads').select('*', { count: 'exact', head: true }).is('status', null);
    const { count: cEmpty } = await supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', '');

    const { data: firstLeads } = await supabase.from('leads').select('name, status').limit(20);

    const report = {
        counts: {
            Novo: cNovo,
            Conversando: cConv,
            isNull: cNull,
            isEmpty: cEmpty
        },
        firstLeads: firstLeads
    };

    fs.writeFileSync('db_status_report.json', JSON.stringify(report, null, 2));
    console.log('Report written to db_status_report.json');
}

check();
