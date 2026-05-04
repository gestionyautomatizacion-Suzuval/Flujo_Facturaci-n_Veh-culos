"use client";

import { useState, useEffect, Suspense } from "react";
import { createClient } from "@/utils/supabase/client";
import { CarFront, AlertCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";

function LoginContent() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (urlError) {
      setErrorMsg(urlError);
    }
  }, [urlError]);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      const supabase = createClient();
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            hd: 'suzuval.cl' 
          }
        },
      });

      if (error) {
        setErrorMsg(error.message);
      }
    } catch (err) {
      setErrorMsg("Ocurrió un error inesperado al conectar con Supabase.");
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-slate-100 overflow-hidden text-slate-800">
      
      {/* Elementos Limpios y Corporativos (Gris y Azul) */}
      <div className="absolute top-0 left-0 w-full h-96 bg-blue-800 skew-y-[-5deg] origin-top-left -z-10 shadow-xl"></div>

      <div className="relative w-full max-w-md p-8 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl">
        <div className="relative z-20 flex flex-col items-center">
          
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-800 shadow-lg shadow-blue-800/30">
            <CarFront className="h-10 w-10 text-white" />
          </div>

          <h1 className="mb-2 text-3xl font-bold tracking-tight text-slate-800">Facturación Vehículos</h1>
          <p className="mb-10 text-center text-sm font-medium text-slate-500">
            Sistema Comercial Suzuval
          </p>

          {errorMsg && (
             <div className="mb-6 flex w-full items-center gap-3 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-600">
             <AlertCircle className="h-5 w-5 shrink-0" />
             <p>{errorMsg}</p>
           </div>
          )}

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-xl bg-slate-50 px-6 py-4 text-base font-semibold text-slate-700 border border-slate-200 transition-all hover:bg-slate-100 hover:border-slate-300 active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100 shadow-sm"
          >
            {loading ? (
              <span className="flex items-center gap-2 text-blue-800">
                <svg className="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Conectando...
              </span>
            ) : (
              <>
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.5601 12.2501C22.5601 11.4701 22.4901 10.7201 22.3601 10H12.0001V14.26H17.9201C17.6701 15.63 16.8901 16.79 15.7201 17.57V20.33H19.2801C21.3601 18.41 22.5601 15.6 22.5601 12.2501Z" fill="#4285F4"/>
                  <path d="M12.0002 23.0001C14.9702 23.0001 17.4602 22.0101 19.2802 20.3301L15.7202 17.5701C14.7302 18.2301 13.4802 18.6301 12.0002 18.6301C9.13018 18.6301 6.70018 16.6901 5.84018 14.1001H2.17017V16.9401C3.98017 20.5301 7.70018 23.0001 12.0002 23.0001Z" fill="#34A853"/>
                  <path d="M5.84008 14.0999C5.62008 13.4399 5.49008 12.7299 5.49008 11.9999C5.49008 11.2699 5.62008 10.5599 5.84008 9.89988V7.05988H2.17008C1.43008 8.52988 1.00008 10.2099 1.00008 11.9999C1.00008 13.7899 1.43008 15.4699 2.17008 16.9399L5.84008 14.0999Z" fill="#FBBC05"/>
                  <path d="M12.0002 5.37004C13.6202 5.37004 15.0602 5.93004 16.2102 7.03004L19.3602 3.88004C17.4502 2.10004 14.9602 1.00004 12.0002 1.00004C7.70018 1.00004 3.98017 3.47004 2.17017 7.06004L5.84018 9.90004C6.70018 7.31004 9.13018 5.37004 12.0002 5.37004Z" fill="#EA4335"/>
                </svg>
                Continuar con @suzuval.cl
              </>
            )}
          </button>
          
          <div className="mt-8 text-center text-xs text-slate-400">
            &copy; {new Date().getFullYear()} Suzuval. Todos los derechos reservados.
            <br />
            Plataforma interna segura.
          </div>
        </div>
      </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-500">Cargando...</div>}>
      <LoginContent />
    </Suspense>
  );
}
