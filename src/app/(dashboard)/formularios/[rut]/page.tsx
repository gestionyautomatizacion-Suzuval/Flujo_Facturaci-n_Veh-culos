/* eslint-disable */
"use client";

import { useState, useCallback, useEffect } from "react";
import React from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, Save, Loader2, RefreshCcw, FileText, Calculator,
  CheckCircle2, AlertCircle, User,
} from "lucide-react";
import CalculoPapeles from "./CalculoPapeles";
import { buscarPorModelo, buscarPrecioBono } from "@/utils/stockNuevos";

// ── RUT helpers ──────────────────────────────────────────────
function cleanRut(raw: string) {
  return raw.replace(/[^0-9kK]/g, "").toUpperCase();
}

function formatRut(raw: string): string {
  const c = cleanRut(raw);
  if (c.length <= 1) return c;
  return `${c.slice(0, -1)}-${c.slice(-1)}`;
}

function validateRut(rut: string): boolean {
  const c = cleanRut(rut);
  if (c.length < 8 || c.length > 9) return false;
  const body = c.slice(0, -1);
  const dvIn = c.slice(-1);
  let sum = 0, mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const rem = 11 - (sum % 11);
  const dvExp = rem === 11 ? "0" : rem === 10 ? "K" : String(rem);
  return dvIn === dvExp;
}

// ── Types ────────────────────────────────────────────────────
interface ClienteInfo {
  id: number;
  nombre: string;
  segundo_nombre: string | null;
  apellido: string;
  segundo_apellido: string | null;
  rut: string;
}

interface PagoRow {
  id?: number;
  cuadratura_id?: number;
  n_comprobante: string | null;
  monto: number;
  tipo_pago: string | null;
}

interface CuadraturaData {
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
  perfil_id?: string | null;
  id_cuadratura: string | null;
  updated_at?: string | null;
  clientes: ClienteInfo | null;
  cuadratura_pagos?: PagoRow[];
  mantencion_prepagada?: MantencionRow | null;
}

interface MantencionRow {
  id?: number;
  cuadratura_id?: number;
  mantencion_10000: number;
  mantencion_20000: number;
  mantencion_30000: number;
}

const EMPTY_PAGO = { n_comprobante: "", monto: 0, tipo_pago: "--" };

const EMPTY_FORM = {
  cod_modelo: "",
  marca: "",
  descripcion_modelo: "",
  tipo_compra: "Contado con Renovación",
  precio_lista: 0,
  bono_marca: 0,
  bono_amicar_suzuval: 0,
  bono_amicar_derco: 0,
  flete_grabado: 181000,
  precio_venta_accesorios: 0,
  inscripcion: 89560,
  permiso_circulacion: 0,
  soap_sello_verde: 0,
  impuesto_verde: 0,
  dcto_suzuval_zqdv: 0,
  aporte_marca_derco_z126: 0,
};

const EMPTY_MANT = { mantencion_10000: 0, mantencion_20000: 0, mantencion_30000: 0 };

// ── Main Component ───────────────────────────────────────────
export default function CuadraturaPage(props: { params: Promise<{ rut: string }> }) {
  const params = React.use(props.params);
  const router = useRouter();
  const supabase = createClient();

  const isNew = params.rut === "nueva";
  const cuadraturaId = !isNew ? parseInt(params.rut, 10) : null;

  const [activeTab, setActiveTab] = useState<"compra" | "papeles">("compra");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [showSuccess, setShowSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Cargar email del usuario logueado
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
  }, []);

  // Client lookup
  const [rut, setRut] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [cliente, setCliente] = useState<ClienteInfo | null | undefined>(undefined);

  // Existing cuadratura (view mode)
  const [existingData, setExistingData] = useState<CuadraturaData | null>(null);

  // Form
  const [form, setForm] = useState(EMPTY_FORM);
  // Mantenciones prepagadas — tabla mantencion_prepagada (1:1 con cuadratura)
  const [mant, setMant] = useState(EMPTY_MANT);
  // Pagos — se guardan en cuadratura_pagos al guardar
  const [pagos, setPagos] = useState<typeof EMPTY_PAGO[]>(Array(6).fill(null).map(() => ({ ...EMPTY_PAGO })));

  // ── Load existing (cuadratura + pagos) ──
  useEffect(() => {
    if (!isNew && cuadraturaId && !isNaN(cuadraturaId)) {
      const load = async () => {
        const { data, error } = await supabase
          .from("cuadratura_valores_cliente")
          .select("*, clientes(id, nombre, segundo_nombre, apellido, segundo_apellido, rut), perfiles(nombre_completo, email)")
          .eq("id", cuadraturaId)
          .single();

        if (error || !data) {
          console.error("Error cargando cuadratura:", error?.message);
          setSaveError("No se pudo cargar la cuadratura: " + (error?.message ?? "registro no encontrado"));
          setLoading(false);
          return;
        }

        // Cargar pagos y mantenciones en paralelo
        const [{ data: pagosData }, { data: mantData }] = await Promise.all([
          supabase
            .from("cuadratura_pagos")
            .select("*")
            .eq("cuadratura_id", cuadraturaId)
            .order("id", { ascending: true }),
          supabase
            .from("mantencion_prepagada")
            .select("*")
            .eq("cuadratura_id", cuadraturaId)
            .maybeSingle(),
        ]);

        setExistingData({
          ...(data as CuadraturaData),
          cuadratura_pagos: (pagosData ?? []) as PagoRow[],
          mantencion_prepagada: mantData as MantencionRow | null,
        });
        setLoading(false);
      };
      load();
    }
  }, []);

  // ── RUT lookup (debounced) ──
  useEffect(() => {
    if (!isNew) return;
    const rutFormatted = formatRut(rut);
    if (!validateRut(rutFormatted)) {
      setCliente(undefined);
      return;
    }
    const timer = setTimeout(async () => {
      setIsLookingUp(true);
      const { data } = await supabase
        .from("clientes")
        .select("id, nombre, segundo_nombre, apellido, segundo_apellido, rut")
        .eq("rut", rutFormatted)
        .maybeSingle();
      setCliente(data ?? null);
      setIsLookingUp(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [rut, isNew]);

  // ── Vehicle lookup (debounced) ──
  useEffect(() => {
    if (!form.cod_modelo || form.cod_modelo.length < 2) return;
    const timer = setTimeout(async () => {
      const [match, preciosBono] = await Promise.all([
        buscarPorModelo(form.cod_modelo),
        buscarPrecioBono(form.cod_modelo)
      ]);
      
      setForm(prev => {
        let newMarca = prev.marca;
        let newDesc = prev.descripcion_modelo;
        let newPrecioLista = prev.precio_lista;
        let newBonoMarca = prev.bono_marca;

        if (match) {
          newMarca = match.MARCA || newMarca;
          newDesc = match["DESCRIPCIÓN MODELO"] || newDesc;
        }

        if (preciosBono) {
          newPrecioLista = preciosBono.precioLista || newPrecioLista;
          newBonoMarca = preciosBono.bonoMarca || newBonoMarca;
        }

        if (
          prev.marca === newMarca &&
          prev.descripcion_modelo === newDesc &&
          prev.precio_lista === newPrecioLista &&
          prev.bono_marca === newBonoMarca
        ) {
          return prev;
        }

        return { 
          ...prev, 
          marca: newMarca, 
          descripcion_modelo: newDesc,
          precio_lista: newPrecioLista,
          bono_marca: newBonoMarca
        };
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [form.cod_modelo]);

  // ── Calculations ──
  const calcPrecioContado = form.precio_lista - form.bono_marca;
  const calcPrecioFinal =
    calcPrecioContado
    - form.bono_amicar_suzuval
    - form.bono_amicar_derco
    + form.flete_grabado
    + form.precio_venta_accesorios
    + mant.mantencion_10000
    + mant.mantencion_20000
    + mant.mantencion_30000;
  const calcTotalPapeles =
    form.inscripcion + form.permiso_circulacion + form.soap_sello_verde + form.impuesto_verde;
  const calcTotalAPagar =
    calcPrecioFinal + calcTotalPapeles - form.dcto_suzuval_zqdv - form.aporte_marca_derco_z126;

  // Pagos cálculos (solo frontend)
  const totalPagos = pagos.reduce((s, p) => s + (Number(p.monto) || 0), 0);
  const recargos = pagos.reduce((s, p) => {
    if (p.tipo_pago?.toLowerCase().includes("tarjeta")) return s + (Number(p.monto) || 0) * 0.0119;
    return s;
  }, 0);
  const saldoPendiente = calcTotalAPagar + recargos - totalPagos;

  const calcPct = (amount: number) => (calcPrecioContado ? (amount / calcPrecioContado) * 100 : 0);
  const pctSuzuvalZqdv   = calcPct(form.dcto_suzuval_zqdv);
  const pctDercoZ126     = calcPct(form.aporte_marca_derco_z126);
  const pctAmicarSuzuval = calcPct(form.bono_amicar_suzuval);
  const pctAmicarDerco   = calcPct(form.bono_amicar_derco);
  const totalDctoSuzuval = form.dcto_suzuval_zqdv + form.bono_amicar_suzuval;
  const pctTotalSuzuval  = calcPct(totalDctoSuzuval);
  const totalDctoDerco   = form.aporte_marca_derco_z126 + form.bono_amicar_derco;
  const pctTotalDerco    = calcPct(totalDctoDerco);

  const handleChange = (field: string, value: any) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleUpdateValores = useCallback((valores: {
    inscripcion: number;
    permiso_circulacion: number;
    soap_sello_verde: number;
    impuesto_verde: number;
  }) => {
    setForm(prev => {
      if (
        prev.inscripcion === valores.inscripcion &&
        prev.permiso_circulacion === valores.permiso_circulacion &&
        prev.soap_sello_verde === valores.soap_sello_verde &&
        prev.impuesto_verde === valores.impuesto_verde
      ) return prev;
      return { ...prev, ...valores };
    });
  }, []);

  const handlePagoChange = (idx: number, field: string, value: any) => {
    setPagos(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  };

  const handleReset = () => {
    setForm(EMPTY_FORM);
    setMant(EMPTY_MANT);
    setPagos(Array(6).fill(null).map(() => ({ ...EMPTY_PAGO })));
    setRut("");
    setCliente(undefined);
    setSaveError("");
  };

  const handleSave = async () => {
    setSaveError("");
    if (!cliente?.id) { setSaveError("Debes ingresar un RUT registrado en clientes."); return; }
    if (!form.cod_modelo.trim()) { setSaveError("Debes ingresar el código de modelo del vehículo."); return; }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (isEditing && cuadraturaId) {
      // ── MODO EDICIÓN: UPDATE ──
      const { error } = await supabase
        .from("cuadratura_valores_cliente")
        .update({
          ...form,
          precio_final: calcPrecioFinal,
          saldo_pendiente: saldoPendiente,
        })
        .eq("id", cuadraturaId);

      if (error) { setSaving(false); setSaveError("Error al actualizar: " + error.message); return; }

      // Upsert mantenciones
      await supabase.from("mantencion_prepagada").upsert({
        cuadratura_id: cuadraturaId,
        mantencion_10000: mant.mantencion_10000,
        mantencion_20000: mant.mantencion_20000,
        mantencion_30000: mant.mantencion_30000,
      }, { onConflict: "cuadratura_id" });

      setSaving(false);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setIsEditing(false);
        // Recargar datos actualizados
        window.location.reload();
      }, 1200);
      return;
    }

    // ── MODO NUEVO: INSERT ──
    // 1. Guardar cuadratura principal
    const { data, error } = await supabase
      .from("cuadratura_valores_cliente")
      .insert({
        cliente_id: cliente.id,
        ...form,
        precio_final: calcPrecioFinal,
        saldo_pendiente: saldoPendiente,
        perfil_id: user?.id ?? null,
      })
      .select("id")
      .single();

    if (error) {
      setSaving(false);
      setSaveError("Error al guardar: " + error.message);
      return;
    }

    // Actualizar el id_cuadratura generado usando el ID
    const generatedId = `${1000 + data.id}_${cliente.rut}`;
    await supabase.from("cuadratura_valores_cliente").update({ id_cuadratura: generatedId }).eq("id", data.id);



    // 2. Guardar mantenciones prepagadas (si alguna tiene valor)
    if (data && (mant.mantencion_10000 || mant.mantencion_20000 || mant.mantencion_30000)) {
      await supabase.from("mantencion_prepagada").insert({
        cuadratura_id: data.id,
        mantencion_10000: mant.mantencion_10000,
        mantencion_20000: mant.mantencion_20000,
        mantencion_30000: mant.mantencion_30000,
      });
    }

    // 3. Guardar pagos no vacíos en cuadratura_pagos
    if (data) {
      const pagosAGuardar = pagos.filter(
        p => (Number(p.monto) || 0) > 0 || (p.n_comprobante ?? "").trim() !== ""
      );
      if (pagosAGuardar.length > 0) {
        await supabase.from("cuadratura_pagos").insert(
          pagosAGuardar.map(p => ({
            cuadratura_id: data.id,
            n_comprobante: p.n_comprobante?.trim() || null,
            monto: Number(p.monto) || 0,
            tipo_pago: p.tipo_pago === "--" ? null : p.tipo_pago,
          }))
        );
      }
    }

    setSaving(false);

    if (data) {
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        router.push(`/formularios/${data.id}`);
      }, 1400);
    }
  };

  const formatCLP = (n: number) => (n || 0).toLocaleString("es-CL");
  const formatPct = (n: number) =>
    (n || 0).toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";

  const canSave = !!cliente?.id && !!form.cod_modelo.trim();

  // ── LOADING ──
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-16">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  // ── ERROR AL CARGAR ──
  if (!isNew && !existingData && saveError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-16 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
          <p className="text-red-700 font-bold text-lg mb-2">Error al cargar cuadratura</p>
          <p className="text-red-500 text-sm font-mono">{saveError}</p>
          <button
            onClick={() => router.push("/formularios")}
            className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors"
          >
            ← Volver al listado
          </button>
        </div>
      </div>
    );
  }


  // ── VIEW MODE (existing cuadratura) ──
  if (!isNew && existingData && !isEditing) {
    return (
      <CuadraturaView
        data={existingData}
        onBack={() => router.push("/formularios")}
        onEdit={() => {
          // Pre-cargar el form con los datos existentes
          setForm({
            cod_modelo:              existingData.cod_modelo ?? "",
            marca:                   existingData.marca ?? "",
            descripcion_modelo:      existingData.descripcion_modelo ?? "",
            tipo_compra:             existingData.tipo_compra ?? "Contado con Renovación",
            precio_lista:            existingData.precio_lista ?? 0,
            bono_marca:              existingData.bono_marca ?? 0,
            bono_amicar_suzuval:     existingData.bono_amicar_suzuval ?? 0,
            bono_amicar_derco:       existingData.bono_amicar_derco ?? 0,
            flete_grabado:           existingData.flete_grabado ?? 181000,
            precio_venta_accesorios: existingData.precio_venta_accesorios ?? 0,
            inscripcion:             existingData.inscripcion ?? 89560,
            permiso_circulacion:     existingData.permiso_circulacion ?? 0,
            soap_sello_verde:        existingData.soap_sello_verde ?? 0,
            impuesto_verde:          existingData.impuesto_verde ?? 0,
            dcto_suzuval_zqdv:       existingData.dcto_suzuval_zqdv ?? 0,
            aporte_marca_derco_z126: existingData.aporte_marca_derco_z126 ?? 0,
          });
          setMant({
            mantencion_10000: existingData.mantencion_prepagada?.mantencion_10000 ?? 0,
            mantencion_20000: existingData.mantencion_prepagada?.mantencion_20000 ?? 0,
            mantencion_30000: existingData.mantencion_prepagada?.mantencion_30000 ?? 0,
          });
          // Pre-cargar pagos si existen
          if (existingData.cuadratura_pagos?.length) {
            const loaded = existingData.cuadratura_pagos.map(p => ({
              n_comprobante: p.n_comprobante ?? "",
              monto: p.monto ?? 0,
              tipo_pago: p.tipo_pago ?? "--",
            }));
            // Rellenar hasta 6
            while (loaded.length < 6) loaded.push({ ...EMPTY_PAGO });
            setPagos(loaded.slice(0, 6));
          }
          setCliente(existingData.clientes);
          setRut(existingData.clientes?.rut ?? "");
          setIsEditing(true);
        }}
        userEmail={userEmail}
      />
    );
  }

  // ── NEW MODE (editable form) ──
  const clienteNombre = cliente
    ? [cliente.nombre, cliente.segundo_nombre, cliente.apellido, cliente.segundo_apellido]
        .filter(Boolean).join(" ")
    : null;

  return (
    <div className="flex-1 bg-white overflow-auto pb-24">
      {/* ── Header ── */}
      <div className="sticky top-0 bg-white border-b border-slate-200 shadow-sm z-50 px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <button onClick={() => router.push("/formularios")} className="text-slate-400 hover:text-slate-800 transition-colors flex-shrink-0">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-800">
            {isEditing
              ? `Editando ${existingData?.id_cuadratura ?? `#${cuadraturaId}`}`
              : "Nueva Cuadratura de Valores"}
          </h1>
            {!canSave && (
              <p className="text-xs text-amber-600 font-medium truncate">
                ⚠️ Ingresa RUT del cliente y código de modelo para poder guardar
              </p>
            )}
            {saveError && <p className="text-xs text-red-600 font-medium truncate">{saveError}</p>}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-lg flex-shrink-0">
          <button
            onClick={() => setActiveTab("compra")}
            className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-1.5 transition-colors ${activeTab === "compra" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            <FileText className="w-4 h-4" /> Cuadratura Compra
          </button>
          <button
            onClick={() => setActiveTab("papeles")}
            className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-1.5 transition-colors ${activeTab === "papeles" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            <Calculator className="w-4 h-4" /> Cuadratura Papeles
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-3 flex-shrink-0">
          <button
            onClick={handleReset}
            className="px-4 py-2 border border-orange-400 bg-orange-50 text-orange-700 font-bold rounded-md hover:bg-orange-100 transition-colors flex items-center gap-2"
          >
            <RefreshCcw className="w-4 h-4" /> Limpiar
          </button>
          <div className="relative">
            <button
              onClick={handleSave}
              disabled={saving || !canSave}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-md transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              GUARDAR
            </button>
            {showSuccess && (
              <div className="absolute top-full mt-2 right-0 bg-emerald-500 text-white text-xs px-3 py-2 rounded shadow-lg whitespace-nowrap z-50 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> ¡Cuadratura guardada correctamente!
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 max-w-[1200px] mx-auto">
        {/* ── Tab Compra ── */}
        <div className={activeTab === "compra" ? "block" : "hidden"}>

          {/* RUT + NOMBRE */}
          <div className="flex gap-4 mb-6 items-end flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                RUT Cliente <span className="normal-case font-normal text-slate-400">(sin puntos, con guión)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={rut}
                  onChange={e => setRut(e.target.value)}
                  onBlur={e => setRut(formatRut(e.target.value))}
                  maxLength={10}
                  className="w-full border-b-2 border-slate-300 focus:border-indigo-500 bg-slate-50 p-2 font-mono outline-none pr-8"
                  placeholder="12345678-9"
                />
                {isLookingUp && (
                  <Loader2 className="absolute right-2 top-2.5 w-4 h-4 animate-spin text-slate-400" />
                )}
                {!isLookingUp && cliente && (
                  <CheckCircle2 className="absolute right-2 top-2.5 w-4 h-4 text-emerald-500" />
                )}
                {!isLookingUp && cliente === null && (
                  <AlertCircle className="absolute right-2 top-2.5 w-4 h-4 text-red-500" />
                )}
              </div>
            </div>

            {/* Badge cliente */}
            {cliente && (
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-lg min-w-[200px]">
                <User className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-emerald-800 uppercase leading-tight">{clienteNombre}</p>
                  <p className="text-xs text-emerald-600 font-mono">{cliente.rut}</p>
                </div>
              </div>
            )}
            {cliente === null && (
              <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <div>
                  <p className="text-sm text-red-700 font-bold">Cliente no registrado</p>
                  <p className="text-xs text-red-500">Debes crear al cliente primero en Clientes / Firmas</p>
                </div>
              </div>
            )}
          </div>

          {/* VEHÍCULO Y CÁLCULOS (BLOQUEADOS SI NO HAY CLIENTE) */}
          <div className={!cliente?.id ? "opacity-50 pointer-events-none select-none transition-opacity" : "transition-opacity"}>
            <div className="flex gap-4 mb-6 flex-wrap">
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                MOD. VEHÍCULO <span className="normal-case font-normal text-slate-400">(Código)</span>
              </label>
              <input
                type="text"
                value={form.cod_modelo}
                onChange={e => handleChange("cod_modelo", e.target.value.toUpperCase())}
                className="w-full border-b-2 border-slate-300 focus:border-blue-500 bg-blue-50/30 p-2 font-mono outline-none uppercase"
                placeholder="EJ: SZ-SFT..."
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">MARCA</label>
              <input
                type="text"
                value={form.marca}
                readOnly
                className="w-full border-b-2 border-slate-200 bg-slate-100 p-2 font-bold outline-none uppercase text-slate-500 cursor-not-allowed"
                placeholder="Auto-completado..."
              />
            </div>
            <div className="flex-[2] min-w-[200px]">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">DESCRIPCIÓN MODELO</label>
              <input
                type="text"
                value={form.descripcion_modelo}
                readOnly
                className="w-full border-b-2 border-slate-200 bg-slate-100 p-2 font-bold outline-none uppercase text-slate-500 cursor-not-allowed"
                placeholder="Auto-completado..."
              />
            </div>
          </div>

          {/* GRILLA DE CÁLCULOS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            {/* LADO IZQUIERDO */}
            <div className="flex flex-col gap-6">

              {/* NEGOCIO */}
              <div className="border border-slate-300 flex">
                <div className="w-12 bg-slate-100 border-r border-slate-300 flex items-center justify-center p-2">
                  <span className="transform -rotate-90 whitespace-nowrap font-bold text-xs text-slate-600 tracking-widest">NEGOCIO</span>
                </div>
                <div className="flex-1 flex flex-col">
                  <div className="flex border-b border-slate-300 text-sm h-[30px] bg-slate-50">
                    <div className="w-1/2 border-r border-slate-300" />
                    <div className="w-1/4 border-r border-slate-300 font-bold text-center text-slate-600 flex items-center justify-center tracking-wider">BRUTO</div>
                    <div className="w-1/4 font-bold text-center text-slate-600 flex items-center justify-center tracking-wider">NETO</div>
                  </div>
                  <div className="flex border-b border-slate-300 text-sm h-[34px]">
                    <div className="w-1/2 px-2 flex items-center border-r border-slate-300 font-medium">Tipo Venta</div>
                    <div className="w-1/2 bg-white">
                      <select 
                        value={form.tipo_compra} 
                        onChange={e => {
                          const val = e.target.value;
                          setForm(prev => ({
                            ...prev,
                            tipo_compra: val,
                            inscripcion: val.includes("Financiamiento") ? 0 : (prev.inscripcion === 0 ? 89560 : prev.inscripcion)
                          }));
                        }} 
                        className="w-full h-full text-center outline-none bg-transparent font-medium text-slate-700 text-xs"
                      >
                        <option>Contado con Renovación</option>
                        <option>Contado sin Renovación</option>
                        <option>Financiamiento con Renovación</option>
                        <option>Financiamiento sin Renovación</option>
                        <option>Flota</option>
                        <option>Crédito con Retoma</option>
                        <option>Leasing</option>
                        <option>PSR</option>
                      </select>
                    </div>
                  </div>
                  <NumFila label="Precio Lista"             bruto={form.precio_lista}           onChange={v => handleChange("precio_lista", v)} />
                  <NumFila label="Bono Marca"               bruto={form.bono_marca}             onChange={v => handleChange("bono_marca", v)} />
                  <FilaCalc label="Precio Contado"          bruto={calcPrecioContado}           highlight />
                  <NumFila label="Bono Amicar (Cargo Suzuval)" bruto={form.bono_amicar_suzuval} onChange={v => handleChange("bono_amicar_suzuval", v)} />
                  <NumFila label="Bono Amicar (Cargo Derco)"  bruto={form.bono_amicar_derco}   onChange={v => handleChange("bono_amicar_derco", v)} />
                  <NumFila label="Flete + Grabado"          bruto={form.flete_grabado}          onChange={v => handleChange("flete_grabado", v)} />
                  <NumFila label="Precio Accesorio/Mantención" bruto={form.precio_venta_accesorios} onChange={v => handleChange("precio_venta_accesorios", v)} />
                  <NumFila label="Mantención Prepagada 10.000 km" bruto={mant.mantencion_10000} onChange={v => setMant(prev => ({ ...prev, mantencion_10000: v }))} />
                  <NumFila label="Mantención Prepagada 20.000 km" bruto={mant.mantencion_20000} onChange={v => setMant(prev => ({ ...prev, mantencion_20000: v }))} />
                  <NumFila label="Mantención Prepagada 30.000 km" bruto={mant.mantencion_30000} onChange={v => setMant(prev => ({ ...prev, mantencion_30000: v }))} />
                  <FilaCalc label="Precio Final"            bruto={calcPrecioFinal}             highlight />
                </div>
              </div>

              {/* APORTES */}
              <div className="border border-slate-300 flex">
                <div className="w-12 bg-slate-100 border-r border-slate-300 flex items-center justify-center p-1">
                  <span className="transform -rotate-90 whitespace-nowrap font-bold text-xs text-slate-600 tracking-widest">APORTES</span>
                </div>
                <div className="flex-1 flex flex-col">
                  <NumFilaPct label="Descuentos Suzuval - ZQDV"   bruto={form.dcto_suzuval_zqdv}       pct={pctSuzuvalZqdv} onChange={v => handleChange("dcto_suzuval_zqdv", v)} />
                  <NumFilaPct label="Aporte Marca Derco - Z126"   bruto={form.aporte_marca_derco_z126} pct={pctDercoZ126}   onChange={v => handleChange("aporte_marca_derco_z126", v)} last />
                </div>
              </div>

              {/* PAPELES */}
              <div className="border border-slate-300 flex">
                <div className="w-12 bg-slate-100 border-r border-slate-300 flex items-center justify-center p-2">
                  <span className="transform -rotate-90 whitespace-nowrap font-bold text-xs text-slate-600 tracking-widest text-center leading-tight">PAPELES<br/>INSCR.</span>
                </div>
                <div className="flex-1 flex flex-col">
                  <NumFila label="Inscripción"                      bruto={form.inscripcion}         onChange={v => handleChange("inscripcion", v)} />
                  <NumFila label="Permiso Circulación"              bruto={form.permiso_circulacion} onChange={v => handleChange("permiso_circulacion", v)} />
                  <NumFila label="SOAP + Sello Verde"               bruto={form.soap_sello_verde}    onChange={v => handleChange("soap_sello_verde", v)} />
                  <NumFila 
                    label={<>Impuesto Verde (<a href="https://www4.sii.cl/calcImpVehiculoNuevoInternet/internet.html" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Revisar en SII.cl</a>)</>}
                    bruto={form.impuesto_verde}      
                    onChange={v => handleChange("impuesto_verde", v)} 
                  />
                  <FilaCalc label="Total Papeles"                   bruto={calcTotalPapeles}         highlight />
                </div>
              </div>
            </div>

            {/* LADO DERECHO */}
            <div className="flex flex-col gap-6">

              {/* TOTALES */}
              <div className="border border-slate-400">
                <div className="flex border-b border-slate-400 text-sm h-[34px]">
                  <div className="flex-[1.5] px-2 flex items-center border-r border-slate-400 font-bold bg-slate-200">Total Compra</div>
                  <div className="flex-1 flex items-center justify-center font-bold text-slate-800 bg-slate-100">${formatCLP(calcTotalAPagar)}</div>
                </div>
                <div className="flex text-sm h-[34px]">
                  <div className="flex-[1.5] px-2 flex items-center justify-between border-r border-slate-400 font-bold bg-slate-200">
                    <span>Total Factura</span>
                    <span className="text-slate-400 font-normal text-xs font-mono">(${formatCLP(Math.round((calcTotalAPagar - calcTotalPapeles) / 1.19))})</span>
                  </div>
                  <div className="flex-1 flex items-center justify-center font-bold text-slate-800 bg-slate-100">${formatCLP(calcTotalAPagar - calcTotalPapeles)}</div>
                </div>
              </div>

              {/* COMPROBANTES DE PAGO — solo frontend, no se guardan */}
              <div className="border border-slate-400">
                <div className="grid grid-cols-[1fr_1fr_1.5fr] bg-slate-200 border-b border-slate-400 font-bold text-xs uppercase text-center">
                  <div className="py-2 border-r border-slate-400 flex items-center justify-center">N° Comprobante</div>
                  <div className="py-2 border-r border-slate-400 flex items-center justify-center">MONTO $$</div>
                  <div className="py-2 flex items-center justify-center">Tipo de Pago</div>
                </div>
                {pagos.map((p, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_1.5fr] border-b border-slate-400 text-sm bg-blue-50/30">
                    <div className="border-r border-slate-400">
                      <input
                        type="text"
                        value={p.n_comprobante}
                        onChange={e => handlePagoChange(i, "n_comprobante", e.target.value)}
                        className="w-full h-8 bg-transparent text-center outline-none px-1 text-xs"
                        placeholder="—"
                      />
                    </div>
                    <div className="border-r border-slate-400">
                      <NumberInput value={p.monto} onChange={v => handlePagoChange(i, "monto", v)} />
                    </div>
                    <div>
                      <select
                        value={p.tipo_pago}
                        onChange={e => handlePagoChange(i, "tipo_pago", e.target.value)}
                        className="w-full h-8 bg-transparent text-center outline-none text-xs px-1"
                      >
                        <option value="--">--</option>
                        <option>Transferencia</option>
                        <option>Efectivo</option>
                        <option>Tarjeta Crédito</option>
                        <option>Tarjeta Débito</option>
                        <option>Vale Vista</option>
                        <option>Cheque</option>
                      </select>
                    </div>
                  </div>
                ))}
                <div className="grid grid-cols-[1fr_1fr_1.5fr] text-sm bg-slate-100 font-bold">
                  <div className="py-2 px-2 border-r border-slate-400 text-center text-slate-500 text-xs bg-slate-200">Total Pagos</div>
                  <div className="py-2 border-r border-slate-400 flex items-center justify-center font-mono bg-slate-100">${formatCLP(totalPagos)}</div>
                  <div className="py-2 px-2 text-[10px] text-slate-400 flex items-center justify-center">
                    {recargos > 0 && `+$${formatCLP(Math.round(recargos))} recargo tarjeta`}
                  </div>
                </div>
              </div>

              {/* SALDO */}
              <div className="border border-slate-400">
                <div className="flex border-b border-slate-400 text-sm font-bold">
                  <div className="flex-[2] py-2 px-4 border-r border-slate-400 text-center bg-slate-200">TOTAL A PAGAR CLIENTE</div>
                  <div className="flex-1 py-2 px-2 text-center bg-slate-100">${formatCLP(calcTotalAPagar)}</div>
                </div>
                {(() => {
                  const isOk  = saldoPendiente === 0;
                  const isPos = saldoPendiente < 0;
                  const statusBg  = isOk ? "bg-green-100 text-green-900" : isPos ? "bg-emerald-200 text-emerald-900" : "bg-red-100 text-red-900";
                  const statusTxt = isOk ? "Negocio con Saldo Completo" : isPos ? "Negocio con Saldo Sobrante" : "Negocio con Saldo Pendiente";
                  const valueBg   = isOk ? "bg-green-50" : isPos ? "bg-emerald-100" : "bg-red-50";
                  return (
                    <>
                      <div className={`flex border-b border-slate-400 text-sm font-bold ${statusBg}`}>
                        <div className="w-full py-1.5 text-center">{statusTxt}</div>
                      </div>
                      <div className={`flex text-sm font-bold border-b-2 ${valueBg}`}>
                        <div className="flex-[2] py-2 px-4 border-r border-slate-400 text-right">Saldo Pendiente de:</div>
                        <div className="flex-1 py-2 px-2 flex items-center justify-center text-xl">${formatCLP(saldoPendiente)}</div>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* RESUMEN DESCUENTOS */}
              <div className="flex text-xs border border-slate-400 font-bold">
                <div className="w-24 border-r border-slate-400 flex items-center justify-center p-2 text-center text-slate-500 bg-slate-50 uppercase">Resumen<br/>Dctos</div>
                <div className="flex-1 flex flex-col bg-sky-50">
                  {([
                    { label: "Dcto Suzuval - ZQDV",        pct: pctSuzuvalZqdv,   val: form.dcto_suzuval_zqdv },
                    { label: "Dcto Amicar Suzuval - Z104", pct: pctAmicarSuzuval, val: form.bono_amicar_suzuval },
                    { label: "Total",                       pct: pctTotalSuzuval,  val: totalDctoSuzuval, highlight: true },
                    { label: "Dcto Derco Manual - Z126",   pct: pctDercoZ126,     val: form.aporte_marca_derco_z126 },
                    { label: "Dcto Amicar DERCO - Z107",   pct: pctAmicarDerco,   val: form.bono_amicar_derco },
                    { label: "Total",                       pct: pctTotalDerco,    val: totalDctoDerco, highlight: true },
                  ] as {label: string; pct: number; val: number; highlight?: boolean}[]).map((r, i) => (
                    <div key={i} className={`flex border-b border-slate-300 py-1 ${r.highlight ? "bg-sky-200" : ""}`}>
                      <div className="flex-[2] border-r border-slate-300 px-2">{r.label}</div>
                      <div className="w-16 border-r border-slate-300 text-center">{formatPct(r.pct)}</div>
                      <div className="flex-1 text-right pr-2 font-mono">{r.val ? formatCLP(r.val) : ""}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

        {/* ── Tab Papeles ── */}
        <div className={activeTab === "papeles" ? "block" : "hidden"}>
          <div className={!cliente?.id ? "opacity-50 pointer-events-none select-none transition-opacity" : "transition-opacity"}>

          <CalculoPapeles
            valorVehiculoBruto={calcPrecioContado}
            valoresActuales={{
              inscripcion: form.inscripcion,
              permiso_circulacion: form.permiso_circulacion,
              soap_sello_verde: form.soap_sello_verde,
              impuesto_verde: form.impuesto_verde,
            }}
            onUpdateValores={handleUpdateValores}
          />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── VIEW MODE COMPONENT ─────────────────────────────────────────
function CuadraturaView({
  data, onBack, onEdit, userEmail
}: {
  data: CuadraturaData;
  onBack: () => void;
  onEdit?: () => void;
  userEmail?: string | null;
}) {
  const formatCLP = (n: number) => (n || 0).toLocaleString("es-CL");
  const formatPct = (n: number) =>
    (n || 0).toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";

  const clienteNombre = data.clientes
    ? [data.clientes.nombre, data.clientes.segundo_nombre, data.clientes.apellido, data.clientes.segundo_apellido]
        .filter(Boolean).join(" ")
    : "—";

  const calcPrecioContado = (data.precio_lista || 0) - (data.bono_marca || 0);
  const calcTotalPapeles = (data.inscripcion || 0) + (data.permiso_circulacion || 0) + (data.soap_sello_verde || 0) + (data.impuesto_verde || 0);
  const calcTotalAPagar = (data.precio_final || 0) + calcTotalPapeles - (data.dcto_suzuval_zqdv || 0) - (data.aporte_marca_derco_z126 || 0);

  const pctOf = (v: number) => (calcPrecioContado ? (v / calcPrecioContado) * 100 : 0);
  const isOwner = userEmail && (data as any).perfiles?.email === userEmail;

  return (
    <div className="flex-1 bg-white overflow-auto pb-20">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-slate-200 shadow-sm z-50 px-6 py-4 flex items-center gap-4">
        <button onClick={onBack} className="text-slate-400 hover:text-slate-800 transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div>
          {/* Badge folio */}
          <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
            ID Cuadratura:{" "}
            <span className="font-mono text-base text-indigo-600 font-bold">
              {data.id_cuadratura ?? `#${data.id}`}
            </span>
          </p>
          {/* Título principal */}
          <h1 className="text-xl font-bold text-slate-800 leading-tight">
            Cuadratura
          </h1>
          {/* Línea de fechas */}
          <p className="text-xs text-slate-400 mt-0.5">
            Creada el {new Date(data.created_at).toLocaleDateString("es-CL")} por {(data as any).perfiles?.nombre_completo ?? "—"}
            {data.updated_at && data.updated_at !== data.created_at && (
              <span className="ml-1 text-amber-600 font-medium">
                {"• "}Modificada el{" "}
                {new Date(data.updated_at).toLocaleString("es-CL", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {isOwner && onEdit && (
            <button
              onClick={onEdit}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-md transition-colors shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Editar
            </button>
          )}
          <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2">
            <User className="w-4 h-4 text-indigo-600" />
            <div>
              <p className="text-sm font-bold text-indigo-800 uppercase">{clienteNombre}</p>
              <p className="text-xs text-indigo-500 font-mono">{data.clientes?.rut}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-[1200px] mx-auto">
        {/* Vehículo */}
        <div className="flex gap-4 mb-6 flex-wrap">
          {[
            { label: "MOD. VEHÍCULO", val: data.cod_modelo },
            { label: "MARCA", val: data.marca },
            { label: "DESCRIPCIÓN", val: data.descripcion_modelo },
            { label: "TIPO VENTA", val: data.tipo_compra },
          ].map(f => (
            <div key={f.label} className="flex-1 min-w-[140px]">
              <p className="text-xs font-bold text-slate-400 uppercase mb-1">{f.label}</p>
              <p className="font-bold text-slate-800 uppercase text-sm">{f.val || "—"}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* LADO IZQUIERDO */}
          <div className="flex flex-col gap-6">
            {/* NEGOCIO */}
            <div className="border border-slate-300 flex">
              <div className="w-12 bg-slate-100 border-r border-slate-300 flex items-center justify-center p-2">
                <span className="transform -rotate-90 whitespace-nowrap font-bold text-xs text-slate-600 tracking-widest">NEGOCIO</span>
              </div>
              <div className="flex-1 flex flex-col">
                <div className="flex border-b border-slate-300 text-sm h-[30px] bg-slate-50">
                  <div className="w-1/2 border-r border-slate-300" />
                  <div className="w-1/4 border-r border-slate-300 font-bold text-center text-slate-600 flex items-center justify-center">BRUTO</div>
                  <div className="w-1/4 font-bold text-center text-slate-600 flex items-center justify-center">NETO</div>
                </div>
                {[
                  { label: "Precio Lista",              v: data.precio_lista },
                  { label: "Bono Marca",                v: data.bono_marca },
                  { label: "Precio Contado",             v: calcPrecioContado, bold: true },
                  { label: "Bono Amicar (Suzuval)",     v: data.bono_amicar_suzuval },
                  { label: "Bono Amicar (Derco)",       v: data.bono_amicar_derco },
                  { label: "Flete + Grabado",           v: data.flete_grabado },
                  { label: "Accesorios/Mantención",     v: data.precio_venta_accesorios },
                  { label: "Mantención Prep. 10.000 km", v: data.mantencion_prepagada?.mantencion_10000 ?? 0 },
                  { label: "Mantención Prep. 20.000 km", v: data.mantencion_prepagada?.mantencion_20000 ?? 0 },
                  { label: "Mantención Prep. 30.000 km", v: data.mantencion_prepagada?.mantencion_30000 ?? 0 },
                  { label: "Precio Final",              v: data.precio_final, bold: true },
                ].map((row, i) => (
                  <div key={i} className={`flex border-b border-slate-300 text-sm h-[34px] ${row.bold ? "bg-orange-50 font-bold" : ""}`}>
                    <div className="w-1/2 px-2 flex items-center border-r border-slate-300">{row.label}</div>
                    <div className="w-1/4 border-r border-slate-300 flex items-center justify-center font-mono text-slate-800">{formatCLP(row.v || 0)}</div>
                    <div className="w-1/4 flex items-center justify-center font-mono text-slate-600 bg-slate-50/50">{formatCLP(Math.round((row.v || 0) / 1.19))}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* APORTES */}
            <div className="border border-slate-300 flex">
              <div className="w-12 bg-slate-100 border-r border-slate-300 flex items-center justify-center p-1">
                <span className="transform -rotate-90 whitespace-nowrap font-bold text-xs text-slate-600 tracking-widest">APORTES</span>
              </div>
              <div className="flex-1 flex flex-col">
                {[
                  { label: "Descuentos Suzuval - ZQDV", v: data.dcto_suzuval_zqdv },
                  { label: "Aporte Marca Derco - Z126",  v: data.aporte_marca_derco_z126 },
                ].map((row, i) => (
                  <div key={i} className={`flex text-sm h-[34px] ${i === 0 ? "border-b border-slate-300" : ""}`}>
                    <div className="w-1/2 px-2 flex items-center justify-between border-r border-slate-300 font-medium">
                      <span>{row.label}</span>
                      <span className="text-slate-400 font-mono text-xs">{formatPct(pctOf(row.v || 0))}</span>
                    </div>
                    <div className="w-1/4 border-r border-slate-300 flex items-center justify-center font-mono">{formatCLP(row.v || 0)}</div>
                    <div className="w-1/4 flex items-center justify-center font-mono text-slate-600 bg-slate-50">{formatCLP(Math.round((row.v || 0) / 1.19))}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* PAPELES */}
            <div className="border border-slate-300 flex">
              <div className="w-12 bg-slate-100 border-r border-slate-300 flex items-center justify-center p-2">
                <span className="transform -rotate-90 whitespace-nowrap font-bold text-xs text-slate-600 tracking-widest text-center leading-tight">PAPELES<br/>INSCR.</span>
              </div>
              <div className="flex-1 flex flex-col">
                {[
                  { label: "Inscripción",          v: data.inscripcion },
                  { label: "Permiso Circulación",  v: data.permiso_circulacion },
                  { label: "SOAP + Sello Verde",   v: data.soap_sello_verde },
                  { label: "Impuesto Verde",       v: data.impuesto_verde },
                ].map((row, i) => (
                  <div key={i} className="flex border-b border-slate-300 text-sm h-[34px]">
                    <div className="w-1/2 px-2 flex items-center border-r border-slate-300 font-medium">{row.label}</div>
                    <div className="w-1/2 flex items-center justify-center font-mono">{formatCLP(row.v || 0)}</div>
                  </div>
                ))}
                <div className="flex text-sm h-[34px] bg-orange-50 font-bold">
                  <div className="w-1/2 px-2 flex items-center border-r border-slate-300">Total Papeles</div>
                  <div className="w-1/2 flex items-center justify-center font-mono">{formatCLP(calcTotalPapeles)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* LADO DERECHO */}
          <div className="flex flex-col gap-6">
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

            {/* COMPROBANTES DE PAGO GUARDADOS */}
            {data.cuadratura_pagos && data.cuadratura_pagos.length > 0 && (
              <div className="border border-slate-400">
                <div className="grid grid-cols-[1fr_1fr_1.5fr] bg-slate-200 border-b border-slate-400 font-bold text-xs uppercase text-center">
                  <div className="py-2 border-r border-slate-400 flex items-center justify-center">N° Comprobante</div>
                  <div className="py-2 border-r border-slate-400 flex items-center justify-center">MONTO $$</div>
                  <div className="py-2 flex items-center justify-center">Tipo de Pago</div>
                </div>
                {data.cuadratura_pagos.map((p, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_1.5fr] border-b border-slate-400 text-sm bg-blue-50/30">
                    <div className="border-r border-slate-400 flex items-center justify-center py-1 px-2 text-xs text-slate-600">{p.n_comprobante || "—"}</div>
                    <div className="border-r border-slate-400 flex items-center justify-center font-mono font-medium py-1">${formatCLP(p.monto || 0)}</div>
                    <div className="flex items-center justify-center text-xs text-slate-600 py-1">{p.tipo_pago || "—"}</div>
                  </div>
                ))}
                <div className="grid grid-cols-[1fr_1fr_1.5fr] bg-slate-100 text-sm font-bold">
                  <div className="py-2 border-r border-slate-400 text-center text-slate-500 text-xs">Total Pagos</div>
                  <div className="py-2 border-r border-slate-400 flex items-center justify-center font-mono">
                    ${formatCLP(data.cuadratura_pagos.reduce((s, p) => s + (Number(p.monto) || 0), 0))}
                  </div>
                  <div />
                </div>
              </div>
            )}

            {/* SALDO GUARDADO */}
            <div className="border border-slate-400">
              <div className="flex border-b border-slate-400 text-sm font-bold">
                <div className="flex-[2] py-2 px-4 border-r border-slate-400 text-center bg-white">TOTAL A PAGAR CLIENTE</div>
                <div className="flex-1 py-2 px-2 text-center bg-white">${formatCLP(data.saldo_pendiente || 0)}</div>
              </div>
              <div className={`py-2 text-center text-sm font-bold ${(data.saldo_pendiente || 0) > 0 ? "bg-red-100 text-red-800" : (data.saldo_pendiente || 0) < 0 ? "bg-emerald-200 text-emerald-900" : "bg-green-100 text-green-900"}`}>
                {(data.saldo_pendiente || 0) > 0 ? "Negocio con Saldo Pendiente" : (data.saldo_pendiente || 0) < 0 ? "Negocio con Saldo Sobrante" : "Negocio con Saldo Completo"}
              </div>
              <div className={`flex text-sm font-bold ${(data.saldo_pendiente || 0) > 0 ? "bg-red-50" : "bg-emerald-50"}`}>
                <div className="flex-[2] py-2 px-4 border-r border-slate-300 text-right">Saldo Pendiente de:</div>
                <div className="flex-1 py-2 px-2 flex items-center justify-center text-xl">${formatCLP(data.saldo_pendiente || 0)}</div>
              </div>
            </div>

            {/* RESUMEN DESCUENTOS */}
            <div className="flex text-xs border border-slate-400 font-bold">
              <div className="w-24 border-r border-slate-400 flex items-center justify-center p-2 text-center text-slate-500 bg-slate-50 uppercase">Resumen<br/>Dctos</div>
              <div className="flex-1 flex flex-col bg-sky-50">
                {([
                  { label: "Dcto Suzuval - ZQDV",        v: data.dcto_suzuval_zqdv,       pct: pctOf(data.dcto_suzuval_zqdv || 0) },
                  { label: "Dcto Amicar Suzuval - Z104", v: data.bono_amicar_suzuval,     pct: pctOf(data.bono_amicar_suzuval || 0) },
                  { label: "Total Suzuval",               v: (data.dcto_suzuval_zqdv || 0) + (data.bono_amicar_suzuval || 0), pct: pctOf((data.dcto_suzuval_zqdv || 0) + (data.bono_amicar_suzuval || 0)), hl: true },
                  { label: "Dcto Derco Manual - Z126",   v: data.aporte_marca_derco_z126, pct: pctOf(data.aporte_marca_derco_z126 || 0) },
                  { label: "Dcto Amicar DERCO - Z107",   v: data.bono_amicar_derco,       pct: pctOf(data.bono_amicar_derco || 0) },
                  { label: "Total Derco",                 v: (data.aporte_marca_derco_z126 || 0) + (data.bono_amicar_derco || 0), pct: pctOf((data.aporte_marca_derco_z126 || 0) + (data.bono_amicar_derco || 0)), hl: true },
                ] as {label: string; v: number | string; pct: number; hl?: boolean}[]).map((r, i) => (
                  <div key={i} className={`flex border-b border-slate-300 py-1 ${r.hl ? "bg-sky-200" : ""}`}>
                    <div className="flex-[2] border-r border-slate-300 px-2">{r.label}</div>
                    <div className="w-16 border-r border-slate-300 text-center">{formatPct(r.pct)}</div>
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

// ── Mini Components ───────────────────────────────────────────
function NumberInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const formatVal = (v: number) => v === 0 ? "" : v.toLocaleString("es-CL");
  const [raw, setRaw] = useState(formatVal(value));
  useEffect(() => { setRaw(formatVal(value)); }, [value]);
  return (
    <input
      type="text"
      inputMode="numeric"
      className="w-full h-full text-center outline-none bg-transparent font-mono text-sm px-1"
      value={raw}
      onChange={e => {
        const numericStr = e.target.value.replace(/\D/g, "");
        const num = Number(numericStr) || 0;
        setRaw(numericStr ? num.toLocaleString("es-CL") : "");
        onChange(num);
      }}
      onFocus={e => e.target.select()}
    />
  );
}

function NumFila({ label, bruto, onChange }: { label: React.ReactNode; bruto: number; onChange: (v: number) => void }) {
  const neto = Math.round((bruto || 0) / 1.19);
  return (
    <div className="flex border-b border-slate-300 text-sm h-[34px]">
      <div className="w-1/2 px-2 flex items-center border-r border-slate-300 font-medium text-xs bg-slate-100">{label}</div>
      <div className="w-1/4 border-r border-slate-300 bg-white flex items-center justify-center">
        <NumberInput value={bruto} onChange={onChange} />
      </div>
      <div className="w-1/4 bg-slate-100 flex items-center justify-center font-mono text-slate-700 text-sm">{neto.toLocaleString("es-CL")}</div>
    </div>
  );
}

function FilaCalc({ label, bruto, highlight }: { label: string; bruto: number; highlight?: boolean }) {
  const neto = Math.round((bruto || 0) / 1.19);
  return (
    <div className={`flex border-b border-slate-300 text-sm h-[34px] font-bold ${highlight ? "bg-orange-50" : "bg-slate-100"}`}>
      <div className="w-1/2 px-2 flex items-center border-r border-slate-300 text-xs">{label}</div>
      <div className="w-1/4 border-r border-slate-300 flex items-center justify-center font-mono text-slate-900">{(bruto || 0).toLocaleString("es-CL")}</div>
      <div className="w-1/4 flex items-center justify-center font-mono text-slate-900 bg-black/5">{neto.toLocaleString("es-CL")}</div>
    </div>
  );
}

function NumFilaPct({
  label, bruto, pct, onChange, last
}: { label: string; bruto: number; pct: number; onChange: (v: number) => void; last?: boolean }) {
  const neto = Math.round((bruto || 0) / 1.19);
  return (
    <div className={`flex text-sm h-[34px] ${!last ? "border-b border-slate-300" : ""}`}>
      <div className="w-1/2 px-2 flex items-center justify-between border-r border-slate-300 font-medium text-xs bg-slate-100">
        <span>{label}</span>
        <span className="font-mono text-slate-400 text-xs">
          {(pct || 0).toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
        </span>
      </div>
      <div className="w-1/4 border-r border-slate-300 bg-white">
        <NumberInput value={bruto} onChange={onChange} />
      </div>
      <div className="w-1/4 bg-slate-100 flex items-center justify-center font-mono text-slate-700 text-sm">{neto.toLocaleString("es-CL")}</div>
    </div>
  );
}
