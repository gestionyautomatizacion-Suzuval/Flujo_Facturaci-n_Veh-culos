export interface Category {
  id: string;
  nombre: string;
  orden: number;
}

export interface Guide {
  id: string;
  titulo: string;
  descripcion?: string;
  url_pdf: string;
  updated_at: string;
  categoria_id: string | null;
  orden: number;
}
