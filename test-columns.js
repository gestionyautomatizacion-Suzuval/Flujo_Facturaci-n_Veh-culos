import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  const { data, error } = await supabase
    .from('negocios')
    .select('contribuyente_electronico, tipo_negocio, estado_civil, comunidad_bienes, nacionalidad, profesion_giro')
    .limit(1);

  if (error) {
    console.error("Error fetching columns:", error.message);
  } else {
    console.log("Columns exist!");
  }
}

checkColumns();
