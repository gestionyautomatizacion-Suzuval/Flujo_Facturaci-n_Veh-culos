"use client";

import React, { useState, useRef, useEffect } from "react";
import SignatureCanvas from "react-signature-canvas";
import { createClient } from "@/utils/supabase/client";
import { Camera, RefreshCcw, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

export default function CapturaFirmaPage() {
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
    let formatted = "";
    for (let i = body.length - 1, j = 0; i >= 0; i--, j++) {
      formatted = body.charAt(i) + formatted;
      if (j === 2 && i > 0) {
        formatted = "." + formatted;
        j = -1;
      }
    }
    return `${formatted}-${dv}`;
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
      const frontalExt = frontalFile.name.split('.').pop();
      const frontalPath = `capturas/${Date.now()}_front_${rut.replace(/[^0-9kK]/g, '')}.${frontalExt}`;
      const { error: fError } = await supabase.storage.from("firmas").upload(frontalPath, frontalFile);
      if (fError) throw new Error("Error al subir carnet frontal.");

      // 2. Subir Foto Trasera
      const traseroExt = traseroFile.name.split('.').pop();
      const traseroPath = `capturas/${Date.now()}_back_${rut.replace(/[^0-9kK]/g, '')}.${traseroExt}`;
      const { error: tError } = await supabase.storage.from("firmas").upload(traseroPath, traseroFile);
      if (tError) throw new Error("Error al subir carnet trasero.");

      // 3. Obtener Firma y subir
      const firmaDataUrl = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
      const firmaRes = await fetch(firmaDataUrl);
      const firmaBlob = await firmaRes.blob();
      const firmaPath = `capturas/${Date.now()}_firma_${rut.replace(/[^0-9kK]/g, '')}.png`;
      const { error: sigError } = await supabase.storage.from("firmas").upload(firmaPath, firmaBlob, { contentType: 'image/png' });
      if (sigError) throw new Error("Error al subir la firma electrónica.");

      // 4. Guardar en Base de Datos
      const { data: frontUrlData } = supabase.storage.from("firmas").getPublicUrl(frontalPath);
      const { data: backUrlData } = supabase.storage.from("firmas").getPublicUrl(traseroPath);
      const { data: firmaUrlData } = supabase.storage.from("firmas").getPublicUrl(firmaPath);

      const { error: dbError } = await supabase.from("copia_firmas").insert([{
        rut,
        correo_vendedor: vendedor,
        ci_frontal: frontUrlData.publicUrl,
        ci_trasero: backUrlData.publicUrl,
        firma: firmaUrlData.publicUrl,
        autorizacion
      }]);

      if (dbError) throw new Error("Error al guardar el registro en la base de datos.");

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
          <h1 className="text-xl font-bold text-white">Captura de Documentos</h1>
          <p className="text-blue-100 text-sm mt-1">Facturación de Vehículos</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-6">
          {errorMsg && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-start gap-3 text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <p>{errorMsg}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">RUT Completo</label>
            <input
              type="text"
              required
              value={rut}
              onChange={(e) => setRut(formatRut(e.target.value))}
              placeholder="12.345.678-9"
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-lg"
            />
          </div>

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
                    <p className="text-sm font-semibold">Toma Foto Frontal</p>
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
                    <p className="text-sm font-semibold">Toma Foto Trasera</p>
                  </div>
                )}
              </label>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
               <label className="block text-sm font-semibold text-slate-700">Firma Electrónica</label>
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
              Autorizo expresamente a Suzuval SPA a utilizar mi Cédula de Identidad y Firma Digital para los trámites legales y de facturación del vehículo, entendiendo que esta información será almacenada de forma segura.
            </span>
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-4 rounded-xl shadow-lg shadow-blue-600/30 transition-all active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none flex items-center justify-center gap-2 mt-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Procesando envío...
              </>
            ) : (
              "Enviar Documentos"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
