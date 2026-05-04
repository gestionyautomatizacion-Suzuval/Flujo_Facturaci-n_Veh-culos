import { createClient } from "@/utils/supabase/server";
import { Negocio } from "@/components/KanbanBoard";
import ClientKanbanPage from "./ClientKanbanPage";

export default async function NegociosPage() {
  const supabase = await createClient();

  // 1. Obtener el rol del usuario antes de construir el query
  const { data: { user } } = await supabase.auth.getUser();
  let userRole = "VENDEDOR"; // fallback
  if (user) {
    const { data: perfil } = await supabase
      .from("perfiles")
      .select("rol")
      .eq("id", user.id)
      .single();
    if (perfil) {
      userRole = perfil.rol;
    }
  }

  // 2. Traer los negocios desde la Base de Datos, ordenados de más nuevos a más viejos.
  //    Los ADMINISTRATIVOS solo ven negocios cuya Nota de Venta fue aprobada por jefatura.
  let query = supabase
    .from("negocios")
    .select("*")
    .order("created_at", { ascending: false });

  if (userRole === "ADMINISTRATIVO") {
    // El valor en BD cuando la jefatura aprueba la Nota de Venta es "FIRMADA"
    query = query.eq("firma_jefatura_nv", "FIRMADA");
  }

  const { data: negocios, error } = await query;

  if (error) {
    console.error("Error cargando negocios:", error);
  }

  // Asegura que es un array válido parseado como tipo Negocio
  const safeNegocios: Negocio[] = (negocios as Negocio[]) || [];

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold leading-7 text-slate-900 sm:truncate sm:text-3xl sm:tracking-tight">
            Flujo de Facturación
          </h1>
        </div>
      </div>

      {/* Contenedor del Kanban inyectando los datos de la base de datos reales mediante un Client wrapper */}
      <div className="flex-1 overflow-hidden">
        <ClientKanbanPage initialData={safeNegocios} userRole={userRole} />
      </div>
    </div>
  );
}
