/* eslint-disable @typescript-eslint/no-unused-vars, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps, @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { Plus, Users, ShieldCheck, Save, X, Loader2, AlertCircle, Edit, ShieldAlert, CheckCircle2, Trash2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

interface Perfil {
  id: string;
  nombre_completo: string;
  email: string;
  rol: string;
  created_at: string;
  sucursales?: string[];
  isSuspended?: boolean;
}

interface Sucursal {
  id: string;
  nombre: string;
}

export default function UsuariosSettingsPage() {
  const [usuarios, setUsuarios] = useState<Perfil[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Perfil | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const [err, setErr] = useState("");
  const [succ, setSucc] = useState("");
  const [currentUserRole, setCurrentUserRole] = useState("");

  const supabase = createClient();

  const fetchSucursales = async () => {
    try {
      const { data, error } = await supabase
        .from("sucursales")
        .select("id, nombre")
        .eq("activa", true)
        .order("id");
      
      if (data && data.length > 0) {
        setSucursales(data);
      } else {
        throw new Error("Sin datos");
      }
    } catch (e) {
      // Fallback a las sucursales por defecto si la tabla no existe o está vacía
      setSucursales([
        { id: "C026", nombre: "CF. LA CALERA" },
        { id: "C027", nombre: "CF. VIÑA DEL MAR" },
        { id: "C028", nombre: "CF. VALPARAISO" },
        { id: "C031", nombre: "CF. SAN ANTONIO" },
        { id: "C041", nombre: "CF. CONCON" },
        { id: "C157", nombre: "CF. ESPACIO URBANO" },
        { id: "C168", nombre: "CF. MELIPILLA" },
      ]);
    }
  };

  const fetchUsuarios = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    if (Array.isArray(data)) setUsuarios(data);

    const { data: authData } = await supabase.auth.getUser();
    if (authData?.user) {
      const { data: perfil } = await supabase
        .from("perfiles")
        .select("rol")
        .eq("id", authData.user.id)
        .single();
      if (perfil) setCurrentUserRole(perfil.rol);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsuarios();
    fetchSucursales();
  }, []);

  const handleDeleteUser = async (user: Perfil) => {
    if (!confirm(`¿Estás seguro de ELIMINAR permanentemente a ${user.nombre_completo}? Esta acción no se puede deshacer.`)) return;
    setErr(""); setSucc("");
    try {
      const res = await fetch(`/api/admin/users?userId=${user.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al eliminar el usuario");
      setSucc("El usuario ha sido eliminado permanentemente.");
      fetchUsuarios();
    } catch (error: any) { setErr(error.message); }
  };

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsCreating(true); setErr(""); setSucc("");
    const formData = new FormData(e.currentTarget);
    const bodyArgs = {
      email: formData.get("email"),
      password: formData.get("password"),
      nombre_completo: formData.get("nombre"),
      rol: formData.get("rol"),
      sucursales: formData.getAll("sucursales"),
    };
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyArgs),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error creando el usuario");
      setSucc(`Usuario creado exitosamente con rol ${bodyArgs.rol}.`);
      setModalOpen(false);
      fetchUsuarios();
    } catch (error: any) { setErr(error.message); }
    finally { setIsCreating(false); }
  };

  const handleUpdateRole = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedUser) return;
    setIsUpdating(true); setErr(""); setSucc("");
    const formData = new FormData(e.currentTarget);
    const newRol = formData.get("rol") as string;
    const newSucursales = formData.getAll("sucursales");
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUser.id, rol: newRol, sucursales: newSucursales }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error actualizando rol");
      setSucc(`Rol actualizado para ${selectedUser.nombre_completo}.`);
      setEditModalOpen(false);
      fetchUsuarios();
    } catch (error: any) { setErr(error.message); }
    finally { setIsUpdating(false); }
  };

  const toggleSuspension = async (user: Perfil) => {
    const action = user.isSuspended ? "activate" : "suspend";
    const warnMsg = action === "suspend"
      ? `¿Suspender a ${user.nombre_completo}? Ya no podrá iniciar sesión.`
      : `¿Reactivar a ${user.nombre_completo}?`;
    if (!confirm(warnMsg)) return;
    setErr(""); setSucc("");
    setUsuarios(prev => prev.map(u => u.id === user.id ? { ...u, isSuspended: !u.isSuspended } : u));
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, rol: user.rol, action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error cambiando suspensión");
      setSucc(`Usuario ${action === "suspend" ? "suspendido" : "reactivado"} correctamente.`);
    } catch (error: any) {
      setUsuarios(prev => prev.map(u => u.id === user.id ? { ...u, isSuspended: user.isSuspended } : u));
      setErr(error.message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-6 space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3 text-slate-800">
            <Users className="w-6 h-6 text-blue-600" />
            Gestión de Personal
          </h1>
          <p className="text-sm text-slate-500 mt-1">Administra las cuentas y niveles de acceso del equipo.</p>
        </div>
        <button
          onClick={() => { setModalOpen(true); setErr(""); setSucc(""); }}
          className="bg-blue-800 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          Nuevo Usuario
        </button>
      </div>

      {succ && <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl border border-emerald-200 text-sm font-medium">{succ}</div>}
      {err && !modalOpen && !editModalOpen && <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 text-sm font-medium">{err}</div>}

      {/* Tabla de Usuarios */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold text-slate-500">Nombre</th>
                <th className="px-6 py-4 font-semibold text-slate-500">Email</th>
                <th className="px-6 py-4 font-semibold text-slate-500">Rol</th>
                <th className="px-6 py-4 font-semibold text-slate-500">Sucursales</th>
                <th className="px-6 py-4 font-semibold text-slate-500 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                  Cargando equipo...
                </td></tr>
              ) : usuarios.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400 italic">Sin usuarios registrados.</td></tr>
              ) : (
                usuarios.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-800 flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${u.isSuspended ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                        {u.nombre_completo?.charAt(0) || "U"}
                      </div>
                      <span className={u.isSuspended ? "line-through text-slate-400" : ""}>{u.nombre_completo || "Sin Nombre"}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 truncate">{u.email}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider
                        ${u.rol === "ADMIN" ? "bg-red-50 text-red-700 ring-1 ring-red-600/20" : ""}
                        ${u.rol === "GERENCIA" ? "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20" : ""}
                        ${u.rol === "JEFE" ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/20" : ""}
                        ${u.rol === "VENDEDOR" || u.rol === "ADMINISTRATIVO" ? "bg-slate-100 text-slate-600 ring-1 ring-slate-400/20" : ""}
                      `}>
                        {(u.rol === "ADMIN" || u.rol === "GERENCIA") && <ShieldCheck className="w-3 h-3" />}
                        {u.rol}
                      </span>
                    </td>
                    <td className="px-6 py-4 max-w-[180px]">
                      <div className="flex flex-wrap gap-1">
                        {u.sucursales && u.sucursales.length > 0
                          ? u.sucursales.map(s => (
                            <span key={s} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">{s}</span>
                          ))
                          : <span className="text-xs text-slate-400">Todas / NA</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right space-x-1">
                      <button onClick={() => { setSelectedUser(u); setEditModalOpen(true); setErr(""); setSucc(""); }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Editar Rol">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => toggleSuspension(u)} className={`p-2 rounded-lg transition ${u.isSuspended ? "text-emerald-500 hover:bg-emerald-50" : "text-slate-400 hover:text-red-600 hover:bg-red-50"}`} title={u.isSuspended ? "Reactivar" : "Suspender"}>
                        {u.isSuspended ? <CheckCircle2 className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                      </button>
                      {currentUserRole === "ADMIN" && (
                        <button onClick={() => handleDeleteUser(u)} className="p-2 rounded-lg transition text-slate-400 hover:text-red-600 hover:bg-red-50" title="Eliminar">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Editar Rol */}
      {editModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-800">Modificar Rol</h3>
              <button onClick={() => setEditModalOpen(false)} className="text-slate-400 hover:text-slate-700 transition"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleUpdateRole} className="p-6 space-y-4">
              {err && <div className="bg-red-50 text-red-600 p-3 rounded-lg flex gap-2 text-sm"><AlertCircle className="w-5 h-5 shrink-0" /><p>{err}</p></div>}
              <div className="mb-2">
                <p className="text-sm font-semibold">{selectedUser.nombre_completo}</p>
                <p className="text-xs text-slate-500">{selectedUser.email}</p>
              </div>
              <div className="space-y-1 pb-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nivel de Acceso (Rol)</label>
                <select required name="rol" defaultValue={selectedUser.rol} className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-blue-600 focus:outline-none bg-white">
                  <option value="VENDEDOR">Vendedor</option>
                  <option value="JEFE">Jefe</option>
                  <option value="ADMINISTRATIVO">Administrativo</option>
                  <option value="GERENCIA">Gerencia</option>
                  <option value="ADMIN">Administrador (Admin)</option>
                </select>
              </div>
              <div className="space-y-1 pb-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Sucursales</label>
                <p className="text-[10px] text-slate-400 mb-2">Solo Vendedor/Jefe. Admin accede a todas.</p>
                <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-3 bg-slate-50/50">
                  {sucursales.map(suc => (
                    <label key={`edit-${suc.id}`} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input type="checkbox" name="sucursales" value={suc.id} defaultChecked={selectedUser.sucursales?.includes(suc.id)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-600" />
                      <span className="truncate">{suc.id} — {suc.nombre}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button disabled={isUpdating} type="submit" className="w-full bg-blue-800 text-white rounded-xl py-3 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-blue-700 transition">
                {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Actualizar Rol
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Nuevo Usuario */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-800">Crear Nueva Cuenta</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-700 transition"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              {err && <div className="bg-red-50 text-red-600 p-3 rounded-lg flex gap-2 text-sm"><AlertCircle className="w-5 h-5 shrink-0" /><p>{err}</p></div>}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nombre Completo</label>
                <input required name="nombre" type="text" className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-blue-600 focus:outline-none" placeholder="Ej: Juan Pérez" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Correo Electrónico</label>
                <input required name="email" type="email" className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-blue-600 focus:outline-none" placeholder="correo@empresa.com" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nivel de Acceso (Rol)</label>
                <select required name="rol" className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-blue-600 focus:outline-none bg-white">
                  <option value="VENDEDOR">Vendedor</option>
                  <option value="JEFE">Jefe</option>
                  <option value="ADMINISTRATIVO">Administrativo</option>
                  <option value="GERENCIA">Gerencia</option>
                  <option value="ADMIN">Administrador (Admin)</option>
                </select>
              </div>
              <div className="space-y-1 pt-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Sucursales</label>
                <p className="text-[10px] text-slate-400 mb-2">Selecciona las sucursales donde operará (Vendedor/Jefe).</p>
                <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-3 bg-slate-50/50">
                  {sucursales.map(suc => (
                    <label key={`new-${suc.id}`} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input type="checkbox" name="sucursales" value={suc.id} className="rounded border-slate-300 text-blue-600 focus:ring-blue-600" />
                      <span className="truncate">{suc.id} — {suc.nombre}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-1 pb-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mt-2">Clave Genérica</label>
                <input required name="password" type="text" className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-blue-600 focus:outline-none" placeholder="Asigna una contraseña inicial..." />
              </div>
              <button disabled={isCreating} type="submit" className="w-full bg-blue-800 text-white rounded-xl py-3 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-blue-700 transition">
                {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Ingresar al Sistema
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
