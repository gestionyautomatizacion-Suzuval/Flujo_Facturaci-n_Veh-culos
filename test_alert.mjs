
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xcamqzutgvrplhzvmlka.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjYW1xenV0Z3ZycGxoenZtbGthIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQ0OTYzMywiZXhwIjoyMDkyMDI1NjMzfQ.ITy3CXdNLVjFUWMFqpED0LuDfYg-Dwo3uMXMxyRkLnk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const pedidoVenta = process.argv[2];
  if (!pedidoVenta) {
    console.log('Por favor, proporciona el número de pedido_venta como argumento.');
    process.exit(1);
  }

  const { data, error } = await supabase.from('negocios_comentarios').insert({
    pedido_venta: pedidoVenta,
    usuario_nombre: 'Simulador Test',
    usuario_email: 'test@simulador.cl',
    comentario: 'Este es un mensaje de prueba para verificar la alerta en tiempo real.'
  }).select();

  if (error) {
    console.error('Error insertando mensaje:', error);
  } else {
    console.log('Mensaje insertado exitosamente. ¡Deberías ver la alerta ahora!', data);
  }
}

run();

