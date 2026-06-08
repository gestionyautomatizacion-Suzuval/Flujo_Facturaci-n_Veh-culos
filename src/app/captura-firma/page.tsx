"use client";

import React, { useState, useRef, useEffect, Suspense } from "react";
import SignatureCanvas from "react-signature-canvas";
import { createClient } from "@/utils/supabase/client";
import { Camera, RefreshCcw, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

function CapturaFirmaForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const vendedorQuery = searchParams.get("vendedor") || "";

  const [mounted, setMounted] = useState(false);
  const [rut, setRut] = useState("");
  const [vendedor, setVendedor] = useState(vendedorQuery);
  const [frontalFile, setFrontalFile] = useState<File | null>(null);
  const [traseroFile, setTraseroFile] = useState<File | null>(null);
  const [autorizacion, setAutorizacion] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Búsqueda de cliente por RUT
  const [nombreCliente, setNombreCliente] = useState<string | null>(null); // null = no encontrado
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const rutBusquedaRef = useRef<string>("");

  const sigCanvas = useRef<any>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const clearSignature = () => {
    sigCanvas.current?.clear();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setFile: React.Dispatch<React.SetStateAction<File | null>>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const formatRut = (value: string) => {
    const clean = value.replace(/[^0-9kK]/g, '').toUpperCase();
    if (clean.length <= 1) return clean;
    const body = clean.slice(0, -1);
    const dv = clean.slice(-1);
    return `${body}-${dv}`;
  };

  const buscarNombreCliente = async (rutFormateado: string) => {
    if (!validateRut(rutFormateado)) {
      setNombreCliente(undefined as any);
      return;
    }
    rutBusquedaRef.current = rutFormateado;
    setBuscandoCliente(true);
    setNombreCliente(undefined as any);
    const supabase = createClient();
    const { data } = await supabase
      .from("clientes")
      .select("nombre, segundo_nombre, apellido, segundo_apellido")
      .eq("rut", rutFormateado)
      .maybeSingle();
    // Evitar race condition: solo actualizar si este rut sigue siendo el actual
    if (rutBusquedaRef.current !== rutFormateado) return;
    if (data) {
      const nombre = [data.nombre, data.segundo_nombre, data.apellido, data.segundo_apellido]
        .filter(Boolean)
        .join(" ");
      setNombreCliente(nombre);
    } else {
      setNombreCliente(null);
    }
    setBuscandoCliente(false);
  };

  const validateRut = (rutStr: string) => {
    const cleanRut = rutStr.replace(/[^0-9kK]/g, '').toUpperCase();
    if (cleanRut.length < 8) return false;
    // Basic formatting validation for this step
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!validateRut(rut)) {
      setErrorMsg("Por favor, ingresa un RUT válido.");
      return;
    }
    if (!nombreCliente) {
      setErrorMsg("El RUT ingresado no está registrado en el sistema. Por favor contacta al vendedor.");
      return;
    }
    if (!vendedor) {
      setErrorMsg("Falta el correo del vendedor.");
      return;
    }
    if (!frontalFile || !traseroFile) {
      setErrorMsg("Debes adjuntar las fotos frontal y trasera del Carnet de Identidad.");
      return;
    }
    if (sigCanvas.current?.isEmpty()) {
      setErrorMsg("Debes firmar en el recuadro blanco.");
      return;
    }
    if (!autorizacion) {
      setErrorMsg("Debes autorizar el uso de datos.");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();
    try {
      // 1. Subir Foto Frontal
      const fExt = frontalFile.type.includes('png') ? 'png' : 'jpg';
      const frontalPath = `capturas/${Date.now()}_front_${rut.replace(/[^0-9kK]/g, '')}.${fExt}`;
      const { error: fError } = await supabase.storage.from("firmas").upload(frontalPath, frontalFile);
      if (fError) throw new Error(`Error Frontal: ${fError.message}`);

      // 2. Subir Foto Trasera
      const tExt = traseroFile.type.includes('png') ? 'png' : 'jpg';
      const traseroPath = `capturas/${Date.now()}_back_${rut.replace(/[^0-9kK]/g, '')}.${tExt}`;
      const { error: tError } = await supabase.storage.from("firmas").upload(traseroPath, traseroFile);
      if (tError) throw new Error(`Error Trasero: ${tError.message}`);

      // 3. Obtener Firma y subir
      const firmaDataUrl = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
      const firmaRes = await fetch(firmaDataUrl);
      const firmaBlob = await firmaRes.blob();
      const firmaPath = `capturas/${Date.now()}_firma_${rut.replace(/[^0-9kK]/g, '')}.png`;
      const { error: sigError } = await supabase.storage.from("firmas").upload(firmaPath, firmaBlob, { contentType: 'image/png' });
      if (sigError) throw new Error(`Error Firma: ${sigError.message}`);

      // 4. Guardar en tabla clientes (UPDATE por rut)
      const { data: frontUrlData } = supabase.storage.from("firmas").getPublicUrl(frontalPath);
      const { data: backUrlData } = supabase.storage.from("firmas").getPublicUrl(traseroPath);
      const { data: firmaUrlData } = supabase.storage.from("firmas").getPublicUrl(firmaPath);

      const { error: dbError } = await supabase
        .from("clientes")
        .update({
          ci_frontal: frontUrlData.publicUrl,
          ci_trasero: backUrlData.publicUrl,
          firma: firmaUrlData.publicUrl,
          autorizacion,
          link_firma_vendedor: vendedor,
        })
        .eq("rut", rut);

      if (dbError) throw new Error("Error al guardar la firma en la base de datos.");

      setSuccess(true);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Ocurrió un error inesperado al enviar los datos.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <CheckCircle className="w-20 h-20 text-emerald-500 mb-6" />
        <h1 className="text-3xl font-bold text-slate-800 mb-2">¡Todo Listo!</h1>
        <p className="text-slate-600 mb-8 max-w-sm">Tus documentos y firma han sido enviados exitosamente. Puedes cerrar esta ventana.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 md:px-0">
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        <div className="bg-blue-600 p-6 text-center">
          <h1 className="text-xl font-bold text-white">Firma Digital</h1>
          <p className="text-blue-100 text-sm mt-1">Suzuval Spa</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-6">
          {errorMsg && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-start gap-3 text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <p>{errorMsg}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Correo del Vendedor</label>
            <input
              type="email"
              required
              value={vendedor}
              onChange={(e) => setVendedor(e.target.value)}
              placeholder="correo@suzuval.cl"
              readOnly={!!vendedorQuery} // Lock if it came from URL
              className={`w-full px-4 py-3 border rounded-xl transition-colors text-slate-700 ${vendedorQuery ? 'bg-slate-100 border-slate-200' : 'bg-white border-slate-300 focus:ring-2 focus:ring-blue-500'}`}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">RUT Completo</label>
            <input
              type="text"
              required
              value={rut}
              onChange={(e) => {
                const formatted = formatRut(e.target.value);
                setRut(formatted);
                buscarNombreCliente(formatted);
              }}
              placeholder="12345678-9"
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-lg"
            />
            {/* Feedback nombre cliente */}
            {buscandoCliente && (
              <div className="mt-2 flex items-center gap-2 text-slate-400 text-sm">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Buscando cliente...</span>
              </div>
            )}
            {!buscandoCliente && nombreCliente && (
              <div className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                <span className="text-sm font-semibold text-emerald-800 tracking-wide">{nombreCliente}</span>
              </div>
            )}
            {!buscandoCliente && nombreCliente === null && validateRut(rut) && (
              <div className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                <svg className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                <span className="text-sm text-amber-700">Cliente no registrado en el sistema</span>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 border-b border-slate-200 pb-2">Fotografías del Carnet</h3>
            
            <div>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors relative overflow-hidden group">
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileChange(e, setFrontalFile)} />
                {frontalFile ? (
                  <div className="absolute inset-0 bg-emerald-50 flex items-center justify-center flex-col text-emerald-700 border-emerald-300 border-2 rounded-xl">
                    <CheckCircle className="w-8 h-8 mb-1" />
                    <span className="font-semibold text-sm">Frontal Capturado</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center pt-5 pb-6 text-slate-500 group-hover:text-blue-600 transition-colors">
                    <Camera className="w-8 h-8 mb-2" />
                    <p className="text-sm font-semibold">Foto Frontal</p>
                  </div>
                )}
              </label>
            </div>

            <div>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors relative overflow-hidden group">
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileChange(e, setTraseroFile)} />
                {traseroFile ? (
                   <div className="absolute inset-0 bg-emerald-50 flex items-center justify-center flex-col text-emerald-700 border-emerald-300 border-2 rounded-xl">
                   <CheckCircle className="w-8 h-8 mb-1" />
                   <span className="font-semibold text-sm">Trasero Capturado</span>
                 </div>
                ) : (
                  <div className="flex flex-col items-center justify-center pt-5 pb-6 text-slate-500 group-hover:text-blue-600 transition-colors">
                    <Camera className="w-8 h-8 mb-2" />
                    <p className="text-sm font-semibold">Foto Trasera</p>
                  </div>
                )}
              </label>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
               <label className="block text-sm font-semibold text-slate-700">Firma Digital</label>
               <button type="button" onClick={clearSignature} className="text-xs text-blue-600 font-medium flex items-center gap-1 hover:text-blue-800">
                 <RefreshCcw className="w-3.5 h-3.5" /> Limpiar
               </button>
            </div>
            <div className="border-2 border-slate-300 rounded-xl bg-white overflow-hidden touch-none h-48 w-full cursor-crosshair">
              {mounted && (
                <SignatureCanvas
                  ref={sigCanvas}
                  penColor="blue"
                  canvasProps={{ className: "w-full h-full" }}
                />
              )}
            </div>
          </div>

          <label className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
            <input
              type="checkbox"
              required
              checked={autorizacion}
              onChange={(e) => setAutorizacion(e.target.checked)}
              className="mt-1 w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
            />
            <span className="text-xs text-slate-600 leading-relaxed">
              Autorizo expresamente a Suzuval SPA a utilizar mi Cédula de Identidad y Firma Digital para los trámites legales y de facturación del vehículo.
            </span>
          </label>

          <button
            type="submit"
            disabled={submitting || !nombreCliente || buscandoCliente}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-4 rounded-xl shadow-lg shadow-blue-600/30 transition-all active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none flex items-center justify-center gap-2 mt-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Procesando envío...
              </>
            ) : (
              "Registrar Firma Digital"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function CapturaFirmaPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
        <h2 className="text-lg font-semibold text-slate-700">Cargando formulario...</h2>
      </div>
    }>
      <CapturaFirmaForm />
    </Suspense>
  );
}
