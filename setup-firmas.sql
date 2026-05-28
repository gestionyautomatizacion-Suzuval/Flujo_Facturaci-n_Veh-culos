-- 1. Crear la tabla de Firmas Digitales
CREATE TABLE public.firmas_digitales (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    rut_cliente text NOT NULL,
    correo_vendedor text NOT NULL,
    foto_carnet_frontal text NOT NULL,
    foto_carnet_trasero text NOT NULL,
    firma_electronica text NOT NULL,
    autorizacion boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Habilitar Seguridad a Nivel de Fila (RLS) en la tabla
ALTER TABLE public.firmas_digitales ENABLE ROW LEVEL SECURITY;

-- 3. Políticas para la tabla firmas_digitales
-- Permitir a cualquier persona (anon) insertar datos (ya que el cliente llenará el formulario público)
CREATE POLICY "Permitir inserción pública en firmas_digitales" 
ON public.firmas_digitales FOR INSERT 
TO public
WITH CHECK (true);

-- Permitir solo a usuarios autenticados leer los datos
CREATE POLICY "Permitir lectura a usuarios autenticados" 
ON public.firmas_digitales FOR SELECT 
TO authenticated 
USING (true);

-- 4. Crear el Bucket de Storage para los documentos (Privado)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documentos_identidad', 'documentos_identidad', false);

-- 5. Políticas para el Bucket documentos_identidad
-- Permitir a cualquier persona subir archivos al bucket
CREATE POLICY "Permitir subida pública de documentos"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'documentos_identidad');

-- Permitir solo a usuarios autenticados leer (descargar/ver) los archivos del bucket
CREATE POLICY "Permitir lectura autenticada de documentos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'documentos_identidad');
