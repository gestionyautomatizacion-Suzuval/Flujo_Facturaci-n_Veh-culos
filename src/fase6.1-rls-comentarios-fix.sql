/* 
  CORRECCIÓN FASE 6.1 - RLS DE COMENTARIOS
  Asegura que los comentarios de un negocio solo sean visibles 
  para los usuarios que tienen acceso al negocio correspondiente.
*/

-- 1. Eliminar política permisiva anterior
DROP POLICY IF EXISTS "Todos los auth pueden leer comentarios" ON public.negocios_comentarios;

-- 2. Crear nueva política estricta basada en el acceso al negocio
CREATE POLICY "Visibilidad Comentarios por Negocio"
ON public.negocios_comentarios FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.negocios n
    WHERE n.pedido_venta = negocios_comentarios.pedido_venta
  )
);
