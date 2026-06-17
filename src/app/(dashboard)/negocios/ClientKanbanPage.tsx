/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useRef } from "react";
import KanbanBoard, { Negocio } from "@/components/KanbanBoard";
import NuevoNegocioModal from "@/components/NuevoNegocioModal";
import { LayoutGrid, AlignJustify, Search, X } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export type CardSize = 'large' | 'small';

export default function ClientKanbanPage({ initialData, userRole = "VENDEDOR" }: { initialData: Negocio[], userRole?: string }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cardSize, setCardSize] = useState<CardSize>('large');
  const [searchTerm, setSearchTerm] = useState("");
  const isAdmin = ["ADMINISTRATIVO", "GERENCIA", "ADMIN"].includes(userRole);
  
  const [unreadChats, setUnreadChats] = useState<Set<string>>(new Set());
  const [userEmail, setUserEmail] = useState("");
  const userEmailRef = useRef(userEmail);

  useEffect(() => {
    userEmailRef.current = userEmail;
  }, [userEmail]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) {
        setUserEmail(data.user.email);
      }
    });

    if (!isAdmin) return;

    // Cargar chats sin leer de localStorage
    const stored = localStorage.getItem("unread_negocios_chats");
    if (stored) {
      try {
        setUnreadChats(new Set(JSON.parse(stored)));
      } catch (e) {}
    }

    const channel = supabase.channel('global-comentarios-kanban')
      .on(
        'postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'negocios_comentarios' }, 
        (payload) => {
          const newMsg = payload.new as any;
          console.log("Nuevo comentario recibido en Kanban:", newMsg);
          
          if (!newMsg.comentario.startsWith("[AUDITORIA]|")) {
            setUnreadChats(prev => {
              const next = new Set(prev);
              next.add(newMsg.pedido_venta);
              localStorage.setItem("unread_negocios_chats", JSON.stringify(Array.from(next)));
              console.log("Notificación activada para PV:", newMsg.pedido_venta);
              return next;
            });
          }
        }
      )
      .subscribe((status) => {
        console.log("Estado de suscripción Kanban global:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  return (
    <>
      {/* Barra de búsqueda centrada en el navbar */}
      <div className="absolute mt-[-52px] left-1/2 -translate-x-1/2 z-10 hidden sm:flex w-[380px] max-w-[40vw]">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por PV, interno, centro, creador, cliente o fecha..."
            className="w-full h-[38px] pl-9 pr-8 rounded-xl border border-slate-200 bg-white/80 backdrop-blur-sm text-sm text-slate-700 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Botones de vista + Nuevo Negocio (derecha del navbar) */}
      <div className="absolute mt-[-55px] right-8 z-10 hidden sm:flex flex-row items-center gap-3">
        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setCardSize('large')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              cardSize === 'large' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
            title="Cuadradas Grandes"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCardSize('small')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              cardSize === 'small' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
            title="Rectángulos Pequeños"
          >
            <AlignJustify className="w-4 h-4" />
          </button>
        </div>

        <button 
          onClick={() => setIsModalOpen(true)}
          className="inline-flex h-[38px] items-center justify-center rounded-xl bg-blue-800 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-all active:scale-95 whitespace-nowrap"
        >
          + Nuevo Pedido Venta
        </button>
      </div>
      
      {/* Botón flotante para Móviles (Abajo a la derecha) */}
      <button 
          onClick={() => setIsModalOpen(true)}
          className="sm:hidden fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-blue-800 text-white shadow-lg shadow-blue-900/40 active:scale-95 transition-transform"
      >
        <span className="text-2xl">+</span>
      </button>

      <KanbanBoard initialData={initialData} isAdmin={isAdmin} canDelete={userRole === 'ADMIN'} cardSize={cardSize} searchTerm={searchTerm} unreadChats={unreadChats} />

      {isModalOpen && (
        <NuevoNegocioModal 
          onClose={() => setIsModalOpen(false)} 
          onSuccess={() => {
            setIsModalOpen(false);
            // Hacer refresh duro a la página para recargar datos desde el SSR Server Component
            window.location.reload(); 
          }} 
        />
      )}
    </>
  );
}
