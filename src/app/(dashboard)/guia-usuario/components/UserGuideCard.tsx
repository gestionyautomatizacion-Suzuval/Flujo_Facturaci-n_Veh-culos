"use client";

import { BookOpen, Edit, Trash2 } from "lucide-react";
import { Draggable } from "@hello-pangea/dnd";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { Guide } from "../types";

interface UserGuideCardProps {
  id: string;
  index: number;
  titulo: string;
  descripcion?: string;
  url_pdf: string;
  updated_at: string;
  isAdmin: boolean;
  onOpenPdf: (url: string, title: string) => void;
  onEdit: (guide: Partial<Guide>) => void;
  onDelete: (id: string) => void;
}

export default function UserGuideCard({
  id,
  index,
  titulo,
  descripcion,
  url_pdf,
  updated_at,
  isAdmin,
  onOpenPdf,
  onEdit,
  onDelete,
}: UserGuideCardProps) {
  return (
    <Draggable draggableId={id} index={index} isDragDisabled={!isAdmin}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`group relative flex flex-col justify-between rounded-2xl border bg-white p-5 transition-all ${
            snapshot.isDragging
              ? "border-blue-400 shadow-xl rotate-1 scale-[1.02]"
              : "border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md"
          }`}
        >
          {/* Drag handle + action buttons */}
          <div className="flex items-start justify-between mb-4">
            <div
              {...(isAdmin ? provided.dragHandleProps : {})}
              className={`flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-700 ${
                isAdmin ? "cursor-grab active:cursor-grabbing" : ""
              }`}
              onClick={() => onOpenPdf(url_pdf, titulo)}
            >
              <BookOpen className="h-5 w-5" />
            </div>

            {isAdmin && (
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit({ id, titulo, descripcion, url_pdf }); }}
                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                  title="Editar"
                >
                  <Edit className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(id); }}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  title="Eliminar"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Content — clickable to open PDF */}
          <div
            className="flex-1 cursor-pointer"
            onClick={() => onOpenPdf(url_pdf, titulo)}
          >
            <h3 className="mb-1.5 text-sm font-semibold text-slate-900 line-clamp-2 leading-snug">
              {titulo}
            </h3>
            {descripcion && (
              <p className="mb-3 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                {descripcion}
              </p>
            )}
          </div>

          <p className="mt-3 text-xs text-slate-400">
            Actualizado: {format(new Date(updated_at), "dd/MM/yyyy", { locale: es })}
          </p>
        </div>
      )}
    </Draggable>
  );
}
