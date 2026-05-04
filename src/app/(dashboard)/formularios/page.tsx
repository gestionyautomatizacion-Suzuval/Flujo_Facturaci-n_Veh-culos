"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { Plus, Calculator, Search, ChevronRight, FileSpreadsheet } from "lucide-react";
import { useRouter } from "next/navigation";

export default function FormulariosPage() {
  const [formularios, setFormularios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    fetchFormularios();
  }, []);

  const fetchFormularios = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("formularios_facturacion")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setFormularios(data);
    }
    setLoading(false);
  };

  const handleCreateNew = () => {
    router.push("/formularios/nuevo");
  };

  const filtered = formularios.filter(f => 
    (f.rut && f.rut.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (f.nombre_apellido && f.nombre_apellido.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="flex-1 bg-slate-50 overflow-hidden flex flex-col h-full">
      <div className="bg-white border-b border-slate-200 px-8 py-6 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Calculator className="w-6 h-6 text-indigo-600" />
            Calculadora de Negocios
          </h1>
        </div>
        <button
          onClick={handleCreateNew}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors shadow-sm active:scale-95"
        >
          <Plus className="w-5 h-5" /> Nuevo Cálculo
        </button>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-full max-h-[800px]">
          
          <div className="p-4 border-b border-slate-100 flex items-center gap-4 bg-slate-50/50">
            <div className="relative flex-1 max-w-md">
              <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Buscar por RUT o Nombre..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div className="overflow-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">Fecha</th>
                  <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">Cliente (RUT)</th>
                  <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">Marca</th>
                  <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">Modelo</th>
                  <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-right">Precio Final</th>
                  <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-right">Saldo Pendiente</th>
                  <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-center">Creador del cálculo</th>
                  <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      Cargando formularios...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <FileSpreadsheet className="w-12 h-12 text-slate-200 mb-3" />
                        <h3 className="text-lg font-medium text-slate-600">No hay formularios</h3>
                        <p className="text-sm text-slate-400 mt-1">
                          {searchTerm ? "No coincide con tu búsqueda." : "Comienza creando un nuevo cálculo."}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((form) => (
                    <tr key={form.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => router.push(`/formularios/${form.rut}`)}>
                      <td className="py-4 px-6 align-middle">
                        <div className="text-sm font-medium text-slate-800">{new Date(form.created_at).toLocaleDateString()}</div>
                      </td>
                      <td className="py-4 px-6 align-middle">
                        <div className="text-sm font-bold text-indigo-700">{form.nombre_apellido || "Sin Nombre"}</div>
                        <div className="text-xs text-slate-500 mt-0.5 font-mono">{form.rut}</div>
                      </td>
                      <td className="py-4 px-6 align-middle">
                        <div className="text-sm font-medium text-slate-700">{form.marca || "-"}</div>
                      </td>
                      <td className="py-4 px-6 align-middle">
                        <div className="text-sm font-medium text-slate-700">{form.descripcion_modelo || "-"}</div>
                      </td>
                      <td className="py-4 px-6 align-middle text-right">
                        <div className="text-sm font-semibold text-slate-800">
                          {form.precio_final != null ? `$${Number(form.precio_final).toLocaleString('es-CL')}` : '-'}
                        </div>
                      </td>
                      <td className="py-4 px-6 align-middle text-right">
                        <div className={`text-sm font-bold inline-flex px-2 py-1 rounded ${Number(form.saldo_pendiente) > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                          {form.saldo_pendiente != null ? `$${Number(form.saldo_pendiente).toLocaleString('es-CL')}` : '-'}
                        </div>
                      </td>
                      <td className="py-4 px-6 align-middle text-center">
                        <div className="text-sm font-medium text-slate-500 truncate max-w-[150px]" title={form.creador_email || "No registrado"}>{form.creador_email || "-"}</div>
                      </td>
                      <td className="py-4 px-6 align-middle text-center">
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 mx-auto transition-colors" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
