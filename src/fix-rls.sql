-- Corrige la recursion infinita en chat_participants
DROP POLICY IF EXISTS "Un usuario puede ver participantes de sus salas" ON public.chat_participants;

CREATE POLICY "Un usuario puede ver participantes de sus salas"
ON public.chat_participants FOR SELECT
USING ( auth.role() = 'authenticated' );
