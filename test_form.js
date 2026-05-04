const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xcamqzutgvrplhzvmlka.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjYW1xenV0Z3ZycGxoenZtbGthIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQ0OTYzMywiZXhwIjoyMDkyMDI1NjMzfQ.ITy3CXdNLVjFUWMFqpED0LuDfYg-Dwo3uMXMxyRkLnk';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCols() {
  const { data, error } = await supabase
      .from('formularios_facturacion')
      .select('*')
      .limit(1);
      
  if (error) {
    console.error("Supabase Error:", error);
  } else {
    console.log("Columns:", Object.keys(data[0] || {}));
  }
}

checkCols();
