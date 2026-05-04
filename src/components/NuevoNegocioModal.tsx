"use client";

import { useState, useEffect } from "react";
import { X, Save, AlertCircle, Search, RefreshCw, Check } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

// Sub-componente para botones Sí/No (Visual)
const YesNoToggle = ({ label, name, onChange }: { label: string, name: string, onChange?: (val: boolean) => void }) => {
  const [value, setValue] = useState(false);
  return (
    <div className="space-y-1 w-full">
      <input type="hidden" name={name} value={value ? 'true' : 'false'} />
      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{label}</label>
      <div className="flex h-[38px] rounded-sm border border-slate-300 overflow-hidden bg-slate-50/50">
        <button 
          type="button" 
          onClick={() => { setValue(false); onChange?.(false); }} 
          className={`flex-1 flex justify-center items-center transition-colors ${!value ? 'bg-slate-100 border-r border-slate-300 shadow-inner' : 'hover:bg-slate-100 border-r border-slate-200'}`}
        >
          <X className={`w-5 h-5 ${!value ? 'text-red-500' : 'text-slate-300'}`} strokeWidth={3} />
        </button>
        <button 
          type="button" 
          onClick={() => { setValue(true); onChange?.(true); }} 
          className={`flex-1 flex justify-center items-center transition-colors ${value ? 'bg-slate-100 shadow-inner' : 'hover:bg-slate-100'}`}
        >
          <Check className={`w-5 h-5 ${value ? 'text-emerald-400' : 'text-slate-300'}`} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
};

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function NuevoNegocioModal({ onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState<string>("");
  const [userSucursales, setUserSucursales] = useState<string[]>([]);
  const [hasPrepagoVigente, setHasPrepagoVigente] = useState(false);
  
  // Estado para autocompletado del Vehículo
  const [isSearching, setIsSearching] = useState(false);
  const [vehiculoData, setVehiculoData] = useState({
    chasis: "",
    marca: "",
    codigo_modelo: "",
    modelo: "",
    color: "",
    anio: ""
  });

  const supabase = createClient();

  useEffect(() => {
    // Al montar, obtener el correo del usuario logueado automáticamente y su perfil para las sucursales
    const getUserData = async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user?.email) {
        setUserEmail(authData.user.email);
      }

      if (authData?.user?.id) {
        const { data: perfil } = await supabase
          .from("perfiles")
          .select("rol, sucursales")
          .eq("id", authData.user.id)
          .single();
        
        if (perfil) {
          setUserRole(perfil.rol);
          if (perfil.sucursales && perfil.sucursales.length > 0) {
            setUserSucursales(perfil.sucursales);
          }
        }
      }
    };
    getUserData();
  }, []);

  const handleBuscarInterno = async (e: React.FocusEvent<HTMLInputElement>) => {
    const interno = e.target.value.trim();
    if (!interno) return;

    setIsSearching(true);
    setErrorMsg("");
    
    try {
      // Buscar el interno en la tabla stock_nuevos
      const { data, error } = await supabase
        .from("stock_nuevos")
        .select("*")
        .eq("INTERNO", interno)
        .limit(1)
        .single();
        
      if (error) {
        // Podría no existir, probamos también con interno en minúscula por seguridad
        const { data: dataLower, error: errorLower } = await supabase
          .from("stock_nuevos")
          .select("*")
          .eq("interno", interno)
          .limit(1)
          .single();
          
        if (errorLower) {
          setErrorMsg(`No se encontró el interno ${interno} en stock_nuevos.`);
          setIsSearching(false);
          return;
        }
        
        setVehiculoData({
          chasis: dataLower["N° DE CHASIS"] || dataLower["numero_chasis"] || dataLower["chasis"] || "",
          marca: dataLower["MARCA"] || dataLower["marca"] || "",
          codigo_modelo: dataLower["MOD. VEHÍCULO"] || dataLower["mod._vehiculo"] || dataLower["codigo_modelo"] || "",
          modelo: dataLower["DESCRIPCIÓN MODELO"] || dataLower["modelo"] || "",
          color: dataLower["COLOR"] || dataLower["color"] || "",
          anio: dataLower["AÑO"] || dataLower["anio"] || ""
        });
      } else if (data) {
        // Encontrado directo
        setVehiculoData({
          chasis: data["N° DE CHASIS"] || data["numero_chasis"] || data["chasis"] || "",
          marca: data["MARCA"] || data["marca"] || "",
          codigo_modelo: data["MOD. VEHÍCULO"] || data["mod._vehiculo"] || data["codigo_modelo"] || "",
          modelo: data["DESCRIPCIÓN MODELO"] || data["modelo"] || "",
          color: data["COLOR"] || data["color"] || "",
          anio: data["AÑO"] || data["anio"] || ""
        });
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Error consultando stock_nuevos. Verifica que la tabla exista con las columnas requeridas.");
    }

    setIsSearching(false);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    const formData = new FormData(e.currentTarget);
    const data = {
      interno: formData.get("interno") as string,
      pedido_venta: formData.get("pedido_venta") as string,
      rut: (formData.get("rut") as string) || "S/N",
      nombre_apellido: (formData.get("nombre_apellido") as string) || "S/N",
      marca: formData.get("marca") as string,
      modelo: formData.get("modelo") as string,
      color: formData.get("color") as string,
      suc_vta: formData.get("suc_vta") as string,
      vendedor_nombre: formData.get("vendedor_nombre") as string,
      tipo_compra: formData.get("tipo_compra") as string,
      saldo: formData.get("saldo") as string,
      estado: "PARA_REVISIÓN",
      
      // Nuevos campos
      prepago_vigente: formData.get("prepago_vigente") === 'true',
      fecha_vencimiento_prepago: (formData.get("fecha_vencimiento_prepago") as string) || null,
      retoma_usado: formData.get("retoma_usado") === 'true',
      accesorios_instalados: formData.get("accesorios_instalados") === 'true',
      gestion_accesorios: formData.get("gestion_accesorios") as string,
      mantencion_prepagada: formData.get("mantencion_prepagada") === 'true',
      aporte_promocion_marca: formData.get("aporte_promocion_marca") === 'true',
      observacion_inicial: formData.get("observacion_inicial") as string,

      // chasis y año se enviarían aquí una vez agregados a la base de datos oficial
      chasis: formData.get("chasis") as string,
      cod_modelo_vehiculo: formData.get("codigo_modelo") as string,
      ano_facturacion: formData.get("anio") as string
    };

    try {
      const { data: insertedData, error } = await supabase
        .from("negocios")
        .insert([data])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          setErrorMsg(`El Pedido de Venta ${data.pedido_venta} ya existe en el sistema.`);
        } else {
          setErrorMsg(error.message);
        }
        return;
      }

      // 1. Agregar documentos plantillas automáticamente y asociarlos al negocio recién creado
      if (insertedData && insertedData.pedido_venta) {
        const baseTemplates = ['RNVM', 'MPP', 'PEP_PERSONA', 'PEP_EMPRESA'];
        const templateInserts = baseTemplates.map(template => ({
          pedido_venta: insertedData.pedido_venta,
          nombre_archivo: `${template}.pdf`,
          url: `https://xcamqzutgvrplhzvmlka.supabase.co/storage/v1/object/public/documentos_firmados/${template}.pdf`,
          tamano_kb: 50,
          usuario_email: 'sistema',
          es_firmado: true
        }));
        
        const { error: insertTemplatesError } = await supabase.from("negocios_documentos").insert(templateInserts);
        if (insertTemplatesError) {
          console.error("Error insertando las plantillas:", insertTemplatesError);
        }
      }

      onSuccess();
    } catch (err) {
      setErrorMsg("Error de conexión guardando el negocio.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm sm:p-6">
      
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col border border-slate-200">
        
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b px-6 py-4 bg-slate-50">
          <h2 className="text-xl font-bold text-blue-900">Ingresar Nuevo Vehículo</h2>
          <button 
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Cuerpo del Formulario desplazable */}
        <div className="flex-1 overflow-y-auto px-6 py-6 pb-20">
          <form id="new-negocio-form" onSubmit={handleSubmit} className="space-y-6">
            
            {errorMsg && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-100">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p>{errorMsg}</p>
              </div>
            )}

            {/* Panel de Búsqueda conectada a Supabase */}
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
              <div className="flex items-center mb-4">
                <Search className="w-4 h-4 mr-2 text-blue-600" />
                <h3 className="text-sm font-semibold text-blue-900">Búsqueda Automática en Tabla: stock_nuevos</h3>
              </div>
              
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1 relative">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Número de Interno</label>
                  <input 
                    required 
                    name="interno" 
                    type="text" 
                    placeholder="Escribe el interno y presiona TAB" 
                    onBlur={handleBuscarInterno}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-sm" 
                  />
                  {isSearching && (
                    <div className="absolute right-3 top-[28px] text-blue-600">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pedido de Venta</label>
                  <input required name="pedido_venta" type="text" placeholder="Ej: PV-5001" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-sm" />
                </div>
              </div>
            </div>

            <hr className="border-slate-100" />

            <h3 className="text-sm font-semibold text-slate-800">Datos del Vehículo</h3>
            
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Chasis</label>
                <input 
                  required 
                  name="chasis" 
                  type="text" 
                  value={vehiculoData.chasis}
                  readOnly
                  placeholder={isSearching ? "Buscando en Sheets..." : "Autocompletado"} 
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Marca</label>
                <input 
                  required 
                  name="marca" 
                  type="text" 
                  value={vehiculoData.marca}
                  readOnly
                  placeholder={isSearching ? "Buscando en Sheets..." : "Autocompletado"} 
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Código Modelo</label>
                <input 
                  required 
                  name="codigo_modelo" 
                  type="text" 
                  value={vehiculoData.codigo_modelo}
                  readOnly
                  placeholder={isSearching ? "Buscando en Sheets..." : "Autocompletado"} 
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Descr. Modelo</label>
                <input 
                  required 
                  name="modelo" 
                  type="text" 
                  value={vehiculoData.modelo}
                  readOnly
                  placeholder={isSearching ? "Buscando en Sheets..." : "Autocompletado"} 
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Color</label>
                <input 
                  name="color" 
                  type="text" 
                  value={vehiculoData.color}
                  readOnly
                  placeholder={isSearching ? "Buscando en Sheets..." : "Autocompletado"} 
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Año</label>
                <input 
                  name="anio" 
                  type="text" 
                  value={vehiculoData.anio}
                  readOnly
                  placeholder={isSearching ? "Buscando en Sheets..." : "Autocompletado"} 
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600" 
                />
              </div>
            </div>

            <hr className="border-slate-100" />

            <h3 className="text-sm font-semibold text-slate-800">Observaciones de Venta</h3>

            {/* Campos Ocultos Autodetectados */}
            <input type="hidden" name="vendedor_nombre" value={userEmail} />
            <select name="suc_vta" className="hidden" defaultValue={userSucursales[0] ? (
              {
                'C026': 'C026 - CF. LA CALERA',
                'C027': 'C027 - CF. VIÑA DEL MAR',
                'C028': 'C028 - CF. VALPARAISO',
                'C031': 'C031 - CF. SAN ANTONIO',
                'C041': 'C041 - CF. CONCON',
                'C157': 'C157 - CF. ESPACIO URBANO',
                'C168': 'C168 - CF. MELIPILLA'
              }[userSucursales[0]] || userSucursales[0]
            ) : "C026 - CF. LA CALERA"}>
                {/* Si es rol global o no tiene sucursales cargadas aún (o fallback general) */}
                {(["ADMIN", "GERENCIA", "ADMINISTRATIVO"].includes(userRole) || userSucursales.length === 0) ? (
                  <>
                    <option value="C026 - CF. LA CALERA">C026 - CF. LA CALERA</option>
                    <option value="C027 - CF. VIÑA DEL MAR">C027 - CF. VIÑA DEL MAR</option>
                    <option value="C028 - CF. VALPARAISO">C028 - CF. VALPARAISO</option>
                    <option value="C031 - CF. SAN ANTONIO">C031 - CF. SAN ANTONIO</option>
                    <option value="C041 - CF. CONCON">C041 - CF. CONCON</option>
                    <option value="C157 - CF. ESPACIO URBANO">C157 - CF. ESPACIO URBANO</option>
                    <option value="C168 - CF. MELIPILLA">C168 - CF. MELIPILLA</option>
                  </>
                ) : (
                  // Es vendedor o jefe con sucursales asignadas
                  userSucursales.map(suc_codigo => {
                    const mapNombres: Record<string, string> = {
                      'C026': 'C026 - CF. LA CALERA',
                      'C027': 'C027 - CF. VIÑA DEL MAR',
                      'C028': 'C028 - CF. VALPARAISO',
                      'C031': 'C031 - CF. SAN ANTONIO',
                      'C041': 'C041 - CF. CONCON',
                      'C157': 'C157 - CF. ESPACIO URBANO',
                      'C168': 'C168 - CF. MELIPILLA'
                    };
                    const nombreFormateado = mapNombres[suc_codigo] || suc_codigo;
                    return <option key={suc_codigo} value={nombreFormateado}>{nombreFormateado}</option>;
                  })
                )}
            </select>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 mt-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tipo Compra</label>
                <select name="tipo_compra" className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none bg-white">
                   <option value="CONTADO">CONTADO</option>
                   <option value="CONTADO CON RETOMA">CONTADO CON RETOMA</option>
                   <option value="CRÉDITO">CRÉDITO</option>
                   <option value="CRÉDITO CON RETOMA">CRÉDITO CON RETOMA</option>
                   <option value="ORDEN DE COMPRA">ORDEN DE COMPRA</option>
                   <option value="PSR">PSR</option>
                </select>
              </div>

              <div className="space-y-3">
                <YesNoToggle name="prepago_vigente" label="Prepago Vigente" onChange={setHasPrepagoVigente} />
                {hasPrepagoVigente && (
                  <div className="space-y-1 animate-in fade-in zoom-in duration-200">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider text-blue-600">Fecha Prepago</label>
                    <input type="date" required name="fecha_vencimiento_prepago" className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none bg-white" />
                  </div>
                )}
              </div>

              <YesNoToggle name="retoma_usado" label="Retoma Usado" />
              <YesNoToggle name="mantencion_prepagada" label="Mantención Prepagada" />
              <YesNoToggle name="accesorios_instalados" label="Accesorios Instalados" />

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Gestión de Accesorios</label>
                <select name="gestion_accesorios" className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none bg-white">
                   <option value="COMPRÓ CON EL VENDEDOR">COMPRÓ CON EL VENDEDOR</option>
                   <option value="OFRECIDO AL CLIENTE PERO NO ACEPTÓ">OFRECIDO AL CLIENTE PERO NO ACEPTÓ</option>
                   <option value="NO OFRECIDO">NO OFRECIDO</option>
                </select>
              </div>

              <YesNoToggle name="aporte_promocion_marca" label="Aporte Promoción Marca" />

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Saldo Inicial</label>
                <select name="saldo" className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none bg-white">
                   <option value="COMPLETO">COMPLETO</option>
                   <option value="PENDIENTE">PENDIENTE</option>
                   <option value="SOBRANTE">SOBRANTE</option>
                </select>
              </div>
            </div>

            <div className="space-y-1 mt-4">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Observación Inicial</label>
              <textarea 
                required
                name="observacion_inicial" 
                rows={2} 
                placeholder="Escriba aquí los detalles..." 
                className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none" 
              />
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 w-full border-t border-slate-200 bg-white px-6 py-4 flex justify-end gap-3 rounded-b-2xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <button 
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button 
            type="submit"
            form="new-negocio-form"
            disabled={loading || isSearching}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-800 hover:bg-blue-700 active:scale-95 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:active:scale-100 shadow-sm"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <Save className="w-4 h-4" />
            )}
            Crear Negocio
          </button>
        </div>

      </div>
    </div>
  );
}
