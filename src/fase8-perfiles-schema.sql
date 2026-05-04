/* MIGRACION FASE 8 - PERFILES Y PUESTOS (RBAC) */

-- Crear tipo de roles cerrados
create type user_role as enum ('VENDEDOR', 'JEFE', 'ADMINISTRATIVO', 'GERENCIA', 'ADMIN');

-- Crear tabla de perfiles enlazada a las credenciales oficiales (auth.users)
create table if not exists public.perfiles (
  id uuid references auth.users(id) on delete cascade primary key,
  nombre_completo text,
  email text,
  rol user_role default 'VENDEDOR'::user_role,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Políticas RLS
alter table public.perfiles enable row level security;

-- Todos pueden ver quién es quién en el sistema
create policy "Auth leer perfiles"
on public.perfiles for select
to authenticated
using (true);

-- Solo la súper-llave puede insertar o editar, así que no insertamos póliza PUBLICA de insert/update
