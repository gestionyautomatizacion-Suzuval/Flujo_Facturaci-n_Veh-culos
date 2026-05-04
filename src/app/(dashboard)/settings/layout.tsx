import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Verificar el rol
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .single();

  const rol = perfil?.rol || "VENDEDOR";

  const accessAllowed = rol === "ADMIN" || rol === "GERENCIA";

  if (!accessAllowed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <div className="bg-red-50 p-6 rounded-3xl flex flex-col items-center max-w-sm text-center border border-red-100">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-red-900 mb-2">Acceso Denegado</h2>
          <p className="text-sm text-red-700/80 mb-6 leading-relaxed">
            Tu nivel de acceso actual (<span className="font-bold">{rol}</span>) no tiene permisos para ingresar a la configuración del sistema ni creación de cuentas.
          </p>
          <a href="/negocios" className="text-sm font-semibold bg-white px-5 py-2.5 rounded-xl border border-red-200 text-red-800 shadow-sm hover:bg-slate-50 transition-colors">
            Volver a Flujos
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
