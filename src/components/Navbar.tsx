"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { User } from "@supabase/supabase-js";
import { LogOut, Menu } from "lucide-react";
import { useRouter } from "next/navigation";

export default function Navbar({ user }: { user: User }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

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
