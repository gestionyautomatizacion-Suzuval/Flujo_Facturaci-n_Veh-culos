"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Loader2, Calculator, Check, Save } from "lucide-react";
import { useRouter } from "next/navigation";

const formatCLP = (num: number) => {
  return num != null ? num.toLocaleString('es-CL') : '0';
};

const formatPct = (num: number) => {
  return num != null ? num.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%' : '0.0%';
};

interface Props {
  negocio?: any;
  badgeSlot?: React.ReactNode;
}

export default function CuadraturaSection({ negocio, badgeSlot }: Props) {
  const [rutCalculoValores, setRutCalculoValores] = useState(negocio?.rut_calculo_valores || negocio?.rut || "");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [hasAutoLoaded, setHasAutoLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const supabase = createClient();
  const router = useRouter();

  const handleLoad = async (rutToLoad = rutCalculoValores) => {
    if (!rutToLoad?.trim()) return;
    
    setLoading(true);
    setError("");
    setData(null);

    const { data: result, error: fetchError } = await supabase
      .from("formularios_facturacion")
      .select("*")
      .eq("rut", rutToLoad.trim())
      .single();

    if (fetchError) {
      setError("No se encontró cuadratura para este RUT.");
    } else if (result) {
      // Ensure array length of 6 for table
      const rawPagos = Array.isArray(result.pagos_comprobantes) ? result.pagos_comprobantes : [];
      const pagosPadded = [...rawPagos];
      while (pagosPadded.length < 6) {
        pagosPadded.push({ n_comprobante: "", pagos: 0, tipo_pago: "--" });
      }
      result.pagos_comprobantes = pagosPadded.slice(0, 6);
      setData(result);
    }
    setLoading(false);
  };

  useEffect(() => {
    const rutParaCargar = negocio?.rut_calculo_valores || negocio?.rut;
    if (rutParaCargar && !hasAutoLoaded) {
      setHasAutoLoaded(true);
      handleLoad(rutParaCargar);
    }
  }, [negocio?.rut_calculo_valores, negocio?.rut, hasAutoLoaded]);

  const handleSaveToNegocio = async () => {
    if (!negocio?.interno || !data?.rut) return;
    
    setIsSaving(true);
    const { error } = await supabase
      .from('negocios')
      .update({ rut_calculo_valores: data.rut })
      .eq('pedido_venta', negocio.pedido_venta);
      
    setIsSaving(false);
    if (error) {
      alert("Error al vincular RUT: " + error.message);
    } else {
      const { data: authData } = await supabase.auth.getUser();
      await supabase.from('negocios_comentarios').insert([{
        pedido_venta: negocio.pedido_venta,
        comentario: `[AUDITORIA]|Cuadratura cargada: RUT ${data.rut}`,
        usuario_email: authData?.user?.email || 'Sistema'
      }]);
      router.refresh();
    }
  };

  if (!data && !loading && !error) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8">
        <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 relative flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Cargar Cuadratura Cliente</h4>
          <div className="absolute left-1/2 -translate-x-1/2">
            {badgeSlot}
          </div>
        </div>
        <div className="p-5 flex items-end gap-4">
          <div className="flex-1 max-w-xs">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">RUT</label>
            <input 
              type="text" 
              placeholder="Ej: 12345678-9" 
              value={rutCalculoValores}
              onChange={(e) => setRutCalculoValores(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLoad()}
              className="w-full border-b-2 border-slate-300 focus:border-indigo-500 bg-slate-50 p-2 font-mono outline-none"
            />
          </div>
          <button 
            onClick={() => handleLoad()}
            disabled={loading || !rutCalculoValores.trim()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-md shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
          >
            <Calculator className="w-4 h-4" />
            Cargar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8">
      <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex flex-col gap-3">
        <div className="relative flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <Calculator className="w-4 h-4 text-indigo-600" />
            Cuadratura Cliente {data ? `- RUT: ${data.rut}` : ''}
          </h4>
          <div className="absolute left-1/2 -translate-x-1/2">
            {badgeSlot}
          </div>
          <div className="flex items-center gap-2">
            {data && (negocio?.rut_calculo_valores || negocio?.rut) !== data.rut && (
              <button 
                onClick={handleSaveToNegocio}
                disabled={isSaving}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-md shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5 mr-2"
              >
                {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Guardar Cambios
              </button>
            )}
            <input 
              type="text" 
              placeholder="Nuevo RUT..." 
              value={rutCalculoValores}
              onChange={(e) => setRutCalculoValores(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLoad()}
              className="w-32 border-b-2 border-slate-300 focus:border-indigo-500 bg-white p-1 text-sm font-mono outline-none"
            />
            <button 
              onClick={() => handleLoad()}
              disabled={loading}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-md shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Cargar"}
            </button>
          </div>
        </div>

        {data && (data.mod_vehiculo || data.marca || data.descripcion_modelo) && (
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 bg-white border border-slate-200 shadow-sm rounded-md px-3 py-2 w-fit">
            {data.marca && (
              <div className="flex items-center gap-1">
                <span className="font-bold uppercase text-slate-500">Marca:</span>
                <span className="font-medium text-slate-800">{data.marca}</span>
              </div>
            )}
            {data.marca && (data.mod_vehiculo || data.descripcion_modelo) && (
              <div className="w-px h-3 bg-slate-300"></div>
            )}
            {data.mod_vehiculo && (
              <div className="flex items-center gap-1">
                <span className="font-bold uppercase text-slate-500">Mod. Vehículo:</span>
                <span className="font-medium text-slate-800">{data.mod_vehiculo}</span>
              </div>
            )}
            {data.mod_vehiculo && data.descripcion_modelo && (
              <div className="w-px h-3 bg-slate-300"></div>
            )}
            {data.descripcion_modelo && (
              <div className="flex items-center gap-1">
                <span className="font-bold uppercase text-slate-500">Descripción Modelo:</span>
                <span className="font-medium text-slate-800">{data.descripcion_modelo}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-5">
        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
        ) : error ? (
          <div className="text-red-500 font-medium text-sm">{error}</div>
        ) : data && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            {/* LADO IZQUIERDO */}
            <div className="flex flex-col gap-6">
              
              {/* PANEL NEGOCIO */}
              <div className="border border-slate-300 flex">
                <div className="w-12 bg-slate-100 border-r border-slate-300 flex items-center justify-center p-2">
                  <span className="transform -rotate-90 whitespace-nowrap font-bold text-xs text-slate-600 tracking-widest text-center">NEGOCIO</span>
                </div>
                <div className="flex-1 flex flex-col">
                  
                  {/* Encabezados NETO / BRUTO */}
                  <div className="flex border-b border-slate-300 text-sm h-[30px] bg-slate-50">
                    <div className="w-1/2 border-r border-slate-300"></div>
                    <div className="w-1/4 border-r border-slate-300 font-bold text-center text-slate-600 flex items-center justify-center tracking-wider">BRUTO</div>
                    <div className="w-1/4 font-bold text-center text-slate-600 flex items-center justify-center tracking-wider">NETO</div>
                  </div>

                  {/* Tipo de Venta */}
                  <div className="flex border-b border-slate-300 text-sm h-[34px]">
                    <div className="w-1/2 px-2 flex items-center border-r border-slate-300 font-medium">Tipo Venta</div>
                    <div className="w-1/2 bg-white flex items-center justify-center font-medium text-slate-700">
                      {data.tipo_compra || '-'}
                    </div>
                  </div>

                  {/* Precio Lista */}
                  <div className="flex border-b border-slate-300 text-sm h-[34px]">
                    <div className="w-1/2 px-2 flex items-center border-r border-slate-300 font-medium">Precio Lista</div>
                    <div className="w-1/4 border-r border-slate-300 bg-white flex items-center justify-center font-mono">
                      {formatCLP(data.precio_lista)}
                    </div>
                    <div className="w-1/4 bg-slate-50 flex items-center justify-center font-mono text-slate-700">
                      {formatCLP(Math.round((data.precio_lista || 0) / 1.19))}
                    </div>
                  </div>

                  {/* Bono Marca */}
                  <div className="flex border-b border-slate-300 text-sm h-[34px]">
                    <div className="w-1/2 px-2 flex items-center border-r border-slate-300 font-medium">Bono Marca</div>
                    <div className="w-1/4 border-r border-slate-300 bg-white flex items-center justify-center font-mono">
                      {formatCLP(data.bono_marca)}
                    </div>
                    <div className="w-1/4 bg-slate-50 flex items-center justify-center font-mono text-slate-700">
                      {formatCLP(Math.round((data.bono_marca || 0) / 1.19))}
                    </div>
                  </div>

                  {/* Precio Contado */}
                  <div className="flex border-b border-slate-300 text-sm h-[34px] bg-orange-50 font-bold">
                    <div className="w-1/2 px-2 flex items-center border-r border-slate-300">Precio Contado</div>
                    <div className="w-1/4 border-r border-slate-300 flex items-center justify-center font-mono text-slate-900">
                      {formatCLP((data.precio_lista || 0) - (data.bono_marca || 0))}
                    </div>
                    <div className="w-1/4 flex items-center justify-center font-mono text-slate-900 bg-orange-50/50">
                      {formatCLP(Math.round(((data.precio_lista || 0) - (data.bono_marca || 0)) / 1.19))}
                    </div>
                  </div>

                  {/* Bono Amicar (Cargo a Suzuval) */}
                  <div className="flex border-b border-slate-300 text-sm h-[34px]">
                    <div className="w-1/2 px-2 flex items-center border-r border-slate-300 font-medium">Bono Amicar (Cargo a Suzuval)</div>
                    <div className="w-1/4 border-r border-slate-300 bg-white flex items-center justify-center font-mono">
                      {formatCLP(data.bono_amicar_suzuval)}
                    </div>
                    <div className="w-1/4 bg-slate-50 flex items-center justify-center font-mono text-slate-700">
                      {formatCLP(Math.round((data.bono_amicar_suzuval || 0) / 1.19))}
                    </div>
                  </div>

                  {/* Bono Amicar (Cargo a Derco) */}
                  <div className="flex border-b border-slate-300 text-sm h-[34px]">
                    <div className="w-1/2 px-2 flex items-center border-r border-slate-300 font-medium">Bono Amicar (Cargo a Derco)</div>
                    <div className="w-1/4 border-r border-slate-300 bg-white flex items-center justify-center font-mono">
                      {formatCLP(data.bono_amicar_derco)}
                    </div>
                    <div className="w-1/4 bg-slate-50 flex items-center justify-center font-mono text-slate-700">
                      {formatCLP(Math.round((data.bono_amicar_derco || 0) / 1.19))}
                    </div>
                  </div>

                  {/* Flete + Grabado */}
                  <div className="flex border-b border-slate-300 text-sm h-[34px]">
                    <div className="w-1/2 px-2 flex items-center border-r border-slate-300 font-medium">Flete + Grabado</div>
                    <div className="w-1/4 border-r border-slate-300 bg-white flex items-center justify-center font-mono">
                      {formatCLP(data.flete_grabado)}
                    </div>
                    <div className="w-1/4 bg-slate-50 flex items-center justify-center font-mono text-slate-700">
                      {formatCLP(Math.round((data.flete_grabado || 0) / 1.19))}
                    </div>
                  </div>

                  {/* Precio Venta Accesorios */}
                  <div className="flex border-b border-slate-300 text-sm h-[34px]">
                    <div className="w-1/2 px-2 flex items-center border-r border-slate-300 font-medium">Precio Accesorio o Mantención</div>
                    <div className="w-1/4 border-r border-slate-300 bg-white flex items-center justify-center font-mono">
                      {formatCLP(data.precio_venta_accesorios)}
                    </div>
                    <div className="w-1/4 bg-slate-50 flex items-center justify-center font-mono text-slate-700">
                      {formatCLP(Math.round((data.precio_venta_accesorios || 0) / 1.19))}
                    </div>
                  </div>

                  {/* Mantencion 10 */}
                  <div className="flex border-b border-slate-300 text-sm h-[34px]">
                    <div className="w-1/2 px-2 flex items-center border-r border-slate-300 font-medium">Mantención 10.000</div>
                    <div className="w-1/4 border-r border-slate-300 bg-white flex items-center justify-center font-mono">
                      {formatCLP(data.mantencion_10)}
                    </div>
                    <div className="w-1/4 bg-slate-50 flex items-center justify-center font-mono text-slate-700">
                      {formatCLP(Math.round((data.mantencion_10 || 0) / 1.19))}
                    </div>
                  </div>

                  {/* Mantencion 20 */}
                  <div className="flex border-b border-slate-300 text-sm h-[34px]">
                    <div className="w-1/2 px-2 flex items-center border-r border-slate-300 font-medium">Mantención 20.000</div>
                    <div className="w-1/4 border-r border-slate-300 bg-white flex items-center justify-center font-mono">
                      {formatCLP(data.mantencion_20)}
                    </div>
                    <div className="w-1/4 bg-slate-50 flex items-center justify-center font-mono text-slate-700">
                      {formatCLP(Math.round((data.mantencion_20 || 0) / 1.19))}
                    </div>
                  </div>

                  {/* Mantencion 30 */}
                  <div className="flex border-b border-slate-300 text-sm h-[34px]">
                    <div className="w-1/2 px-2 flex items-center border-r border-slate-300 font-medium">Mantención 30.000</div>
                    <div className="w-1/4 border-r border-slate-300 bg-white flex items-center justify-center font-mono">
                      {formatCLP(data.mantencion_30)}
                    </div>
                    <div className="w-1/4 bg-slate-50 flex items-center justify-center font-mono text-slate-700">
                      {formatCLP(Math.round((data.mantencion_30 || 0) / 1.19))}
                    </div>
                  </div>

                  {/* Precio Final */}
                  <div className="flex border-b border-slate-300 text-sm h-[34px] bg-orange-50 font-bold">
                    <div className="w-1/2 px-2 flex items-center border-r border-slate-300">Precio Final</div>
                    <div className="w-1/4 border-r border-slate-300 flex items-center justify-center font-mono text-slate-900">
                      {formatCLP(data.precio_final)}
                    </div>
                    <div className="w-1/4 flex items-center justify-center font-mono text-slate-900 bg-orange-50/50">
                      {formatCLP(Math.round((data.precio_final || 0) / 1.19))}
                    </div>
                  </div>

                </div>
              </div>

              {/* DESCUENTOS APORTES */}
              <div className="border border-slate-300 flex">
                <div className="w-12 bg-slate-100 border-r border-slate-300 flex items-center justify-center p-1">
                  <span className="transform -rotate-90 whitespace-nowrap font-bold text-xs text-slate-600 tracking-widest text-center">APORTES</span>
                </div>
                <div className="flex-1 flex flex-col">
                   <div className="flex border-b border-slate-300 text-sm h-[34px]">
                     <div className="w-1/2 px-2 flex items-center justify-between border-r border-slate-300 font-medium">
                       <span>Descuentos Suzuval - ZQDV</span>
                       <span className="font-mono text-slate-500">{formatPct(data.precio_lista ? ((data.dcto_suzuval_zqdv || 0) / data.precio_lista) * 100 : 0)}</span>
                     </div>
                     <div className="w-1/4 border-r border-slate-300 bg-white flex items-center justify-center font-mono">
                        {formatCLP(data.dcto_suzuval_zqdv)}
                     </div>
                     <div className="w-1/4 bg-slate-50 flex items-center justify-center font-mono text-slate-700">
                        {formatCLP(Math.round((data.dcto_suzuval_zqdv || 0) / 1.19))}
                     </div>
                   </div>
                   <div className="flex text-sm h-[34px]">
                     <div className="w-1/2 px-2 flex items-center justify-between border-r border-slate-300 font-medium">
                       <span>Aporte Marca Derco - Z126</span>
                       <span className="font-mono text-slate-500">{formatPct(data.precio_lista ? ((data.aporte_marca_derco_z126 || 0) / data.precio_lista) * 100 : 0)}</span>
                     </div>
                     <div className="w-1/4 border-r border-slate-300 bg-white flex items-center justify-center font-mono">
                        {formatCLP(data.aporte_marca_derco_z126)}
                     </div>
                     <div className="w-1/4 bg-slate-50 flex items-center justify-center font-mono text-slate-700">
                        {formatCLP(Math.round((data.aporte_marca_derco_z126 || 0) / 1.19))}
                     </div>
                   </div>
                </div>
              </div>

              {/* PAPELES INSCRIPCIÓN */}
              <div className="border border-slate-300 flex">
                <div className="w-12 bg-slate-100 border-r border-slate-300 flex items-center justify-center p-1">
                  <div className="transform -rotate-90 whitespace-nowrap font-bold text-xs text-slate-600 tracking-widest text-center leading-tight">PAPELES<br/>INSCRIPCIÓN</div>
                </div>
                <div className="flex-1 flex flex-col text-sm text-slate-700">
                  <div className="flex border-b border-slate-300 h-[34px]">
                    <div className="w-1/2 px-2 flex items-center border-r border-slate-300 font-medium">Inscripción</div>
                    <div className="w-1/2 bg-white flex items-center justify-center font-mono">{formatCLP(data.inscripcion)}</div>
                  </div>
                  <div className="flex border-b border-slate-300 h-[34px]">
                    <div className="w-1/2 px-2 flex items-center border-r border-slate-300 font-medium">Permiso Circulación</div>
                    <div className="w-1/2 bg-white flex items-center justify-center font-mono">{formatCLP(data.permiso_circulacion)}</div>
                  </div>
                  <div className="flex border-b border-slate-300 h-[34px]">
                    <div className="w-1/2 px-2 flex items-center border-r border-slate-300 font-medium">Seguro Obligatorio (SOAP) + Sello Verde</div>
                    <div className="w-1/2 bg-white flex items-center justify-center font-mono">{formatCLP(data.soap_sello_verde)}</div>
                  </div>
                  <div className="flex border-b border-slate-300 h-[34px]">
                    <div className="w-1/2 px-2 flex items-center border-r border-slate-300 font-medium">
                      <a href="https://www.sii.cl/" target="_blank" rel="noreferrer" className="text-blue-600 underline hover:text-blue-800">Impuesto Verde (Revisar en SII.cl)</a>
                    </div>
                    <div className="w-1/2 bg-white flex items-center justify-center font-mono">{formatCLP(data.impuesto_verde)}</div>
                  </div>
                  <div className="flex bg-slate-50 font-bold h-[34px]">
                    <div className="w-1/2 px-2 flex items-center border-r border-slate-300 text-slate-900">Total Papeles</div>
                    <div className="w-1/2 flex items-center justify-center font-mono text-slate-900">${formatCLP((data.inscripcion || 0) + (data.permiso_circulacion || 0) + (data.soap_sello_verde || 0) + (data.impuesto_verde || 0))}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* LADO DERECHO */}
            <div className="flex flex-col gap-6">

               {/* NUEVA TABLA: TOTAL COMPRA Y TOTAL FACTURA */}
               <div className="border border-slate-400">
                 <div className="flex border-b border-slate-400 text-sm h-[34px]">
                   <div className="flex-[1.5] px-2 flex items-center border-r border-slate-400 font-bold bg-slate-100">Total Compra</div>
                   <div className="flex-1 flex items-center justify-center font-bold text-slate-800 bg-white">${formatCLP((data.precio_final || 0) + (data.inscripcion || 0) + (data.permiso_circulacion || 0) + (data.soap_sello_verde || 0) + (data.impuesto_verde || 0) - (data.dcto_suzuval_zqdv || 0) - (data.aporte_marca_derco_z126 || 0))}</div>
                 </div>
                 <div className="flex text-sm h-[34px]">
                   <div className="flex-[1.5] px-2 flex items-center justify-between border-r border-slate-400 font-bold bg-slate-100">
                     <span>Total Factura</span>
                     <span className="text-slate-500 font-normal text-xs font-mono">(${formatCLP(Math.round(((data.precio_final || 0) - (data.dcto_suzuval_zqdv || 0) - (data.aporte_marca_derco_z126 || 0)) / 1.19))})</span>
                   </div>
                   <div className="flex-1 flex items-center justify-center font-bold text-slate-800 bg-white">${formatCLP((data.precio_final || 0) - (data.dcto_suzuval_zqdv || 0) - (data.aporte_marca_derco_z126 || 0))}</div>
                 </div>
               </div>
               
               {/* PAGOS $$ */}
               <div className="border border-slate-400">
                 <div className="grid grid-cols-[1fr_1fr_1.5fr] bg-slate-200 border-b border-slate-400 font-bold text-xs uppercase text-center">
                   <div className="py-2 border-r border-slate-400 flex items-center justify-center">N° Comprobante</div>
                   <div className="py-2 border-r border-slate-400 flex items-center justify-center">PAGOS $$</div>
                   <div className="py-2 flex items-center justify-center">Tipo de Pago</div>
                 </div>
                 {(data.pagos_comprobantes || Array(6).fill({ n_comprobante: "", pagos: 0, tipo_pago: "--" })).map((p: any, i: number) => (
                   <div key={i} className="grid grid-cols-[1fr_1fr_1.5fr] border-b border-slate-400 text-sm bg-blue-50/30">
                     <div className="border-r border-slate-400 flex items-center justify-center p-1">
                       {p.n_comprobante || '-'}
                     </div>
                     <div className="border-r border-slate-400 flex items-center justify-center font-mono font-medium p-1 text-slate-800">
                       {formatCLP(p.pagos)}
                     </div>
                     <div className="flex items-center justify-center p-1 text-xs">
                       {p.tipo_pago || '--'}
                     </div>
                   </div>
                 ))}
                 <div className="grid grid-cols-[1fr_1fr_1.5fr] bg-slate-100 text-sm font-bold">
                   <div className="py-2 px-3 border-r border-slate-400 flex items-center justify-end text-slate-500">Total Pagos</div>
                   <div className="py-2 flex items-center justify-center border-r border-slate-400 font-mono text-slate-800 bg-white">
                     ${formatCLP((data.pagos_comprobantes || []).reduce((sum: number, p: any) => sum + (Number(p.pagos) || 0), 0))}
                   </div>
                   <div className="py-2"></div>
                 </div>
               </div>

               {/* SALDO PENDIENTE */}
               <div className="border border-slate-400 overflow-hidden">
                 <div className="flex text-sm font-bold border-b border-slate-400">
                   <div className="flex-[1.5] py-2.5 px-3 border-r border-slate-400 flex items-center justify-center bg-slate-100 text-slate-700 uppercase">Total a Pagar Cliente</div>
                   <div className="flex-1 flex items-center justify-center font-mono text-slate-900 bg-white text-base">
                     ${formatCLP((data.precio_final || 0) + (data.inscripcion || 0) + (data.permiso_circulacion || 0) + (data.soap_sello_verde || 0) + (data.impuesto_verde || 0) - (data.dcto_suzuval_zqdv || 0) - (data.aporte_marca_derco_z126 || 0))}
                   </div>
                 </div>
                 
                 {data.saldo_pendiente > 0 ? (
                   <div className="flex text-sm font-bold bg-red-50 text-red-700">
                     <div className="flex-[1.5] py-2 px-3 border-r border-red-200 flex items-center justify-end">Saldo Pendiente de:</div>
                     <div className="flex-1 flex items-center justify-center font-mono text-base">${formatCLP(data.saldo_pendiente)}</div>
                   </div>
                 ) : (
                   <div className="py-2 px-3 text-center text-sm font-bold bg-emerald-100 text-emerald-800">
                     Negocio con Saldo Completo
                   </div>
                 )}
                 {data.saldo_pendiente === 0 && (
                   <div className="flex text-sm font-bold bg-emerald-50 text-emerald-700 border-t border-emerald-200">
                     <div className="flex-[1.5] py-1.5 px-3 border-r border-emerald-200 flex items-center justify-end text-xs">Saldo Pendiente de:</div>
                     <div className="flex-1 flex items-center justify-center font-mono">$0</div>
                   </div>
                 )}
               </div>

               {/* RESUMEN DESCUENTOS */}
               <div className="border border-slate-400 flex mt-2">
                 <div className="w-24 bg-slate-100 border-r border-slate-400 flex items-center justify-center p-2">
                   <span className="font-bold text-xs text-slate-600 text-center uppercase leading-tight">Resumen<br/>Descuentos</span>
                 </div>
                 <div className="flex-1 flex flex-col text-xs font-medium text-slate-700">
                   <div className="flex border-b border-slate-200 hover:bg-slate-50">
                     <div className="flex-[2] py-1.5 px-3 border-r border-slate-200">Dcto Suzuval - ZQDV</div>
                     <div className="flex-1 py-1.5 px-2 border-r border-slate-200 text-center font-mono text-slate-500">{formatPct(data.precio_lista ? ((data.dcto_suzuval_zqdv || 0) / data.precio_lista) * 100 : 0)}</div>
                     <div className="flex-1 py-1.5 px-3 text-right font-mono">{formatCLP(data.dcto_suzuval_zqdv)}</div>
                   </div>
                   <div className="flex border-b border-slate-400 hover:bg-slate-50">
                     <div className="flex-[2] py-1.5 px-3 border-r border-slate-200">Dcto Amicar Suzuval - Z104</div>
                     <div className="flex-1 py-1.5 px-2 border-r border-slate-200 text-center font-mono text-slate-500">{formatPct(data.precio_lista ? ((data.bono_amicar_suzuval || 0) / data.precio_lista) * 100 : 0)}</div>
                     <div className="flex-1 py-1.5 px-3 text-right font-mono">{formatCLP(data.bono_amicar_suzuval)}</div>
                   </div>
                   <div className="flex border-b border-slate-400 bg-slate-100 font-bold">
                     <div className="flex-[2] py-1.5 px-3 border-r border-slate-300">Total</div>
                     <div className="flex-1 py-1.5 px-2 border-r border-slate-300 text-center font-mono text-slate-600">{formatPct(data.precio_lista ? (((data.dcto_suzuval_zqdv || 0) + (data.bono_amicar_suzuval || 0)) / data.precio_lista) * 100 : 0)}</div>
                     <div className="flex-1 py-1.5 px-3 text-right font-mono text-slate-800">{formatCLP((data.dcto_suzuval_zqdv || 0) + (data.bono_amicar_suzuval || 0))}</div>
                   </div>
                   <div className="flex border-b border-slate-200 hover:bg-slate-50">
                     <div className="flex-[2] py-1.5 px-3 border-r border-slate-200">Dcto Derco Manual - Z126</div>
                     <div className="flex-1 py-1.5 px-2 border-r border-slate-200 text-center font-mono text-slate-500">{formatPct(data.precio_lista ? ((data.aporte_marca_derco_z126 || 0) / data.precio_lista) * 100 : 0)}</div>
                     <div className="flex-1 py-1.5 px-3 text-right font-mono">{formatCLP(data.aporte_marca_derco_z126)}</div>
                   </div>
                   <div className="flex border-b border-slate-400 hover:bg-slate-50">
                     <div className="flex-[2] py-1.5 px-3 border-r border-slate-200">Dcto Amicar DERCO - Z107</div>
                     <div className="flex-1 py-1.5 px-2 border-r border-slate-200 text-center font-mono text-slate-500">{formatPct(data.precio_lista ? ((data.bono_amicar_derco || 0) / data.precio_lista) * 100 : 0)}</div>
                     <div className="flex-1 py-1.5 px-3 text-right font-mono">{formatCLP(data.bono_amicar_derco)}</div>
                   </div>
                   <div className="flex bg-slate-100 font-bold">
                     <div className="flex-[2] py-1.5 px-3 border-r border-slate-300">Total</div>
                     <div className="flex-1 py-1.5 px-2 border-r border-slate-300 text-center font-mono text-slate-600">{formatPct(data.precio_lista ? (((data.aporte_marca_derco_z126 || 0) + (data.bono_amicar_derco || 0)) / data.precio_lista) * 100 : 0)}</div>
                     <div className="flex-1 py-1.5 px-3 text-right font-mono text-slate-800">{formatCLP((data.aporte_marca_derco_z126 || 0) + (data.bono_amicar_derco || 0))}</div>
                   </div>
                 </div>
               </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
