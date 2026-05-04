const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('.env.local', 'utf8');
const getEnv = (key) => {
  const match = envContent.match(new RegExp(`${key}=(.*)`));
  return match ? match[1].trim() : null;
};

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.rpc('get_policies', { table_name: 'negocios' });
  if (error) {
     const { data: d2, error: e2 } = await supabase.from('pg_policies').select('*'); // This won't work typically because it's a system table
     console.log('Cant use rpc?', error);
     // Let's just run a raw query using pg
  }
}
test();
