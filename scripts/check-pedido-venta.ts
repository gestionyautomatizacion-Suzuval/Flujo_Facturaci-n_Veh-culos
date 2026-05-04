import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabase = createClient(urlMatch![1].trim(), keyMatch![1].trim());
async function run() {
  const { data } = await supabase.from('negocios').select('interno, pedido_venta').limit(5);
  console.log(data);
}
run();
