"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { ChevronLeft, Save, Loader2, RefreshCcw, FileText, Calculator } from "lucide-react";
import React from "react";
import CalculoPapeles from "./CalculoPapeles";

export default function CalculadoraFormPage(props: { params: Promise<{ rut: string }> }) {
  const params = React.use(props.params);
  const router = useRouter();
  const supabase = createClient();
  const isNew = params.rut === "nuevo" || params.rut === "undefined";
  const decodedRut = isNew ? "" : decodeURIComponent(params.rut);

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Tab State
  const [activeTab, setActiveTab] = useState<"compra" | "papeles">("compra");

  // Form State
  const [form, setForm] = useState({
    rut: decodedRut,
    nombre_apellido: "",
    mod_vehiculo: "",
    marca: "",
    descripcion_modelo: "",
    tipo_compra: "Contado",
    precio_lista: 0,
    bono_marca: 0,
    bono_amicar_suzuval: 0,
    bono_amicar_derco: 0,
    flete_grabado: 181000,
    precio_venta_accesorios: 0,
    mantencion_10: 0,
    mantencion_20: 0,
    mantencion_30: 0,
    mantencion_10_bruto: 0,
    mantencion_20_bruto: 0,
    mantencion_30_bruto: 0,
    inscripcion: 89560,
    permiso_circulacion: 0,
    soap_sello_verde: 0,
    impuesto_verde: 0,
    dcto_suzuval_zqdv: 0,
    dcto_suzuval_zqdv_monto: 0,
    aporte_marca_derco_z126: 0,
    aporte_marca_derco_z126_monto: 0,
    pagos_comprobantes: Array(6).fill({ n_comprobante: "", pagos: 0, tipo_pago: "--" }),
    creador_email: "",
  });

  useEffect(() => {
    if (!isNew && decodedRut) {
      loadData(decodedRut);
    }
    
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setForm(prev => {
          if (prev.creador_email === user.email) return prev;
          return { ...prev, creador_email: prev.creador_email || user.email || "" };
        });
      }
    };
    fetchUser();
  }, [decodedRut]);

  const loadData = async (rutPivot: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("formularios_facturacion")
      .select("*")
      .eq("rut", rutPivot)
      .single();

    if (data) {
      // Ensure array length of 6 for table
      const rawPagos = Array.isArray(data.pagos_comprobantes) ? data.pagos_comprobantes : [];
      const pagosPadded = [...rawPagos];
      while (pagosPadded.length < 6) {
        pagosPadded.push({ n_comprobante: "", pagos: 0, tipo_pago: "--" });
      }

      setForm({
        rut: data.rut || "",
        nombre_apellido: data.nombre_apellido || "",
        mod_vehiculo: data.mod_vehiculo || "",
        marca: data.marca || "",
        descripcion_modelo: data.descripcion_modelo || "",
        tipo_compra: data.tipo_compra || "Contado",
        precio_lista: data.precio_lista || 0,
        bono_marca: data.bono_marca || 0,
        bono_amicar_suzuval: data.bono_amicar_suzuval || 0,
        bono_amicar_derco: data.bono_amicar_derco || 0,
        flete_grabado: data.flete_grabado || 0,
        precio_venta_accesorios: data.precio_venta_accesorios || 0,
        mantencion_10: data.mantencion_10 || 0,
        mantencion_20: data.mantencion_20 || 0,
        mantencion_30: data.mantencion_30 || 0,
        mantencion_10_bruto: data.mantencion_10_bruto || 0,
        mantencion_20_bruto: data.mantencion_20_bruto || 0,
        mantencion_30_bruto: data.mantencion_30_bruto || 0,
        inscripcion: data.inscripcion || 0,
        permiso_circulacion: data.permiso_circulacion || 0,
        soap_sello_verde: data.soap_sello_verde || 0,
        impuesto_verde: data.impuesto_verde || 0,
        dcto_suzuval_zqdv: data.dcto_suzuval_zqdv || 0,
        dcto_suzuval_zqdv_monto: data.dcto_suzuval_zqdv_monto || 0,
        aporte_marca_derco_z126: data.aporte_marca_derco_z126 || 0,
        aporte_marca_derco_z126_monto: data.aporte_marca_derco_z126_monto || 0,
        pagos_comprobantes: pagosPadded.slice(0, 6),
        creador_email: data.creador_email || ""
      });
    } else {
      // If we used a rut that doesn't exist yet in the db, just set the RUT field
      setForm(prev => ({ ...prev, rut: rutPivot }));
    }
    setLoading(false);
  };

  const handleChange = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handlePagoChange = (index: number, field: string, value: any) => {
    const newPagos = [...form.pagos_comprobantes];
    newPagos[index] = { ...newPagos[index], [field]: value };
    setForm(prev => ({ ...prev, pagos_comprobantes: newPagos }));
  };

  // Buscador automático de Vehículo
  useEffect(() => {
    const fetchVehiculo = async () => {
      // Intenta buscar si el código tiene al menos 2 caracteres
      if (form.mod_vehiculo && form.mod_vehiculo.trim().length >= 2) {
        const { data, error } = await supabase
          .from("stock_nuevos")
          .select("*")
          .eq('"MOD. VEHÍCULO"', form.mod_vehiculo.trim())
          .limit(1);
        
        if (data && data.length > 0 && !error) {
          const match = data[0];
          setForm(prev => {
            const newMarca = match["MARCA"] || prev.marca;
            const newDesc = match["DESCRIPCIÓN MODELO"] || prev.descripcion_modelo;
            if (prev.marca === newMarca && prev.descripcion_modelo === newDesc) {
              return prev;
            }
            return { 
              ...prev, 
              marca: newMarca, 
              descripcion_modelo: newDesc 
            };
          });
        }
      }
    };

    const timeoutId = setTimeout(() => {
      fetchVehiculo();
    }, 600); // debounce de 600ms

    return () => clearTimeout(timeoutId);
  }, [form.mod_vehiculo]);

  // Calculations
  const calcPrecioContado = form.precio_lista - form.bono_marca;
  const calcPrecioFinal = calcPrecioContado 
    - form.bono_amicar_suzuval 
    - form.bono_amicar_derco 
    + form.flete_grabado 
    + form.precio_venta_accesorios 
    + form.mantencion_10 
    + form.mantencion_20 
    + form.mantencion_30;

  const calcTotalPapeles = form.inscripcion + form.permiso_circulacion + form.soap_sello_verde + form.impuesto_verde;
  
  const calcTotalAPagar = calcPrecioFinal + calcTotalPapeles - form.dcto_suzuval_zqdv - form.aporte_marca_derco_z126;

  const totalPagos = form.pagos_comprobantes.reduce((sum, p) => sum + (Number(p.pagos) || 0), 0);
  
  // Calculate recargo
  // Recargo 1.19% applies only to "Tarjeta" payment types
  let recargos = 0;
  form.pagos_comprobantes.forEach(p => {
    if (p.tipo_pago && p.tipo_pago.toLowerCase().includes('tarjeta')) {
      recargos += (Number(p.pagos) || 0) * 0.0119;
    }
  });

  const saldoPendiente = calcTotalAPagar + recargos - totalPagos;

  const calcPct = (amount: number) => {
    if (!form.precio_lista) return 0;
    return (amount / form.precio_lista) * 100;
  };

  const pctSuzuvalZqdv = calcPct(form.dcto_suzuval_zqdv);
  const pctDercoZ126 = calcPct(form.aporte_marca_derco_z126);
  const pctAmicarSuzuval = calcPct(form.bono_amicar_suzuval);
  const pctAmicarDerco = calcPct(form.bono_amicar_derco);

  const totalDctoSuzuval = Number(form.dcto_suzuval_zqdv || 0) + Number(form.bono_amicar_suzuval || 0);
  const pctTotalSuzuval = calcPct(totalDctoSuzuval);

  const totalDctoDerco = Number(form.aporte_marca_derco_z126 || 0) + Number(form.bono_amicar_derco || 0);
  const pctTotalDerco = calcPct(totalDctoDerco);

  // Estable callback para actualizar papeles desde CalculoPapeles hijo
  const handleUpdateValores = useCallback((valores: {
    inscripcion: number;
    permiso_circulacion: number;
    soap_sello_verde: number;
    impuesto_verde: number;
  }) => {
    setForm((prev) => {
      if (
        prev.inscripcion === valores.inscripcion &&
        prev.permiso_circulacion === valores.permiso_circulacion &&
        prev.soap_sello_verde === valores.soap_sello_verde &&
        prev.impuesto_verde === valores.impuesto_verde
      ) {
        return prev;
      }
      return {
        ...prev,
        inscripcion: valores.inscripcion,
        permiso_circulacion: valores.permiso_circulacion,
        soap_sello_verde: valores.soap_sello_verde,
        impuesto_verde: valores.impuesto_verde
      };
    });
  }, []);

  const handleSave = async (eOrManual?: React.FocusEvent | React.MouseEvent | boolean) => {
    const isManual = eOrManual === true;
    
    // Desactivar autoguardado
    if (!isManual) {
      return;
    }

    if (!form.rut) {
      return;
    }
    if (!form.mod_vehiculo) {
      return;
    }
    if (!form.nombre_apellido) {
      return;
    }
    setSaving(true);
    
    const payload = {
      ...form,
      precio_final: calcPrecioFinal,
      saldo_pendiente: saldoPendiente
    };

    // Remover llaves que no existen en base de datos si ocurre un error de "Column no encontrada" 
    // (Por ejemplo, temporalmente eliminar mod_vehiculo, marca, descripcion si aún no has corrido la migración SQL)
    // delete payload.mod_vehiculo;
    // delete payload.marca;
    // delete payload.descripcion_modelo;

    const { data: existing } = await supabase
      .from("formularios_facturacion")
      .select("id")
      .eq("rut", form.rut)
      .single();

    let res;
    if (existing) {
      res = await supabase.from("formularios_facturacion").update(payload).eq("rut", form.rut);
    } else {
      res = await supabase.from("formularios_facturacion").insert(payload);
    }

    setSaving(false);
    if (!res.error) {
      setLastSaved(new Date());
      if (isManual) {
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          router.push("/formularios");
        }, 2000);
      }
      if (isNew) {
        router.replace(`/formularios/${encodeURIComponent(form.rut)}`);
      }
    } else {
      alert("Error al guardar: " + res.error.message);
    }
  };

  const handleReset = () => {
    setForm(prev => ({
      ...prev,
      mod_vehiculo: "",
      marca: "",
      descripcion_modelo: "",
      tipo_compra: "",
      precio_lista: 0,
      bono_marca: 0,
      bono_amicar_suzuval: 0,
      bono_amicar_derco: 0,
      flete_grabado: 181000,
      precio_venta_accesorios: 0,
      mantencion_10: 0,
      mantencion_20: 0,
      mantencion_30: 0,
      inscripcion: 89560,
      permiso_circulacion: 0,
      soap_sello_verde: 33000,
      impuesto_verde: 0,
      dcto_suzuval_zqdv: 0,
      dcto_suzuval_zqdv_monto: 0,
      aporte_marca_derco_z126: 0,
      aporte_marca_derco_z126_monto: 0,
      pagos_comprobantes: Array(6).fill({ n_comprobante: "", pagos: 0, tipo_pago: "--" })
    }));
  };

  const formatCLP = (num: number) => {
    return num.toLocaleString('es-CL');
  };

  const formatPct = (num: number) => {
    return num.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
  };

  if (loading) {
    return <div className="p-8 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
  }

  return (
    <div className="flex-1 bg-white overflow-auto pb-20">
      
      {/* Header flotante */}
      <div className="sticky top-0 bg-white border-b border-slate-200 shadow-sm z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/formularios')} className="text-slate-500 hover:text-slate-800 transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Cálculo de Vehículos Nuevos</h1>
            {(!form.rut || !form.mod_vehiculo || !form.nombre_apellido) ? (
              <p className="text-xs text-amber-600 font-medium flex items-center gap-1">⚠️ Falta RUT, NOMBRE o MOD. VEHÍCULO para guardar</p>
            ) : lastSaved ? (
              <p className="text-xs text-slate-400">Guardado a las {lastSaved.toLocaleTimeString()}</p>
            ) : null}
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button 
            onClick={() => setActiveTab("compra")}
            className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-colors ${activeTab === 'compra' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <FileText className="w-4 h-4" />
            Cálculo Compra
          </button>
          <button 
            onClick={() => setActiveTab("papeles")}
            className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-colors ${activeTab === 'papeles' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Calculator className="w-4 h-4" />
            Cálculo Papeles
          </button>
        </div>

        <div className="flex gap-3">
          <button onClick={handleReset} className="px-4 py-2 border border-orange-400 bg-orange-50 text-orange-700 font-bold rounded-md hover:bg-orange-100 transition-colors flex items-center gap-2">
            <RefreshCcw className="w-4 h-4" /> Limpiar Cuadratura
          </button>
          <button onClick={() => handleSave(true)} disabled={saving || !form.rut || !form.mod_vehiculo || !form.nombre_apellido} className="relative px-5 py-2 bg-indigo-600 text-white font-bold rounded-md hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} GUARDAR
            {showSuccess && (
              <div className="absolute top-full mt-2 right-0 bg-green-500 text-white text-xs px-3 py-1.5 rounded shadow-lg whitespace-nowrap z-50">
                ¡Cálculo guardado correctamente!
              </div>
            )}
          </button>
        </div>
      </div>

      <div className="p-6 max-w-[1200px] mx-auto">
        <div className={activeTab === "compra" ? "block" : "hidden"}>
          <>
            <div className="flex gap-4 mb-6">
           <div className="flex-1">
             <label className="block text-xs font-bold text-slate-500 uppercase mb-1">RUT CLIENTE (Sin Puntos y con Guión)</label>
             <input type="text" value={form.rut} onChange={e => handleChange('rut', e.target.value)} onBlur={handleSave} className="w-full border-b-2 border-slate-300 focus:border-indigo-500 bg-slate-50 p-2 font-mono outline-none" placeholder="12345678-9"/>
           </div>
           <div className="flex-[2]">
             <label className="block text-xs font-bold text-slate-500 uppercase mb-1">NOMBRE Y APELLIDO</label>
             <input type="text" value={form.nombre_apellido} onChange={e => handleChange('nombre_apellido', e.target.value)} onBlur={handleSave} className="w-full border-b-2 border-slate-300 focus:border-indigo-500 bg-slate-50 p-2 font-bold outline-none uppercase" placeholder="Nombre completo..."/>
           </div>
         </div>

         {/* SECCIÓN VEHÍCULO */}
         <div className="flex gap-4 mb-6">
           <div className="flex-1">
             <label className="block font-bold text-slate-500 uppercase mb-1 flex items-baseline gap-1">
               <span className="text-xs">MOD. VEHÍCULO</span> 
               <span className="text-[10px] font-normal normal-case text-slate-400">(Código Modelo)</span>
             </label>
             <input type="text" value={form.mod_vehiculo} onChange={e => handleChange('mod_vehiculo', e.target.value.toUpperCase())} onBlur={handleSave} className="w-full border-b-2 border-slate-300 focus:border-blue-500 bg-blue-50/30 p-2 font-mono outline-none uppercase" placeholder="EJ: SZ-SFT..."/>
           </div>
           <div className="flex-1">
             <label className="block text-xs font-bold text-slate-500 uppercase mb-1">MARCA</label>
             <input type="text" value={form.marca} readOnly className="w-full border-b-2 border-slate-200 bg-slate-50 p-2 font-bold outline-none uppercase text-slate-500 cursor-not-allowed" placeholder="Marca..."/>
           </div>
           <div className="flex-[2]">
             <label className="block text-xs font-bold text-slate-500 uppercase mb-1">DESCRIPCIÓN MODELO</label>
             <input type="text" value={form.descripcion_modelo} readOnly className="w-full border-b-2 border-slate-200 bg-slate-50 p-2 font-bold outline-none uppercase text-slate-500 cursor-not-allowed" placeholder="Descripción..."/>
           </div>
         </div>

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
                  <div className="w-1/2 bg-white">
                     <select 
                       value={form.tipo_compra} 
                       onChange={(e) => handleChange('tipo_compra', e.target.value)}
                       onBlur={handleSave}
                       className="w-full h-full text-center outline-none bg-transparent font-medium text-slate-700"
                     >
                        <option value="">Seleccione...</option>
                        <option value="Contado con Renovación">Contado con Renovación</option>
                        <option value="Contado sin Renovación">Contado sin Renovación</option>
                        <option value="Financiamiento con Renovación">Financiamiento con Renovación</option>
                        <option value="Financiamiento sin Renovación">Financiamiento sin Renovación</option>
                        <option value="Flota">Flota</option>
                        <option value="Crédito con Retoma">Crédito con Retoma</option>
                        <option value="Leasing">Leasing</option>
                        <option value="PSR">PSR</option>
                     </select>
                  </div>
                </div>

                {/* Precio Lista */}
                <div className="flex border-b border-slate-300 text-sm h-[34px]">
                  <div className="w-1/2 px-2 flex items-center border-r border-slate-300 font-medium">Precio Lista</div>
                  <div className="w-1/4 border-r border-slate-300 bg-white flex items-center justify-center font-mono">
                    <NumberInput value={form.precio_lista} onChange={(v) => handleChange('precio_lista', v)} onBlur={handleSave} />
                  </div>
                  <div className="w-1/4 bg-slate-50 flex items-center justify-center font-mono text-slate-700">
                    {formatCLP(Math.round((form.precio_lista || 0) / 1.19))}
                  </div>
                </div>

                {/* Bono Marca */}
                <div className="flex border-b border-slate-300 text-sm h-[34px]">
                  <div className="w-1/2 px-2 flex items-center border-r border-slate-300 font-medium">Bono Marca</div>
                  <div className="w-1/4 border-r border-slate-300 bg-white flex items-center justify-center font-mono">
                    <NumberInput value={form.bono_marca} onChange={(v) => handleChange('bono_marca', v)} onBlur={handleSave} />
                  </div>
                  <div className="w-1/4 bg-slate-50 flex items-center justify-center font-mono text-slate-700">
                    {formatCLP(Math.round((form.bono_marca || 0) / 1.19))}
                  </div>
                </div>

                {/* Precio Contado */}
                <div className="flex border-b border-slate-300 text-sm h-[34px] bg-orange-50 font-bold">
                  <div className="w-1/2 px-2 flex items-center border-r border-slate-300">Precio Contado</div>
                  <div className="w-1/4 border-r border-slate-300 flex items-center justify-center font-mono text-slate-900">
                    {formatCLP(calcPrecioContado)}
                  </div>
                  <div className="w-1/4 flex items-center justify-center font-mono text-slate-900 bg-orange-50/50">
                    {formatCLP(Math.round((calcPrecioContado || 0) / 1.19))}
                  </div>
                </div>

                {/* Bono Amicar (Cargo a Suzuval) */}
                <div className="flex border-b border-slate-300 text-sm h-[34px]">
                  <div className="w-1/2 px-2 flex items-center border-r border-slate-300 font-medium">Bono Amicar (Cargo a Suzuval)</div>
                  <div className="w-1/4 border-r border-slate-300 bg-white flex items-center justify-center font-mono">
                    <NumberInput value={form.bono_amicar_suzuval} onChange={(v) => handleChange('bono_amicar_suzuval', v)} onBlur={handleSave} />
                  </div>
                  <div className="w-1/4 bg-slate-50 flex items-center justify-center font-mono text-slate-700">
                    {formatCLP(Math.round((form.bono_amicar_suzuval || 0) / 1.19))}
                  </div>
                </div>

                {/* Bono Amicar (Cargo a Derco) */}
                <div className="flex border-b border-slate-300 text-sm h-[34px]">
                  <div className="w-1/2 px-2 flex items-center border-r border-slate-300 font-medium">Bono Amicar (Cargo a Derco)</div>
                  <div className="w-1/4 border-r border-slate-300 bg-white flex items-center justify-center font-mono">
                    <NumberInput value={form.bono_amicar_derco} onChange={(v) => handleChange('bono_amicar_derco', v)} onBlur={handleSave} />
                  </div>
                  <div className="w-1/4 bg-slate-50 flex items-center justify-center font-mono text-slate-700">
                    {formatCLP(Math.round((form.bono_amicar_derco || 0) / 1.19))}
                  </div>
                </div>

                {/* Flete + Grabado */}
                <div className="flex border-b border-slate-300 text-sm h-[34px]">
                  <div className="w-1/2 px-2 flex items-center border-r border-slate-300 font-medium">Flete + Grabado</div>
                  <div className="w-1/4 border-r border-slate-300 bg-white flex items-center justify-center font-mono">
                    <NumberInput value={form.flete_grabado} onChange={(v) => handleChange('flete_grabado', v)} onBlur={handleSave} />
                  </div>
                  <div className="w-1/4 bg-slate-50 flex items-center justify-center font-mono text-slate-700">
                    {formatCLP(Math.round((form.flete_grabado || 0) / 1.19))}
                  </div>
                </div>

                {/* Precio Venta Accesorios */}
                <div className="flex border-b border-slate-300 text-sm h-[34px]">
                  <div className="w-1/2 px-2 flex items-center border-r border-slate-300 font-medium">Precio Accesorio o Mantención</div>
                  <div className="w-1/4 border-r border-slate-300 bg-white flex items-center justify-center font-mono">
                    <NumberInput value={form.precio_venta_accesorios} onChange={(v) => handleChange('precio_venta_accesorios', v)} onBlur={handleSave} />
                  </div>
                  <div className="w-1/4 bg-slate-50 flex items-center justify-center font-mono text-slate-700">
                    {formatCLP(Math.round((form.precio_venta_accesorios || 0) / 1.19))}
                  </div>
                </div>

                {/* Mantencion 10 */}
                <div className="flex border-b border-slate-300 text-sm h-[34px]">
                  <div className="w-1/2 px-2 flex items-center border-r border-slate-300 font-medium">Mantención 10.000</div>
                  <div className="w-1/4 border-r border-slate-300 bg-white flex items-center justify-center font-mono">
                    <NumberInput value={form.mantencion_10} onChange={(v) => handleChange('mantencion_10', v)} onBlur={handleSave} />
                  </div>
                  <div className="w-1/4 bg-slate-50 flex items-center justify-center font-mono text-slate-700">
                    {formatCLP(Math.round((form.mantencion_10 || 0) / 1.19))}
                  </div>
                </div>

                {/* Mantencion 20 */}
                <div className="flex border-b border-slate-300 text-sm h-[34px]">
                  <div className="w-1/2 px-2 flex items-center border-r border-slate-300 font-medium">Mantención 20.000</div>
                  <div className="w-1/4 border-r border-slate-300 bg-white flex items-center justify-center font-mono">
                    <NumberInput value={form.mantencion_20} onChange={(v) => handleChange('mantencion_20', v)} onBlur={handleSave} />
                  </div>
                  <div className="w-1/4 bg-slate-50 flex items-center justify-center font-mono text-slate-700">
                    {formatCLP(Math.round((form.mantencion_20 || 0) / 1.19))}
                  </div>
                </div>

                {/* Mantencion 30 */}
                <div className="flex border-b border-slate-300 text-sm h-[34px]">
                  <div className="w-1/2 px-2 flex items-center border-r border-slate-300 font-medium">Mantención 30.000</div>
                  <div className="w-1/4 border-r border-slate-300 bg-white flex items-center justify-center font-mono">
                    <NumberInput value={form.mantencion_30} onChange={(v) => handleChange('mantencion_30', v)} onBlur={handleSave} />
                  </div>
                  <div className="w-1/4 bg-slate-50 flex items-center justify-center font-mono text-slate-700">
                    {formatCLP(Math.round((form.mantencion_30 || 0) / 1.19))}
                  </div>
                </div>

                {/* Precio Final */}
                <div className="flex border-b border-slate-300 text-sm h-[34px] bg-orange-50 font-bold">
                  <div className="w-1/2 px-2 flex items-center border-r border-slate-300">Precio Final</div>
                  <div className="w-1/4 border-r border-slate-300 flex items-center justify-center font-mono text-slate-900">
                    {formatCLP(calcPrecioFinal)}
                  </div>
                  <div className="w-1/4 flex items-center justify-center font-mono text-slate-900 bg-orange-50/50">
                    {formatCLP(Math.round((calcPrecioFinal || 0) / 1.19))}
                  </div>
                </div>

              </div>
            </div>

            {/* DESCUENTOS APORTES */}
            <div className="border border-slate-300 flex mb-6">
              <div className="w-12 bg-slate-100 border-r border-slate-300 flex items-center justify-center p-1">
                <span className="transform -rotate-90 whitespace-nowrap font-bold text-xs text-slate-600 tracking-widest text-center">APORTES</span>
              </div>
              <div className="flex-1 flex flex-col">
                 <div className="flex border-b border-slate-300 text-sm h-[34px]">
                   <div className="w-1/2 px-2 flex items-center justify-between border-r border-slate-300 font-medium">
                     <span>Descuentos Suzuval - ZQDV</span>
                     <span className="font-mono text-slate-500">{formatPct(pctSuzuvalZqdv)}</span>
                   </div>
                   <div className="w-1/4 border-r border-slate-300 bg-white">
                      <NumberInput value={form.dcto_suzuval_zqdv} onChange={(v) => handleChange('dcto_suzuval_zqdv', v)} onBlur={handleSave} />
                   </div>
                   <div className="w-1/4 bg-slate-50 flex items-center justify-center font-mono text-slate-700">
                      {formatCLP(Math.round((form.dcto_suzuval_zqdv || 0) / 1.19))}
                   </div>
                 </div>
                 <div className="flex text-sm h-[34px]">
                   <div className="w-1/2 px-2 flex items-center justify-between border-r border-slate-300 font-medium">
                     <span>Aporte Marca Derco - Z126</span>
                     <span className="font-mono text-slate-500">{formatPct(pctDercoZ126)}</span>
                   </div>
                   <div className="w-1/4 border-r border-slate-300 bg-white">
                      <NumberInput value={form.aporte_marca_derco_z126} onChange={(v) => handleChange('aporte_marca_derco_z126', v)} onBlur={handleSave} />
                   </div>
                   <div className="w-1/4 bg-slate-50 flex items-center justify-center font-mono text-slate-700">
                      {formatCLP(Math.round((form.aporte_marca_derco_z126 || 0) / 1.19))}
                   </div>
                 </div>
              </div>
            </div>

            {/* PAPELES INSCRIPCIÓN */}
            <div className="border border-slate-300 flex">
              <div className="w-12 bg-slate-100 border-r border-slate-300 flex items-center justify-center p-2">
                <span className="transform -rotate-90 whitespace-nowrap font-bold text-xs text-slate-600 tracking-widest text-center">PAPELES <br/> INSCRIPCIÓN</span>
              </div>
              <div className="flex-1 flex flex-col">
                 <NumRow title="Inscripción" value={form.inscripcion} onChange={(v) => handleChange('inscripcion', v)} onBlur={handleSave} />
                 <NumRow title="Permiso Circulación" value={form.permiso_circulacion} onChange={(v) => handleChange('permiso_circulacion', v)} onBlur={handleSave} />
                 <NumRow title="Seguro Obligatorio (SOAP) + Sello Verde" value={form.soap_sello_verde} onChange={(v) => handleChange('soap_sello_verde', v)} onBlur={handleSave} />
                 <NumRow title={<a href="https://www4.sii.cl/calcImpVehiculoNuevoInternet/internet.html" target="_blank" rel="noopener noreferrer" className="hover:text-blue-800">Impuesto Verde (Revisar en SII.cl)</a>} titleClass="text-blue-600 underline" value={form.impuesto_verde} onChange={(v) => handleChange('impuesto_verde', v)} onBlur={handleSave} />
                 <CalcRow title="Total Papeles" bg="bg-orange-100/50" value={calcTotalPapeles} />
              </div>
            </div>
          </div>

          {/* LADO DERECHO */}
          <div className="flex flex-col gap-6">

             {/* NUEVA TABLA: TOTAL COMPRA Y TOTAL FACTURA */}
             <div className="border border-slate-400">
               <div className="flex border-b border-slate-400 text-sm h-[34px]">
                 <div className="flex-[1.5] px-2 flex items-center border-r border-slate-400 font-bold bg-slate-100">Total Compra</div>
                 <div className="flex-1 flex items-center justify-center font-bold text-slate-800 bg-white">${formatCLP(calcTotalAPagar)}</div>
               </div>
               <div className="flex text-sm h-[34px]">
                 <div className="flex-[1.5] px-2 flex items-center justify-between border-r border-slate-400 font-bold bg-slate-100">
                   <span>Total Factura</span>
                   <span className="text-slate-500 font-normal text-xs font-mono">(${formatCLP(Math.round((calcTotalAPagar - calcTotalPapeles) / 1.19))})</span>
                 </div>
                 <div className="flex-1 flex items-center justify-center font-bold text-slate-800 bg-white">${formatCLP(calcTotalAPagar - calcTotalPapeles)}</div>
               </div>
             </div>
             
             {/* PAGOS $$ */}
             <div className="border border-slate-400">
               <div className="grid grid-cols-[1fr_1fr_1.5fr] bg-slate-200 border-b border-slate-400 font-bold text-xs uppercase text-center">
                 <div className="py-2 border-r border-slate-400 flex items-center justify-center">N° Comprobante</div>
                 <div className="py-2 border-r border-slate-400 flex items-center justify-center">PAGOS $$</div>
                 <div className="py-2 flex items-center justify-center">Tipo de Pago</div>
               </div>
               {form.pagos_comprobantes.map((p, i) => (
                 <div key={i} className="grid grid-cols-[1fr_1fr_1.5fr] border-b border-slate-400 text-sm bg-blue-50/30">
                   <div className="border-r border-slate-400 flex">
                     <input type="text" className="w-full h-8 bg-transparent text-center outline-none px-1" value={p.n_comprobante} onChange={(e) => handlePagoChange(i, 'n_comprobante', e.target.value)} onBlur={handleSave} />
                   </div>
                   <div className="border-r border-slate-400 flex">
                     <NumberInput value={p.pagos} onChange={(v) => handlePagoChange(i, 'pagos', v)} onBlur={handleSave} />
                   </div>
                   <div className="flex">
                     <select className="w-full h-8 bg-transparent text-center outline-none text-xs px-1" value={p.tipo_pago} onChange={(e) => handlePagoChange(i, 'tipo_pago', e.target.value)} onBlur={handleSave}>
                       <option value="--">--</option>
                       <option value="Transferencia">Transferencia</option>
                       <option value="Efectivo">Efectivo</option>
                       <option value="Tarjeta Crédito">Tarjeta Crédito</option>
                       <option value="Tarjeta Débito">Tarjeta Débito</option>
                       <option value="Vale Vista">Vale Vista</option>
                     </select>
                   </div>
                 </div>
               ))}
               <div className="grid grid-cols-[1fr_1fr_1.5fr] border-b border-slate-400 text-sm">
                 <div className="py-1.5 px-1 bg-slate-50 border-r border-slate-400 flex items-center justify-center text-slate-500">Total Pagos</div>
                 <div className="py-1.5 px-1 bg-slate-50 border-r border-slate-400 flex items-center justify-center font-bold text-slate-800">${formatCLP(totalPagos)}</div>
                 <div className="bg-slate-50 flex items-center justify-center text-slate-500"></div>
               </div>
             </div>

             {/* TOTAL A PAGAR CLIENTE */}
             <div className="border border-slate-400 mt-2">
                <div className="flex border-b border-slate-400 text-sm font-bold">
                  <div className="flex-[2] py-2 px-4 border-r border-slate-400 text-center bg-white">TOTAL A PAGAR CLIENTE</div>
                  <div className="flex-1 py-2 px-2 text-center bg-white">${formatCLP(calcTotalAPagar)}</div>
                </div>

                {(() => {
                  let statusBg = "bg-red-100 text-red-900";
                  let statusText = "Negocio con Saldo Pendiente";
                  let valueBg = "bg-red-50 border-red-200 text-slate-800";
                  
                  if (saldoPendiente === 0) {
                    statusBg = "bg-green-100 text-green-900";
                    statusText = "Negocio con Saldo Completo";
                    valueBg = "bg-green-50 border-green-200 text-green-800";
                  } else if (saldoPendiente < 0) {
                    statusBg = "bg-emerald-200 text-emerald-900";
                    statusText = "Negocio con Saldo Sobrante";
                    valueBg = "bg-emerald-100 border-emerald-300 text-emerald-800";
                  }

                  return (
                    <>
                      <div className={`flex border-b border-slate-400 text-sm font-bold ${statusBg}`}>
                        <div className="w-full py-1.5 text-center">{statusText}</div>
                      </div>
                      <div className={`flex text-sm font-bold border-b-2 ${valueBg}`}>
                        <div className="flex-[2] py-2 px-4 border-r border-slate-400 text-right">Saldo Pendiente de: </div>
                        <div className="flex-1 py-2 px-2 flex items-center justify-center text-xl tracking-tight">
                          ${formatCLP(saldoPendiente)}
                        </div>
                      </div>
                    </>
                  );
                })()}
             </div>

             {/* RESUMEN DESCUENTOS */}
             <div className="flex mt-4 text-xs border border-slate-400 font-bold">
                <div className="w-24 border-r border-slate-400 flex items-center justify-center p-2 text-center text-slate-500 bg-slate-50 uppercase">
                  Resumen<br/>Descuentos
                </div>
                <div className="flex-1 flex flex-col bg-sky-50">
                  <div className="flex border-b border-slate-400 py-1">
                    <div className="flex-[2] border-r border-slate-400 px-2">Dcto Suzuval - ZQDV</div>
                    <div className="w-16 border-r border-slate-400 text-center">{formatPct(pctSuzuvalZqdv)}</div>
                    <div className="flex-1 text-center font-mono">{form.dcto_suzuval_zqdv ? formatCLP(form.dcto_suzuval_zqdv) : ""}</div>
                  </div>
                  <div className="flex border-b border-slate-400 py-1">
                    <div className="flex-[2] border-r border-slate-400 px-2">Dcto Amicar Suzuval - Z104</div>
                    <div className="w-16 border-r border-slate-400 text-center">{formatPct(pctAmicarSuzuval)}</div>
                    <div className="flex-1 text-center font-mono">{form.bono_amicar_suzuval ? formatCLP(form.bono_amicar_suzuval) : ""}</div>
                  </div>
                  <div className="flex border-b border-slate-400 py-1 bg-sky-200">
                    <div className="flex-[2] border-r border-slate-400 px-2">Total</div>
                    <div className="w-16 border-r border-slate-400 text-center">{formatPct(pctTotalSuzuval)}</div>
                    <div className="flex-1 text-center font-mono">{totalDctoSuzuval ? formatCLP(totalDctoSuzuval) : ""}</div>
                  </div>
                  <div className="flex border-b border-slate-400 py-1">
                    <div className="flex-[2] border-r border-slate-400 px-2">Dcto Derco Manual - Z126</div>
                    <div className="w-16 border-r border-slate-400 text-center">{formatPct(pctDercoZ126)}</div>
                    <div className="flex-1 text-center font-mono">{form.aporte_marca_derco_z126 ? formatCLP(form.aporte_marca_derco_z126) : ""}</div>
                  </div>
                  <div className="flex border-b border-slate-400 py-1">
                    <div className="flex-[2] border-r border-slate-400 px-2">Dcto Amicar DERCO - Z107</div>
                    <div className="w-16 border-r border-slate-400 text-center">{formatPct(pctAmicarDerco)}</div>
                    <div className="flex-1 text-center font-mono">{form.bono_amicar_derco ? formatCLP(form.bono_amicar_derco) : ""}</div>
                  </div>
                  <div className="flex py-1 bg-sky-200">
                    <div className="flex-[2] border-r border-slate-400 px-2">Total</div>
                    <div className="w-16 border-r border-slate-400 text-center">{formatPct(pctTotalDerco)}</div>
                    <div className="flex-1 text-center font-mono">{totalDctoDerco ? formatCLP(totalDctoDerco) : ""}</div>
                  </div>
                </div>
             </div>

          </div>

        </div>
          </>
        </div>
        
        <div className={activeTab === "papeles" ? "block" : "hidden"}>
          <CalculoPapeles 
            valorVehiculoBruto={calcPrecioContado} 
            valoresActuales={{
              inscripcion: form.inscripcion,
              permiso_circulacion: form.permiso_circulacion,
              soap_sello_verde: form.soap_sello_verde,
              impuesto_verde: form.impuesto_verde
            }}
            onUpdateValores={handleUpdateValores}
          />
        </div>
      </div>
    </div>
  );
}

function Row({ title, value, titleClass="" }: { title: string, value: React.ReactNode, titleClass?: string }) {
  return (
    <div className="flex border-b border-slate-300 text-sm">
      <div className={`flex-[2] px-2 py-1 flex items-center border-r border-slate-300 font-medium ${titleClass}`}>{title}</div>
      <div className="flex-1 bg-white">{value}</div>
    </div>
  );
}

function NumRow({ title, value, onChange, onBlur, prefix="", titleClass="" }: { title: React.ReactNode, value: number, onChange: (v: number) => void, onBlur: () => void, prefix?: string, titleClass?: string }) {
  return (
    <div className="flex border-b border-slate-300 text-sm h-8">
      <div className="flex-[2] px-2 flex items-center border-r border-slate-300 font-medium">
        <span className={`flex-1 ${titleClass}`}>{title}</span>
        {prefix && <span className="text-slate-400 w-4 text-center">{prefix}</span>}
      </div>
      <div className="flex-1">
        <NumberInput value={value} onChange={onChange} onBlur={onBlur} bg="bg-white hover:bg-slate-50 focus:bg-orange-50" />
      </div>
    </div>
  );
}

function CalcRow({ title, value, bg="bg-orange-100/50", titleClass="" }: { title: string, value: number, bg?: string, titleClass?: string }) {
  return (
    <div className={`flex border-b border-slate-300 text-sm h-8 ${bg} font-bold`}>
      <div className={`flex-[2] px-2 flex items-center border-r border-slate-300 ${titleClass}`}>{title}</div>
      <div className="flex-1 text-center py-1 flex justify-center items-center">${value.toLocaleString('es-CL')}</div>
    </div>
  );
}

function NumberInput({ value, onChange, onBlur, bg="bg-transparent" }: { value: number, onChange: (v: number) => void, onBlur: () => void, bg?: string }) {
  const [internalValue, setInternalValue] = useState(value === 0 ? '0' : value.toLocaleString('es-CL'));
  
  // Sync
  useEffect(() => {
    setInternalValue(value === 0 ? '0' : value.toLocaleString('es-CL'));
  }, [value]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    setInternalValue(raw ? Number(raw).toLocaleString('es-CL') : '0');
    onChange(Number(raw || 0));
  };

  return (
    <input 
      type="text" 
      className={`w-full h-full ${bg} text-center outline-none px-1 text-sm transition-colors tabular-nums`}
      value={internalValue}
      onChange={handleInput}
      onBlur={onBlur}
    />
  );
}
