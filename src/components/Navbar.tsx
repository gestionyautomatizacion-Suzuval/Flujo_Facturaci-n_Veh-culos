"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { User } from "@supabase/supabase-js";
import { LogOut, Menu, Bell, User as UserIcon } from "lucide-react";
import { useRouter } from "next/navigation";

interface AppNotification {
  id: string;
  pedido_venta: string;
  usuario_nombre: string;
  comentario: string;
  created_at: string;
}

const getElapsedString = (dateString: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const diffHrs = diffMs / (1000 * 60 * 60);

  if (diffHrs >= 24) {
    if (diffHrs >= 48) {
      return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short' }).format(date);
    }
    return 'Ayer';
  } else {
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return 'Hace un momento';
    if (diffMins === 1) return 'Hace 1 min';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    const diffHoursFloor = Math.floor(diffHrs);
    if (diffHoursFloor === 1) return 'Hace 1 hr';
    return `Hace ${diffHoursFloor} hrs`;
  }
};

export default function Navbar({ user }: { user: User }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cerrar dropdown al clickear fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    if (isNotificationsOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isNotificationsOpen]);

  useEffect(() => {
    if (!user?.email) return;
    const supabase = createClient();
    
    // 1. Cargar historial de las últimas 72 horas
    const fetchHistory = async () => {
      const limitDate = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('negocios_comentarios')
        .select(`
          id, 
          pedido_venta, 
          usuario_nombre, 
          comentario,
          created_at
        `)
        .neq('usuario_email', user.email)
        .gte('created_at', limitDate)
        .order('created_at', { ascending: false })
        .limit(50);
        
      if (data) {
        const history = data.map((d: any) => ({
          id: d.id,
          pedido_venta: d.pedido_venta,
          usuario_nombre: d.usuario_nombre,
          comentario: d.comentario,
          created_at: d.created_at,
        }));
        setNotifications((prev) => {
          const merged = [...prev, ...history];
          const unique = merged.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
          return unique;
        });
      }
    };
    
    fetchHistory();

    // 2. Escuchar nuevos comentarios en tiempo real
    const channel = supabase.channel('navbar-realtime-chat')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'negocios_comentarios'
      }, async (payload) => {
        if (payload.new.usuario_email !== user.email) {
          // No need to query negocios table since we already have pedido_venta in the payload
          const data = { pedido_venta: payload.new.pedido_venta };
            
          if (data?.pedido_venta) {
            setNotifications(prev => [{
              id: payload.new.id,
              pedido_venta: data.pedido_venta,
              usuario_nombre: payload.new.usuario_nombre,
              comentario: payload.new.comentario,
              created_at: payload.new.created_at
            }, ...prev].slice(0, 50));
            setHasUnread(true);
          }
        }
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleLogout = async () => {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <header className="relative z-50 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white/50 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="flex md:hidden">
        <button className="text-slate-500 hover:text-slate-700">
          <Menu className="h-6 w-6" />
        </button>
      </div>
      
      <div className="flex flex-1 items-center justify-end gap-x-4 lg:gap-x-6">
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => {
              setIsNotificationsOpen(!isNotificationsOpen);
              setHasUnread(false);
            }}
            title="Notificaciones"
            className={`relative p-2 transition-colors ${hasUnread || isNotificationsOpen ? 'text-blue-600 hover:text-blue-700' : 'text-slate-400 hover:text-slate-500'}`}
          >
            {hasUnread && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white animate-pulse"></span>
            )}
            <Bell className="h-6 w-6" />
          </button>

          {isNotificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl bg-white shadow-lg ring-1 ring-black ring-opacity-5 z-50 overflow-hidden border border-slate-100">
              <div className="p-3 border-b border-slate-100 bg-slate-50">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-bold text-slate-700">Historial de Notificaciones</span>
                  {notifications.length > 0 && (
                    <button onClick={() => setNotifications([])} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                      Limpiar Todo
                    </button>
                  )}
                </div>
                <button
                  onClick={() => {
                    setIsNotificationsOpen(false);
                    router.push('/notificaciones');
                  }}
                  className="w-full text-center py-1.5 px-3 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                >
                  Centro de Notificaciones &rarr;
                </button>
              </div>
              <div className="max-h-[70vh] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-500">No hay notificaciones recientes</div>
                ) : (
                  notifications.map(n => (
                    <button
                      key={n.id}
                      onClick={() => {
                        setIsNotificationsOpen(false);
                        // Remover la notificación del dropdown ha provocado "desapariciones" según el feedback.
                        // Ahora simplemente redirigiremos, dejando el historial intacto.
                        router.push(`/negocios/${n.pedido_venta}`);
                      }}
                      className="w-full text-left p-4 hover:bg-blue-50 border-b border-slate-50 transition-colors group"
                    >
                      <div className="flex justify-between items-start mb-1.5">
                        <span className="text-sm font-bold text-slate-800">{n.usuario_nombre}</span>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded shadow-sm">PV: {n.pedido_venta}</span>
                          <span className="text-[10px] font-medium text-slate-400 capitalize">{getElapsedString(n.created_at)}</span>
                        </div>
                      </div>
                      <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
                        {n.comentario.startsWith('[ARCHIVO]|') ? '📎 Archivo adjunto' : n.comentario}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-slate-200" aria-hidden="true" />
        
        <div className="flex items-center gap-x-4">
          <div className="hidden md:flex md:flex-col md:items-end">
            <span className="text-sm font-semibold leading-6 text-slate-900" aria-hidden="true">
              {user.user_metadata?.full_name || user.email?.split('@')[0]}
            </span>
            <span className="text-xs font-medium text-slate-500">
              {user.email}
            </span>
          </div>

          
          <button 
            onClick={handleLogout}
            disabled={loggingOut}
            className="ml-2 p-2 text-slate-400 hover:text-red-600 transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
