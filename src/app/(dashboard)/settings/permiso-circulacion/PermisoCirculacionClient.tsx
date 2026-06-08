"use client";

import { useState, useEffect, useCallback } from "react";
import { Calculator, Save, AlertCircle, Loader2, Check } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

interface ParametrosSII {
  id: string;
  anio: number;
  mes: number;
  utm: number | null;
}

export default function PermisoCirculacionClient() {
  const [anio] = useState<number>(new Date().getFullYear());
  const [utmData, setUtmData] = useState<Record<number, ParametrosSII>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [calculoPcId, setCalculoPcId] = useState<string | null>(null);

  // Valores de Vehículo
  const [valorVehiculo, setValorVehiculo] = useState<number>(0);
  const [mesFacturaA, setMesFacturaA] = useState<number>(new Date().getMonth() + 1);
  const [mesFacturaB, setMesFacturaB] = useState<number>(13 - (new Date().getMonth() + 1));
  const [selloVerde, setSelloVerde] = useState<number>(4000);

  // Valores de Papeles
  const [inscripcion, setInscripcion] = useState<number>(89560);
  const [permisoCirculacion, setPermisoCirculacion] = useState<number>(0);
  const [seguroObligatorio, setSeguroObligatorio] = useState<number>(33000);
  const [impuestoVerde, setImpuestoVerde] = useState<number>(0);

  // Configuración Adicional
  const [modificarValor, setModificarValor] = useState<string>("NO");
  const [facturarProximoMes, setFacturarProximoMes] = useState<string>("NO");

  const supabase = createClient();

  const fetchData = useCallback(async () => {
    setLoading(true);
    
    // 1. Fetch UTMs del año actual
    const { data: utms } = await supabase
      .from("parametros_sii")
      .select("id, anio, mes, utm")
      .eq("anio", anio);

    const utmMap: Record<number, ParametrosSII> = {};
    if (utms) {
      utms.forEach((r: any) => { utmMap[r.mes] = r; });
    }
    setUtmData(utmMap);

    // 2. Fetch configuración Singleton de calculo_pc
    const { data: pcConfig } = await supabase
      .from("calculo_pc")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (pcConfig) {
      setCalculoPcId(pcConfig.id);
      setInscripcion(Number(pcConfig.inscripcion) || 0);
      setSeguroObligatorio(Number(pcConfig.seguro_obligatorio) || 0);
      setSelloVerde(Number(pcConfig.sello_verde) || 0);
      setImpuestoVerde(Number(pcConfig.impuesto_verde) || 0);
      setMesFacturaA(pcConfig.mes_factura_a || new Date().getMonth() + 1);
      setMesFacturaB(pcConfig.mes_factura_b || 13 - (new Date().getMonth() + 1));
      setFacturarProximoMes(pcConfig.facturar_proximo_mes || "NO");
      setModificarValor(pcConfig.modificar_valor_vehiculo || "NO");
    }

    setLoading(false);
  }, [anio, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Guardar en Base de Datos
  const handleSave = async () => {
    if (!calculoPcId) return;
    setSaving(true);
    
    // Identificar el ID del parametro_sii correspondiente al mes y año seleccionado
    const paramSiiId = utmData[mesFacturaA]?.id || null;

    const { error } = await supabase
      .from("calculo_pc")
      .update({
        inscripcion,
        seguro_obligatorio: seguroObligatorio,
        sello_verde: selloVerde,
        impuesto_verde: impuestoVerde,
        mes_factura_a: mesFacturaA,
        mes_factura_b: mesFacturaB,
        facturar_proximo_mes: facturarProximoMes,
        modificar_valor_vehiculo: modificarValor,
        parametro_sii_id: paramSiiId
      })
      .eq("id", calculoPcId);

    setSaving(false);
    if (!error) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } else {
      alert("Error al guardar: " + error.message);
    }
  };

  // Cálculos derivados
  const mesUtm = mesFacturaA;
  const valorUtmMes = utmData[mesUtm]?.utm || 0;
  
  const netoVehiculo = Math.round(valorVehiculo / 1.19);

  let tramoCalculado = 0;
  let permisoMarzoCalculado = 0;

  if (valorUtmMes > 0 && valorVehiculo > 0) {
    const d5 = valorVehiculo;
    const d6 = valorUtmMes;
    
    const neto = Math.round(d5 / 1.19);
    const limite1 = d6 * 60;
    const limite2 = d6 * 120;
    const limite3 = d6 * 250;
    const limite4 = d6 * 400;

    if (d5 >= d6 * 1.19 && d5 <= d6 * 60 * 1.19) {
      tramoCalculado = 1;
    } else if (d5 > d6 * 60 * 1.19 && d5 <= d6 * 120 * 1.19) {
      tramoCalculado = 2;
    } else if (d5 > d6 * 120 * 1.19 && d5 <= d6 * 250 * 1.19) {
      tramoCalculado = 3;
    } else if (d5 > d6 * 250 * 1.19 && d5 <= d6 * 400 * 1.19) {
      tramoCalculado = 4;
    } else if (d5 > d6 * 400 * 1.19) {
      tramoCalculado = 5;
    }

    let porcentaje = 0;
    let deduccion = 0;
    if (tramoCalculado === 1) { porcentaje = 0.01; deduccion = 0; }
    else if (tramoCalculado === 2) { porcentaje = 0.02; deduccion = d6 * 0.6; }
    else if (tramoCalculado === 3) { porcentaje = 0.03; deduccion = d6 * 1.8; }
    else if (tramoCalculado === 4) { porcentaje = 0.04; deduccion = d6 * 4.3; }
    else if (tramoCalculado === 5) { porcentaje = 0.045; deduccion = d6 * 6.3; }

    permisoMarzoCalculado = Math.round((neto * porcentaje) - deduccion);
  }

  useEffect(() => {
    if (permisoMarzoCalculado > 0) {
      const mesesAPagar = mesFacturaB;
      const proporcional = Math.round((permisoMarzoCalculado / 12) * mesesAPagar);
      setPermisoCirculacion(proporcional);
    } else {
      setPermisoCirculacion(0);
    }
  }, [permisoMarzoCalculado, mesFacturaB]);

  const totalPapeles = inscripcion + permisoCirculacion + seguroObligatorio + impuestoVerde;
  const permisoMarzoAproximado = permisoMarzoCalculado;

  return (
    <div className="flex flex-col max-w-[1200px] w-full mx-auto pb-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold leading-7 text-slate-900 sm:truncate sm:text-3xl sm:tracking-tight flex items-center gap-2">
          <Calculator className="w-8 h-8 text-indigo-600" />
          Cálculo Permisos de Circulación
        </h1>
        <p className="mt-2 text-sm text-slate-500 max-w-2xl">
          Simulador para el cálculo de Permiso de Circulación e Inscripción. Los valores de la UTM se obtienen automáticamente del mantenedor.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Lado Izquierdo - Tablas Principales */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Tabla Vehículo */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800">Vehículo</h2>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Detalle del Vehículo</span>
            </div>
            <div className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="w-1/3 bg-slate-50 border-r border-slate-200"></th>
                    <th className="w-1/3 py-2 px-4 text-center font-medium text-slate-600 border-r border-slate-200">Bruto</th>
                    <th className="w-1/3 py-2 px-4 text-center font-medium text-slate-600">Neto</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="py-3 px-4 font-medium text-slate-700 bg-slate-50 border-r border-slate-200">Valor final Vehículo</td>
                    <td className="p-0 border-r border-slate-200">
                      <input 
                        type="number" 
                        value={valorVehiculo || ""} 
                        onChange={(e) => setValorVehiculo(Number(e.target.value))}
                        className="w-full h-full min-h-[44px] px-4 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-indigo-50 transition-colors"
                        placeholder="0"
                      />
                    </td>
                    <td className="py-3 px-4 text-center bg-slate-50 text-slate-600 font-medium">{netoVehiculo.toLocaleString("es-CL")}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-3 px-4 font-medium text-slate-700 bg-slate-50 border-r border-slate-200">Valor UTM Mes</td>
                    <td colSpan={2} className="py-3 px-4 text-center bg-yellow-100 font-bold text-yellow-800 border-l border-yellow-200">
                      {loading ? "Cargando..." : valorUtmMes ? valorUtmMes.toLocaleString("es-CL") : "UTM No Configurada"}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-3 px-4 font-medium text-slate-700 bg-slate-50 border-r border-slate-200">Mes Factura</td>
                    <td className="p-0 border-r border-slate-200">
                      <input 
                        type="number" 
                        value={mesFacturaA || ""} 
                        onChange={(e) => setMesFacturaA(Number(e.target.value))}
                        className="w-full h-full min-h-[44px] px-4 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-indigo-50 transition-colors"
                        min={1} max={12}
                      />
                    </td>
                    <td className="p-0">
                      <input 
                        type="number" 
                        value={mesFacturaB || ""} 
                        onChange={(e) => setMesFacturaB(Number(e.target.value))}
                        className="w-full h-full min-h-[44px] px-4 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-indigo-50 transition-colors"
                      />
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-3 px-4 font-medium text-slate-700 bg-slate-50 border-r border-slate-200">Tramo</td>
                    <td colSpan={2} className="py-3 px-4 text-center bg-slate-50 text-slate-600 font-medium">
                      {tramoCalculado}
                    </td>
                  </tr>
                  <tr className="">
                    <td className="py-3 px-4 font-medium text-slate-700 bg-slate-50 border-r border-slate-200 rounded-bl-xl">Sello Verde</td>
                    <td colSpan={2} className="p-0">
                      <input 
                        type="number" 
                        value={selloVerde || ""} 
                        onChange={(e) => setSelloVerde(Number(e.target.value))}
                        className="w-full h-full min-h-[44px] px-4 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-indigo-50 transition-colors"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Tabla Papeles */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
             <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800">Papeles</h2>
            </div>
            <div className="p-0">
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="w-1/3 py-3 px-4 font-medium text-slate-700 bg-slate-50 border-r border-slate-200">Inscripción</td>
                    <td className="p-0">
                      <input 
                        type="number" 
                        value={inscripcion || ""} 
                        onChange={(e) => setInscripcion(Number(e.target.value))}
                        className="w-full h-full min-h-[44px] px-4 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-indigo-50 transition-colors"
                      />
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="w-1/3 py-3 px-4 font-medium text-slate-700 bg-slate-50 border-r border-slate-200">Permiso Circulación</td>
                    <td className="p-0">
                      <input 
                        type="number" 
                        value={permisoCirculacion || ""} 
                        onChange={(e) => setPermisoCirculacion(Number(e.target.value))}
                        className="w-full h-full min-h-[44px] px-4 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-indigo-50 transition-colors"
                        placeholder="0"
                      />
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="w-1/3 py-3 px-4 font-medium text-slate-700 bg-slate-50 border-r border-slate-200">Seguro Obligatorio + Sello</td>
                    <td className="p-0">
                      <input 
                        type="number" 
                        value={seguroObligatorio || ""} 
                        onChange={(e) => setSeguroObligatorio(Number(e.target.value))}
                        className="w-full h-full min-h-[44px] px-4 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-indigo-50 transition-colors"
                      />
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="w-1/3 py-3 px-4 font-medium text-slate-700 bg-slate-50 border-r border-slate-200">
                      Impuesto Verde (
                      <a href="https://www4.sii.cl/calcImpVehiculoNuevoInternet/internet.html" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        Revisar en SII.cl
                      </a>
                      )
                    </td>
                    <td className="p-0">
                      <input 
                        type="number" 
                        value={impuestoVerde || ""} 
                        onChange={(e) => setImpuestoVerde(Number(e.target.value))}
                        className="w-full h-full min-h-[44px] px-4 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-indigo-50 transition-colors"
                        placeholder="0"
                      />
                    </td>
                  </tr>
                  <tr className="bg-slate-100">
                    <td className="w-1/3 py-3 px-4 font-bold text-slate-800 border-r border-slate-200">Total</td>
                    <td className="py-3 px-4 text-center font-bold text-indigo-700 text-lg">
                      ${totalPapeles.toLocaleString("es-CL")}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Fila de Resumen */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex">
             <div className="w-2/3 py-4 px-6 font-medium text-slate-700 bg-slate-50 border-r border-slate-200 flex items-center">
               Permiso Circulación Marzo aproximado
             </div>
             <div className="w-1/3 py-4 px-6 text-center font-bold text-slate-800 flex items-center justify-center">
               ${permisoMarzoAproximado.toLocaleString("es-CL")}
             </div>
          </div>

        </div>

        {/* Lado Derecho - Controles Adicionales */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider">Ajustes Adicionales</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 border border-slate-200 rounded-xl hover:border-indigo-300 transition-colors bg-slate-50">
                <span className="text-sm font-medium text-slate-700">Modificar valor vehículo</span>
                <select 
                  value={modificarValor} 
                  onChange={(e) => setModificarValor(e.target.value)}
                  className="bg-yellow-200 text-yellow-900 font-bold border-none outline-none rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-yellow-400 cursor-pointer"
                >
                  <option value="NO">NO</option>
                  <option value="SI">SÍ</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-3 border border-slate-200 rounded-xl hover:border-indigo-300 transition-colors bg-slate-50">
                <span className="text-sm font-medium text-slate-700">Facturar próximo mes</span>
                <select 
                  value={facturarProximoMes} 
                  onChange={(e) => {
                    const newVal = e.target.value;
                    setFacturarProximoMes(newVal);
                    if (newVal === "SI") {
                      setMesFacturaA((prev) => (prev % 12) + 1);
                      setMesFacturaB((prev) => prev === 1 ? 12 : prev - 1);
                    } else if (newVal === "NO" && facturarProximoMes === "SI") {
                      setMesFacturaA((prev) => prev === 1 ? 12 : prev - 1);
                      setMesFacturaB((prev) => (prev % 12) + 1);
                    }
                  }}
                  className="bg-yellow-200 text-yellow-900 font-bold border-none outline-none rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-yellow-400 cursor-pointer"
                >
                  <option value="NO">NO</option>
                  <option value="SI">SÍ</option>
                </select>
              </div>
            </div>

            <div className="mt-8 p-4 bg-indigo-50 rounded-xl border border-indigo-100 flex gap-3">
               <AlertCircle className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
               <p className="text-xs text-indigo-800 leading-relaxed">
                 El valor de la UTM resaltado en amarillo depende del mes ingresado en <strong>Mes Factura</strong> y si se selecciona facturar el próximo mes.
               </p>
            </div>
            
            <button 
              onClick={handleSave}
              disabled={saving || !calculoPcId}
              className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Guardando...
                </>
              ) : saveSuccess ? (
                <>
                  <Check className="w-5 h-5 text-emerald-300" />
                  ¡Guardado correctamente!
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Guardar Parámetros
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
