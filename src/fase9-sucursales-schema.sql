/* 
  MIGRACION FASE 9 - VISIBILIDAD DE SUCURSALES Y FILTROS 
  (Soporte para múltiples sucursales)
*/

-- 1. Crear tipo de sucursales autorizadas
CREATE TYPE tipo_sucursal AS ENUM (
  'C026', -- CF. LA CALERA
  'C027', -- CF. VIÑA DEL MAR
  'C028', -- CF. VALPARAISO
  'C031', -- CF. SAN ANTONIO
  'C041', -- CF. CONCON
  'C157', -- CF. ESPACIO URBANO
  'C168'  -- CF. MELIPILLA
);

-- 2. Modificar la tabla perfiles para soportar múltiples sucursales
-- Agregamos la columna 'sucursales' como un arreglo de tipo_sucursal
ALTER TABLE public.perfiles 
ADD COLUMN IF NOT EXISTS sucursales tipo_sucursal[] DEFAULT '{}';

-- 3. Funciones auxiliares de seguridad para RLS
-- Obtiene el rol del usuario conectado
CREATE OR REPLACE FUNCTION public.get_user_rol() RETURNS text AS $$
  SELECT rol::text FROM public.perfiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Obtiene el listado de sucursales (arreglo) del usuario conectado
CREATE OR REPLACE FUNCTION public.get_user_sucursales() RETURNS tipo_sucursal[] AS $$
  SELECT sucursales FROM public.perfiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 4. Ejemplo RLS para tabla Base ('negocios', 'cotizaciones', etc.)
-- NOTA: DEBES Asegurarte que tu tabla maestra tiene la columna `sucursal_id tipo_sucursal`.
/*
CREATE POLICY "Visibilidad Negocios por Rol y Sucursal"
ON public.negocios FOR SELECT TO authenticated
USING (
  -- Los "Generales" ven TODO
  (public.get_user_rol() IN ('ADMIN', 'GERENCIA', 'ADMINISTRATIVO'))
  
  OR 
  
  -- Los VENDEDORES/JEFES solo ven data si la sucursal del registro está dentro de su arreglo asignado
  (
    public.get_user_rol() IN ('VENDEDOR', 'JEFE') 
    AND sucursal_id = ANY(public.get_user_sucursales())
  )
);
*/
