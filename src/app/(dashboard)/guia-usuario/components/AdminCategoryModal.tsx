"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

interface AdminCategoryModalProps {
  category?: { id: string; nombre: string } | null;
  nextOrden: number;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AdminCategoryModal({
  category,
  nextOrden,
  onClose,
  onSuccess,
}: AdminCategoryModalProps) {
  const isEditing = !!category;
  const [nombre, setNombre] = useState(category?.nombre || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!nombre.trim()) {
      setError("El nombre de la sección es obligatorio.");
      return;
    }
    setLoading(true);
    try {
      if (isEditing) {
        const { error: err } = await supabase
          .from("guias_categorias")
          .update({ nombre })
          .eq("id", category.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase
          .from("guias_categorias")
          .insert([{ nombre, orden: nextOrden }]);
        if (err) throw err;
      }
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al guardar la sección.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-800">
            {isEditing ? "Renombrar Sección" : "Nueva Sección"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nombre de la sección <span className="text-red-500">*</span>
            </label>
            <input
              autoFocus
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="Ej. Ventas, Procesos, General"
              disabled={loading}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-70"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Guardar" : "Crear Sección"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
