"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Copy, Check, Search, FileSignature, Image as ImageIcon, File, Loader2, Trash2 } from "lucide-react";

interface FirmaRegistro {
  id: string;
  created_at: string;
  rut: string;
  ci: string | null;
  ci_frontal: string | null;
  ci_trasero: string | null;
  firma: string | null;
  correo_vendedor: string | null;
  autorizacion: boolean | null;
}

export default function FirmasDigitalesPage() {
  const [registros, setRegistros] = useState<FirmaRegistro[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [searchRut, setSearchRut] = useState("");
  const [copied, setCopied] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const initData = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user?.email) {
        setUserEmail(userData.user.email);
        
        const { data: perfil } = await supabase
          .from('perfiles')
          .select('rol')
          .eq('id', userData.user.id)
          .single();
          
        if (perfil) {
          setUserRole(perfil.rol);
        }
      }
      
      fetchRegistros();
    };
    initData();
  }, []);

  const fetchRegistros = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("copia_firmas")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
      
    if (!error && data) {
      setRegistros(data);
    }
    setLoading(false);
  };

  const handleCopyLink = () => {
    if (!userEmail) return;
    const url = `${window.location.origin}/captura-firma?vendedor=${encodeURIComponent(userEmail)}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Estás seguro de que deseas eliminar este registro? Esta acción no se puede deshacer.")) {
      return;
    }
    
    setIsDeleting(id);
    const { error } = await supabase
      .from("copia_firmas")
      .delete()
      .eq("id", id);
      
    if (error) {
      alert("Error al eliminar el registro: " + error.message);
    } else {
      setRegistros(prev => prev.filter(r => r.id !== id));
    }
    setIsDeleting(null);
  };

  const filteredRegistros = registros.filter(r => 
    r.rut?.toLowerCase().includes(searchRut.toLowerCase()) || 
    r.correo_vendedor?.toLowerCase().includes(searchRut.toLowerCase())
  );

  const getImageUrl = (urlOrPath: string | null) => {
    if (!urlOrPath) return null;
    if (urlOrPath.startsWith("http") || urlOrPath.startsWith("data:image")) return urlOrPath;
    return supabase.storage.from("firmas").getPublicUrl(urlOrPath).data.publicUrl;
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Firmas Digitales de Clientes</h1>
        <p className="text-slate-500 mt-1">Comparte tu enlace personal para que los clientes completen sus datos y firma.</p>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-2">Tu Enlace de Captura</h2>
          <div className="flex items-center gap-2">
            <code className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-md text-sm border border-slate-200 w-full md:w-auto truncate max-w-[300px] md:max-w-md">
              {userEmail ? `${window.location.origin}/captura-firma?vendedor=${userEmail}` : "Cargando enlace..."}
            </code>
          </div>
        </div>
        <button
          onClick={handleCopyLink}
          disabled={!userEmail}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? "Enlace copiado" : "Copiar Enlace"}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por RUT o Correo de Vendedor..."
              value={searchRut}
              onChange={(e) => setSearchRut(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-4">Fecha</th>
                <th className="px-6 py-4">RUT Cliente</th>
                <th className="px-6 py-4">Vendedor</th>
                <th className="px-6 py-4 text-center">Docs</th>
                <th className="px-6 py-4 text-center">Firma</th>
                {(userRole === "ADMIN" || userRole === "GERENCIA") && (
                  <th className="px-6 py-4 text-center">Acciones</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={(userRole === "ADMIN" || userRole === "GERENCIA") ? 6 : 5} className="px-6 py-8 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Cargando registros...
                  </td>
                </tr>
              ) : filteredRegistros.length === 0 ? (
                <tr>
                  <td colSpan={(userRole === "ADMIN" || userRole === "GERENCIA") ? 6 : 5} className="px-6 py-8 text-center text-slate-500">
                    No se encontraron firmas registradas.
                  </td>
                </tr>
              ) : (
                filteredRegistros.map((registro) => (
                  <tr key={registro.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {new Date(registro.created_at).toLocaleDateString('es-CL', {
                        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-800">
                      {registro.rut}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {registro.correo_vendedor || "No registrado"}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {registro.ci_frontal ? (
                          <a href={getImageUrl(registro.ci_frontal) || "#"} target="_blank" rel="noreferrer" title="Carnet Frontal" className="text-blue-600 hover:text-blue-800 bg-blue-50 p-1.5 rounded-md border border-blue-200">
                            <ImageIcon className="w-4 h-4" />
                          </a>
                        ) : registro.ci ? (
                           <a href={getImageUrl(registro.ci) || "#"} target="_blank" rel="noreferrer" title="Carnet Antiguo (PDF/Link)" className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 p-1.5 rounded-md border border-indigo-200">
                            <File className="w-4 h-4" />
                          </a>
                        ) : null}
                        {registro.ci_trasero && (
                          <a href={getImageUrl(registro.ci_trasero) || "#"} target="_blank" rel="noreferrer" title="Carnet Trasero" className="text-blue-600 hover:text-blue-800 bg-blue-50 p-1.5 rounded-md border border-blue-200">
                            <ImageIcon className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {registro.firma ? (
                         <a href={getImageUrl(registro.firma) || "#"} target="_blank" rel="noreferrer" title="Ver Firma" className="inline-flex items-center justify-center text-emerald-600 hover:text-emerald-800 bg-emerald-50 p-1.5 rounded-md border border-emerald-200">
                           <FileSignature className="w-4 h-4" />
                         </a>
                      ) : (
                        <span className="text-slate-400 text-xs">Sin firma</span>
                      )}
                    </td>
                    {(userRole === "ADMIN" || userRole === "GERENCIA") && (
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleDelete(registro.id)}
                          disabled={isDeleting === registro.id}
                          className="p-1.5 text-red-600 hover:bg-red-50 hover:text-red-800 rounded-md transition-colors disabled:opacity-50"
                          title="Eliminar registro"
                        >
                          {isDeleting === registro.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
