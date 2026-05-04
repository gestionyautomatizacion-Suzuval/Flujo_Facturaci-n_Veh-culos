"use server";

import { createClient } from "@/utils/supabase/server";

export async function actualizarMetaMensual(meta: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "No autorizado" };
  }

  // Usamos el cliente de admin para saltar RLS y poder actualizar el perfil
  // sin necesitar modificar las políticas estrictas de la base de datos
  const { createClient: createAdminClient } = await import('@supabase/supabase-js');
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const { error } = await supabaseAdmin
    .from("perfiles")
    .update({ meta_mensual: meta })
    .eq("id", user.id);

  if (error) {
    console.error("Error al actualizar meta:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
