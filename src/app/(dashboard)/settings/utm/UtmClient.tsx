"use client";

import { useState, useEffect } from "react";
import { Landmark, Save, RefreshCw, AlertTriangle, CloudDownload, Check } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

interface ParametrosSII {
  anio: number;
  mes: number; // 1-12
  utm: number | null;
  uta: number | null;
  ipc_puntos: number | null;
  ipc_mensual: number | null;
  ipc_acumulado: number | null;
  ipc_12_meses: number | null;
}

export default function UtmClient() {
  const [anio, setAnio] = useState<number>(new Date().getFullYear());
  const [data, setData] = useState<Record<number, ParametrosSII>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorSQL, setErrorSQL] = useState<boolean>(false);
  const [syncing, setSyncing] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, [anio]);

  const loadData = async () => {
    setLoading(true);
    setErrorSQL(false);
    
    // Check if table exists by trying to fetch
    const { data: records, error } = await supabase
      .from("parametros_sii")
      .select("*")
      .eq("anio", anio);

    if (error) {
      if (error.code === "42P01" || error.code === "PGRST106" || error.code === "PGRST205") { // undefined_table or not in schema cache
        setErrorSQL(true);
        setLoading(false);
        return;
      } else {
        console.error("Error loading data:", error);
        // Do not return, let it initialize the empty map so the table renders
      }
    }

    const map: Record<number, ParametrosSII> = {};
    if (records) {
      records.forEach((r: any) => {
        map[r.mes] = r;
      });
    }
    
    // Initialize empty month records if they don't exist
    for (let m = 1; m <= 12; m++) {
      if (!map[m]) {
        map[m] = {
          anio,
          mes: m,
          utm: null,
          uta: null,
          ipc_puntos: null,
          ipc_mensual: null,
          ipc_acumulado: null,
          ipc_12_meses: null
        };
      }
    }
    
    setData(map);
    setLoading(false);
  };

  const handleInputChange = (mes: number, field: keyof ParametrosSII, value: string) => {
    const parsed = value === "" ? null : parseFloat(value.replace(",", "."));
    setData(prev => ({
      ...prev,
      [mes]: {
        ...prev[mes],
        [field]: parsed
      }
    }));
  };

  const saveData = async () => {
    setSaving(true);
    const rowsToSave = Object.values(data)
      .filter(row => 
        row.utm !== null || row.uta !== null || row.ipc_puntos !== null || 
        row.ipc_mensual !== null || row.ipc_acumulado !== null || row.ipc_12_meses !== null
      )
      .map((row: any) => ({
        anio: row.anio,
        mes: row.mes,
        utm: row.utm ?? null,
        uta: row.uta ?? null,
        ipc_puntos: row.ipc_puntos ?? null,
        ipc_mensual: row.ipc_mensual ?? null,
        ipc_acumulado: row.ipc_acumulado ?? null,
        ipc_12_meses: row.ipc_12_meses ?? null
      }));

    if (rowsToSave.length > 0) {
      const { error } = await supabase
        .from("parametros_sii")
        .upsert(rowsToSave, { onConflict: "anio,mes" });

      if (!error) {
        setSuccessMsg("Datos guardados exitosamente.");
        setTimeout(() => setSuccessMsg(""), 3000);
      } else {
        console.error("Error saving:", error);
        alert(`Ocurrió un error al guardar: ${error.message || JSON.stringify(error)}`);
      }
    }
    setSaving(false);
  };

  const syncMindicador = async () => {
    setSyncing(true);
    try {
      const [utmRes, ipcRes] = await Promise.all([
        fetch(`https://mindicador.cl/api/utm/${anio}`),
        fetch(`https://mindicador.cl/api/ipc/${anio}`)
      ]);
      
      const utmData = await utmRes.json();
      const ipcData = await ipcRes.json();

      const newData = { ...data };
      
      // Update UTM
      if (utmData && utmData.serie) {
        utmData.serie.forEach((item: any) => {
          const date = new Date(item.fecha);
          if (date.getUTCFullYear() === anio) {
            const m = date.getUTCMonth() + 1;
            if (newData[m]) {
              newData[m].utm = item.valor;
              newData[m].uta = item.valor * 12; // Calculo aut. de UTA
            }
          }
        });
      }

      // Update IPC
      if (ipcData && ipcData.serie) {
        ipcData.serie.forEach((item: any) => {
          const date = new Date(item.fecha);
          if (date.getUTCFullYear() === anio) {
            const m = date.getUTCMonth() + 1;
            if (newData[m]) {
              newData[m].ipc_mensual = item.valor;
            }
          }
        });
      }

      setData(newData);
      setSuccessMsg("¡Datos sincronizados! Revisa y presiona Guardar.");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (e) {
      console.error(e);
      alert("Error al contactar a mindicador.cl");
    } finally {
      setSyncing(false);
    }
  };

  if (errorSQL) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-8 max-w-3xl mx-auto mt-8">
        <div className="flex items-center gap-3 text-red-700 mb-4">
          <AlertTriangle className="w-8 h-8" />
          <h2 className="text-xl font-bold">Falta inicializar la base de datos</h2>
        </div>
        <p className="text-red-900 mb-4">
          Para guardar estos valores necesitas crear la tabla <strong>parametros_sii</strong>. 
          Entra a la sección de SQL en Supabase y ejecuta este comando:
        </p>
        <pre className="bg-slate-900 text-emerald-400 p-4 rounded-xl text-sm overflow-x-auto">
{`create table public.parametros_sii (
  id uuid default gen_random_uuid() primary key,
  anio integer not null,
  mes integer not null,
  utm numeric,
  uta numeric,
  ipc_puntos numeric,
  ipc_mensual numeric,
  ipc_acumulado numeric,
  ipc_12_meses numeric,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (anio, mes)
);

alter table public.parametros_sii enable row level security;
create policy "Enable all actions for authenticated users" on public.parametros_sii for all to authenticated using (true) with check (true);
`}
        </pre>
        <button 
          onClick={() => loadData()}
          className="mt-6 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition"
        >
          Ya ejecuté el SQL, reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col max-w-[1200px] w-full mx-auto pb-12">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold leading-7 text-slate-900 sm:text-3xl flex items-center gap-2">
            <Landmark className="w-8 h-8 text-emerald-600" />
            Tabla UTM - UTA - IPC
          </h1>
          <p className="mt-2 text-sm text-slate-500 max-w-2xl">
            Ingresa o sincroniza automáticamente los valores. La UTA se calculará como UTM x 12 durante la sincronización.
          </p>
        </div>

        <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 p-1">
            {[anio - 1, anio, anio + 1].map(y => (
              <button
                key={y}
                onClick={() => setAnio(y)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${anio === y ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {y}
              </button>
            ))}
        </div>
      </div>

      <div className="bg-white border text-center border-slate-200 shadow-sm rounded-xl overflow-x-auto w-full">
        {loading ? (
          <div className="p-12 flex justify-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin" />
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                <th rowSpan={2} className="px-4 py-3 font-semibold text-center border-r border-slate-200">{anio}</th>
                <th rowSpan={2} className="px-4 py-3 font-semibold text-center border-r border-slate-200">UTM (1)</th>
                <th rowSpan={2} className="px-4 py-3 font-semibold text-center border-r border-slate-200">UTA (2)</th>
                <th colSpan={4} className="px-4 py-2 font-semibold text-center border-b border-slate-200">Índice de Precios al Consumidor (IPC)</th>
              </tr>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 text-xs">
                <th className="px-4 py-2 font-medium text-center border-r border-slate-200 text-slate-600">Valor en puntos (6)</th>
                <th className="px-4 py-2 font-medium text-center border-r border-slate-200 text-slate-600">Mensual (3)</th>
                <th className="px-4 py-2 font-medium text-center border-r border-slate-200 text-slate-600">Acumulado {anio} (4)</th>
                <th className="px-4 py-2 font-medium text-center">Últimos 12 meses (5)</th>
              </tr>
            </thead>
            <tbody>
              {MESES.map((mesNombre, idx) => {
                const numMes = idx + 1;
                const row = data[numMes];
                if (!row) return null;

                return (
                  <tr key={numMes} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-700 border-r border-slate-100">{mesNombre}</td>
                    <td className="px-2 py-2 border-r border-slate-100">
                      <input 
                        type="number" 
                        className="w-full bg-transparent border border-slate-200 rounded px-2 py-1 text-center focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={row.utm || ""}
                        onChange={(e) => handleInputChange(numMes, 'utm', e.target.value)}
                        placeholder="-"
                      />
                    </td>
                    <td className="px-2 py-2 border-r border-slate-100">
                       <input 
                        type="number" 
                        className="w-full bg-transparent border border-slate-200 rounded px-2 py-1 text-center focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={row.uta || ""}
                        onChange={(e) => handleInputChange(numMes, 'uta', e.target.value)}
                        placeholder="-"
                      />
                    </td>
                    <td className="px-2 py-2 border-r border-slate-100">
                       <input 
                        type="number" 
                        className="w-full bg-transparent border border-slate-200 rounded px-2 py-1 text-center focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={row.ipc_puntos || ""}
                        onChange={(e) => handleInputChange(numMes, 'ipc_puntos', e.target.value)}
                        placeholder="-"
                      />
                    </td>
                    <td className="px-2 py-2 border-r border-slate-100">
                       <input 
                        type="number" 
                        step="0.1"
                        className="w-full bg-transparent border border-slate-200 rounded px-2 py-1 text-center focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={row.ipc_mensual || ""}
                        onChange={(e) => handleInputChange(numMes, 'ipc_mensual', e.target.value)}
                        placeholder="-"
                      />
                    </td>
                    <td className="px-2 py-2 border-r border-slate-100">
                       <input 
                        type="number" 
                        step="0.1"
                        className="w-full bg-transparent border border-slate-200 rounded px-2 py-1 text-center focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={row.ipc_acumulado || ""}
                        onChange={(e) => handleInputChange(numMes, 'ipc_acumulado', e.target.value)}
                        placeholder="-"
                      />
                    </td>
                    <td className="px-2 py-2">
                       <input 
                        type="number" 
                        step="0.1"
                        className="w-full bg-transparent border border-slate-200 rounded px-2 py-1 text-center focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={row.ipc_12_meses || ""}
                        onChange={(e) => handleInputChange(numMes, 'ipc_12_meses', e.target.value)}
                        placeholder="-"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {!loading && !errorSQL && (
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
           {successMsg ? (
            <div className="text-emerald-700 bg-emerald-50 px-4 py-2 font-medium rounded-lg flex items-center gap-2 border border-emerald-200">
              <Check className="w-5 h-5 flex-shrink-0" />
              {successMsg}
            </div>
           ) : null}

           <div className="flex items-center gap-3">
              <button 
                onClick={syncMindicador}
                disabled={syncing || saving}
                className="flex items-center gap-2 px-5 py-2.5 border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 font-medium rounded-xl transition-colors disabled:opacity-50"
              >
                <CloudDownload className={`w-4 h-4 ${syncing ? 'animate-bounce' : ''}`} />
                Extraer del SII
              </button>
              
              <button 
                onClick={saveData}
                disabled={saving || syncing}
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 shadow-sm"
              >
                {saving ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                Guardar Cambios
              </button>
           </div>
        </div>
      )}

    </div>
  );
}
