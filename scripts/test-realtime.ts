import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);

const supabaseUrl = urlMatch![1].trim();
const supabaseKey = keyMatch![1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRealtime() {
  console.log("Setting up realtime subscription...");
  
  const channel = supabase.channel('test-channel')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'negocios_comentarios' }, (payload) => {
      console.log("RECEIVED PAYLOAD!", payload);
      process.exit(0);
    })
    .subscribe(async (status) => {
      console.log("Status:", status);
      if (status === 'SUBSCRIBED') {
        console.log("Inserting test comment...");
        const { error } = await supabase.from('negocios_comentarios').insert({
          negocio_interno: '4850541',
          comentario: 'Test realtime msg',
          usuario_email: 'test@test.com',
          usuario_nombre: 'Test'
        });
        if (error) console.log("Insert err:", error);
      }
    });

  setTimeout(() => {
    console.log("Timeout! Did not receive realtime event. Realtime is probably OFF.");
    process.exit(1);
  }, 10000);
}

testRealtime();
