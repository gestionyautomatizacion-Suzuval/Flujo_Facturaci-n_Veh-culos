"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { MessageSquare, Users2, Search, Plus, Send, X, Loader2 } from "lucide-react";

interface ChatsClientProps {
  userEmail: string;
  userName: string;
}

interface Perfil {
  email: string;
  nombre_completo: string;
  estado: string;
}

interface ChatRoom {
  id: string;
  name: string | null;
  is_group: boolean;
  participants: string[];
  display_name?: string; // computed on client
}

interface ChatMessage {
  id: string;
  room_id: string;
  sender_email: string;
  sender_name: string;
  content: string;
  created_at: string;
}

export default function ChatsClient({ userEmail, userName }: ChatsClientProps) {
  const [directory, setDirectory] = useState<Perfil[]>([]);
  const [directoryMap, setDirectoryMap] = useState<Record<string, string>>({});
  
  const [chats, setChats] = useState<ChatRoom[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  
  const supabase = createClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Init Data: En paralelo, carga los perfiles y luego las salas de chat
  useEffect(() => {
    const init = async () => {
      // 1. Cargar directorio de usuarios activos
      const { data: perfilesData } = await supabase
        .from("perfiles")
        .select("email, nombre_completo, estado")
        .eq("estado", "ACTIVO");
        
      const p = perfilesData || [];
      const map: Record<string, string> = {};
      p.forEach(user => { map[user.email] = user.nombre_completo || user.email; });
      setDirectory(p.filter(u => u.email !== userEmail)); // no listarme a mi mismo
      setDirectoryMap(map);

      // 2. Cargar mis salas
      await loadMyChats(map);
    };

    init();
  }, []);

  const loadMyChats = async (map: Record<string, string>) => {
    // a. Obtener IDs de las salas donde estoy
    const { data: myParts } = await supabase
      .from("chat_participants")
      .select("room_id")
      .eq("user_email", userEmail);
      
    if (!myParts || myParts.length === 0) return setChats([]);
    
    const roomIds = myParts.map(p => p.room_id);
    
    // b. Obtener info de esas salas
    const { data: rooms } = await supabase
      .from("chat_rooms")
      .select("*")
      .in("id", roomIds)
      .order("created_at", { ascending: false });
      
    // c. Obtener todos los participantes de esas salas para armar los nombres correctos
    const { data: allParts } = await supabase
      .from("chat_participants")
      .select("room_id, user_email")
      .in("room_id", roomIds);

    // d. Obtener el ultimo mensaje para ordenar
    const { data: latestMsgs } = await supabase
      .from("chat_messages")
      .select("room_id, created_at")
      .in("room_id", roomIds)
      .order("created_at", { ascending: false });
      
    const latestMsgMap: Record<string, string> = {};
    if (latestMsgs) {
      for (const m of latestMsgs) {
        if (!latestMsgMap[m.room_id]) {
          latestMsgMap[m.room_id] = m.created_at;
        }
      }
    }
      
    if (!rooms || !allParts) return;

    let formattedRooms: ChatRoom[] = rooms.map(r => {
      const parts = allParts.filter(p => p.room_id === r.id).map(p => p.user_email);
      let displayName = r.name || "Chat";
      
      if (!r.is_group) {
        // Chat 1-a-1: el nombre es el de la otra persona
        const otherUserEmail = parts.find(e => e !== userEmail) || userEmail;
        displayName = map[otherUserEmail] || otherUserEmail.split("@")[0];
      }
      
      return {
        id: r.id,
        name: r.name,
        is_group: r.is_group,
        participants: parts,
        display_name: displayName,
        last_activity: latestMsgMap[r.id] || r.created_at
      } as ChatRoom & { last_activity: string };
    });
    
    formattedRooms.sort((a, b) => new Date((b as any).last_activity).getTime() - new Date((a as any).last_activity).getTime());
    
    setChats(formattedRooms);
  };

  // Cargar Mensajes de una sala activa
  useEffect(() => {
    if (!activeChatId) return;
    
    const loadMessages = async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("room_id", activeChatId)
        .order("created_at", { ascending: true });
        
      if (data) setMessages(data as ChatMessage[]);
    };
    
    loadMessages();
    
    // Suscribirse a nuevos mensajes de ESTA sala
    const channel = supabase.channel(`room:${activeChatId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'chat_messages',
        filter: `room_id=eq.${activeChatId}`
      }, (payload) => {
        const newMsg = payload.new as ChatMessage;
        setMessages(prev => {
          // Prevenir duplicados debido a la inserción optimista
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChatId]);

  const handleCreateChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUsers.length === 0) return;
    setCreatingGroup(true);
    
    const isGroup = selectedUsers.length > 1;
    const finalName = isGroup && groupName.trim() !== "" ? groupName.trim() : null;
    
    try {
      // Usamos UUID del lado del cliente para no requerir un .select() 
      // y evitar el bloqueo de las políticas RLS (porque aun no somos participantes).
      const newRoomId = crypto.randomUUID();
      
      // 1. Crear la sala
      const { error: roomError } = await supabase
        .from("chat_rooms")
        .insert({ id: newRoomId, is_group: isGroup, name: finalName });
        
      if (roomError) throw roomError;
      
      // 2. Añadir participantes (incluyéndome)
      const participantsToInsert = [
        { room_id: newRoomId, user_email: userEmail },
        ...selectedUsers.map(email => ({ room_id: newRoomId, user_email: email }))
      ];
      
      const { error: partsError } = await supabase.from("chat_participants").insert(participantsToInsert);
      if (partsError) throw partsError;
      
      // 3. Recargar lista y seleccionar el nuevo chat
      await loadMyChats(directoryMap);
      setActiveChatId(newRoomId);
      setIsModalOpen(false);
      setSelectedUsers([]);
      setGroupName("");
      
    } catch (err: any) {
      console.error(err);
      alert(`Uh oh! Hubo un error creando el chat: ${err?.message || err}`);
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !activeChatId) return;
    
    const msg = messageInput.trim();
    setMessageInput("");
    setSendingMsg(true);
    
    // Inserción optimista para UI más ágil
    const tempId = crypto.randomUUID();
    const tempMsg: ChatMessage = {
      id: tempId,
      room_id: activeChatId,
      sender_email: userEmail,
      sender_name: userName,
      content: msg,
      created_at: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, tempMsg]);
    
    const { error } = await supabase
      .from("chat_messages")
      .insert({
        id: tempId,
        room_id: activeChatId,
        sender_email: userEmail,
        sender_name: userName,
        content: msg
      });
      
    if (error) {
      console.error("Mensaje no enviado", error);
      // Revertir optimista en caso de fallo (simple alert)
      alert("Error al enviar el mensaje. Revisa tu conexión.");
    }
    setSendingMsg(false);
  };

  const handleStartDirectChat = async (targetEmail: string) => {
    // 1. Buscar si ya existe un chat 1-a-1
    const existingChat = chats.find(c => !c.is_group && c.participants.includes(targetEmail));
    
    if (existingChat) {
      setActiveChatId(existingChat.id);
      setLeftTab("chats");
      return;
    }
    
    // 2. Si no existe, crearlo silenciosamente
    try {
      const newRoomId = crypto.randomUUID();
      
      const { error: roomError } = await supabase
        .from("chat_rooms")
        .insert({ id: newRoomId, is_group: false, name: null });
        
      if (roomError) throw roomError;
      
      const { error: partsError } = await supabase.from("chat_participants").insert([
        { room_id: newRoomId, user_email: userEmail },
        { room_id: newRoomId, user_email: targetEmail }
      ]);
      
      if (partsError) throw partsError;
      
      await loadMyChats(directoryMap);
      setActiveChatId(newRoomId);
      setLeftTab("chats");
    } catch (err: any) {
      console.error(err);
      alert(`Error iniciando chat: ${err?.message || JSON.stringify(err)}`);
    }
  };

  const activeSpace = chats.find(c => c.id === activeChatId);

  const [leftTab, setLeftTab] = useState<"chats" | "contacts">("chats");

  return (
    <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-white">
      
      {/* SIDEBAR DE CONTACTOS */}
      <div className="w-80 border-r border-slate-200 bg-slate-50 flex flex-col shrink-0 relative">
        <div className="p-4 border-b border-slate-200 bg-white">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-xl font-bold tracking-tight text-slate-800">Directorio</h1>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="p-2 bg-blue-100 text-blue-700 hover:bg-blue-600 hover:text-white rounded-full transition-colors"
              title="Crear Grupo"
            >
              <Users2 className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex bg-slate-100 p-1 rounded-lg mb-3">
            <button 
              onClick={() => setLeftTab("chats")}
              className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition-colors ${leftTab === "chats" ? "bg-white text-blue-700 shadow-sm border border-slate-200/60" : "text-slate-500 hover:text-slate-700"}`}
            >
              Chats Activos
            </button>
            <button 
              onClick={() => setLeftTab("contacts")}
              className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition-colors ${leftTab === "contacts" ? "bg-white text-blue-700 shadow-sm border border-slate-200/60" : "text-slate-500 hover:text-slate-700"}`}
            >
              Contactos ({directory.length})
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar..." 
              className="w-full bg-slate-100 border-none rounded-xl pl-9 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {leftTab === "chats" ? (
            chats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 text-slate-400">
                <MessageSquare className="w-12 h-12 mb-3 text-slate-300" />
                <p className="text-sm font-medium">Aún no tienes chats</p>
                <p className="text-xs mt-1">Ve a 'Contactos' para iniciar uno.</p>
              </div>
            ) : (
              <div className="flex flex-col p-2 space-y-1">
                {chats.map(chat => (
                  <button
                    key={chat.id}
                    onClick={() => setActiveChatId(chat.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all text-left ${activeChatId === chat.id ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-200/50 text-slate-700'}`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${activeChatId === chat.id ? 'bg-white/20 text-white' : chat.is_group ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {chat.is_group ? <Users2 className="w-5 h-5" /> : chat.display_name?.charAt(0)}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <h3 className="font-semibold text-sm truncate">{chat.display_name}</h3>
                      <p className={`text-xs truncate mt-0.5 ${activeChatId === chat.id ? 'text-blue-100' : 'text-slate-500'}`}>
                        {chat.is_group ? `${chat.participants.length} miembros` : 'Chat directo'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : (
            directory.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">No hay otros contactos registrados.</div>
            ) : (
              <div className="flex flex-col p-2 space-y-1">
                {directory.map(user => {
                  return (
                    <button
                      key={user.email}
                      onClick={() => handleStartDirectChat(user.email)}
                      className="flex items-center gap-3 p-3 rounded-xl transition-all text-left hover:bg-slate-200/50 text-slate-700"
                    >
                       <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 bg-slate-200 text-slate-600">
                         {user.nombre_completo?.charAt(0) || "U"}
                       </div>
                       <div className="flex-1 overflow-hidden">
                         <h3 className="font-semibold text-sm truncate">{user.nombre_completo}</h3>
                         <p className="text-xs truncate mt-0.5 text-slate-500">{user.email}</p>
                       </div>
                       <MessageSquare className="w-4 h-4 text-slate-400" />
                    </button>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>
      
      {/* ÁREA DE CHAT ACTIVO */}
      <div className="flex-1 flex flex-col bg-slate-50/50 relative">
        {activeChatId && activeSpace ? (
          <>
            {/* Cabecera del Chat */}
            <div className="h-16 border-b border-slate-200 bg-white flex items-center px-6 shrink-0 shadow-sm z-10">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold mr-3 shadow-sm ${activeSpace.is_group ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {activeSpace.is_group ? <Users2 className="w-5 h-5" /> : activeSpace.display_name?.charAt(0)}
              </div>
              <div>
                <h2 className="font-bold text-slate-800">{activeSpace.display_name}</h2>
                <p className="text-xs text-slate-500 font-medium">
                  {activeSpace.is_group ? `${activeSpace.participants.length} participantes reunidos` : 'Conversación Directa'}
                </p>
              </div>
            </div>
            
            {/* Lista de Mensajes */}
            <div className="flex-1 overflow-y-auto w-full max-w-4xl mx-auto flex flex-col p-6 space-y-4">
              {messages.length === 0 ? (
                <div className="m-auto text-center p-8 border border-dashed border-slate-300 rounded-2xl bg-white/50 max-w-sm">
                  <p className="text-slate-500 font-medium text-sm">Este es el inicio del chat.</p>
                  <p className="text-slate-400 text-xs mt-1">Escribe el primer mensaje abajo para saludar a los demás.</p>
                </div>
              ) : (
                messages.map((msg, i) => {
                  const isMine = msg.sender_email === userEmail;
                  const showName = !isMine && (!messages[i-1] || messages[i-1].sender_email !== msg.sender_email);
                  
                  return (
                    <div key={msg.id} className={`flex flex-col max-w-[80%] ${isMine ? 'self-end items-end' : 'self-start items-start'}`}>
                      {showName && activeSpace.is_group && (
                        <span className="text-xs font-bold text-slate-500 mb-1 ml-1">{msg.sender_name}</span>
                      )}
                      
                      <div className={`px-4 py-2.5 rounded-2xl ${isMine ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm'}`}>
                        <p className="text-sm break-words whitespace-pre-wrap">{msg.content}</p>
                      </div>
                      
                      <span className="text-[10px] text-slate-400 mt-1 mx-1 text-right block">
                        {new Date(msg.created_at).toLocaleDateString([], {day: '2-digit', month: 'short'})} a las {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
            
            {/* Input Box */}
            <div className="p-4 bg-white border-t border-slate-200">
              <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex gap-2">
                <input 
                  type="text" 
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Escribe un mensaje aquí..."
                  className="flex-1 bg-slate-100 border-none rounded-full px-6 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                />
                <button 
                  type="submit"
                  disabled={!messageInput.trim() || sendingMsg}
                  className="bg-blue-600 text-white w-12 h-12 rounded-full flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0 shadow-md"
                >
                  <Send className="w-5 h-5 ml-1" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <MessageSquare className="w-10 h-10 text-blue-200" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Comunícate con tu red</h2>
            <p className="text-slate-500 max-w-sm mx-auto">
              Envía mensajes directos a las sucursales o crea grupos dinámicos con diferentes integrantes del equipo.
            </p>
          </div>
        )}
      </div>

      {/* MODAL NUEVO CHAT */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-800">Nuevo Mensaje</h2>
              <button onClick={() => { setIsModalOpen(false); setSelectedUsers([]); setGroupName(""); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateChat} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 flex-1 overflow-y-auto space-y-4">
                
                {selectedUsers.length > 1 && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nombre del Grupo (Opcional)</label>
                    <input 
                      type="text" 
                      value={groupName}
                      onChange={e => setGroupName(e.target.value)}
                      placeholder="Identifica este chat..."
                      className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                )}
                
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1.5 flex justify-between">
                    <span>Directorio Escalonado ({directory.length})</span>
                    {selectedUsers.length > 0 && <span className="text-blue-600">{selectedUsers.length} seleccionados</span>}
                  </label>
                  <div className="space-y-2">
                    {directory.map(user => {
                      const isSelected = selectedUsers.includes(user.email);
                      return (
                        <div 
                          key={user.email} 
                          onClick={() => {
                            if (isSelected) {
                              setSelectedUsers(prev => prev.filter(e => e !== user.email));
                            } else {
                              setSelectedUsers(prev => [...prev, user.email]);
                            }
                          }}
                          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            isSelected ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-transparent border-transparent hover:bg-slate-50'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border ${
                            isSelected ? 'bg-blue-600 text-white border-blue-700' : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {user.nombre_completo?.charAt(0) || "U"}
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <h4 className={`font-semibold text-sm truncate ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
                              {user.nombre_completo || "Asesor sin nombre"}
                            </h4>
                            <p className="text-xs text-slate-500 truncate">{user.email}</p>
                          </div>
                          {isSelected && (
                            <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                              <span className="text-xs">✓</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              
              <div className="p-4 border-t border-slate-100 bg-white">
                <button 
                  type="submit"
                  disabled={selectedUsers.length === 0 || creatingGroup}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  {creatingGroup ? <Loader2 className="w-5 h-5 animate-spin" /> : <MessageSquare className="w-5 h-5" />}
                  {selectedUsers.length > 1 ? 'Crear Grupo de Chat' : 'Iniciar Conversación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
    </div>
  );
}
