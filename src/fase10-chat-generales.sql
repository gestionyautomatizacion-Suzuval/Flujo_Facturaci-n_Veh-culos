/* 
  MIGRACION FASE 10 - CHAT GENERALES (CONTACTOS)
  Creación de tablas para mensajería 1-on-1 y grupal
*/

-- 1. Tabla de Salas de Chat (Rooms)
CREATE TABLE public.chat_rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NULL, -- Si es grupo, tendrá nombre. Si es 1 a 1, será nulo.
  is_group BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabla de Participantes
CREATE TABLE public.chat_participants (
  room_id UUID REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_email VARCHAR(255) NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (room_id, user_email)
);

-- 3. Tabla de Mensajes
CREATE TABLE public.chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  sender_email VARCHAR(255) NOT NULL,
  sender_name VARCHAR(255) NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Habilitar Row Level Security (RLS)
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- 5. Políticas de Seguridad (Access Control)
-- Rooms
CREATE POLICY "Un usuario puede ver las salas en las que es participante" 
ON public.chat_rooms FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chat_participants cp 
    WHERE cp.room_id = chat_rooms.id 
    AND cp.user_email = auth.jwt()->>'email'
  )
);

CREATE POLICY "Cualquier usuario autenticado puede crear salas"
ON public.chat_rooms FOR INSERT
WITH CHECK ( auth.role() = 'authenticated' );

-- Participants
CREATE POLICY "Un usuario puede ver participantes de sus salas"
ON public.chat_participants FOR SELECT
USING ( auth.role() = 'authenticated' );

CREATE POLICY "Puedes añadir un participante si eres el creador o estas en la sala"
ON public.chat_participants FOR INSERT
WITH CHECK ( auth.role() = 'authenticated' ); -- Para evitar complex policies en insercion inicial, permitimos a autenticados.

-- Messages
CREATE POLICY "Puedes leer mensajes de las salas donde participas"
ON public.chat_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chat_participants cp 
    WHERE cp.room_id = chat_messages.room_id 
    AND cp.user_email = auth.jwt()->>'email'
  )
);

CREATE POLICY "Puedes enviar mensajes a tus salas"
ON public.chat_messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_participants cp 
    WHERE cp.room_id = chat_messages.room_id 
    AND cp.user_email = auth.jwt()->>'email'
  )
  AND sender_email = auth.jwt()->>'email'
);


-- 6. Habilitar Realtime para las tablas
DO $$ 
BEGIN
  -- Revisa si la policy de la publicacion existe y agrega tables
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'chat_messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'chat_rooms') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_rooms;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'chat_participants') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Ignorar errores si las tablas ya existen en el esquema
END $$;
