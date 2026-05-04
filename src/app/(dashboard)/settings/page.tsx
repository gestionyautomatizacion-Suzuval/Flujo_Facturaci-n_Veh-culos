import Link from "next/link";
import { Users, Landmark } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="flex h-full flex-col max-w-[1200px] mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold leading-7 text-slate-900 sm:truncate sm:text-3xl sm:tracking-tight flex items-center gap-2">
          Configuración Global
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Administra de manera centralizada usuarios, permisos y valores globales del sistema.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link href="/settings/usuarios" className="block group h-full">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 hover:shadow-lg hover:border-indigo-300 transition-all duration-300 cursor-pointer h-full flex flex-col">
            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-5 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300 shadow-sm border border-indigo-100">
              <Users className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-indigo-700 transition-colors">Gestión de Personal</h3>
            <p className="text-sm text-slate-500 leading-relaxed flex-1">
              Administra las cuentas, niveles de seguridad, y el acceso del equipo a los distintos módulos.
            </p>
          </div>
        </Link>
        
        <Link href="/settings/parametros" className="block group h-full">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 hover:shadow-lg hover:border-emerald-300 transition-all duration-300 cursor-pointer h-full flex flex-col">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-5 group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-300 shadow-sm border border-emerald-100">
              <Landmark className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-emerald-700 transition-colors">Parámetros y UTM</h3>
            <p className="text-sm text-slate-500 leading-relaxed flex-1">
              Actualiza el valor de la UTM y otras constantes matemáticas requeridas para trámites e impuestos.
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
