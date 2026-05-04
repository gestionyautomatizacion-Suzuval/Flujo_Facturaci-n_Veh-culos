import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!serviceKey || !projectUrl) {
      return NextResponse.json({ error: "Falta configurar SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 });
    }

    const supabaseAdmin = createClient(projectUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Leer la lista de usuarios root de Firebase/Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (authError || !authData.users || authData.users.length === 0) {
      return NextResponse.json({ error: "No hay usuarios registrados en el sistema de Auth." }, { status: 400 });
    }

    // Tomar al ususario base (idealmente es con el que creaste la app)
    const firstUser = authData.users[0];

    // Convertirlo en el Dios del sistema (ADMIN) en la tabla 'perfiles'
    const { error: dbError } = await supabaseAdmin.from('perfiles').upsert({
      id: firstUser.id,
      email: firstUser.email,
      nombre_completo: 'Administrador Maestro',
      rol: 'ADMIN',
      estado: 'ACTIVO'
    });

    if (dbError) {
      return NextResponse.json({ error: "Error inyectando el permiso: " + dbError.message });
    }

    return NextResponse.json({ 
      success: true, 
      mensaje: "¡Felicidades! Acabas de ser ascendido a ADMIN.",
      emailInyectado: firstUser.email,
      instruccion: "Vuelve al Panel de Control (http://localhost:3000) y recarga la página."
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
