import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !projectUrl) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en el servidor");
  return createClient(projectUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export async function GET() {
  try {
    const supabaseAdmin = getAdminClient();

    // 1. Obtener perfiles
    const { data: perfiles, error: perfError } = await supabaseAdmin
      .from("perfiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (perfError) throw new Error(perfError.message);

    // 2. Obtener estado de ban desde Auth
    const { data: { users: authUsers }, error: authErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (authErr) throw new Error(authErr.message);

    const authMap = new Map(authUsers.map((u) => [u.id, u]));

    // 3. Enriquecer perfiles con isSuspended
    const enriched = (perfiles || []).map((p) => {
      const authUser = authMap.get(p.id);
      const bannedUntil = authUser?.banned_until;
      const isSuspended = bannedUntil ? new Date(bannedUntil) > new Date() : false;
      return { ...p, isSuspended };
    });

    return NextResponse.json(enriched);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { email, password, nombre_completo, rol, sucursales } = await req.json();
    const supabaseAdmin = getAdminClient();

    // 1. Crear el Auth User
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre: nombre_completo, rol }
    });

    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });

    // 2. Insertar en tabla perfiles
    const userId = authData.user.id;
    const { error: dbError } = await supabaseAdmin.from("perfiles").insert({
      id: userId,
      nombre_completo,
      email,
      rol,
      sucursales: Array.isArray(sucursales) ? sucursales : []
    });

    if (dbError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: "Error creando Perfil SQL: " + dbError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, user: authData.user });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { userId, rol, action, sucursales } = await req.json();
    // action: 'suspend' | 'activate' | undefined (solo cambia rol/sucursales)

    const supabaseAdmin = getAdminClient();

    // 1. Actualizar perfil (rol y/o sucursales)
    const updateData: any = { rol };
    if (sucursales !== undefined) {
      updateData.sucursales = Array.isArray(sucursales) ? sucursales : [];
    }

    const { error: dbError } = await supabaseAdmin
      .from("perfiles")
      .update(updateData)
      .eq("id", userId);

    if (dbError) throw new Error(dbError.message);

    // 2. Si hay acción de suspensión, actualizar ban en Supabase Auth
    if (action === "suspend") {
      await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: "87600h" });
    } else if (action === "activate") {
      await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: "none" });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) return NextResponse.json({ error: "Falta parámetro userId" }, { status: 400 });

    const { createClient: createServerClient } = await import("@/utils/supabase/server");
    const supabaseSession = await createServerClient();

    const { data: { user } } = await supabaseSession.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { data: perfil } = await supabaseSession
      .from("perfiles")
      .select("rol")
      .eq("id", user.id)
      .single();

    if (!perfil || perfil.rol !== "ADMIN") {
      return NextResponse.json({ error: "Permiso denegado. Solo los administradores (ADMIN) pueden eliminar cuentas." }, { status: 403 });
    }

    const supabaseAdmin = getAdminClient();
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authError) throw new Error(authError.message);

    await supabaseAdmin.from("perfiles").delete().eq("id", userId);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
