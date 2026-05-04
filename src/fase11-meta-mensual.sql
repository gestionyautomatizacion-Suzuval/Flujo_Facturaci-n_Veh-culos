/* 
  FASE 11: Añadir columna meta_mensual a los perfiles
  Permite que cada usuario tenga una meta configurable.
*/

ALTER TABLE public.perfiles 
ADD COLUMN IF NOT EXISTS meta_mensual integer DEFAULT 12;
