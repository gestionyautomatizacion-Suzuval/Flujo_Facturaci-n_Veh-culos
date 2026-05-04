const {createClient} = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function check() {
  // Let's do an update to fix the record 4850541
  const updateData = {
    chasis: 'JM7KF2W7AV0159248',
    cod_modelo_vehiculo: 'KGTGLCK',
    ano_facturacion: '2026'
  };
  
  const { data, error } = await supabase
    .from('negocios')
    .update(updateData)
    .eq('interno', '4850541')
    .select();
    
  console.log("Error:", error);
  console.log("Data updated:", data);
}
check();
