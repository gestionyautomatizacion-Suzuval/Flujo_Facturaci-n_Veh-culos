import React, { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Calendar, User, Building2, CreditCard, ChevronRight, Trash2, Eye, ArrowDown, ArrowUp } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

// TIPOS
export type EstadoNegocio = 'PARA_REVISIÓN' | 'REVISADO_EN_ESPERA' | 'REVISADO_OK' | 'FACTURADO';

export interface Negocio {
  interno: string;
  pedido_venta: string;
  rut: string;
  nombre_apellido: string;
  marca: string;
  modelo: string;
  color: string;
  ano?: string | number;
  suc_vta: string;
  vendedor_nombre: string;
  tipo_compra: string;
  saldo: string;
  estado: EstadoNegocio;
  created_at: string;
  carta_mutuo_datos?: any;
}

const KANBAN_COLUMNS: { id: EstadoNegocio; title: string; color: string; border: string }[] = [
  { id: 'PARA_REVISIÓN', title: 'Pendiente de Revisión', color: 'bg-blue-50', border: 'border-blue-200' },
  { id: 'REVISADO_EN_ESPERA', title: 'En Revisión', color: 'bg-amber-50', border: 'border-amber-200' },
  { id: 'REVISADO_OK', title: 'OK Revisado', color: 'bg-emerald-50', border: 'border-emerald-200' },
  { id: 'FACTURADO', title: 'Facturado', color: 'bg-purple-50', border: 'border-purple-200' }
];

export default function KanbanBoard({ initialData, isAdmin = false, canDelete = false, cardSize = 'large', searchTerm = '', unreadChats = new Set() }: { initialData: Negocio[], isAdmin?: boolean, canDelete?: boolean, cardSize?: string, searchTerm?: string, unreadChats?: Set<string> }) {
  const [data, setData] = useState<Negocio[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [sortOrders, setSortOrders] = useState<Record<EstadoNegocio, 'desc' | 'asc'>>({
    PARA_REVISIÓN: 'desc',
    REVISADO_EN_ESPERA: 'desc',
    REVISADO_OK: 'desc',
    FACTURADO: 'desc'
  });
  const [confirmAction, setConfirmAction] = useState<{
    destinationId: EstadoNegocio;
    sourceId: EstadoNegocio;
    draggableId: string;
    sourceTitle: string;
    destTitle: string;
    isAdvance: boolean;
  } | null>(null);
  const router = useRouter();

  const supabase = createClient();

  useEffect(() => {
    setData(initialData);
    setIsMounted(true);
  }, [initialData]);

  const handleDeleteNegocio = async (pedido_venta: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("¿Estás seguro de eliminar este negocio completamente? Esta acción no se puede deshacer.")) return;
    
    try {
      const response = await fetch(`/api/admin/negocios?pedido_venta=${encodeURIComponent(pedido_venta)}`, {
        method: "DELETE",
      });
      const result = await response.json();
      
      if (!response.ok || result.error) {
        alert("Error al eliminar: " + (result.error || response.statusText));
      } else {
        setData(prev => prev.filter(n => n.pedido_venta !== pedido_venta));
      }
    } catch (err: any) {
      alert("Error al comunicarse con el servidor: " + err.message);
    }
  };

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    if (!isAdmin) return; // Validación extra manual

    if (destination.droppableId === 'FACTURADO') {
      alert("⛔ Acción denegada: El estado FACTURADO solo se alcanza de manera automática al adjuntar el documento 'Factura' en la carpeta del negocio. No se permiten cambios manuales.");
      return;
    }

    const sourceIndex = KANBAN_COLUMNS.findIndex(C => C.id === source.droppableId);
    const destIndex = KANBAN_COLUMNS.findIndex(C => C.id === destination.droppableId);

    setConfirmAction({
      destinationId: destination.droppableId as EstadoNegocio,
      sourceId: source.droppableId as EstadoNegocio,
      draggableId,
      sourceTitle: KANBAN_COLUMNS[sourceIndex].title,
      destTitle: KANBAN_COLUMNS[destIndex].title,
      isAdvance: destIndex > sourceIndex
    });
  };

  const confirmMove = async () => {
    if (!confirmAction) return;

    const { destinationId, draggableId } = confirmAction;
    const previousData = [...data];
    const newData = [...data];
    const negocioIndex = newData.findIndex(n => n.pedido_venta === draggableId);
    
    if (negocioIndex > -1) {
      const previousState = newData[negocioIndex].estado;
      newData[negocioIndex].estado = destinationId;
      setData([...newData]);
      setConfirmAction(null);
      
      const { error } = await supabase
        .from('negocios')
        .update({ estado: destinationId })
        .eq('pedido_venta', draggableId);

      if (error) {
        console.error("Error moviendo tarjeta en BD:", error);
        newData[negocioIndex].estado = previousState;
        setData([...newData]); // Rollback
        alert("Ocurrió un error al mover la tarjeta en los servidores: " + error.message);
      } else {
        const { data: authData } = await supabase.auth.getUser();
        await supabase.from('negocios_comentarios').insert([{
          pedido_venta: draggableId,
          comentario: `[AUDITORIA]|Estado del negocio cambiado: ${confirmAction.sourceTitle} -> ${confirmAction.destTitle}`,
          usuario_email: authData?.user?.email || 'Sistema'
        }]);
        await supabase.from('negocios_historial').insert([{
          pedido_venta: draggableId,
          tipo_evento: 'KANBAN',
          descripcion: `Estado cambiado: ${confirmAction.sourceTitle} -> ${confirmAction.destTitle}`,
          usuario_email: authData?.user?.email || 'Sistema'
        }]);
      }
    }
  };

  const cancelMove = () => {
    setConfirmAction(null);
  };

  if (!isMounted) return null;

  // Filtrar por PV, interno, suc_vta (centro) o vendedor_nombre (correo del creador)
  const q = searchTerm.trim().toLowerCase();
  const filteredData = q
    ? data.filter(n => {
        const dateStr = format(new Date(n.created_at), "dd/MM/yy").toLowerCase();
        
        return (n.pedido_venta || '').toLowerCase().includes(q) ||
        (n.interno || '').toLowerCase().includes(q) ||
        (n.suc_vta || '').toLowerCase().includes(q) ||
        (n.vendedor_nombre || '').toLowerCase().includes(q) ||
        (n.nombre_apellido || '').toLowerCase().includes(q) ||
        dateStr.includes(q);
      })
    : data;

  return (
    <>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex h-full gap-4 overflow-x-auto pb-4">
          {KANBAN_COLUMNS.map(column => {
            const columnItems = filteredData
              .filter(item => item.estado === column.id)
              .sort((a, b) => {
                const order = sortOrders[column.id];
                const timeA = new Date(a.created_at).getTime();
                const timeB = new Date(b.created_at).getTime();
                return order === 'asc' ? timeA - timeB : timeB - timeA;
              });

            return (
              <div key={column.id} className={`flex h-full w-80 shrink-0 flex-col rounded-xl border ${column.border} ${column.color} p-4`}>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                    {column.title}
                    <button
                      onClick={() => {
                        setSortOrders(prev => ({
                          ...prev,
                          [column.id]: prev[column.id] === 'desc' ? 'asc' : 'desc'
                        }));
                      }}
                      className="p-1 hover:bg-black/5 rounded text-slate-400 hover:text-slate-600 transition-colors"
                      title={sortOrders[column.id] === 'desc' ? "Ordenar ascendente" : "Ordenar descendente"}
                    >
                      {sortOrders[column.id] === 'desc' ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUp className="w-3.5 h-3.5" />}
                    </button>
                  </h3>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-500 shadow-sm">
                    {columnItems.length}
                  </span>
                </div>

                <Droppable droppableId={column.id} isDropDisabled={!isAdmin}>
                  {(provided, snapshot) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className={`flex-1 overflow-y-auto space-y-3 p-1 transition-colors rounded-lg ${snapshot.isDraggingOver ? 'bg-black/5' : ''}`}
                    >
                      {columnItems.map((item, index) => (
                        <Draggable key={item.pedido_venta} draggableId={item.pedido_venta} index={index} isDragDisabled={!isAdmin}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => {
                                const stored = localStorage.getItem("unread_negocios_chats");
                                if (stored) {
                                  try {
                                    let arr = JSON.parse(stored);
                                    arr = arr.filter((pv: string) => pv !== item.pedido_venta);
                                    localStorage.setItem("unread_negocios_chats", JSON.stringify(arr));
                                  } catch (e) {}
                                }
                                router.push(`/negocios/${item.pedido_venta}`);
                              }}
                              className={`group relative rounded-xl border bg-white shadow-sm transition-all hover:shadow-md hover:border-blue-400 cursor-pointer ${
                                snapshot.isDragging ? 'rotate-2 scale-105 shadow-xl ring-2 ring-blue-500 ring-offset-2 z-50' : 'border-slate-200'
                              } ${!isAdmin ? 'opacity-90 hover:bg-slate-50' : ''} ${cardSize === 'small' ? 'px-3 pt-1 pb-3' : 'px-4 pt-1 pb-4'}`}
                            >
                              {unreadChats?.has(item.pedido_venta) && (
                                <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 z-10">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-orange-500 ring-2 ring-white shadow-sm"></span>
                                </span>
                              )}
                              {cardSize === 'small' ? (
                                /* TARJETA PEQUEÑA (TIPO LISTA) */
                                <div>
                                  <div className="mb-1.5 text-center leading-none">
                                    <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider leading-none">
                                      Creado {format(new Date(item.created_at), "dd/MM/yy - HH:mm", { locale: es })}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="inline-flex items-center rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 ring-1 ring-inset ring-blue-700/10">
                                      Interno: {item.interno}
                                    </span>
                                    <span className="inline-flex items-center rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 ring-1 ring-inset ring-blue-700/10">
                                      PV: {item.pedido_venta}
                                    </span>
                                  </div>
                                  {item.nombre_apellido && item.nombre_apellido.trim().toUpperCase() !== 'S/N' && (
                                    <p className="font-semibold text-slate-800 text-sm leading-tight truncate mb-1">
                                      {item.nombre_apellido}
                                    </p>
                                  )}
                                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                                    <div className="flex flex-col">
                                      <div className="flex items-center truncate mb-1">
                                        <Building2 className="mr-1 h-3 w-3 shrink-0" />
                                        <span className="truncate">{item.suc_vta ? (item.suc_vta.includes('-') ? item.suc_vta.split('-')[1]?.trim() : item.suc_vta) : 'Sin sucursal'}</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 self-end">
                                      {canDelete && (
                                        <button 
                                            onClick={(e) => handleDeleteNegocio(item.pedido_venta, e)}
                                            className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-colors hover:bg-red-100 hover:text-red-600"
                                            title="Eliminar Negocio"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                      )}
                                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-colors group-hover:bg-blue-100 group-hover:text-blue-600">
                                        <ChevronRight className="h-3 w-3" />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                /* TARJETA GRANDE ORIGINAL */
                                <div>
                                  <div className="mb-2 text-center leading-none">
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider leading-none">
                                      Creado {format(new Date(item.created_at), "dd/MM/yy - HH:mm", { locale: es })}
                                    </span>
                                  </div>
                                  <div className="mb-3 flex items-start justify-between">
                                    <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                                      Interno: {item.interno}
                                    </span>
                                    <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                                      PV: {item.pedido_venta}
                                    </span>
                                  </div>

                                  {item.nombre_apellido && item.nombre_apellido.trim().toUpperCase() !== 'S/N' && (
                                    <p className="font-semibold text-slate-900 leading-tight mb-1">
                                      {item.nombre_apellido}
                                    </p>
                                  )}
                                  
                                  <div className="mb-3 text-sm font-medium text-slate-600 truncate">
                                    {item.marca} {item.modelo}
                                    {item.ano && (
                                      <span className="text-xs text-slate-400 font-normal block mt-0.5 whitespace-normal">
                                        {item.ano}
                                      </span>
                                    )}
                                  </div>

                                  <div className="space-y-2 text-xs text-slate-500">
                                    <div className="flex items-center">
                                      <User className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                                      <span className="truncate">{item.vendedor_nombre}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center truncate">
                                        <Building2 className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate">{item.suc_vta || 'Sin sucursal'}</span>
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0">
                                        {canDelete && (
                                          <button 
                                              onClick={(e) => handleDeleteNegocio(item.pedido_venta, e)}
                                              className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-colors hover:bg-red-100 hover:text-red-600"
                                              title="Eliminar Negocio"
                                          >
                                              <Trash2 className="h-4 w-4" />
                                          </button>
                                        )}
                                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-colors group-hover:bg-blue-100 group-hover:text-blue-600">
                                          <ChevronRight className="h-4 w-4" />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {/* Modal de Confirmación */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 transform transition-all">
            <h3 className={`text-xl font-bold mb-2 flex items-center gap-2 ${confirmAction.isAdvance ? "text-emerald-600" : "text-amber-600"}`}>
              {confirmAction.isAdvance ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
              )}
              {confirmAction.isAdvance ? "Confirmar Avance" : "Confirmar Retroceso"}
            </h3>
            
            <p className="text-slate-600 mb-4 text-sm leading-relaxed">
              ¿Estás seguro de mover el negocio <span className="font-bold text-slate-800">#{confirmAction.draggableId}</span> desde <span className="font-semibold">{confirmAction.sourceTitle}</span> hasta <span className="font-semibold">{confirmAction.destTitle}</span>?
            </p>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={cancelMove}
                className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmMove}
                className={`px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors shadow-sm
                  ${confirmAction.isAdvance ? "bg-emerald-500 hover:bg-emerald-600" : "bg-amber-500 hover:bg-amber-600"}
                `}
              >
                {confirmAction.isAdvance ? "Sí, Avanzar" : "Sí, Retroceder"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
