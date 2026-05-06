import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { email, password, nombre_completo, rol, sucursales } = await req.json();

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!serviceKey || !projectUrl) {
      return NextResponse.json({ error: "Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor" }, { status: 500 });
    }

    // Usar cliente maestro Bypass:
    const supabaseAdmin = createClient(projectUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // 1. Crear el Auth User sin requerir validación
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        nombre: nombre_completo,
        rol: rol
      }
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    // 2. Insertarlo oficialmente en la tabla Perfiles
    const userId = authData.user.id;
    const { error: dbError } = await supabaseAdmin.from('perfiles').insert({
      id: userId,
      nombre_completo,
      email,
      rol,
      sucursales: Array.isArray(sucursales) ? sucursales : []
    });

    if (dbError) {
      // Intento de borrado de rollback (opcional)
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
    const { userId, rol, estado, sucursales } = await req.json();

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!serviceKey || !projectUrl) {
      return NextResponse.json({ error: "Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor" }, { status: 500 });
    }

    const supabaseAdmin = createClient(projectUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // 1. Actualizamos el perfil de la base de datos SQL
    const updateData: any = { rol, estado };
    if (sucursales !== undefined) {
      updateData.sucursales = Array.isArray(sucursales) ? sucursales : [];
    }

    const { error: dbError } = await supabaseAdmin
      .from('perfiles')
      .update(updateData)
      .eq('id', userId);

    if (dbError) throw new Error(dbError.message);

    // 2. Si el estado cambia, actualizamos el Baneo de Acceso real en Supabase Auth
    if (estado === 'INACTIVO') {
      // Banear cuenta por 10 años
      await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: '87600h' });
    } else {
      // Remover ban
      await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: 'none' });
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

    if (!userId) {
      return NextResponse.json({ error: "Falta parámetro userId" }, { status: 400 });
    }

    const { createClient: createServerClient } = await import("@/utils/supabase/server");
    const supabaseSession = await createServerClient();
    
    const { data: { user } } = await supabaseSession.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { data: perfil } = await supabaseSession
      .from("perfiles")
      .select("rol")
      .eq("id", user.id)
      .single();

    if (!perfil || perfil.rol !== "ADMIN") {
      return NextResponse.json({ error: "Permiso denegado. Solo los administradores (ADMIN) pueden eliminar cuentas de usuario." }, { status: 403 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!serviceKey || !projectUrl) {
      return NextResponse.json({ error: "Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor" }, { status: 500 });
    }

    const supabaseAdmin = createClient(projectUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authError) throw new Error(authError.message);

    await supabaseAdmin.from('perfiles').delete().eq('id', userId);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
