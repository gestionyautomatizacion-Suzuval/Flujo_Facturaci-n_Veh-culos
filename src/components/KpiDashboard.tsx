"use client";

import { useState, useCallback } from "react";
import PedidosTable, { Pedido } from "./PedidosTable";
import { Car, AlertCircle, CheckCircle2, Activity, CalendarRange, LucideIcon } from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  Car,
  AlertCircle,
  CheckCircle2,
  Activity,
  CalendarRange
};

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
export interface KpiStat {
  name: string;
  value: string;
  iconName: string;
  color: string;           // Clase Tailwind para el ícono, ej. "text-blue-500"
  bg: string;              // Clase Tailwind para el fondo del ícono, ej. "bg-blue-50"
  accentHex: string;       // Color hex para el borde activo de la tarjeta
  estadoFiltro: string;    // Valor exacto del campo `estado` en la DB
}

interface KpiDashboardProps {
  stats: KpiStat[];
  userRole: string;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------
export default function KpiDashboard({ stats, userRole }: KpiDashboardProps) {
  const [selectedStat, setSelectedStat] = useState<KpiStat | null>(null);
  const [tableData, setTableData] = useState<Pedido[] | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCardClick = useCallback(
    async (stat: KpiStat) => {
      // Si ya está seleccionada la misma tarjeta, deseleccionar (toggle)
      if (selectedStat?.estadoFiltro === stat.estadoFiltro) {
        setSelectedStat(null);
        setTableData(null);
        return;
      }

      setSelectedStat(stat);
      setLoading(true);
      setTableData(null);

      try {
        const res = await fetch(
          `/api/pedidos?estado=${encodeURIComponent(stat.estadoFiltro)}`
        );
        if (!res.ok) throw new Error("Error al obtener los pedidos");
        const json = await res.json();
        setTableData(json.data ?? []);
      } catch (err) {
        console.error(err);
        setTableData([]);
      } finally {
        setLoading(false);
      }
    },
    [selectedStat]
  );

  return (
    <div>
      {/* ─── Grid de tarjetas KPI ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {stats.map((stat) => {
          const isActive = selectedStat?.estadoFiltro === stat.estadoFiltro;
          const Icon = ICON_MAP[stat.iconName] || Car; // Fallback

          return (
            <button
              key={stat.name}
              onClick={() => handleCardClick(stat)}
              aria-pressed={isActive}
              className={[
                "group relative w-full overflow-hidden rounded-2xl bg-white p-6 text-left",
                "border transition-all duration-200",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500",
                isActive
                  ? "shadow-lg -translate-y-1"
                  : "shadow-sm hover:shadow-md hover:-translate-y-0.5 border-slate-100",
              ].join(" ")}
              style={
                isActive
                  ? {
                      borderColor: stat.accentHex,
                      boxShadow: `0 8px 24px -4px ${stat.accentHex}33`,
                    }
                  : {}
              }
            >
              {/* Indicador activo (barra superior) */}
              {isActive && (
                <span
                  className="absolute inset-x-0 top-0 h-1 rounded-t-2xl"
                  style={{ backgroundColor: stat.accentHex }}
                />
              )}

              {/* Ícono */}
              <div
                className={`absolute right-4 top-5 rounded-xl p-3 transition-transform duration-200 group-hover:scale-110 ${stat.bg}`}
              >
                <Icon className={`h-6 w-6 ${stat.color}`} />
              </div>

              {/* Contenido */}
              <p className="pr-12 text-sm font-medium text-slate-500">
                {stat.name}
              </p>
              <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
                {stat.value}
              </p>

              {/* Hint de clic */}
              <p
                className={`mt-1 text-xs font-medium transition-opacity duration-200 ${
                  isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                }`}
                style={{ color: stat.accentHex }}
              >
                {isActive ? "Clic para cerrar ↑" : "Ver detalle →"}
              </p>
            </button>
          );
        })}
      </div>

      {/* ─── Sección de tabla ─────────────────────────────────────────────── */}
      <PedidosTable
        data={tableData}
        loading={loading}
        selectedCard={selectedStat?.estadoFiltro ?? null}
        cardLabel={selectedStat?.name ?? null}
        cardColor={selectedStat?.accentHex ?? "#3b82f6"}
        userRole={userRole}
      />
    </div>
  );
}
