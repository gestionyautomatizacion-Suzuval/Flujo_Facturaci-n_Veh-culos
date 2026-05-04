const {createClient} = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function check() {
  const { data, error } = await supabase.from('negocios').select('*').limit(1);
  if (error) {
    console.error(error);
  } else if (data && data.length > 0) {
    console.log("COLUMNS:");
    console.log(Object.keys(data[0]));
  } else {
    // If empty, let's insert a fake row then delete it, just to see columns? No, we can't easily.
    // Let's just catch the error if we try to select a column that doesn't exist
    const keysToTry = ['ano', 'año', 'anio', 'ano_facturacion', 'chasis', 'codigo_modelo', 'cod_modelo_vehiculo'];
    for (const k of keysToTry) {
        const { error: e } = await supabase.from('negocios').select(k).limit(1);
        if (e) {
            console.log(`Column ${k} DOES NOT exist.`);
        } else {
            console.log(`Column ${k} EXISTS.`);
        }
    }
  }
}
check();
