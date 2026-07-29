import { createClient } from "@/utils/supabase/server";
import { startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import KpiDashboard, { KpiStat } from "@/components/KpiDashboard";

export default async function DashboardSummary() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  // Obtener perfil completo del usuario
  let userRole = "VENDEDOR";
  if (user) {
    const { data: perfil } = await supabase
      .from("perfiles")
      .select("rol")
      .eq("id", user.id)
      .single();
    if (perfil?.rol) userRole = perfil.rol;
  }

  const now = new Date();
  const firstDayMonth = startOfMonth(now).toISOString();
  const lastDayMonth = endOfMonth(now).toISOString();
  const firstDayYear = startOfYear(now).toISOString();
  const lastDayYear = endOfYear(now).toISOString();

  // Si el perfil es ADMINISTRATIVO, restringir a negocios que tengan Nota de Venta adjunta
  let allowedPVs: string[] | null = null;
  if (userRole === "ADMINISTRATIVO") {
    const { data: notaVentaDocs } = await supabase
      .from("negocios_documentos")
      .select("pedido_venta")
      .or("tipo_documento.eq.NOTA_VENTA,nombre_archivo.ilike.%Nota de Venta%,nombre_archivo.ilike.%Nota_de_Venta%");

    allowedPVs = Array.from(
      new Set(notaVentaDocs?.map((d) => d.pedido_venta).filter(Boolean) || [])
    );
  }

  // Conteos KPI
  let queryRevision = supabase
    .from("negocios")
    .select("interno", { count: "exact", head: true })
    .eq("estado", "PARA_REVISIÓN");

  let queryObservaciones = supabase
    .from("negocios")
    .select("interno", { count: "exact", head: true })
    .eq("estado", "REVISADO_EN_ESPERA");

  let queryOk = supabase
    .from("negocios")
    .select("interno", { count: "exact", head: true })
    .eq("estado", "REVISADO_OK");

  let queryFacturadosMes = supabase
    .from("negocios")
    .select("interno", { count: "exact", head: true })
    .eq("estado", "FACTURADO")
    .gte("created_at", firstDayMonth)
    .lte("created_at", lastDayMonth);

  let queryFacturadosAno = supabase
    .from("negocios")
    .select("interno", { count: "exact", head: true })
    .eq("estado", "FACTURADO")
    .gte("created_at", firstDayYear)
    .lte("created_at", lastDayYear);

  if (allowedPVs !== null) {
    const filterPVs = allowedPVs.length > 0 ? allowedPVs : ["__SIN_RESULTADOS__"];
    queryRevision = queryRevision.in("pedido_venta", filterPVs);
    queryObservaciones = queryObservaciones.in("pedido_venta", filterPVs);
    queryOk = queryOk.in("pedido_venta", filterPVs);
    queryFacturadosMes = queryFacturadosMes.in("pedido_venta", filterPVs);
    queryFacturadosAno = queryFacturadosAno.in("pedido_venta", filterPVs);
  }

  const { count: countRevision } = await queryRevision;
  const { count: countObservaciones } = await queryObservaciones;
  const { count: countOk } = await queryOk;
  const { count: countFacturadosMes } = await queryFacturadosMes;
  const { count: countFacturadosAno } = await queryFacturadosAno;

  const avanceMes = countFacturadosMes || 0;

  // Definición de tarjetas KPI con estadoFiltro y color hex para el acento activo
  const stats: KpiStat[] = [
    {
      name: "Pedidos Pendientes de Revisión",
      value: countRevision?.toString() || "0",
      iconName: "Car",
      color: "text-blue-500",
      bg: "bg-blue-50",
      accentHex: "#3b82f6",
      estadoFiltro: "PARA_REVISIÓN",
    },
    {
      name: "Pedidos en Revisión",
      value: countObservaciones?.toString() || "0",
      iconName: "AlertCircle",
      color: "text-amber-500",
      bg: "bg-amber-50",
      accentHex: "#f59e0b",
      estadoFiltro: "REVISADO_EN_ESPERA",
    },
    {
      name: "Pedidos Ok Revisados",
      value: countOk?.toString() || "0",
      iconName: "CheckCircle2",
      color: "text-emerald-500",
      bg: "bg-emerald-50",
      accentHex: "#10b981",
      estadoFiltro: "REVISADO_OK",
    },
    {
      name: "Pedidos Facturados en el Mes",
      value: avanceMes.toString(),
      iconName: "Activity",
      color: "text-purple-500",
      bg: "bg-purple-50",
      accentHex: "#8b5cf6",
      estadoFiltro: "FACTURADO",
    },
    {
      name: "Pedidos Facturados",
      value: countFacturadosAno?.toString() || "0",
      iconName: "CalendarRange",
      color: "text-indigo-500",
      bg: "bg-indigo-50",
      accentHex: "#6366f1",
      estadoFiltro: "FACTURADO",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold leading-7 text-slate-900 sm:truncate sm:text-3xl sm:tracking-tight">
          Pedidos de Venta
        </h1>
      </div>

      {/* KpiDashboard es Client Component: maneja la interactividad */}
      <KpiDashboard stats={stats} userRole={userRole} />
    </div>
  );
}
