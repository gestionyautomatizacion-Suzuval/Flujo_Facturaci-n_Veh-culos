/* MIGRACION FASE 6 - COMENTARIOS Y CHAT DEL NEGOCIO */

create table public.negocios_comentarios (
  id uuid primary key default uuid_generate_v4(),
  negocio_interno text not null references public.negocios(interno) on delete cascade,
  usuario_nombre text not null,
  usuario_email text not null,
  comentario text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Políticas de Seguridad (RLS) para permitir full acceso a usuarios logueados
alter table public.negocios_comentarios enable row level security;

create policy "Todos los auth pueden leer comentarios"
on public.negocios_comentarios for select
to authenticated
using (true);

create policy "Todos los auth pueden insertar comentarios"
on public.negocios_comentarios for insert
to authenticated
with check (true);
