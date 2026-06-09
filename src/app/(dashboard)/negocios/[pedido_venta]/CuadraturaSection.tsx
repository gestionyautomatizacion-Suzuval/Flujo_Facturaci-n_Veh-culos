"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Loader2, Calculator, ChevronDown, ExternalLink, Save, Search } from "lucide-react";
import { useRouter } from "next/navigation";

const formatCLP = (n: number) => (n != null ? Number(n).toLocaleString("es-CL") : "0");
const formatPct = (n: number) =>
  (n != null ? Number(n).toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "0.0") + "%";

interface MantencionRow {
  mantencion_10000: number;
  mantencion_20000: number;
  mantencion_30000: number;
}

interface CuadraturaRow {
  id: number;
  created_at: string;
  cod_modelo: string;
  marca: string | null;
  descripcion_modelo: string | null;
  tipo_compra: string | null;
  precio_lista: number;
  bono_marca: number;
  bono_amicar_suzuval: number;
  bono_amicar_derco: number;
  flete_grabado: number;
  precio_venta_accesorios: number;
  inscripcion: number;
  permiso_circulacion: number;
  soap_sello_verde: number;
  impuesto_verde: number;
  dcto_suzuval_zqdv: number;
  aporte_marca_derco_z126: number;
  precio_final: number;
  saldo_pendiente: number;
  perfil_id: string | null;
  cliente_id: string | null;
}

interface Props {
  negocio?: any;
  onCuadraturaLinked?: (cliente_id: string, rut: string, nombre_apellido: string) => void;
  renderValidacion?: (elemento_id: string) => React.ReactNode;
}

export default function CuadraturaSection({ negocio, onCuadraturaLinked, renderValidacion }: Props) {
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<CuadraturaRow | null>(null);
  const [clienteData, setClienteData] = useState<any>(null);
  const [mantenciones, setMantenciones] = useState<Record<number, MantencionRow>>({});
  const [error, setError] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);
  
  const [folioInput, setFolioInput] = useState(""); // Input string para el ID Cuadratura
  const [isSaving, setIsSaving] = useState(false);
  const [isLinked, setIsLinked] = useState(false);

  const supabase = createClient();
  const router = useRouter();

  // Si ya tiene una cuadratura vinculada, la cargamos
  useEffect(() => {
    if (negocio?.cuadratura_id && !hasLoaded) {
      setHasLoaded(true);
      loadCuadraturaByFolio(negocio.cuadratura_id);
    }
  }, [negocio?.cuadratura_id]);

  const loadCuadraturaByFolio = async (folioTerm: string | number) => {
    if (!folioTerm) return;
    setLoading(true);
    setError("");

    let cuadData = null;

    if (typeof folioTerm === "number") {
      const { data } = await supabase.from("cuadratura_valores_cliente").select("*").eq("id", folioTerm).maybeSingle();
      cuadData = data;
    } else {
      const term = folioTerm.trim();
      // 1. Intentar por match exacto de id_cuadratura
      let { data } = await supabase.from("cuadratura_valores_cliente").select("*").eq("id_cuadratura", term).maybeSingle();
      cuadData = data;
      
      // 2. Si no encuentra y es numérico puro, intentar por ID
      if (!cuadData && /^\d+$/.test(term)) {
        const { data: byId } = await supabase.from("cuadratura_valores_cliente").select("*").eq("id", Number(term)).maybeSingle();
        cuadData = byId;
      }
      
      // 3. Si aún no, intentar con LIKE (por si ingresó 1001 y el folio es 1001_rut)
      if (!cuadData) {
        const { data: byLike } = await supabase.from("cuadratura_valores_cliente").select("*").ilike("id_cuadratura", `${term}%`).maybeSingle();
        cuadData = byLike;
      }
    }

    if (!cuadData) {
      setError("No se encontró cuadratura con el ID: " + folioTerm);
      setSelected(null);
      setLoading(false);
      return;
    }

    // 2. Cargar cliente asociado
    let cData = null;
    if (cuadData.cliente_id) {
      const { data: cliente, error: cliErr } = await supabase
        .from("clientes")
        .select("*")
        .eq("id", cuadData.cliente_id)
        .maybeSingle();
      if (!cliErr && cliente) {
        cData = cliente;
        setClienteData(cliente);
      }
    }

    // 3. Cargar mantenciones
    const { data: mantData } = await supabase
      .from("mantencion_prepagada")
      .select("cuadratura_id, mantencion_10000, mantencion_20000, mantencion_30000")
      .eq("cuadratura_id", cuadData.id);

    const mantMap: Record<number, MantencionRow> = {};
    (mantData ?? []).forEach((m: any) => { mantMap[m.cuadratura_id] = m; });

    setSelected(cuadData as CuadraturaRow);
    setMantenciones(mantMap);
    setLoading(false);
    
    if (cData && onCuadraturaLinked) {
      const fullNombre = [cData.nombre, cData.segundo_nombre, cData.apellido, cData.segundo_apellido].filter(Boolean).join(" ").trim();
      onCuadraturaLinked(cData.id, cData.rut, fullNombre);
    }
    
    return { cuadData, cData };
  };

  const handleCargar = async () => {
    const term = folioInput.trim();
    if (!term) {
      setError("Ingresa un ID de cuadratura");
      return;
    }
    setHasLoaded(true);
    setIsLinked(false);
    await loadCuadraturaByFolio(term);
  };

  const handleVincular = async () => {
    if (!selected || !negocio?.pedido_venta) return;
    setIsSaving(true);

    const { error: updErr } = await supabase
      .from("negocios")
      .update({ cuadratura_id: selected.id })
      .eq("pedido_venta", negocio.pedido_venta);

    if (updErr) {
      alert("Error al vincular: " + updErr.message);
      setIsSaving(false);
      return;
    }

    // Si hay datos de cliente, los actualizamos o creamos en clientes_datos_negocios
    if (clienteData) {
      const { data: existingData } = await supabase
        .from("clientes_datos_negocios")
        .select("id")
        .eq("pedido_venta", negocio.pedido_venta)
        .maybeSingle();
        
      if (!existingData) {
        // Creamos el registro vacío atado al cliente y negocio
        await supabase.from("clientes_datos_negocios").insert({
          pedido_venta: negocio.pedido_venta,
          cliente_id: clienteData.id,
        });
      } else {
        // Actualizamos cliente_id por si cambió
        await supabase.from("clientes_datos_negocios").update({
          cliente_id: clienteData.id
        }).eq("id", existingData.id);
      }
      
      if (onCuadraturaLinked) {
        const fullNombre = [clienteData.nombre, clienteData.segundo_nombre, clienteData.apellido, clienteData.segundo_apellido].filter(Boolean).join(" ").trim();
        onCuadraturaLinked(clienteData.id, clienteData.rut, fullNombre);
      }
    }

    // Insertar en historial
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("negocios_historial").insert([{
      pedido_venta: negocio.pedido_venta,
      tipo_evento: "VINCULACION_CUADRATURA",
      descripcion: "Cuadratura de valores vinculada al negocio",
      usuario_email: user?.email || "Sistema"
    }]);

    setIsSaving(false);
    setIsLinked(true);
  };

  // ── Header Component ──
  const HeaderControls = () => (
    <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
          <Calculator className="w-4 h-4 text-indigo-500" /> Cuadratura de Valores
        </h4>
        {renderValidacion && renderValidacion("CUADRATURA")}
      </div>
      <div className="flex items-center gap-2">
        <div className="relative flex items-center gap-2">
          <input
            type="text"
            placeholder=""
            className="w-40 text-sm border border-slate-300 rounded-md px-3 py-1.5 focus:outline-none focus:border-indigo-500 shadow-sm"
            value={folioInput}
            onChange={(e) => setFolioInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCargar()}
          />
          <button
            onClick={handleCargar}
            className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center shadow-sm"
          >
            <Search className="w-3.5 h-3.5 mr-1.5" /> Cargar
          </button>
        </div>

        {selected && (negocio?.cuadratura_id !== selected.id || isLinked) && (
          <button
            onClick={handleVincular}
            disabled={isSaving || isLinked}
            className={`${isLinked ? "bg-emerald-600 hover:bg-emerald-700" : "bg-indigo-600 hover:bg-indigo-700"} text-white px-3 py-1.5 rounded-md text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50`}
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {isLinked ? "Guardado" : "Guardar"}
          </button>
        )}
      </div>
    </div>
  );

  // ── Empty state ──
  if (!selected && !loading && !error) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8">
        <HeaderControls />
        <div className="p-5 text-sm text-slate-400 text-center">
          Ingresa un ID de cuadratura y haz clic en "Cargar" para visualizar y vincular la cuadratura.
        </div>
      </div>
    );
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-8 p-8 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8">
        <HeaderControls />
        <div className="p-5 text-sm text-amber-700 bg-amber-50 rounded-b-xl">⚠️ {error}</div>
      </div>
    );
  }

  // ── Loaded with data ──
  const data = selected;
  if (!data) return null;

  const calcTotalPapeles =
    (data.inscripcion || 0) + (data.permiso_circulacion || 0) + (data.soap_sello_verde || 0) + (data.impuesto_verde || 0);
  const calcPrecioContado = (data.precio_lista || 0) - (data.bono_marca || 0);
  const calcTotalAPagar =
    (data.precio_final || 0) + calcTotalPapeles - (data.dcto_suzuval_zqdv || 0) - (data.aporte_marca_derco_z126 || 0);
  const pctOf = (v: number) => (data.precio_lista ? (v / data.precio_lista) * 100 : 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8">
      <HeaderControls />

      {/* Header Info */}
      <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-slate-500 font-bold text-xs uppercase tracking-wider">
            Folio: <span className="text-indigo-600">{(data as any).id_cuadratura || `#${data.id}`}</span>
          </span>
          <button
            onClick={() => router.push(`/formularios/${data.id}`)}
            className="px-3 py-1.5 text-indigo-600 hover:text-indigo-800 text-xs font-medium rounded-md hover:bg-indigo-50 transition-colors flex items-center gap-1.5 border border-indigo-200"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Editar Cuadratura
          </button>
        </div>

        {/* Vehículo y Cliente info */}
        <div className="flex flex-wrap gap-3 text-xs bg-white border border-slate-200 rounded-md px-3 py-2 w-full justify-between items-center">
          <div className="flex flex-wrap gap-3">
            {data.marca && <span className="font-bold uppercase text-slate-600">{data.marca}</span>}
            {data.cod_modelo && <span className="font-bold uppercase text-slate-600">{data.cod_modelo}</span>}
            {data.descripcion_modelo && <span className="font-bold uppercase text-slate-600">{data.descripcion_modelo}</span>}
          </div>
          {clienteData && (
            <div className="text-slate-500 font-medium border-l border-slate-200 pl-3">
              Cliente: <span className="text-slate-800 font-bold">{clienteData.rut} - {[clienteData.nombre, clienteData.segundo_nombre, clienteData.apellido, clienteData.segundo_apellido].filter(Boolean).join(" ")}</span>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">

          {/* LADO IZQUIERDO */}
          <div className="flex flex-col gap-5">
            {/* NEGOCIO */}
            <div className="border border-slate-300 flex">
              <div className="w-10 bg-slate-100 border-r border-slate-300 flex items-center justify-center">
                <span className="transform -rotate-90 whitespace-nowrap font-bold text-xs text-slate-600 tracking-widest">NEGOCIO</span>
              </div>
              <div className="flex-1 flex flex-col">
                <div className="flex border-b border-slate-300 text-xs h-[26px] bg-slate-50">
                  <div className="w-1/2 border-r border-slate-300" />
                  <div className="w-1/4 border-r border-slate-300 font-bold text-center text-slate-600 flex items-center justify-center">BRUTO</div>
                  <div className="w-1/4 font-bold text-center text-slate-600 flex items-center justify-center">NETO</div>
                </div>
                {[
                  { label: "Tipo Venta", valor: data.tipo_compra || "-", noNeto: true },
                  { label: "Precio Lista", v: data.precio_lista },
                  { label: "Bono Marca", v: data.bono_marca },
                  { label: "Precio Contado", v: calcPrecioContado, bold: true },
                  { label: "Bono Amicar Suzuval", v: data.bono_amicar_suzuval },
                  { label: "Bono Amicar Derco", v: data.bono_amicar_derco },
                  { label: "Flete + Grabado", v: data.flete_grabado },
                  { label: "Accesorios/Mantención", v: data.precio_venta_accesorios },
                  { label: "Mantención Prep. 10.000 km", v: mantenciones[data.id]?.mantencion_10000 ?? 0 },
                  { label: "Mantención Prep. 20.000 km", v: mantenciones[data.id]?.mantencion_20000 ?? 0 },
                  { label: "Mantención Prep. 30.000 km", v: mantenciones[data.id]?.mantencion_30000 ?? 0 },
                  { label: "Precio Final", v: data.precio_final, bold: true },
                ].map((row: any, i) => (
                  <div key={i} className={`flex border-b border-slate-300 text-xs h-[30px] ${row.bold ? "bg-orange-50 font-bold" : ""}`}>
                    <div className="w-1/2 px-2 flex items-center border-r border-slate-300 font-medium">{row.label}</div>
                    {row.noNeto ? (
                      <div className="w-1/2 flex items-center justify-center text-slate-700">{row.valor}</div>
                    ) : (
                      <>
                        <div className="w-1/4 border-r border-slate-300 flex items-center justify-center font-mono">{formatCLP(row.v || 0)}</div>
                        <div className="w-1/4 flex items-center justify-center font-mono text-slate-600 bg-slate-50/50">{formatCLP(Math.round((row.v || 0) / 1.19))}</div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* APORTES */}
            <div className="border border-slate-300 flex">
              <div className="w-10 bg-slate-100 border-r border-slate-300 flex items-center justify-center">
                <span className="transform -rotate-90 whitespace-nowrap font-bold text-xs text-slate-600 tracking-widest">APORTES</span>
              </div>
              <div className="flex-1 flex flex-col">
                {[
                  { label: "Suzuval - ZQDV", v: data.dcto_suzuval_zqdv },
                  { label: "Derco - Z126",   v: data.aporte_marca_derco_z126 },
                ].map((row, i) => (
                  <div key={i} className={`flex text-xs h-[30px] ${i === 0 ? "border-b border-slate-300" : ""}`}>
                    <div className="w-1/2 px-2 flex items-center justify-between border-r border-slate-300 font-medium">
                      <span>{row.label}</span>
                      <span className="text-slate-400 font-mono">{formatPct(pctOf(row.v || 0))}</span>
                    </div>
                    <div className="w-1/4 border-r border-slate-300 flex items-center justify-center font-mono">{formatCLP(row.v || 0)}</div>
                    <div className="w-1/4 flex items-center justify-center font-mono text-slate-600 bg-slate-50">{formatCLP(Math.round((row.v || 0) / 1.19))}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* PAPELES */}
            <div className="border border-slate-300 flex">
              <div className="w-10 bg-slate-100 border-r border-slate-300 flex items-center justify-center">
                <span className="transform -rotate-90 whitespace-nowrap font-bold text-xs text-slate-600 tracking-widest text-center leading-tight">PAPELES</span>
              </div>
              <div className="flex-1 flex flex-col">
                {[
                  { label: "Inscripción",       v: data.inscripcion },
                  { label: "Permiso Circulación", v: data.permiso_circulacion },
                  { label: "SOAP + Sello Verde", v: data.soap_sello_verde },
                  { label: (
                      <>
                        Impuesto Verde (
                        <a href="https://www4.sii.cl/calcImpVehiculoNuevoInternet/internet.html" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                          Revisar en SII.cl
                        </a>
                        )
                      </>
                    ),    v: data.impuesto_verde },
                ].map((row, i) => (
                  <div key={i} className="flex border-b border-slate-300 text-xs h-[30px]">
                    <div className="w-1/2 px-2 flex items-center border-r border-slate-300 font-medium">{row.label}</div>
                    <div className="w-1/2 flex items-center justify-center font-mono">{formatCLP(row.v || 0)}</div>
                  </div>
                ))}
                <div className="flex text-xs h-[30px] bg-orange-50 font-bold">
                  <div className="w-1/2 px-2 flex items-center border-r border-slate-300">Total Papeles</div>
                  <div className="w-1/2 flex items-center justify-center font-mono">{formatCLP(calcTotalPapeles)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* LADO DERECHO */}
          <div className="flex flex-col gap-5">
            {/* TOTALES */}
            <div className="border border-slate-400">
              <div className="flex border-b border-slate-400 text-sm h-[34px]">
                <div className="flex-[1.5] px-2 flex items-center border-r border-slate-400 font-bold bg-slate-100">Total Compra</div>
                <div className="flex-1 flex items-center justify-center font-bold text-slate-800 bg-white">${formatCLP(calcTotalAPagar)}</div>
              </div>
              <div className="flex text-sm h-[34px]">
                <div className="flex-[1.5] px-2 flex items-center justify-between border-r border-slate-400 font-bold bg-slate-100">
                  <span>Total Factura</span>
                  <span className="text-slate-400 font-normal text-xs font-mono">(${formatCLP(Math.round(((data.precio_final || 0) - (data.dcto_suzuval_zqdv || 0) - (data.aporte_marca_derco_z126 || 0)) / 1.19))})</span>
                </div>
                <div className="flex-1 flex items-center justify-center font-bold text-slate-800 bg-white">
                  ${formatCLP((data.precio_final || 0) - (data.dcto_suzuval_zqdv || 0) - (data.aporte_marca_derco_z126 || 0))}
                </div>
              </div>
            </div>

            {/* SALDO */}
            <div className="border border-slate-400 overflow-hidden">
              <div className="flex border-b border-slate-400 text-sm font-bold">
                <div className="flex-[1.5] py-2.5 px-3 border-r border-slate-400 flex items-center justify-center bg-slate-100 text-slate-700 uppercase text-xs">Total a Pagar</div>
                <div className="flex-1 flex items-center justify-center font-mono text-slate-900 bg-white text-base">${formatCLP(calcTotalAPagar)}</div>
              </div>
              {(data.saldo_pendiente || 0) > 0 ? (
                <>
                  <div className="py-1.5 text-center text-xs font-bold bg-red-100 text-red-800">Negocio con Saldo Pendiente</div>
                  <div className="flex text-sm font-bold bg-red-50 text-red-700">
                    <div className="flex-[1.5] py-1.5 px-3 border-r border-red-200 flex items-center justify-end text-xs">Saldo Pendiente:</div>
                    <div className="flex-1 flex items-center justify-center font-mono text-base">${formatCLP(data.saldo_pendiente)}</div>
                  </div>
                </>
              ) : (
                <div className="py-2 text-center text-sm font-bold bg-emerald-100 text-emerald-800">✓ Negocio con Saldo Completo</div>
              )}
            </div>

            {/* RESUMEN DESCUENTOS */}
            <div className="flex text-xs border border-slate-400 font-bold">
              <div className="w-20 border-r border-slate-400 flex items-center justify-center p-2 text-center text-slate-500 bg-slate-50 uppercase">Resumen<br/>Dctos</div>
              <div className="flex-1 flex flex-col bg-sky-50">
                {([
                  { label: "Suzuval ZQDV",    v: data.dcto_suzuval_zqdv,       pct: pctOf(data.dcto_suzuval_zqdv || 0) },
                  { label: "Amicar Suzuval",  v: data.bono_amicar_suzuval,     pct: pctOf(data.bono_amicar_suzuval || 0) },
                  { label: "Total Suzuval",    v: (data.dcto_suzuval_zqdv || 0) + (data.bono_amicar_suzuval || 0), pct: pctOf((data.dcto_suzuval_zqdv || 0) + (data.bono_amicar_suzuval || 0)), hl: true },
                  { label: "Derco Z126",       v: data.aporte_marca_derco_z126, pct: pctOf(data.aporte_marca_derco_z126 || 0) },
                  { label: "Amicar Derco",    v: data.bono_amicar_derco,       pct: pctOf(data.bono_amicar_derco || 0) },
                  { label: "Total Derco",      v: (data.aporte_marca_derco_z126 || 0) + (data.bono_amicar_derco || 0), pct: pctOf((data.aporte_marca_derco_z126 || 0) + (data.bono_amicar_derco || 0)), hl: true },
                ] as const).map((r, idx) => (
                  <div key={idx} className={`flex border-b border-slate-300 py-1 ${(r as any).hl ? "bg-sky-200" : ""}`}>
                    <div className="flex-[2] border-r border-slate-300 px-2">{r.label}</div>
                    <div className="w-14 border-r border-slate-300 text-center">{formatPct(r.pct)}</div>
                    <div className="flex-1 text-right pr-2 font-mono">{(r.v || 0) ? formatCLP(r.v as number) : ""}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
