"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { Plus, Calculator, Search, Loader2, Trash2, ArrowUpDown, ArrowUp, ArrowDown, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";

interface Cuadratura {
  id: number;
  id_cuadratura: string | null;
  created_at: string;
  cod_modelo: string;
  marca: string | null;
  descripcion_modelo: string | null;
  precio_final: number;
  saldo_pendiente: number;
  perfil_id?: string | null;
  perfil_id?: string | null;
  perfiles?: {
    nombre_completo: string | null;
  } | null;
  clientes: {
    nombre: string;
    segundo_nombre: string | null;
    apellido: string;
    rut: string;
  } | null;
}

type SortKey = "created_at" | "nombre" | "id_cuadratura" | "marca" | "precio_final" | "saldo_pendiente";
type SortDir = "asc" | "desc";

export default function CuadraturasListPage() {
  const [cuadraturas, setCuadraturas] = useState<Cuadratura[]>([]);
  const [loading, setLoading]         = useState(true);
  const [searchTerm, setSearchTerm]   = useState("");
  const [userRole, setUserRole]       = useState<string | null>(null);
  const [userEmail, setUserEmail]     = useState<string | null>(null);
  const [isDeleting, setIsDeleting]   = useState<number | null>(null);
  const [fetchError, setFetchError]   = useState<string | null>(null);
  const [sortKey, setSortKey]         = useState<SortKey>("created_at");
  const [sortDir, setSortDir]         = useState<SortDir>("desc");

  const supabase = createClient();
  const router   = useRouter();

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email && user?.id) {
        setUserEmail(user.email);
        const { data: perfil } = await supabase
          .from("perfiles")
          .select("rol")
          .eq("id", user.id)
          .maybeSingle();
        const rol = perfil?.rol ?? null;
        setUserRole(rol);
        await fetchCuadraturas(rol, user.email, user.id);
      } else {
        setLoading(false);
      }
    };
    init();
  }, []);

  const fetchCuadraturas = async (role: string | null, email: string | null, userId: string | null = null) => {
    setLoading(true);
    setFetchError(null);

    const buildQuery = (conRelacionesNuevas: boolean) => {
      const cols = conRelacionesNuevas
        ? "id, id_cuadratura, created_at, cod_modelo, marca, descripcion_modelo, precio_final, saldo_pendiente, perfil_id, clientes(nombre, segundo_nombre, apellido, rut), perfiles(nombre_completo)"
        : "id, created_at, cod_modelo, marca, descripcion_modelo, precio_final, saldo_pendiente, clientes(nombre, segundo_nombre, apellido, rut)";
      let q = supabase
        .from("cuadratura_valores_cliente")
        .select(cols)
        .order("created_at", { ascending: false })
        .limit(200);
        
      if (role === "VENDEDOR") {
        if (conRelacionesNuevas && userId) {
          q = q.eq("perfil_id", userId);
        }
      }
      return q;
    };

    let { data, error } = await buildQuery(true);
    if (error) {
      console.warn("[CuadraturaList] Reintentando sin relaciones nuevas (probablemente falte ejecutar el SQL de perfil_id):", error.message);
      const fallback = await buildQuery(false);
      data  = fallback.data;
      error = fallback.error;
    }

    if (error) {
      console.error("[CuadraturaList] Error definitivo:", error.message);
      setFetchError(error.message);
    } else if (data) {
      setCuadraturas(data as any);
    }
    setLoading(false);
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm("¿Eliminar esta cuadratura? Esta acción no se puede deshacer.")) return;
    setIsDeleting(id);
    const { error } = await supabase.from("cuadratura_valores_cliente").delete().eq("id", id);
    if (!error) {
      setCuadraturas(prev => prev.filter(c => c.id !== id));
    } else {
      alert("Error al eliminar: " + error.message);
    }
    setIsDeleting(null);
  };

  // ── Sort handler ──
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30" />;
    return sortDir === "asc"
      ? <ArrowUp className="w-3 h-3 ml-1 text-indigo-600" />
      : <ArrowDown className="w-3 h-3 ml-1 text-indigo-600" />;
  };

  // ── Filter ──
  const filtered = cuadraturas.filter(c => {
    const rut    = c.clientes?.rut?.toLowerCase() ?? "";
    const nombre = [c.clientes?.nombre, c.clientes?.segundo_nombre, c.clientes?.apellido]
      .filter(Boolean).join(" ").toLowerCase();
    const modelo = (c.cod_modelo ?? "").toLowerCase();
    const marca  = (c.marca ?? "").toLowerCase();
    const idCuad  = (c.id_cuadratura ?? "").toLowerCase();
    const fecha  = new Date(c.created_at).toLocaleDateString("es-CL");
    const term   = searchTerm.toLowerCase();
    return rut.includes(term) || nombre.includes(term) || modelo.includes(term)
        || marca.includes(term) || idCuad.includes(term) || fecha.includes(term);
  });

  // ── Sort ──
  const sorted = [...filtered].sort((a, b) => {
    let va: any, vb: any;
    switch (sortKey) {
      case "created_at":
        va = new Date(a.created_at).getTime();
        vb = new Date(b.created_at).getTime();
        break;
      case "nombre":
        va = [a.clientes?.nombre, a.clientes?.apellido].filter(Boolean).join(" ").toLowerCase();
        vb = [b.clientes?.nombre, b.clientes?.apellido].filter(Boolean).join(" ").toLowerCase();
        break;
      case "id_cuadratura":
        va = a.id_cuadratura ?? "";
        vb = b.id_cuadratura ?? "";
        break;
      case "marca":
        va = (a.marca ?? "").toLowerCase();
        vb = (b.marca ?? "").toLowerCase();
        break;
      case "precio_final":
        va = Number(a.precio_final ?? 0);
        vb = Number(b.precio_final ?? 0);
        break;
      case "saldo_pendiente":
        va = Number(a.saldo_pendiente ?? 0);
        vb = Number(b.saldo_pendiente ?? 0);
        break;
    }
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const canDelete = userRole === "ADMIN" || userRole === "GERENCIA" || userRole === "JEFE";

  // Th sortable helper
  const Th = ({
    label, col, align = "left"
  }: {
    label: string; col?: SortKey; align?: "left" | "right";
  }) => (
    <th
      className={`py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 whitespace-nowrap ${align === "right" ? "text-right" : "text-left"}`}
    >
      {col ? (
        <button
          onClick={() => handleSort(col)}
          className="inline-flex items-center gap-0.5 hover:text-indigo-600 transition-colors"
        >
          {label}
          <SortIcon col={col} />
        </button>
      ) : label}
    </th>
  );

  return (
    <div className="flex-1 bg-slate-50 overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-6 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Calculator className="w-6 h-6 text-indigo-600" />
            Cuadratura de Valores
          </h1>
          <p className="text-sm text-slate-400 mt-1">Historial de cuadraturas por cliente</p>
        </div>
        <Link
          href="/formularios/nueva"
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors shadow-sm active:scale-95"
        >
          <Plus className="w-5 h-5" /> Nueva Cuadratura
        </Link>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col" style={{ minHeight: 400 }}>
          {/* Search bar */}
          <div className="p-4 border-b border-slate-100 flex items-center gap-4 bg-slate-50/50">
            <div className="relative flex-1 max-w-md">
              <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar por fecha, RUT, nombre, ID Cuadratura, marca o modelo..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <span className="text-sm text-slate-400">{sorted.length} registros</span>
          </div>

          {/* Table */}
          <div className="overflow-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <Th label="Fecha"           col="created_at" />
                  <Th label="Cliente"         col="nombre" />
                  <Th label="ID Cuadratura"   col="id_cuadratura" />
                  <Th label="Marca"           col="marca" />
                  <Th label="MOD. Vehículo" />
                  <Th label="Modelo" />
                  <Th label="Precio Final"    col="precio_final"    align="right" />
                  <Th label="Saldo Pendiente" col="saldo_pendiente" align="right" />
                  <Th label="Creado por" />
                  <th className="py-3 px-5 border-b border-slate-200 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="py-16 text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                      <p className="text-slate-400 text-sm">Cargando cuadraturas...</p>
                    </td>
                  </tr>
                ) : fetchError ? (
                  <tr>
                    <td colSpan={10} className="py-10 text-center">
                      <div className="inline-block bg-red-50 border border-red-200 rounded-xl px-6 py-4 max-w-lg">
                        <p className="text-red-700 font-bold mb-1">Error al cargar datos</p>
                        <p className="text-red-500 text-xs font-mono">{fetchError}</p>
                        <p className="text-slate-400 text-xs mt-2">
                          Revisa que todas las sentencias SQL fueron ejecutadas correctamente en Supabase.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : sorted.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-16 text-center">
                      <Calculator className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                      <p className="text-slate-500 font-medium">Sin cuadraturas</p>
                      <p className="text-slate-400 text-sm mt-1">
                        {searchTerm ? "No coincide con tu búsqueda." : "Crea la primera cuadratura."}
                      </p>
                    </td>
                  </tr>
                ) : (
                  sorted.map(c => {
                    const nombre = [c.clientes?.nombre, c.clientes?.segundo_nombre, c.clientes?.apellido]
                      .filter(Boolean).join(" ");
                    const saldo = Math.round(Number(c.saldo_pendiente ?? 0));
                    return (
                      // ── Fila NO clickeable — solo el botón navega ──
                      <tr key={c.id} className="hover:bg-slate-50/60 transition-colors group">

                        {/* Fecha */}
                        <td className="py-3 px-5 align-middle whitespace-nowrap">
                          <span className="text-sm text-slate-700 select-all">
                            {new Date(c.created_at).toLocaleDateString("es-CL")}
                          </span>
                        </td>

                        {/* Cliente */}
                        <td className="py-3 px-5 align-middle">
                          <div className="text-sm font-bold text-indigo-700 select-all">{nombre || "Sin Nombre"}</div>
                          <div className="text-xs text-slate-400 font-mono select-all">{c.clientes?.rut}</div>
                        </td>

                        {/* ID Cuadratura */}
                        <td className="p-3">
                          <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-700/10 whitespace-nowrap">
                            {c.id_cuadratura ?? `#${c.id}`}
                          </span>
                        </td>

                        {/* Marca */}
                        <td className="py-3 px-5 align-middle">
                          <span className="text-sm text-slate-700 select-all">{c.marca || "-"}</span>
                        </td>

                        {/* MOD. Vehículo */}
                        <td className="py-3 px-5 align-middle whitespace-nowrap">
                          <span className="text-sm font-mono text-slate-600 select-all">{c.cod_modelo || "-"}</span>
                        </td>

                        {/* Modelo */}
                        <td className="py-3 px-5 align-middle">
                          <span className="text-sm text-slate-700 select-all">{c.descripcion_modelo || "-"}</span>
                        </td>

                        {/* Precio Final — alineado derecha */}
                        <td className="py-3 px-5 align-middle text-right whitespace-nowrap">
                          <span className="text-sm font-semibold text-slate-800 select-all">
                            ${Math.round(Number(c.precio_final ?? 0)).toLocaleString("es-CL")}
                          </span>
                        </td>

                        {/* Saldo Pendiente — alineado derecha */}
                        <td className="py-3 px-5 align-middle text-right whitespace-nowrap">
                          <span className={`text-sm font-bold px-2 py-0.5 rounded select-all ${saldo > 0 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"}`}>
                            ${saldo.toLocaleString("es-CL")}
                          </span>
                        </td>

                        {/* Creado por */}
                        <td className="py-3 px-5 align-middle">
                          <span className="text-xs text-slate-500 truncate max-w-[140px] block select-all">
                            {c.perfiles?.nombre_completo ?? "-"}
                          </span>
                        </td>

                        {/* Acciones — único punto de navegación */}
                        <td className="py-3 px-5 align-middle">
                          <div className="flex items-center gap-1.5 justify-end">
                            <button
                              onClick={() => router.push(`/formularios/${c.id}`)}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md transition-colors"
                              title="Ver cuadratura"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Ver
                            </button>
                            {canDelete && (
                              <button
                                onClick={e => handleDelete(e, c.id)}
                                disabled={isDeleting === c.id}
                                className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                title="Eliminar cuadratura"
                              >
                                {isDeleting === c.id
                                  ? <Loader2 className="w-4 h-4 animate-spin" />
                                  : <Trash2 className="w-4 h-4" />}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
