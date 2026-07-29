import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

async function test() {
  const url = `${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/negocios?select=*&limit=1`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  const data = await res.json();
  console.log(data);
}
test();
