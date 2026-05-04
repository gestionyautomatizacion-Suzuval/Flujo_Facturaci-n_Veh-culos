/* 
  MIGRACION FASE 9.1 - RLS EN TABLA NEGOCIOS
  Implementa la visibilidad de registros acorde a las sucursales del perfil.
*/

-- 1. Habilitar RLS en la tabla principal (asumiendo que se llama 'negocios')
ALTER TABLE public.negocios ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas previas conflictivas (opcional, si existía una pública)
DROP POLICY IF EXISTS "Visibilidad libre" ON public.negocios;
DROP POLICY IF EXISTS "Visibilidad Negocios por Rol y Sucursal" ON public.negocios;

-- 3. Crear política inteligente que usa las funciones de la Fase 9
CREATE POLICY "Visibilidad Negocios por Rol y Sucursal"
ON public.negocios FOR SELECT TO authenticated
USING (
  -- Los "Generales" (ADMIN, GERENCIA, ADMINISTRATIVO) ven TODO
  (public.get_user_rol() IN ('ADMIN', 'GERENCIA', 'ADMINISTRATIVO'))
  
  OR 
  
  -- Los VENDEDORES y JEFES ven la data si el código de sucursal aparece en el string de "suc_vta"
  -- Ejemplo: suc_vta = "C027 - CF. VIÑA DEL MAR", y el usuario tiene 'C027' en su arreglo.
  (
    public.get_user_rol() IN ('VENDEDOR', 'JEFE') 
    AND (
      EXISTS (
        SELECT 1 FROM unnest(public.get_user_sucursales()) AS sucursal_codigo
        WHERE suc_vta LIKE '%' || sucursal_codigo::text || '%'
      )
    )
  )
);

-- 4. Para permitir a los vendedores seguir CREANDO negocios:
CREATE POLICY "Permitir Insertar a todos"
ON public.negocios FOR INSERT TO authenticated
WITH CHECK (true);

-- (Opcional) Política para modificar
CREATE POLICY "Permitir Modificar"
ON public.negocios FOR UPDATE TO authenticated
USING (true);
