-- FASE 8.1 - ESTADOS DE SUSPENSIÓN DE USUARIOS
-- Agregamos la columna 'estado' a la tabla perfiles para controlar el Activo/Inactivo
alter table public.perfiles add column if not exists estado text default 'ACTIVO';
