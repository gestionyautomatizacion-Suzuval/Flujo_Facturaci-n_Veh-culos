/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://xcamqzutgvrplhzvmlka.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjYW1xenV0Z3ZycGxoenZtbGthIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQ0OTYzMywiZXhwIjoyMDkyMDI1NjMzfQ.ITy3CXdNLVjFUWMFqpED0LuDfYg-Dwo3uMXMxyRkLnk'
);

async function check() {
  const { data: cats, error: errCats } = await supabase.from('guias_categorias').select('*');
  console.log('Categorias:', cats, errCats?.message);

  const { data: guias, error: errGuias } = await supabase.from('guias_usuario').select('*');
  console.log('Guias:', guias, errGuias?.message);
}

check();
