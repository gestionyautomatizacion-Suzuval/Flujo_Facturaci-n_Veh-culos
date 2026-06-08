import { Activity, Car, CheckCircle2, AlertCircle, CalendarRange } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";

export default async function DashboardSummary() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  let isAdmin = false;
  if (user) {
    const { data: perfil } = await supabase.from("perfiles").select("rol").eq("id", user.id).single();
    if (perfil?.rol === "ADMIN") {
      isAdmin = true;
    }
  }

  const now = new Date();
  const firstDayMonth = startOfMonth(now).toISOString();
  const lastDayMonth = endOfMonth(now).toISOString();
  const firstDayYear = startOfYear(now).toISOString();
  const lastDayYear = endOfYear(now).toISOString();

  // Traer los conteos reales desde la DB
  const { count: countRevision } = await supabase
    .from("negocios")
    .select("interno", { count: "exact", head: true })
    .eq("estado", "PARA_REVISIÓN");

  const { count: countObservaciones } = await supabase
    .from("negocios")
    .select("interno", { count: "exact", head: true })
    .eq("estado", "REVISADO_EN_ESPERA");

  const { count: countOk } = await supabase
    .from("negocios")
    .select("interno", { count: "exact", head: true })
    .eq("estado", "REVISADO_OK");

  const { count: countFacturadosMes } = await supabase
    .from("negocios")
    .select("interno", { count: "exact", head: true })
    .eq("estado", "FACTURADO")
    .gte("created_at", firstDayMonth)
    .lte("created_at", lastDayMonth);

  const { count: countFacturadosAno } = await supabase
    .from("negocios")
    .select("interno", { count: "exact", head: true })
    .eq("estado", "FACTURADO")
    .gte("created_at", firstDayYear)
    .lte("created_at", lastDayYear);

  const avanceMes = countFacturadosMes || 0;

  const stats = [
    { name: "Pedidos Pendientes de Revisión", value: countRevision?.toString() || "0", icon: Car, color: "text-blue-500", bg: "bg-blue-50" },
    { name: "Pedidos en Revisión", value: countObservaciones?.toString() || "0", icon: AlertCircle, color: "text-amber-500", bg: "bg-amber-50" },
    { name: "Pedidos Ok Revisados", value: countOk?.toString() || "0", icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-50" },
    { name: "Pedidos Facturados en el Mes", value: avanceMes.toString(), icon: Activity, color: "text-purple-500", bg: "bg-purple-50" },
    { name: "Pedidos Facturados", value: countFacturadosAno?.toString() || "0", icon: CalendarRange, color: "text-indigo-500", bg: "bg-indigo-50" },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold leading-7 text-slate-900 sm:truncate sm:text-3xl sm:tracking-tight">
          Pedidos de Venta
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.name} className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div className={`absolute right-4 top-4 rounded-xl p-3 ${stat.bg}`}>
              <stat.icon className={`h-6 w-6 ${stat.color}`} />
            </div>
            <p className="text-sm font-medium text-slate-500 pr-12">{stat.name}</p>
            <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {isAdmin && (
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Actividad Reciente</h2>
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50">
              <p className="text-sm text-slate-500">Listado de actividad (Próximamente)</p>
            </div>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Estado General</h2>
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50">
              <p className="text-sm text-slate-500">Gráfico de conversión (Próximamente)</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
