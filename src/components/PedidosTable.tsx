"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Search,
  Inbox,
  MousePointerClick,
  Loader2,
  Download,
  RefreshCw,
} from "lucide-react";
import * as XLSX from "xlsx";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
export interface Pedido {
  interno: string;
  pedido_venta: string;
  nombre_apellido: string;
  rut: string;
  marca: string;
  modelo: string;
  color: string;
  suc_vta: string;
  vendedor_nombre: string;
  tipo_compra: string;
  estado: string;
  created_at: string;
}

interface SortConfig {
  key: keyof Pedido | null;
  direction: "asc" | "desc";
}

interface PedidosTableProps {
  data: Pedido[] | null;
  loading: boolean;
  selectedCard: string | null;
  cardLabel: string | null;
  cardColor: string;
  userRole?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const ESTADO_BADGE: Record<string, { label: string; className: string }> = {
  PARA_REVISIÓN: {
    label: "Pendiente Revisión",
    className: "bg-blue-100 text-blue-700",
  },
  REVISADO_EN_ESPERA: {
    label: "En Revisión",
    className: "bg-amber-100 text-amber-700",
  },
  REVISADO_OK: {
    label: "OK Revisado",
    className: "bg-emerald-100 text-emerald-700",
  },
  FACTURADO: {
    label: "Facturado",
    className: "bg-purple-100 text-purple-700",
  },
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatVendedor(email: string) {
  // Muestra solo la parte antes del @ para ahorrar espacio
  return email?.split("@")[0] ?? email ?? "—";
}

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------
function SortIcon({
  columnKey,
  sortConfig,
}: {
  columnKey: keyof Pedido;
  sortConfig: SortConfig;
}) {
  if (sortConfig.key !== columnKey)
    return <ChevronsUpDown className="ml-1 inline h-3 w-3 opacity-40" />;
  return sortConfig.direction === "asc" ? (
    <ChevronUp className="ml-1 inline h-3 w-3 text-blue-600" />
  ) : (
    <ChevronDown className="ml-1 inline h-3 w-3 text-blue-600" />
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
const PAGE_SIZE_OPTIONS = [10, 25, 50];

export default function PedidosTable({
  data,
  loading,
  selectedCard,
  cardLabel,
  cardColor,
  userRole,
}: PedidosTableProps) {
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: null,
    direction: "asc",
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Resetear página cuando cambie la búsqueda
  const handleSearch = (v: string) => {
    setSearch(v);
    setPage(1);
  };

  const [isSyncing, setIsSyncing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleExport = (format: "excel" | "csv") => {
    if (!processed.length || !selectedCard) return;

    const dateStr = new Date().toLocaleDateString("es-CL").replace(/\//g, "-");
    const safeStateName = selectedCard.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    const fileName = `pedidos_${safeStateName}_${dateStr}`;

    const ws = XLSX.utils.json_to_sheet(processed);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pedidos");

    if (format === "excel") {
      XLSX.writeFile(wb, `${fileName}.xlsx`);
    } else {
      XLSX.writeFile(wb, `${fileName}.csv`, { bookType: "csv" });
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setToastMessage(null);
    try {
      const res = await fetch("/api/sync-sheets", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Error en sincronización");
      setToastMessage("✓ Google Sheet actualizado correctamente");
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error(err);
      setToastMessage("❌ Error al sincronizar con Google Sheets");
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setIsSyncing(false);
    }
  };

  // Sorting
  const handleSort = (key: keyof Pedido) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
    setPage(1);
  };

  // Datos procesados: filtrar + ordenar
  const processed = useMemo(() => {
    if (!data) return [];
    const term = search.toLowerCase();
    let filtered = data.filter((row) => {
      if (!term) return true;
      return (
        row.pedido_venta?.toLowerCase().includes(term) ||
        row.interno?.toLowerCase().includes(term) ||
        row.nombre_apellido?.toLowerCase().includes(term) ||
        row.rut?.toLowerCase().includes(term) ||
        row.marca?.toLowerCase().includes(term) ||
        row.modelo?.toLowerCase().includes(term) ||
        row.suc_vta?.toLowerCase().includes(term) ||
        row.vendedor_nombre?.toLowerCase().includes(term)
      );
    });

    if (sortConfig.key) {
      const k = sortConfig.key;
      filtered = [...filtered].sort((a, b) => {
        const av = (a[k] ?? "") as string;
        const bv = (b[k] ?? "") as string;
        const cmp = av.localeCompare(bv, "es", { sensitivity: "base" });
        return sortConfig.direction === "asc" ? cmp : -cmp;
      });
    }
    return filtered;
  }, [data, search, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(processed.length / pageSize));
  const paginated = processed.slice((page - 1) * pageSize, page * pageSize);

  // ─── Estado: sin selección ───────────────────────────────────────────────
  if (!selectedCard) {
    return (
      <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white py-16 text-center shadow-sm">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
          <MousePointerClick className="h-8 w-8 text-slate-400" />
        </div>
        <p className="text-base font-semibold text-slate-700">
          Selecciona una tarjeta para desglosar el detalle de los pedidos
        </p>
        <p className="mt-1 text-sm text-slate-400">
          Haz clic en cualquiera de las tarjetas superiores para filtrar y ver
          los pedidos asociados.
        </p>
      </div>
    );
  }

  // ─── Estado: cargando ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white py-16 shadow-sm">
        <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
        <p className="mt-4 text-sm text-slate-500">Cargando pedidos…</p>
      </div>
    );
  }

  // ─── Columnas de la tabla ─────────────────────────────────────────────────
  const columns: { key: keyof Pedido; label: string; sortable?: boolean }[] = [
    { key: "pedido_venta", label: "N° Pedido", sortable: true },
    { key: "interno", label: "Interno", sortable: true },
    { key: "nombre_apellido", label: "Cliente", sortable: true },
    { key: "rut", label: "RUT", sortable: false },
    { key: "marca", label: "Marca", sortable: true },
    { key: "modelo", label: "Modelo", sortable: true },
    { key: "color", label: "Color", sortable: false },
    { key: "suc_vta", label: "Sucursal", sortable: true },
    { key: "vendedor_nombre", label: "Vendedor", sortable: true },
    { key: "tipo_compra", label: "Tipo Compra", sortable: true },
    { key: "estado", label: "Estado", sortable: true },
    { key: "created_at", label: "Creación", sortable: true },
  ];

  // ─── Render principal ─────────────────────────────────────────────────────
  return (
    <div className="mt-8 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      {/* Cabecera de la sección */}
      <div
        className="flex flex-col gap-3 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
        style={{ borderLeftWidth: 4, borderLeftColor: cardColor, borderLeftStyle: "solid" }}
      >
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            {cardLabel}
          </h2>
          <p className="text-xs text-slate-400">
            {processed.length} registro{processed.length !== 1 ? "s" : ""}{" "}
            encontrado{processed.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Buscador y Botones */}
        <div className="flex w-full flex-col sm:w-auto sm:flex-row items-center gap-3">
          
          {/* Botones de acción (Export / Sync) */}
          <div className="flex w-full sm:w-auto items-center gap-2 justify-end">
            {(userRole === "ADMIN" || userRole === "ADMINISTRATIVO") && (
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Sincronizar Google Sheet"
              >
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">Sincronizar Sheet</span>
              </button>
            )}

            <div className="relative group">
              <button className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                <Download className="h-4 w-4" />
                <span>Exportar</span>
                <ChevronDown className="h-3 w-3" />
              </button>
              {/* Dropdown Menu */}
              <div className="absolute right-0 mt-1 hidden w-36 flex-col rounded-xl border border-slate-100 bg-white p-1 shadow-lg group-hover:flex z-10">
                <button
                  onClick={() => handleExport("excel")}
                  className="rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  Excel (.xlsx)
                </button>
                <button
                  onClick={() => handleExport("csv")}
                  className="rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  CSV (.csv)
                </button>
              </div>
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por cliente, pedido, RUT…"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>
      </div>

      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg">
          {toastMessage}
        </div>
      )}

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="sticky left-0 bg-slate-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                #
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable && handleSort(col.key)}
                  className={`whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 ${
                    col.sortable
                      ? "cursor-pointer select-none hover:text-slate-800"
                      : ""
                  }`}
                >
                  {col.label}
                  {col.sortable && (
                    <SortIcon columnKey={col.key} sortConfig={sortConfig} />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginated.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="py-16 text-center text-sm text-slate-400"
                >
                  <div className="flex flex-col items-center gap-3">
                    <Inbox className="h-10 w-10 text-slate-300" />
                    <span>No hay pedidos que coincidan con tu búsqueda.</span>
                  </div>
                </td>
              </tr>
            ) : (
              paginated.map((row, i) => {
                const badge = ESTADO_BADGE[row.estado] ?? {
                  label: row.estado,
                  className: "bg-slate-100 text-slate-600",
                };
                const rowNum = (page - 1) * pageSize + i + 1;
                const isEven = i % 2 === 0;
                return (
                  <tr
                    key={row.pedido_venta}
                    className={`group transition-colors duration-75 ${
                      isEven ? "bg-white" : "bg-slate-50/60"
                    } hover:bg-blue-50/50`}
                  >
                    <td className="sticky left-0 px-4 py-2.5 text-xs font-medium text-slate-400">
                      {rowNum}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs font-semibold text-slate-800">
                      {row.pedido_venta ? (
                        <Link
                          href={`/negocios/${row.pedido_venta}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                        >
                          {row.pedido_venta}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-slate-600">
                      {row.interno || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-medium text-slate-800">
                      {row.nombre_apellido || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-slate-500">
                      {row.rut || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-700">
                      {row.marca || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-600">
                      {row.modelo || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500">
                      {row.color || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-600">
                      {row.suc_vta || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-600">
                      {formatVendedor(row.vendedor_nombre)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-600">
                      {row.tipo_compra || "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-400">
                      {formatDate(row.created_at)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pie: tamaño de página + paginación */}
      {processed.length > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-6 py-3 sm:flex-row">
          {/* Filas por página */}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Filas por página:</span>
            {PAGE_SIZE_OPTIONS.map((size) => (
              <button
                key={size}
                onClick={() => {
                  setPageSize(size);
                  setPage(1);
                }}
                className={`rounded-lg px-2.5 py-1 font-medium transition ${
                  pageSize === size
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {size}
              </button>
            ))}
          </div>

          {/* Controles de página */}
          <div className="flex items-center gap-1">
            <span className="mr-2 text-xs text-slate-400">
              Pág. {page} de {totalPages}
            </span>
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="rounded-lg px-2 py-1 text-xs text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
            >
              «
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg px-2 py-1 text-xs text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
            >
              ‹
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg px-2 py-1 text-xs text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
            >
              ›
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className="rounded-lg px-2 py-1 text-xs text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
            >
              »
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
