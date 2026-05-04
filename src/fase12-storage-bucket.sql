/* 
  FASE 12: Configuración del Bucket de Almacenamiento
  Crea el bucket 'documentos' y habilita RLS con acceso para usuarios autenticados.
*/

-- 1. Asegurarnos que el bucket existe
insert into storage.buckets (id, name, public) 
values ('documentos', 'documentos', true) 
on conflict (id) do nothing;

-- 2. Limpiar políticas previas que hayan dado conflicto de nombre
DROP POLICY IF EXISTS "Allow Public Select" ON storage.objects;
DROP POLICY IF EXISTS "Allow Auth Insert" ON storage.objects;
DROP POLICY IF EXISTS "Allow Auth Update" ON storage.objects;
DROP POLICY IF EXISTS "Allow Auth Delete" ON storage.objects;

-- 3. Crear Políticas de Acceso únicas para el bucket
create policy "Allow Public Select Documentos" 
on storage.objects for select 
using ( bucket_id = 'documentos' );

create policy "Allow Auth Insert Documentos" 
on storage.objects for insert 
to authenticated 
with check ( bucket_id = 'documentos' );

create policy "Allow Auth Update Documentos" 
on storage.objects for update 
to authenticated 
using ( bucket_id = 'documentos' );

create policy "Allow Auth Delete Documentos" 
on storage.objects for delete 
to authenticated 
using ( bucket_id = 'documentos' );
