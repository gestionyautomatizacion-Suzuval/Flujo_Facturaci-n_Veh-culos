/* MIGRACION FASE 7 - CONTROL DE ARCHIVOS Y RUTAS STORAGE */

create table if not exists public.negocios_documentos (
  id uuid primary key default uuid_generate_v4(),
  negocio_interno text not null references public.negocios(interno) on delete cascade,
  nombre_archivo text not null,
  tamano_kb numeric,
  url text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Políticas RLS para esta tabla
alter table public.negocios_documentos enable row level security;

create policy "Auth leer documentos"
on public.negocios_documentos for select
to authenticated
using (true);

create policy "Auth insertar documentos"
on public.negocios_documentos for insert
to authenticated
with check (true);
