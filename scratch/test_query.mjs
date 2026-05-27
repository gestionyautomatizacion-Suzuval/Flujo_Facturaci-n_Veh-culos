import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase
    .from('negocios_comentarios')
    .select(`
      id, 
      pedido_venta, 
      usuario_nombre, 
      comentario,
      created_at,
      negocios!inner(vendedor_nombre)
    `)
    .limit(5);

  console.log(JSON.stringify(data, null, 2));
  console.log('Error:', error);
}

test();
