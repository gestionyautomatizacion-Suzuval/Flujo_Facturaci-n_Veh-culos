/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

import { 
  CarFront, 
  LayoutDashboard, 
  KanbanSquare, 
  Settings,
  ChevronLeft,
  ChevronRight,
  FileSignature
} from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();
  const [mostrarConfig, setMostrarConfig] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const supabase = createClient();

  useEffect(() => {

    const initSidebar = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;
      
      // Verificamos nivel de gerente
      const { data } = await supabase
        .from("perfiles")
        .select("rol")
        .eq("id", userData.user.id)
        .single();
        
      if (data && (data.rol === "ADMIN" || data.rol === "GERENCIA")) {
        setMostrarConfig(true);
      }
    };
    
    initSidebar();
  }, [pathname]);

  const navigation = [
    { name: "Inicio", href: "/", icon: LayoutDashboard },
    { name: "Cuadratura de Valores", href: "/formularios", icon: CarFront },
    { name: "Pedidos de Ventas", href: "/negocios", icon: KanbanSquare },
    { name: "Clientes / Firmas Digitales", href: "/firmas", icon: FileSignature },
  ];

  return (
    <div className={`relative hidden md:flex flex-col border-r border-slate-200 bg-slate-50 transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-56'}`}>
      <div className={`flex h-16 shrink-0 items-center border-b border-slate-200 font-bold tracking-tight text-blue-900 bg-white ${isCollapsed ? 'justify-center px-0' : 'px-4'}`}>
        {!isCollapsed && (
          <div className="flex flex-col text-center w-full text-base leading-tight">
            <span>Facturación</span>
            <span>Vehículos Nuevos</span>
          </div>
        )}
      </div>
      
      <div className="flex flex-1 flex-col overflow-y-auto">
        <nav className={`flex-1 space-y-1.5 py-6 bg-slate-50 ${isCollapsed ? 'px-2' : 'px-4'}`}>
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`group relative flex items-center rounded-xl py-2.5 text-sm font-medium transition-all ${
                  isCollapsed ? 'justify-center px-0' : 'px-3'
                } ${
                  isActive
                    ? "bg-blue-800 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-200 hover:text-blue-900"
                }`}
                title={isCollapsed ? item.name : undefined}
              >
                <div className="relative flex items-center">
                  <item.icon
                    className={`h-5 w-5 shrink-0 transition-colors ${!isCollapsed ? 'mr-3' : ''} ${
                      isActive ? "text-white" : "text-slate-400 group-hover:text-blue-800"
                    }`}
                    aria-hidden="true"
                  />
                </div>
                {!isCollapsed && <span className="truncate">{item.name}</span>}
              </Link>
            );
          })}
        </nav>
        
        {mostrarConfig && (
          <div className="p-4 border-t border-slate-200 bg-slate-50">
            <Link
              href="/settings"
              className={`group flex items-center rounded-xl py-2.5 text-sm font-medium text-slate-600 transition-all hover:bg-slate-200 hover:text-slate-900 ${
                isCollapsed ? 'justify-center px-0' : 'px-3'
              }`}
              title={isCollapsed ? "Configuración" : undefined}
            >
              <Settings className={`h-5 w-5 text-slate-400 group-hover:text-slate-600 ${!isCollapsed ? 'mr-3' : ''}`} />
              {!isCollapsed && <span>Configuración</span>}
            </Link>
          </div>
        )}

        {/* Floating Toggle Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 hover:text-blue-600 shadow-sm z-10 transition-colors"
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
