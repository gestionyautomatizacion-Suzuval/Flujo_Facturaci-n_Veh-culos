/* 
  MIGRACION FASE 10 - CAMPOS DE OBSERVACIONES Y EXTRAS AL NEGOCIO
*/

ALTER TABLE public.negocios 
ADD COLUMN IF NOT EXISTS prepago_vigente boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS retoma_usado boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS accesorios_instalados boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS gestion_accesorios text,
ADD COLUMN IF NOT EXISTS mantencion_prepagada boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS aporte_promocion_marca boolean DEFAULT false,
-- Nota: La columna "saldo" ya existía, pero antes era texto libre. Si requieres re-mapearla puedes usar el mismo campo de texto o crear uno nuevo.
ADD COLUMN IF NOT EXISTS observacion_inicial text;
