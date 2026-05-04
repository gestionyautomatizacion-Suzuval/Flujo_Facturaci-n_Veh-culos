import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PermisoCirculacionClient from "./PermisoCirculacionClient";

export default function PermisoCirculacionPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="mb-4 max-w-[1200px] mx-auto w-full">
        <Link 
          href="/settings/parametros" 
          className="inline-flex items-center text-sm text-slate-500 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a Parámetros
        </Link>
      </div>
      
      <PermisoCirculacionClient />
    </div>
  );
}
