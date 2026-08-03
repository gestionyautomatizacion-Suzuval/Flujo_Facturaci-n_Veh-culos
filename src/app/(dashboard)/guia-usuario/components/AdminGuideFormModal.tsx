"use client";

import { useState } from "react";
import { X, Upload, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import type { Guide } from "../types";

interface Category {
  id: string;
  nombre: string;
}

interface AdminGuideFormModalProps {
  guide?: Partial<Guide> | null;
  defaultCategoryId?: string | null;
  categories: Category[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function AdminGuideFormModal({
  guide,
  defaultCategoryId,
  categories,
  onClose,
  onSuccess,
}: AdminGuideFormModalProps) {
  const isEditing = !!guide;
  const [titulo, setTitulo] = useState(guide?.titulo || "");
  const [descripcion, setDescripcion] = useState(guide?.descripcion || "");
  const [categoriaId, setCategoriaId] = useState<string>(
    guide?.categoria_id || defaultCategoryId || (categories[0]?.id ?? "")
  );
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!titulo.trim()) { setError("El título es obligatorio."); return; }
    if (!isEditing && !file) { setError("Debes seleccionar un archivo PDF."); return; }
    if (!categoriaId) { setError("Debes seleccionar una sección."); return; }
    setLoading(true);

    try {
      let finalUrl = guide?.url_pdf || "";

      if (file) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("guias_usuario")
          .upload(`manuales/${fileName}`, file);
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("guias_usuario")
          .getPublicUrl(`manuales/${fileName}`);
        finalUrl = urlData.publicUrl;
      }

      const { data: userData } = await supabase.auth.getUser();

      if (isEditing) {
        const { error: err } = await supabase
          .from("guias_usuario")
          .update({ titulo, descripcion, url_pdf: finalUrl, categoria_id: categoriaId, updated_at: new Date().toISOString() })
          .eq("id", guide.id);
        if (err) throw err;
      } else {
        // Obtener el próximo número de orden dentro de la categoría
        const { count } = await supabase
          .from("guias_usuario")
          .select("*", { count: "exact", head: true })
          .eq("categoria_id", categoriaId);

        const { error: err } = await supabase
          .from("guias_usuario")
          .insert([{
            titulo,
            descripcion,
            url_pdf: finalUrl,
            categoria_id: categoriaId,
            orden: count ?? 0,
            created_by: userData.user?.id,
          }]);
        if (err) throw err;
      }
      onSuccess();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Error al guardar la guía.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-800">
            {isEditing ? "Editar Guía" : "Nueva Guía de Usuario"}
          </h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Sección <span className="text-red-500">*</span>
            </label>
            <select
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              disabled={loading}
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Título <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="Ej. Manual de Facturación v2.0"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none h-20"
              placeholder="Breve resumen del contenido (opcional)"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Archivo PDF {!isEditing && <span className="text-red-500">*</span>}
              {isEditing && <span className="text-slate-400 font-normal ml-1">(dejar en blanco para mantener el actual)</span>}
            </label>
            <div className="mt-1 flex justify-center rounded-lg border border-dashed border-slate-300 px-6 py-6 hover:bg-slate-50 transition-colors cursor-pointer">
              <div className="text-center">
                <Upload className="mx-auto h-7 w-7 text-slate-400" />
                <div className="mt-3 flex text-sm text-slate-600 justify-center">
                  <label className="cursor-pointer font-semibold text-blue-600 hover:text-blue-500">
                    <span>Subir archivo</span>
                    <input
                      type="file"
                      className="sr-only"
                      accept=".pdf,application/pdf"
                      onChange={(e) => { if (e.target.files?.[0]) setFile(e.target.files[0]); }}
                      disabled={loading}
                    />
                  </label>
                  <p className="pl-1">o arrastrar y soltar</p>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {file ? `✓ ${file.name}` : "Solo PDF, máx. 10MB"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} disabled={loading}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-70">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Guardar Cambios" : "Subir Guía"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
