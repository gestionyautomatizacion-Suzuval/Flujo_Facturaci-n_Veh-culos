"use client";

import React, { useState, useEffect } from "react";
import { Calendar, User, Building2, CreditCard, ChevronRight, Hash, Car, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Negocio, EstadoNegocio } from "./KanbanBoard";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

const KANBAN_COLUMNS: { id: EstadoNegocio; title: string; color: string; border: string; text: string }[] = [
  { id: 'PARA_REVISIÓN', title: 'Pendiente Revisión', color: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  { id: 'REVISADO_EN_ESPERA', title: 'Negocios con Observaciones', color: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  { id: 'REVISADO_OK', title: 'Negocios Ok Revisados', color: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
  { id: 'FACTURADO', title: 'Facturados', color: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' }
];

export default function StackedListBoard({ data: initialData, isAdmin = false, canDelete = false }: { data: Negocio[], isAdmin?: boolean, canDelete?: boolean }) {
  const router = useRouter();
  const [data, setData] = useState<Negocio[]>(initialData);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const handleDeleteNegocio = async (pedido_venta: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("¿Estás seguro de eliminar este negocio completamente? Esta acción no se puede deshacer.")) return;
    
    const supabase = createClient();
    const { error } = await supabase.from('negocios').delete().eq('pedido_venta', pedido_venta);
    if (error) {
      alert("Error al eliminar: " + error.message);
    } else {
      setData(prev => prev.filter(n => n.pedido_venta !== pedido_venta));
    }
  };

  const getStatusInfo = (status: EstadoNegocio) => {
    return KANBAN_COLUMNS.find(c => c.id === status) || KANBAN_COLUMNS[0];
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
      <div className="flex-1 overflow-auto bg-slate-50/50">
        <div className="min-w-[800px] p-4 sm:p-6 space-y-4">
          {data.length === 0 ? (
             <div className="text-center py-20 text-slate-500">No hay negocios registrados.</div>
          ) : (
            data.map((item) => {
              const statusInfo = getStatusInfo(item.estado);

              return (
                <div 
                  key={item.pedido_venta}
                  onClick={() => router.push(`/negocios/${item.pedido_venta}`)}
                  className="group flex flex-col sm:flex-row bg-white rounded-2xl border border-slate-200 p-4 transition-all hover:border-blue-300 hover:shadow-md cursor-pointer relative overflow-hidden"
                >
                  <div className={`absolute top-0 bottom-0 left-0 w-1.5 ${statusInfo.color.replace('bg-', 'bg-').replace('50', '500')}`} />
                  
                  <div className="flex flex-1 items-center gap-6 pl-4">
                    <div className="flex flex-col gap-1 w-40 shrink-0">
                      <span className="text-xs font-semibold text-slate-400">Interno</span>
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-sm font-bold text-slate-700 ring-1 ring-inset ring-slate-500/10 w-fit">
                        <Hash className="w-3 h-3 mr-1 opacity-50" />
                        {item.interno}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                      <span className="text-xs font-semibold text-slate-400">Cliente / Vehículo</span>
                      {item.nombre_apellido && item.nombre_apellido.trim().toUpperCase() !== 'S/N' && (
                        <p className="font-bold text-slate-900 leading-tight">
                          {item.nombre_apellido}
                        </p>
                      )}
                      <div className="flex items-center text-sm font-medium text-slate-500">
                        <Car className="w-3.5 h-3.5 mr-1" />
                        <span className="truncate">
                          {item.marca} {item.modelo}
                          <span className="text-xs text-slate-400 font-normal ml-2">
                            {item.color} {item.ano ? `- ${item.ano}` : ''}
                          </span>
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 w-48 shrink-0">
                      <span className="text-xs font-semibold text-slate-400">Ingreso</span>
                      <div className="flex items-center text-sm font-semibold text-slate-700">
                        <Calendar className="mr-1.5 h-4 w-4 text-slate-400" />
                        {format(new Date(item.created_at), "d MMM, yyyy", { locale: es })}
                      </div>
                      <div className="text-xs font-medium inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-blue-700 ring-1 ring-inset ring-blue-700/10 w-fit">
                        PV: {item.pedido_venta}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 w-40 shrink-0">
                      <span className="text-xs font-semibold text-slate-400">Estado</span>
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${statusInfo.color} ${statusInfo.text} ${statusInfo.border}`}>
                        {statusInfo.title}
                      </span>
                    </div>

                    <div className="flex items-center justify-center shrink-0 pr-2 gap-2">
                       {canDelete && (
                         <button 
                             onClick={(e) => handleDeleteNegocio(item.pedido_venta, e)}
                             className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-colors hover:bg-red-500 hover:text-white"
                             title="Eliminar Negocio"
                         >
                             <Trash2 className="h-5 w-5" />
                         </button>
                       )}
                       <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                         <ChevronRight className="h-5 w-5" />
                       </div>
                    </div>

                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
