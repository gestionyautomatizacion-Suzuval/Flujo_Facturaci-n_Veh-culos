import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Este endpoint usa el service_role key para bypasear RLS de Supabase.
// Así la búsqueda de cliente funciona igual en navegadores autenticados
// y en smartphones sin sesión (link público enviado al cliente).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rut = searchParams.get("rut");

  if (!rut) {
    return NextResponse.json({ error: "RUT no proporcionado" }, { status: 400 });
  }

  try {
    // Usamos el service_role key (server-only) para evitar restricciones RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from("clientes")
      .select("nombre, segundo_nombre, apellido, segundo_apellido")
      .eq("rut", rut)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ encontrado: false });
    }

    const nombre = [data.nombre, data.segundo_nombre, data.apellido, data.segundo_apellido]
      .filter(Boolean)
      .join(" ");

    return NextResponse.json({ encontrado: true, nombre });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
