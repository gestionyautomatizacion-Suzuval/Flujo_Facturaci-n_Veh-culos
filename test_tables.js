const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const envContent = fs.readFileSync('.env.local', 'utf-8');
const envConfig = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envConfig[match[1].trim()] = match[2].trim();
});

const supabase = createClient(envConfig.NEXT_PUBLIC_SUPABASE_URL, envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
    // If we have an anon key, maybe we don't have permission to query information_schema.
    // Let's try to query 'clientes' table
    const { data, error } = await supabase.from('clientes').select('rut').limit(1);
    console.log("clientes query:", error ? error.message : "success");
    
    // what about 'formularios_facturacion'
    const { data: d2, error: e2 } = await supabase.from('formularios_facturacion').select('*').limit(1);
    if(d2 && d2.length) {
       console.log("formularios_facturacion cols:", Object.keys(d2[0]));
    }
}
run();
