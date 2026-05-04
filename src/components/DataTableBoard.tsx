"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Building2, Calendar, User, ArrowUpDown, ChevronRight, Trash2 } from "lucide-react";
import { Negocio, EstadoNegocio } from "@/components/KanbanBoard";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

const KANBAN_COLUMNS: { id: EstadoNegocio; title: string; color: string; border: string; text: string }[] = [
  { id: 'PARA_REVISIÓN', title: 'Pendiente Revisión', color: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  { id: 'REVISADO_EN_ESPERA', title: 'Negocios con Observaciones', color: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  { id: 'REVISADO_OK', title: 'Negocios Ok Revisados', color: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
  { id: 'FACTURADO', title: 'Facturados', color: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' }
];

export default function DataTableBoard({ initialData, isAdmin }: { initialData: Negocio[], isAdmin: boolean }) {
  const [data, setData] = useState<Negocio[]>(initialData);
  const router = useRouter();
  
  const [sortField, setSortField] = useState<keyof Negocio | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

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

  const handleSort = (field: keyof Negocio) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortField === field && sortDirection === 'asc') direction = 'desc';
    
    setSortField(field);
    setSortDirection(direction);

    const sortedData = [...data].sort((a, b) => {
      const aVal = a[field] || '';
      const bVal = b[field] || '';
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    setData(sortedData);
  };

  const getStatusBadge = (estadoId: EstadoNegocio) => {
    const statusInfo = KANBAN_COLUMNS.find(c => c.id === estadoId);
    if (!statusInfo) return null;
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${statusInfo.color} ${statusInfo.text} ring-1 ring-inset ${statusInfo.border}`}>
        {statusInfo.title}
      </span>
    );
  };

  return (
    <div className="h-full w-full overflow-hidden bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
      <div className="overflow-auto flex-1">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
            <tr>
              <th className="px-6 py-3 font-semibold text-slate-500 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('estado')}>
                <div className="flex items-center gap-2">Estado <ArrowUpDown className="w-3 h-3" /></div>
              </th>
              <th className="px-6 py-3 font-semibold text-slate-500 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('interno')}>
                <div className="flex items-center gap-2">Negocio / Título <ArrowUpDown className="w-3 h-3" /></div>
              </th>
              <th className="px-6 py-3 font-semibold text-slate-500 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('suc_vta')}>
                <div className="flex items-center gap-2">Sucursal / Cliente <ArrowUpDown className="w-3 h-3" /></div>
              </th>
              <th className="px-6 py-3 font-semibold text-slate-500 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('created_at')}>
                <div className="flex items-center gap-2">Fecha <ArrowUpDown className="w-3 h-3" /></div>
              </th>
              <th className="px-6 py-3 font-semibold text-slate-500 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('pedido_venta')}>
                <div className="flex items-center gap-2 text-right justify-end">PV / Vendedor <ArrowUpDown className="w-3 h-3" /></div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((item) => (
              <tr 
                key={item.pedido_venta} 
                onClick={() => router.push(`/negocios/${item.pedido_venta}`)}
                className="hover:bg-slate-50 transition-colors cursor-pointer group"
              >
                <td className="px-6 py-3">
                  {getStatusBadge(item.estado)}
                </td>
                <td className="px-6 py-3">
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{item.interno}</span>
                    {item.nombre_apellido && item.nombre_apellido.trim().toUpperCase() !== 'S/N' && (
                      <span className="text-xs text-slate-500">{item.nombre_apellido}</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-3">
                  <div className="flex flex-col">
                    <div className="flex items-center text-slate-700 font-medium">
                      <Building2 className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                      {item.suc_vta.split('-')[1]?.trim() || item.suc_vta}
                    </div>
                    <span className="text-[11px] text-slate-500 ml-5">
                      {item.marca} {item.modelo}{item.ano ? ` - ${item.ano}` : ''}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-3">
                   <span className="flex items-center text-slate-600">
                      <Calendar className="mr-1.5 h-3.5 w-3.5 text-slate-400" />
                      {format(new Date(item.created_at), "d MMM, yyyy", { locale: es })}
                    </span>
                </td>
                <td className="px-6 py-3 text-right">
                  <div className="flex flex-col items-end">
                    <span className="text-xs font-medium inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-blue-700 ring-1 ring-inset ring-blue-700/10 w-fit">PV: {item.pedido_venta}</span>
                    <div className="flex items-center gap-2 mt-1">
                      {isAdmin && (
                        <button 
                            onClick={(e) => handleDeleteNegocio(item.pedido_venta, e)}
                            className="text-slate-400 hover:text-red-600 transition-colors"
                            title="Eliminar Negocio"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <span className="flex items-center text-[11px] text-slate-500">
                         <User className="mr-1 h-3 w-3" />
                         {item.vendedor_nombre}
                      </span>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
            
            {data.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                  No hay negociaciones activas
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
