"use client";

import { useState, useEffect } from "react";
import { Calculator, Save, AlertCircle } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

interface ParametrosSII {
  anio: number;
  mes: number;
  utm: number | null;
}

interface CalculoPapelesProps {
  valorVehiculoBruto: number;
  onUpdateValores: (valores: {
    inscripcion: number;
    permiso_circulacion: number;
    soap_sello_verde: number;
    impuesto_verde: number;
  }) => void;
  valoresActuales: {
    inscripcion: number;
    permiso_circulacion: number;
    soap_sello_verde: number;
    impuesto_verde: number;
  };
}

export default function CalculoPapeles({ valorVehiculoBruto, onUpdateValores, valoresActuales }: CalculoPapelesProps) {
  const [anio] = useState<number>(new Date().getFullYear());
  const [utmData, setUtmData] = useState<Record<number, ParametrosSII>>({});
  const [loading, setLoading] = useState(true);

  const [mesFacturaA, setMesFacturaA] = useState<number>(new Date().getMonth() + 1);
  const [mesFacturaB, setMesFacturaB] = useState<number>(13 - (new Date().getMonth() + 1));
  const [selloVerde, setSelloVerde] = useState<number>(4000);

  const [valorVehiculoLocal, setValorVehiculoLocal] = useState<number>(valorVehiculoBruto);

  useEffect(() => {
    setValorVehiculoLocal(valorVehiculoBruto);
  }, [valorVehiculoBruto]);

  // Valores de Papeles locales (para sincronizar con el padre)
  const [inscripcion, setInscripcion] = useState<number>(valoresActuales.inscripcion ?? 89560);
  const [permisoCirculacion, setPermisoCirculacion] = useState<number>(valoresActuales.permiso_circulacion ?? 0);
  const [seguroObligatorio, setSeguroObligatorio] = useState<number>(valoresActuales.soap_sello_verde ?? 33000);
  const [impuestoVerde, setImpuestoVerde] = useState<number>(valoresActuales.impuesto_verde ?? 0);

  // Sync from parent if parent changes (e.g., Limpiar Cuadratura)
  useEffect(() => {
    setInscripcion(valoresActuales.inscripcion);
    setSeguroObligatorio(valoresActuales.soap_sello_verde);
    setImpuestoVerde(valoresActuales.impuesto_verde);
  }, [valoresActuales.inscripcion, valoresActuales.soap_sello_verde, valoresActuales.impuesto_verde]);

  // Sync back to parent when values change
  useEffect(() => {
    onUpdateValores({
      inscripcion,
      permiso_circulacion: permisoCirculacion,
      soap_sello_verde: seguroObligatorio,
      impuesto_verde: impuestoVerde
    });
  }, [inscripcion, permisoCirculacion, seguroObligatorio, impuestoVerde]);

  // Configuración Adicional
  const [modificarValor, setModificarValor] = useState<string>("NO");
  const [facturarProximoMes, setFacturarProximoMes] = useState<string>("NO");

  const supabase = createClient();

  useEffect(() => {
    async function fetchUtm() {
      setLoading(true);
      const { data, error } = await supabase
        .from("parametros_sii")
        .select("anio, mes, utm")
        .eq("anio", anio);

      if (!error && data) {
        const map: Record<number, ParametrosSII> = {};
        data.forEach((r: any) => {
          map[r.mes] = r;
        });
        setUtmData(map);
      }
      setLoading(false);
    }
    fetchUtm();
  }, [anio]);

  // Cálculos derivados
  const mesUtm = mesFacturaA;
  const valorUtmMes = utmData[mesUtm]?.utm || 0;
  
  // El valor bruto viene desde las props o del input local si está habilitado
  const valorVehiculo = modificarValor === "SI" ? valorVehiculoLocal : valorVehiculoBruto;
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
    <div className="flex flex-col w-full">
      <div className="mb-8">
        <h2 className="text-2xl font-bold leading-7 text-slate-900 sm:truncate sm:text-3xl sm:tracking-tight flex items-center gap-2">
          <Calculator className="w-8 h-8 text-indigo-600" />
          Cálculo Permisos de Circulación
        </h2>
        <p className="mt-2 text-sm text-slate-500 max-w-2xl">
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
                      {modificarValor === "SI" ? (
                        <input 
                          type="number" 
                          value={valorVehiculoLocal || ""} 
                          onChange={(e) => setValorVehiculoLocal(Number(e.target.value))}
                          className="w-full h-full min-h-[44px] px-4 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-indigo-50 transition-colors"
                        />
                      ) : (
                        <div className="w-full h-full min-h-[44px] flex items-center justify-center bg-slate-50 text-slate-600 font-medium">
                          {valorVehiculo.toLocaleString("es-CL")}
                        </div>
                      )}
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
                    <td className="p-0 border-r border-slate-200">
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
                    <td className="w-1/3 py-3 px-4 font-medium text-slate-700 bg-slate-50 border-r border-slate-200">Impuesto Verde</td>
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
            
          </div>
        </div>

      </div>
    </div>
  );
}
