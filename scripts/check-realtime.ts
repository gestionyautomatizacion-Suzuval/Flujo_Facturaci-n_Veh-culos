import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabase = createClient(urlMatch![1].trim(), keyMatch![1].trim());

async function run() {
  const { data, error } = await supabase.rpc('get_realtime_tables') || await supabase.from('negocios_comentarios').select('*').limit(1);
  if (error) {
    console.log("Normal query:", error);
  } else {
    console.log("Query success:", data);
  }

  // To check publications we need superuser, but maybe we can query pg_publication_tables via REST if exposed... probably not.
}
run();
