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

async function checkPolicies() {
  const { data, error } = await supabase.rpc('get_policies', { table_name: 'negocios' });
  // Instead of rpc, let's just query pg_policies
  
  const res = await supabase.from('pg_policies').select('*').eq('tablename', 'negocios');
  // wait, you can't query pg_policies via standard api without exposing it.
  
  // Let's use execute_sql if possible, but we don't have it. We can run bash with psql if we have connection string.
}
checkPolicies();
