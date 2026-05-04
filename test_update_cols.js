const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://xcamqzutgvrplhzvmlka.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjYW1xenV0Z3ZycGxoenZtbGthIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQ0OTYzMywiZXhwIjoyMDkyMDI1NjMzfQ.ITy3CXdNLVjFUWMFqpED0LuDfYg-Dwo3uMXMxyRkLnk';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpdate() {
  const { data, error } = await supabase
    .from('negocios')
    .update({ direccion_cliente: 'Test 123' })
    .eq('interno', 'TEST_DOES_NOT_EXIST');

  console.log('Error:', error);
  console.log('Data:', data);
}
testUpdate();
