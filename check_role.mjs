import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from('perfiles')
    .select('*')
    .eq('email', 'gvalderrama@suzuval.cl')
    .single();
  console.log('Role for gvalderrama@suzuval.cl:', data?.rol);
  if (error) console.error(error);
}
main();
