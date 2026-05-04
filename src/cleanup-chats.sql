-- Limpiar todas las salas de chat duplicadas/vacías generadas durante las pruebas
DELETE FROM public.chat_rooms
WHERE id NOT IN (SELECT DISTINCT room_id FROM public.chat_messages);
