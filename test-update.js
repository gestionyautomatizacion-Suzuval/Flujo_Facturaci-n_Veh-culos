const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    process.env[match[1].trim()] = match[2].trim();
  }
});

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  console.log("Attempting to update...");
  const { data, error, status, statusText } = await supabase
    .from('negocios')
    .update({ rut: '20301365-5' })
    .eq('interno', '4744660 ');
  
  if (error) {
    console.error("Error:", error);
    console.log("Status:", status);
    console.log("Status Text:", statusText);
  } else {
    console.log("Success:", data);
    console.log("Status:", status);
  }
}
run();
