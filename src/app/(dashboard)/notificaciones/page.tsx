import { createClient } from "@/utils/supabase/server";
import { Bell } from "lucide-react";
import Link from "next/link";

export default async function NotificacionesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let notifications: any[] = [];

  if (user?.email) {
    const { data } = await supabase
      .from('negocios_comentarios')
      .select(`
        id, 
        pedido_venta, 
        usuario_nombre, 
        comentario,
        created_at
      `)
      .neq('usuario_email', user.email)
      .order('created_at', { ascending: false })
      .limit(300);

    if (data) {
      notifications = data
        .filter((d: any) => !d.comentario.startsWith('[AUDITORIA]'))
        .map((d: any) => ({
          id: d.id,
          pedido_venta: d.pedido_venta,
          usuario_nombre: d.usuario_nombre,
          comentario: d.comentario,
          created_at: d.created_at
        }))
        .slice(0, 100);
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6 lg:p-8">
      <div className="mb-8 flex items-center gap-3">
        <div className="p-3 bg-blue-100 rounded-xl text-blue-600">
          <Bell className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold leading-7 text-slate-900 sm:text-3xl sm:tracking-tight">
            Centro de Notificaciones
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Historial completo de las notificaciones y comentarios recientes.
          </p>
        </div>
      </div>

      <div className="bg-white shadow-sm border border-slate-200 rounded-2xl overflow-hidden">
        {notifications.length === 0 ? (
          <div className="p-10 text-center text-slate-500">
            No hay notificaciones disponibles.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {notifications.map((n) => (
              <li key={n.id} className="hover:bg-slate-50 transition-colors">
                <Link href={`/negocios/${n.pedido_venta}`} className="block p-4 sm:p-6">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-slate-800">{n.usuario_nombre}</span>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[10px] sm:text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded shadow-sm">
                        PV: {n.pedido_venta}
                      </span>
                      <span className="text-xs text-slate-500">
                        {n.created_at ? new Intl.DateTimeFormat('es-CL', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }).format(new Date(n.created_at)) : ''}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed break-words">
                    {n.comentario.startsWith('[ARCHIVO]|') ? '📎 Archivo adjunto' : n.comentario}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
