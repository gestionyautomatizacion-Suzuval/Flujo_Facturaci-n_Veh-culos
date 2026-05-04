const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n');
let url = '', key = '';
for (let line of env) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
}
const sup = createClient(url, key);
sup.from('stock_nuevos').select('*').eq('"MOD. VEHÍCULO"', 'NEWCS15LUXMTVIC').limit(1).then(res => {
   console.log('Result for eq1:', JSON.stringify(res, null, 2));
});
