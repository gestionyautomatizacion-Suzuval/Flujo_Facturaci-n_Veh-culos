/* eslint-disable */
"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Copy, Check, Search, FileSignature, Image as ImageIcon, Loader2, Trash2, UserPlus, CheckCircle2, AlertCircle } from "lucide-react";

// ── RUT helpers ──────────────────────────────────────────────
function formatRut(raw: string): string {
  const clean = raw.replace(/[^0-9kK]/g, "").toUpperCase();
  if (clean.length <= 1) return clean;
  return `${clean.slice(0, -1)}-${clean.slice(-1)}`;
}

function validateRut(rut: string): boolean {
  const clean = rut.replace(/[^0-9kK]/g, "").toUpperCase();
  if (clean.length < 8 || clean.length > 9) return false;
  const body = clean.slice(0, -1);
  const dvInput = clean.slice(-1);
  let sum = 0, mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const rem = 11 - (sum % 11);
  const dvExpected = rem === 11 ? "0" : rem === 10 ? "K" : String(rem);
  return dvInput === dvExpected;
}

interface ClienteRegistro {
  id: number;
  rut: string;
  nombre: string;
  apellido: string;
  ci_frontal: string | null;
  ci_trasero: string | null;
  firma: string | null;
  link_firma_vendedor: string | null;
  autorizacion: boolean | null;
  updated_at: string | null;
}

export default function FirmasDigitalesPage() {
  const [registros, setRegistros] = useState<ClienteRegistro[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [searchRut, setSearchRut] = useState("");
  const [copied, setCopied] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);

  // Verificar cliente
  const [rutBuscar, setRutBuscar] = useState("");
  const [isBuscando, setIsBuscando] = useState(false);
  const [clienteEncontrado, setClienteEncontrado] = useState<{
    rut: string; nombre: string; segundo_nombre: string | null;
    apellido: string; segundo_apellido: string | null;
  } | null | undefined>(undefined); // undefined=sin buscar, null=no existe

  // Crear cliente
  const [rutInput, setRutInput] = useState("");
  const [rutValido, setRutValido] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [clienteMsg, setClienteMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const supabase = createClient();

  useEffect(() => {
    const initData = async () => {
      const { data: userData } = await supabase.auth.getUser();
      let email = null;
      let role = null;
      
      if (userData?.user?.email) {
        email = userData.user.email;
        setUserEmail(email);
        
        const { data: perfil } = await supabase
          .from('perfiles')
          .select('rol')
          .eq('id', userData.user.id)
          .single();
          
        if (perfil) {
          role = perfil.rol;
          setUserRole(role);
        }
      }
      
      fetchRegistros(role, email);
    };
    initData();
  }, []);

  const fetchRegistros = async (role: string | null, email: string | null) => {
    setLoading(true);
    let query = supabase
      .from("clientes")
      .select("id, rut, nombre, apellido, ci_frontal, ci_trasero, firma, link_firma_vendedor, autorizacion, updated_at")
      .not("firma", "is", null)
      .order("updated_at", { ascending: false })
      .limit(100);

    if (role === "VENDEDOR" && email) {
      query = query.eq("link_firma_vendedor", email);
    }

    const { data, error } = await query;

    if (!error && data) {
      setRegistros(data as ClienteRegistro[]);
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

  const handleDelete = async (id: number) => {
    if (!window.confirm("¿Eliminar los documentos de firma de este cliente? El registro del cliente se conservará.")) {
      return;
    }

    setIsDeleting(id);
    const { error } = await supabase
      .from("clientes")
      .update({
        ci_frontal: null,
        ci_trasero: null,
        firma: null,
        autorizacion: false,
        link_firma_vendedor: null,
      })
      .eq("id", id);

    if (error) {
      alert("Error al limpiar la firma: " + error.message);
    } else {
      setRegistros(prev => prev.filter(r => r.id !== id));
    }
    setIsDeleting(null);
  };

  const filteredRegistros = registros.filter(r =>
    r.rut?.toLowerCase().includes(searchRut.toLowerCase()) ||
    r.nombre?.toLowerCase().includes(searchRut.toLowerCase()) ||
    r.apellido?.toLowerCase().includes(searchRut.toLowerCase()) ||
    r.link_firma_vendedor?.toLowerCase().includes(searchRut.toLowerCase())
  );

  const getImageUrl = (urlOrPath: string | null) => {
    if (!urlOrPath) return null;
    if (urlOrPath.startsWith("http") || urlOrPath.startsWith("data:image")) return urlOrPath;
    return supabase.storage.from("firmas").getPublicUrl(urlOrPath).data.publicUrl;
  };

  const handleBuscarCliente = async () => {
    const rut = formatRut(rutBuscar);
    if (!validateRut(rut)) return;
    setIsBuscando(true);
    setClienteEncontrado(undefined);
    const { data } = await supabase
      .from("clientes")
      .select("rut, nombre, segundo_nombre, apellido, segundo_apellido")
      .eq("rut", rut)
      .maybeSingle();
    setClienteEncontrado(data ?? null);
    setIsBuscando(false);
  };

  const handleRutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatRut(e.target.value);
    setRutInput(formatted);
    if (formatted.length >= 9) setRutValido(validateRut(formatted));
    else setRutValido(null);
  };

  const handleCrearCliente = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateRut(rutInput)) { setRutValido(false); return; }
    setIsSaving(true);
    setClienteMsg(null);
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("clientes").upsert({
      rut: rutInput,
      nombre: (fd.get("nombre") as string).toUpperCase(),
      segundo_nombre: (fd.get("segundo_nombre") as string).toUpperCase() || null,
      apellido: (fd.get("apellido") as string).toUpperCase(),
      segundo_apellido: (fd.get("segundo_apellido") as string).toUpperCase() || null,
      creado_por: userEmail,
    }, { onConflict: "rut" });
    if (error) {
      setClienteMsg({ type: "err", text: error.message });
    } else {
      setClienteMsg({ type: "ok", text: "Cliente guardado correctamente." });
      setRutInput(""); setRutValido(null);
      (e.target as HTMLFormElement).reset();
    }
    setIsSaving(false);
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto w-full">

      {/* Título sección clientes */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Clientes</h1>
      </div>

      {/* ── Verificar Cliente ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-4 overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50">
          <Search className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-widest">Verificar Cliente</h2>
        </div>
        <div className="p-6 flex flex-col sm:flex-row gap-3 items-start">
          <div className="relative flex-1 max-w-xs">
            <input
              value={rutBuscar}
              onChange={e => { setRutBuscar(formatRut(e.target.value)); setClienteEncontrado(undefined); }}
              onKeyDown={e => e.key === "Enter" && handleBuscarCliente()}
              placeholder="12345678-9"
              maxLength={10}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
            />
          </div>
          <button
            onClick={handleBuscarCliente}
            disabled={isBuscando || !validateRut(formatRut(rutBuscar))}
            className="bg-blue-800 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2 rounded-lg flex items-center gap-2 transition disabled:opacity-50"
          >
            {isBuscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Verificar
          </button>

          {/* Resultado */}
          {clienteEncontrado === null && (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
              <p className="text-sm text-amber-700 font-medium">Cliente no encontrado en el sistema</p>
            </div>
          )}
          {clienteEncontrado && (
            <div className="flex items-center gap-3 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-bold text-emerald-800">
                  {[clienteEncontrado.nombre, clienteEncontrado.segundo_nombre, clienteEncontrado.apellido, clienteEncontrado.segundo_apellido].filter(Boolean).join(" ")}
                </p>
                <p className="text-xs text-emerald-600 font-mono">{clienteEncontrado.rut}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Crear / Actualizar Cliente ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-8 overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50">
          <UserPlus className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-widest">Nuevo / Actualizar Cliente</h2>
        </div>
        <form onSubmit={handleCrearCliente} className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* RUT */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">RUT *</label>
            <div className="relative">
              <input
                required
                value={rutInput}
                onChange={handleRutChange}
                placeholder="12345678-9"
                maxLength={10}
                className={`w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 pr-9 transition-colors
                  ${ rutValido === true  ? "border-emerald-400 ring-emerald-100 bg-emerald-50/30" :
                     rutValido === false ? "border-red-400 ring-red-100 bg-red-50/30" :
                                          "border-slate-300 focus:ring-blue-100 focus:border-blue-400" }`}
              />
              {rutValido === true  && <CheckCircle2 className="absolute right-2.5 top-2.5 w-4 h-4 text-emerald-500" />}
              {rutValido === false && <AlertCircle  className="absolute right-2.5 top-2.5 w-4 h-4 text-red-500" />}
            </div>
            {rutValido === false && <p className="text-[11px] text-red-500 font-medium">RUT inválido — revisa el dígito verificador</p>}
          </div>

          {/* Nombre */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Nombre *</label>
            <input required name="nombre" placeholder="Ej: JUAN" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 uppercase" />
          </div>

          {/* Segundo Nombre */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Segundo Nombre <span className="normal-case text-slate-400 font-normal">(opcional)</span></label>
            <input name="segundo_nombre" placeholder="Ej: CARLOS" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 uppercase" />
          </div>

          {/* Apellido */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Apellido *</label>
            <input required name="apellido" placeholder="Ej: PÉREZ" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 uppercase" />
          </div>

          {/* Segundo Apellido */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Segundo Apellido <span className="normal-case text-slate-400 font-normal">(opcional)</span></label>
            <input name="segundo_apellido" placeholder="Ej: GONZÁLEZ" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 uppercase" />
          </div>

          {/* Botón + Mensaje */}
          <div className="space-y-1 flex flex-col justify-end">
            {clienteMsg && (
              <p className={`text-[11px] font-semibold ${ clienteMsg.type === "ok" ? "text-emerald-600" : "text-red-600" }`}>
                {clienteMsg.text}
              </p>
            )}
            <button
              type="submit"
              disabled={isSaving || rutValido === false}
              className="w-full bg-blue-800 hover:bg-blue-700 text-white font-semibold text-sm py-2 rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-60"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Guardar Cliente
            </button>
          </div>

        </form>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Firmas Digitales</h1>
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
              placeholder="Buscar por RUT, nombre o vendedor..."
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
                <th className="px-6 py-4">Fecha Firma</th>
                <th className="px-6 py-4">RUT</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Vendedor</th>
                <th className="px-6 py-4 text-center">Carnet</th>
                <th className="px-6 py-4 text-center">Firma</th>
                {(userRole === "ADMIN" || userRole === "GERENCIA") && (
                  <th className="px-6 py-4 text-center">Acciones</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={(userRole === "ADMIN" || userRole === "GERENCIA") ? 7 : 6} className="px-6 py-8 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Cargando registros...
                  </td>
                </tr>
              ) : filteredRegistros.length === 0 ? (
                <tr>
                  <td colSpan={(userRole === "ADMIN" || userRole === "GERENCIA") ? 7 : 6} className="px-6 py-8 text-center text-slate-500">
                    No se encontraron firmas registradas.
                  </td>
                </tr>
              ) : (
                filteredRegistros.map((registro) => (
                  <tr key={registro.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {registro.updated_at
                        ? new Date(registro.updated_at).toLocaleDateString('es-CL', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })
                        : "—"}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono font-semibold text-slate-800">
                      {registro.rut}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-800">
                      {[registro.nombre, registro.apellido].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {registro.link_firma_vendedor || "—"}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {registro.ci_frontal && (
                          <a href={getImageUrl(registro.ci_frontal) || "#"} target="_blank" rel="noreferrer" title="Carnet Frontal" className="text-blue-600 hover:text-blue-800 bg-blue-50 p-1.5 rounded-md border border-blue-200">
                            <ImageIcon className="w-4 h-4" />
                          </a>
                        )}
                        {registro.ci_trasero && (
                          <a href={getImageUrl(registro.ci_trasero) || "#"} target="_blank" rel="noreferrer" title="Carnet Trasero" className="text-blue-600 hover:text-blue-800 bg-blue-50 p-1.5 rounded-md border border-blue-200">
                            <ImageIcon className="w-4 h-4" />
                          </a>
                        )}
                        {!registro.ci_frontal && !registro.ci_trasero && (
                          <span className="text-slate-400 text-xs">Sin docs</span>
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
                          title="Limpiar firma del cliente"
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
