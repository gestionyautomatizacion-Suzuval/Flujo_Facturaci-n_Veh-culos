import Link from "next/link";
import { ArrowLeft, Table2, Calculator } from "lucide-react";

export default function ParametrosPage() {
  return (
    <div className="flex h-full flex-col max-w-[1200px] mx-auto w-full">
      <div className="mb-8">
        <Link 
          href="/settings" 
          className="inline-flex items-center text-sm text-slate-500 hover:text-emerald-600 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a Configuración
        </Link>
        <h1 className="text-2xl font-bold leading-7 text-slate-900 sm:truncate sm:text-3xl sm:tracking-tight flex items-center gap-2">
          Parámetros y UTM
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Selecciona el módulo de parámetros que deseas administrar.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link href="/settings/utm" className="block group h-full">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 hover:shadow-lg hover:border-emerald-300 transition-all duration-300 cursor-pointer h-full flex flex-col">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-5 group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-300 shadow-sm border border-emerald-100">
              <Table2 className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-emerald-700 transition-colors">Tabla UTM</h3>
            <p className="text-sm text-slate-500 leading-relaxed flex-1">
              Visualiza y actualiza los valores históricos y actuales de la Unidad Tributaria Mensual.
            </p>
          </div>
        </Link>
        
        <Link href="/settings/permiso-circulacion" className="block group h-full">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 hover:shadow-lg hover:border-indigo-300 transition-all duration-300 cursor-pointer h-full flex flex-col">
            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-5 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300 shadow-sm border border-indigo-100">
              <Calculator className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-indigo-700 transition-colors">Cálculo Permiso Circulación</h3>
            <p className="text-sm text-slate-500 leading-relaxed flex-1">
              Configura las reglas y parámetros para el cálculo del permiso de circulación.
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
