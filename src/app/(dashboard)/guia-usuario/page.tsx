"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, BookOpen, Loader2, FolderPlus, Edit as EditIcon, Trash2 as Trash2Icon } from "lucide-react";
import { format as formatDate } from "date-fns";
import { es as esLocale } from "date-fns/locale";
import { DragDropContext, Droppable, DropResult } from "@hello-pangea/dnd";
import { createClient } from "@/utils/supabase/client";

import CategorySection from "./components/CategorySection";
import PdfViewerModal from "./components/PdfViewerModal";
import AdminGuideFormModal from "./components/AdminGuideFormModal";
import AdminCategoryModal from "./components/AdminCategoryModal";

import type { Category, Guide } from "./types";


// Build a map: categoryId → sorted guides
function buildCategoryMap(categories: Category[], guides: Guide[]) {
  const map: Record<string, Guide[]> = {};
  for (const cat of categories) {
    map[cat.id] = [];
  }
  for (const g of guides) {
    const key = g.categoria_id ?? "__uncategorized__";
    if (!map[key]) map[key] = [];
    map[key].push(g);
  }
  for (const key of Object.keys(map)) {
    map[key].sort((a, b) => a.orden - b.orden);
  }
  return map;
}

export default function GuiaUsuarioPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [guideMap, setGuideMap] = useState<Record<string, Guide[]>>({});
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Modals
  const [selectedPdf, setSelectedPdf] = useState<{ url: string; title: string } | null>(null);
  const [isGuideFormOpen, setIsGuideFormOpen] = useState(false);
  const [guideToEdit, setGuideToEdit] = useState<Partial<Guide> | null>(null);
  const [defaultCategoryId, setDefaultCategoryId] = useState<string | null>(null);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<{ id: string; nombre: string } | null>(null);

  const supabase = createClient();

  // ── Fetch ──────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: cats }, { data: gus }, { data: userData }] = await Promise.all([
      supabase.from("guias_categorias").select("*").order("orden", { ascending: true }),
      supabase.from("guias_usuario").select("*").order("orden", { ascending: true }),
      supabase.auth.getUser(),
    ]);

    const catList: Category[] = cats ?? [];
    const guideList: Guide[] = gus ?? [];

    setCategories(catList);
    setGuides(guideList);
    setGuideMap(buildCategoryMap(catList, guideList));

    if (userData?.user) {
      const { data: perfil } = await supabase
        .from("perfiles")
        .select("rol")
        .eq("id", userData.user.id)
        .single();
      setIsAdmin(perfil?.rol === "ADMIN");
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Drag & Drop ────────────────────────────────────────────
  const onDragEnd = async (result: DropResult) => {
    const { source, destination, type } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    // ---- Reordering CATEGORIES ----
    if (type === "CATEGORY") {
      const newCats = Array.from(categories);
      const [moved] = newCats.splice(source.index, 1);
      newCats.splice(destination.index, 0, moved);

      // Optimistic UI
      setCategories(newCats);
      setGuideMap(buildCategoryMap(newCats, guides));

      // Persist: update `orden` for each category
      const updates = newCats.map((cat, idx) =>
        supabase.from("guias_categorias").update({ orden: idx }).eq("id", cat.id) as unknown as Promise<void>
      );
      await Promise.all(updates);
      return;
    }

    // ---- Reordering / Moving GUIDES ----
    const srcCatId = source.droppableId;
    const dstCatId = destination.droppableId;

    const newMap = { ...guideMap };
    const srcGuides = Array.from(newMap[srcCatId] ?? []);
    const dstGuides = srcCatId === dstCatId ? srcGuides : Array.from(newMap[dstCatId] ?? []);

    const [movedGuide] = srcGuides.splice(source.index, 1);
    const updatedGuide = { ...movedGuide, categoria_id: dstCatId };
    dstGuides.splice(destination.index, 0, updatedGuide);

    newMap[srcCatId] = srcGuides;
    newMap[dstCatId] = dstGuides;

    // Optimistic UI
    setGuideMap(newMap);

    // Persist: update categoria_id and orden for affected guides
    const updates: Promise<void>[] = [];

    // All guides in source category get new orden values
    srcGuides.forEach((g, idx) => {
      updates.push(
        supabase.from("guias_usuario").update({ orden: idx }).eq("id", g.id) as unknown as Promise<void>
      );
    });
    // All guides in destination category get new orden + maybe new categoria_id
    dstGuides.forEach((g, idx) => {
      updates.push(
        supabase.from("guias_usuario")
          .update({ orden: idx, categoria_id: dstCatId })
          .eq("id", g.id) as unknown as Promise<void>
      );
    });

    await Promise.all(updates);
  };

  // ── Category actions ───────────────────────────────────────
  const handleDeleteCategory = async (id: string) => {
    const count = (guideMap[id] ?? []).length;
    const msg = count > 0
      ? `Esta sección tiene ${count} guía(s). Al eliminarla, las guías quedarán sin sección. ¿Continuar?`
      : "¿Estás seguro de que deseas eliminar esta sección?";
    if (!window.confirm(msg)) return;
    await supabase.from("guias_categorias").delete().eq("id", id);
    fetchAll();
  };

  // ── Guide actions ──────────────────────────────────────────
  const handleDeleteGuide = async (id: string) => {
    if (!window.confirm("¿Eliminar esta guía?")) return;
    await supabase.from("guias_usuario").delete().eq("id", id);
    fetchAll();
  };

  const toggleCollapse = (id: string) =>
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleAddGuide = (categoryId: string) => {
    setGuideToEdit(null);
    setDefaultCategoryId(categoryId);
    setIsGuideFormOpen(true);
  };

  const handleEditGuide = (guide: Partial<Guide>) => {
    setGuideToEdit(guide);
    setDefaultCategoryId(guide.categoria_id ?? null);
    setIsGuideFormOpen(true);
  };

  // ── Uncategorized guides ───────────────────────────────────
  const uncategorized = guides.filter((g) => !g.categoria_id);

  return (
    <>
      {/* ── Page header ── */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-blue-600" />
            Guía del Usuario y Documentación
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Consulta los manuales y políticas del sistema.
          </p>
        </div>

        {isAdmin && (
          <div className="flex gap-2">
            <button
              onClick={() => { setCategoryToEdit(null); setIsCatModalOpen(true); }}
              className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-all active:scale-95"
            >
              <FolderPlus className="h-4 w-4" />
              Nueva Sección
            </button>
            <button
              onClick={() => { setGuideToEdit(null); setDefaultCategoryId(categories[0]?.id ?? null); setIsGuideFormOpen(true); }}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-all active:scale-95"
              disabled={categories.length === 0}
              title={categories.length === 0 ? "Primero crea una sección" : undefined}
            >
              <Plus className="h-5 w-5" />
              Nueva Guía
            </button>
          </div>
        )}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : categories.length === 0 && uncategorized.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center">
          <BookOpen className="mx-auto h-12 w-12 text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700">No hay contenido aún</h3>
          <p className="mt-2 text-sm text-slate-500">
            {isAdmin
              ? 'Comienza creando una "Nueva Sección" y luego sube guías dentro de ella.'
              : "Aún no se han publicado manuales en esta sección."}
          </p>
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          {/* Droppable container for categories */}
          <Droppable droppableId="CATEGORIES" type="CATEGORY">
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="space-y-10"
              >
                {categories.map((cat, idx) => (
                  <CategorySection
                    key={cat.id}
                    category={cat}
                    categoryIndex={idx}
                    guides={guideMap[cat.id] ?? []}
                    isAdmin={isAdmin}
                    isCollapsed={!!collapsed[cat.id]}
                    onToggleCollapse={toggleCollapse}
                    onOpenPdf={(url, title) => setSelectedPdf({ url, title })}
                    onEditGuide={handleEditGuide}
                    onDeleteGuide={handleDeleteGuide}
                    onEditCategory={(c) => { setCategoryToEdit(c); setIsCatModalOpen(true); }}
                    onDeleteCategory={handleDeleteCategory}
                    onAddGuide={handleAddGuide}
                  />
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>

          {/* Uncategorized guides fallback */}
          {uncategorized.length > 0 && (
            <div className="mt-10">
              <h2 className="text-base font-bold text-slate-500 mb-4">Sin sección asignada</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {uncategorized.map((g) => (
                  <UserGuideCardStatic
                    key={g.id}
                    guide={g}
                    isAdmin={isAdmin}
                    onOpenPdf={(url, title) => setSelectedPdf({ url, title })}
                    onEdit={handleEditGuide}
                    onDelete={handleDeleteGuide}
                  />
                ))}
              </div>
            </div>
          )}
        </DragDropContext>
      )}

      {/* ── Modals ── */}
      {selectedPdf && (
        <PdfViewerModal url={selectedPdf.url} title={selectedPdf.title} onClose={() => setSelectedPdf(null)} />
      )}

      {isGuideFormOpen && (
        <AdminGuideFormModal
          guide={guideToEdit}
          defaultCategoryId={defaultCategoryId}
          categories={categories}
          onClose={() => { setIsGuideFormOpen(false); setGuideToEdit(null); }}
          onSuccess={() => { setIsGuideFormOpen(false); setGuideToEdit(null); fetchAll(); }}
        />
      )}

      {isCatModalOpen && (
        <AdminCategoryModal
          category={categoryToEdit}
          nextOrden={categories.length}
          onClose={() => { setIsCatModalOpen(false); setCategoryToEdit(null); }}
          onSuccess={() => { setIsCatModalOpen(false); setCategoryToEdit(null); fetchAll(); }}
        />
      )}
    </>
  );
}


// Simple static card for uncategorized guides (no DnD needed)
function UserGuideCardStatic({ guide, isAdmin, onOpenPdf, onEdit, onDelete }: {
  guide: Guide;
  isAdmin: boolean;
  onOpenPdf: (url: string, title: string) => void;
  onEdit: (g: Partial<Guide>) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-300 hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-4">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-700 cursor-pointer"
          onClick={() => onOpenPdf(guide.url_pdf, guide.titulo)}
        >
          <BookOpen className="h-5 w-5" />
        </div>
        {isAdmin && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onEdit(guide)}
              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
            >
              <EditIcon className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onDelete(guide.id)}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
            >
              <Trash2Icon className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
      <div className="flex-1 cursor-pointer" onClick={() => onOpenPdf(guide.url_pdf, guide.titulo)}>
        <h3 className="mb-1.5 text-sm font-semibold text-slate-900 line-clamp-2">{guide.titulo}</h3>
        {guide.descripcion && (
          <p className="text-xs text-slate-500 line-clamp-2">{guide.descripcion}</p>
        )}
      </div>
      <p className="mt-3 text-xs text-slate-400">
        Actualizado: {formatDate(new Date(guide.updated_at), "dd/MM/yyyy", { locale: esLocale })}
      </p>
    </div>
  );
}
