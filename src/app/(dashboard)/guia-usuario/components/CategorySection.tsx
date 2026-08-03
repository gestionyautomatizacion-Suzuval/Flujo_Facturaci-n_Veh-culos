"use client";

import { ChevronDown, ChevronRight, Edit, Trash2, Plus, GripVertical } from "lucide-react";
import { Droppable, Draggable } from "@hello-pangea/dnd";
import UserGuideCard from "./UserGuideCard";
import type { Guide } from "../types";



interface CategorySectionProps {
  category: { id: string; nombre: string; orden: number };
  categoryIndex: number;
  guides: Guide[];
  isAdmin: boolean;
  isCollapsed: boolean;
  onToggleCollapse: (id: string) => void;
  onOpenPdf: (url: string, title: string) => void;
  onEditGuide: (guide: Partial<Guide>) => void;
  onDeleteGuide: (id: string) => void;
  onEditCategory: (cat: { id: string; nombre: string }) => void;
  onDeleteCategory: (id: string) => void;
  onAddGuide: (categoryId: string) => void;
}

export default function CategorySection({
  category,
  categoryIndex,
  guides,
  isAdmin,
  isCollapsed,
  onToggleCollapse,
  onOpenPdf,
  onEditGuide,
  onDeleteGuide,
  onEditCategory,
  onDeleteCategory,
  onAddGuide,
}: CategorySectionProps) {
  return (
    <Draggable draggableId={`cat-${category.id}`} index={categoryIndex} isDragDisabled={!isAdmin}>
      {(catProvided, catSnapshot) => (
        <div
          ref={catProvided.innerRef}
          {...catProvided.draggableProps}
          className={`rounded-2xl transition-all ${catSnapshot.isDragging ? "opacity-80" : ""}`}
        >
          {/* Category Header */}
          <div className="flex items-center gap-2 mb-4 group/header">
            {/* Drag handle for category */}
            {isAdmin && (
              <div
                {...catProvided.dragHandleProps}
                className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 transition-colors p-1"
                title="Arrastra para reordenar sección"
              >
                <GripVertical className="h-4 w-4" />
              </div>
            )}

            {/* Collapse toggle */}
            <button
              onClick={() => onToggleCollapse(category.id)}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              {isCollapsed
                ? <ChevronRight className="h-4 w-4" />
                : <ChevronDown className="h-4 w-4" />
              }
            </button>

            {/* Title + count */}
            <h2 className="text-base font-bold text-slate-800">{category.nombre}</h2>
            <span className="text-sm font-medium text-slate-400">{guides.length}</span>

            {/* Admin actions */}
            {isAdmin && (
              <div className="flex items-center gap-1 ml-1 opacity-0 group-hover/header:opacity-100 transition-opacity">
                <button
                  onClick={() => onEditCategory(category)}
                  className="flex items-center justify-center h-6 w-6 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  title="Renombrar sección"
                >
                  <Edit className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onDeleteCategory(category.id)}
                  className="flex items-center justify-center h-6 w-6 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Eliminar sección"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onAddGuide(category.id)}
                  className="flex items-center justify-center h-6 w-6 rounded-md text-slate-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                  title="Agregar guía a esta sección"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Droppable area for cards */}
          {!isCollapsed && (
            <Droppable droppableId={category.id} type="GUIDE" direction="horizontal">
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 min-h-[120px] rounded-xl p-2 transition-colors ${
                    snapshot.isDraggingOver ? "bg-blue-50/60" : ""
                  }`}
                >
                  {guides.map((guide, idx) => (
                    <UserGuideCard
                      key={guide.id}
                      index={idx}
                      id={guide.id}
                      titulo={guide.titulo}
                      descripcion={guide.descripcion}
                      url_pdf={guide.url_pdf}
                      updated_at={guide.updated_at}
                      isAdmin={isAdmin}
                      onOpenPdf={onOpenPdf}
                      onEdit={onEditGuide}
                      onDelete={onDeleteGuide}
                    />
                  ))}
                  {provided.placeholder}
                  {guides.length === 0 && !snapshot.isDraggingOver && (
                    <div className="col-span-full flex items-center justify-center h-24 rounded-xl border border-dashed border-slate-200 text-sm text-slate-400">
                      {isAdmin ? "Arrastra una guía aquí o usa el botón +" : "Sin guías en esta sección"}
                    </div>
                  )}
                </div>
              )}
            </Droppable>
          )}

          {isCollapsed && (
            <p className="text-xs text-slate-400 mb-2 ml-8">
              {guides.length} {guides.length === 1 ? "guía" : "guías"} (sección contraída)
            </p>
          )}
        </div>
      )}
    </Draggable>
  );
}
