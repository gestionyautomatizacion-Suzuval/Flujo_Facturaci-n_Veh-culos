/* 
  MIGRACION FASE 9.2 - HABILITAR REALTIME
  Al habilitar la replicación de datos en tiempo real (Supabase Realtime) 
  sobre la tabla, los eventos de inserción llegarán instantáneamente a la app.
*/

DO $$ 
BEGIN
  -- Intenta añadir la tabla a la publicación de realtime
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'negocios_comentarios'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.negocios_comentarios;
  END IF;
END $$;
