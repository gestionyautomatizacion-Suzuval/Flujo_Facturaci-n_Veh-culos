/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Loader2, AlertTriangle, ExternalLink } from "lucide-react";
import { todasLasComunas, obtenerRegionPorComuna, regionesYcomunas } from "@/lib/chile";

interface Props {
  pedidoVenta: string;
  linkedClienteInfo: { id: string; rut: string; nombre_apellido: string } | null;
  renderValidacion?: (elemento_id: string) => React.ReactNode;
}

export default function DatosClienteTab({ pedidoVenta, linkedClienteInfo, renderValidacion }: Props) {
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [datosCliente, setDatosCliente] = useState<any>({
    direccion: "",
    comuna: "",
    region: "",
    mail: "",
    movil: "",
    contribuyente_electronico: "NO",
    tipo_negocio: "",
    estado_civil: "",
    comunidad_bienes: "NO",
    nacionalidad: "",
    profesion_giro: ""
  });

  const supabase = createClient();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      // Fetch from clientes_datos_negocios
      const { data } = await supabase
        .from("clientes_datos_negocios")
        .select("*")
        .eq("pedido_venta", pedidoVenta)
        .maybeSingle();

      if (data) {
        setDatosCliente({
          direccion: data.direccion || "",
          comuna: data.comuna || "",
          region: data.region || "",
          mail: data.mail || "",
          movil: data.movil || "",
          contribuyente_electronico: data.contribuyente_electronico ? "SI" : "NO",
          tipo_negocio: data.tipo_negocio || "",
          estado_civil: data.estado_civil || "",
          comunidad_bienes: data.comunidad_bienes ? "SI" : "NO",
          nacionalidad: data.nacionalidad || "",
          profesion_giro: data.profesion_giro || ""
        });
      }
      setLoading(false);
    };

    fetchData();
  }, [pedidoVenta]);

  const handleChange = (field: string, value: string) => {
    setDatosCliente((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    
    // Check if record exists
    const { data: existingData } = await supabase
      .from("clientes_datos_negocios")
      .select("id")
      .eq("pedido_venta", pedidoVenta)
      .maybeSingle();

    const payload = {
      direccion: datosCliente.direccion,
      comuna: datosCliente.comuna,
      region: datosCliente.region,
      mail: datosCliente.mail,
      movil: datosCliente.movil,
      contribuyente_electronico: datosCliente.contribuyente_electronico === "SI",
      tipo_negocio: datosCliente.tipo_negocio,
      estado_civil: datosCliente.estado_civil,
      comunidad_bienes: datosCliente.comunidad_bienes === "SI",
      nacionalidad: datosCliente.nacionalidad,
      profesion_giro: datosCliente.profesion_giro,
      cliente_id: linkedClienteInfo?.id || null
    };

    if (existingData) {
      const { error } = await supabase
        .from("clientes_datos_negocios")
        .update(payload)
        .eq("id", existingData.id);
      if (error) alert("Error guardando: " + error.message);
    } else {
      const { error } = await supabase
        .from("clientes_datos_negocios")
        .insert({ ...payload, pedido_venta: pedidoVenta });
      if (error) alert("Error guardando: " + error.message);
    }

    // Insertar en historial
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("negocios_historial").insert([{
      pedido_venta: pedidoVenta,
      tipo_evento: "EDICION_CLIENTE",
      descripcion: "Datos del cliente actualizados",
      usuario_email: user?.email || "Sistema"
    }]);

    setIsSaving(false);
    setIsEditing(false);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm mb-8">
      <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-2 transition-colors">
        <div className="flex items-center gap-2 flex-1">
          <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mr-2">Datos del Cliente</h3>
          {renderValidacion && renderValidacion("DATOS_CLIENTE")}
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-md shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Guardar"}
              </button>
              <button
                onClick={() => setIsEditing(false)}
                disabled={isSaving}
                className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-600 font-medium text-xs border border-slate-200 rounded-md shadow-sm transition-all"
              >
                Cancelar
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-600 font-medium text-xs border border-slate-200 rounded-md shadow-sm transition-all"
            >
              Editar Datos
            </button>
          )}
        </div>
      </div>
      
      <div className="p-4 md:p-6 w-full">
        {!linkedClienteInfo && (
          <div className="mb-6 bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg flex items-start gap-4">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-800">Cliente No Vinculado</p>
              <p className="text-sm text-amber-700 mt-1">
                Para mostrar el RUT y Nombre, primero debes cargar y vincular la Cuadratura de Valores en la pestaña <strong>Datos del Negocio</strong>.
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-6 w-full">
          {/* Fila 1 */}
          <div className="flex flex-col md:flex-row gap-6 w-full">
            <div className="flex-1">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nombres y Apellidos</p>
              <p className="text-sm font-semibold text-slate-800 break-words bg-slate-50 px-2 py-1 rounded">
                {linkedClienteInfo?.nombre_apellido || "Sin vincular"}
              </p>
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">RUT</p>
              <p className="text-sm font-semibold text-slate-800 break-words bg-slate-50 px-2 py-1 rounded">
                {linkedClienteInfo?.rut || "Sin vincular"}
              </p>
            </div>
          </div>

          <div className="w-full h-px bg-slate-100 my-1"></div>

          {/* Fila 2 */}
          <div className="flex flex-col md:flex-row gap-6 w-full">
            <div className="flex-1 md:flex-[2]">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Dirección</p>
              {isEditing ? 
                <input type="text" className="w-full text-sm border-b border-slate-300 focus:border-indigo-500 outline-none pb-1" value={datosCliente.direccion} onChange={e => handleChange("direccion", e.target.value)} /> :
                <p className="text-sm font-semibold text-slate-800">{datosCliente.direccion || "-"}</p>
              }
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Región</p>
              {isEditing ? 
                <select className="w-full text-sm border-b border-slate-300 focus:border-indigo-500 outline-none pb-1 bg-white" value={datosCliente.region} onChange={e => {
                  handleChange("region", e.target.value);
                  handleChange("comuna", "");
                }}>
                  <option value="">Seleccione...</option>
                  {regionesYcomunas.map(r => <option key={r.region} value={r.region}>{r.region}</option>)}
                </select> :
                <p className="text-sm font-semibold text-slate-800">{datosCliente.region || "-"}</p>
              }
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Comuna</p>
              {isEditing ? 
                <select 
                  className="w-full text-sm border-b border-slate-300 focus:border-indigo-500 outline-none pb-1 bg-white disabled:opacity-50" 
                  value={datosCliente.comuna} 
                  disabled={!datosCliente.region}
                  onChange={e => handleChange("comuna", e.target.value)}
                >
                  <option value="">Seleccione...</option>
                  {(datosCliente.region ? regionesYcomunas.find(r => r.region === datosCliente.region)?.comunas || [] : [])
                    .slice()
                    .sort((a, b) => a.localeCompare(b))
                    .map(c => <option key={c} value={c}>{c}</option>)}
                </select> :
                <p className="text-sm font-semibold text-slate-800">{datosCliente.comuna || "-"}</p>
              }
            </div>
          </div>

          <div className="w-full h-px bg-slate-100 my-1"></div>

          {/* Fila 3 */}
          <div className="flex flex-col md:flex-row gap-6 w-full">
            <div className="flex-[2]">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Mail</p>
              {isEditing ? 
                <input type="email" className="w-full text-sm border-b border-slate-300 focus:border-indigo-500 outline-none pb-1" value={datosCliente.mail} onChange={e => handleChange("mail", e.target.value)} /> :
                <p className="text-sm font-semibold text-slate-800">{datosCliente.mail || "-"}</p>
              }
            </div>
            <div className="flex-[2]">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Móvil</p>
              {isEditing ? 
                <input type="text" className="w-full text-sm border-b border-slate-300 focus:border-indigo-500 outline-none pb-1" value={datosCliente.movil} onChange={e => handleChange("movil", e.target.value)} /> :
                <p className="text-sm font-semibold text-slate-800">{datosCliente.movil || "-"}</p>
              }
            </div>
          </div>

          <div className="w-full h-px bg-slate-100 my-1"></div>

          {/* Fila 4: Extra data section */}
          <div className="flex flex-col gap-6 w-full my-4">
            <div className="flex flex-col md:flex-row gap-6 w-full">
              <div className="flex-1">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Contribuyente Electrónico</p>
                {isEditing ? 
                  <select className="w-full text-sm border-b border-slate-300 focus:border-indigo-500 outline-none pb-1 bg-white" value={datosCliente.contribuyente_electronico} onChange={e => handleChange("contribuyente_electronico", e.target.value)}>
                    <option value="SI">SI</option>
                    <option value="NO">NO</option>
                  </select> :
                  <p className="text-sm font-semibold text-slate-800">{datosCliente.contribuyente_electronico}</p>
                }
                <div className="mt-1">
                  <a href="https://www2.sii.cl/stc/noauthz" target="_blank" rel="noreferrer" className="text-[10px] text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" /> Consultar en SII.cl
                  </a>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tipo de Negocio</p>
                {isEditing ? 
                  <select className="w-full text-sm border-b border-slate-300 focus:border-indigo-500 outline-none pb-1 bg-white" value={datosCliente.tipo_negocio} onChange={e => handleChange("tipo_negocio", e.target.value)}>
                    <option value="">Seleccione...</option>
                    <option value="PERSONA NATURAL">PERSONA NATURAL</option>
                    <option value="EMPRESA">EMPRESA</option>
                  </select> :
                  <p className="text-sm font-semibold text-slate-800">{datosCliente.tipo_negocio || "-"}</p>
                }
              </div>
              <div className="flex-1">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Estado Civil</p>
                {isEditing ? 
                  <select className="w-full text-sm border-b border-slate-300 focus:border-indigo-500 outline-none pb-1 bg-white" value={datosCliente.estado_civil} onChange={e => handleChange("estado_civil", e.target.value)}>
                    <option value="">Seleccione...</option>
                    <option value="SOLTERO(A)">SOLTERO(A)</option>
                    <option value="CASADO(A)">CASADO(A)</option>
                    <option value="VIUDO(A)">VIUDO(A)</option>
                    <option value="DIVORCIADO(A)">DIVORCIADO(A)</option>
                    <option value="CONVIVIENTE CIVIL">CONVIVIENTE CIVIL</option>
                  </select> :
                  <p className="text-sm font-semibold text-slate-800">{datosCliente.estado_civil || "-"}</p>
                }
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6 w-full">
              <div className="flex-1">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Comunidad de Bienes</p>
                {isEditing ? 
                  <select className="w-full text-sm border-b border-slate-300 focus:border-indigo-500 outline-none pb-1 bg-white" value={datosCliente.comunidad_bienes} onChange={e => handleChange("comunidad_bienes", e.target.value)}>
                    <option value="SI">SI</option>
                    <option value="NO">NO</option>
                  </select> :
                  <p className="text-sm font-semibold text-slate-800">{datosCliente.comunidad_bienes}</p>
                }
              </div>
              <div className="flex-1">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nacionalidad</p>
                {isEditing ? 
                  <input type="text" className="w-full text-sm border-b border-slate-300 focus:border-indigo-500 outline-none pb-1" value={datosCliente.nacionalidad} onChange={e => handleChange("nacionalidad", e.target.value)} /> :
                  <p className="text-sm font-semibold text-slate-800">{datosCliente.nacionalidad || "-"}</p>
                }
              </div>
              <div className="flex-1">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Profesión y/o Giro Empresa</p>
                {isEditing ? 
                  <input type="text" className="w-full text-sm border-b border-slate-300 focus:border-indigo-500 outline-none pb-1" value={datosCliente.profesion_giro} onChange={e => handleChange("profesion_giro", e.target.value)} /> :
                  <p className="text-sm font-semibold text-slate-800 break-words">{datosCliente.profesion_giro || "-"}</p>
                }
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
