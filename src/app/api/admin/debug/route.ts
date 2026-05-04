import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceKey || !projectUrl) {
    return NextResponse.json({ error: "Falta service key" });
  }

  const supabaseAdmin = createClient(projectUrl, serviceKey);

  const { data: perfiles, error } = await supabaseAdmin.from('perfiles').select('*');
  const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();

  return NextResponse.json({ 
    authUsers: authUsers.users.map(u => ({ id: u.id, email: u.email })), 
    perfiles: perfiles,
    error: error
  });
}
