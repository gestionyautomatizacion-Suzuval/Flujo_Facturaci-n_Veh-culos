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
  let query = supabase
    .from("negocios")
    .select("*")
    .order("created_at", { ascending: false });

  if (userRole === "ADMINISTRATIVO") {
    const { data: notaVentaDocs } = await supabase
      .from("negocios_documentos")
      .select("pedido_venta")
      .or("tipo_documento.eq.NOTA_VENTA,nombre_archivo.ilike.%Nota de Venta%,nombre_archivo.ilike.%Nota_de_Venta%");

    const pvsConNotaVenta = Array.from(
      new Set(notaVentaDocs?.map((d) => d.pedido_venta).filter(Boolean) || [])
    );

    if (pvsConNotaVenta.length > 0) {
      query = query.in("pedido_venta", pvsConNotaVenta);
    } else {
      query = query.in("pedido_venta", ["__SIN_RESULTADOS__"]);
    }
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
            Pedidos de Ventas
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
