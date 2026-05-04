import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);

const supabase = createClient(urlMatch![1].trim(), keyMatch ? keyMatch[1].trim() : env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)![1].trim());

async function run() {
  const { data } = await supabase.from('negocios').select('interno, pedido_venta').eq('pedido_venta', '302302302');
  console.log("Query by pedido_venta '302302302':", data);
  
  const { data: all } = await supabase.from('negocios').select('interno, pedido_venta').limit(5);
  console.log("Sample rows:", all);
}
run();
