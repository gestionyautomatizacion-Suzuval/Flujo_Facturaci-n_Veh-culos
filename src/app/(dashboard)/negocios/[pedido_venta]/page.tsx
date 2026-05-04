import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import CarpetaClient from "./CarpetaClient";

export default async function NegocioPage({ params }: { params: Promise<{ pedido_venta: string }> }) {
  const supabase = await createClient();
  const { pedido_venta } = await params;
  
  const { data: { user } } = await supabase.auth.getUser();
  console.log("User:", user?.id);
  console.log("pedido_venta type:", typeof pedido_venta, "value:", pedido_venta, "equals 333333333:", pedido_venta === '333333333');
  
  const { data: negocio, error } = await supabase
    .from('negocios')
    .select('*')
    .eq('pedido_venta', pedido_venta)
    .single();

  if (error) {
    console.log("Error fetching negocio:", error);
  }

  if (!negocio) {
    return (
      <div className="p-10">
        <h1 className="text-2xl font-bold text-red-600">Negocio No Encontrado (Debug)</h1>
        <p>Pedido de Venta buscado: <strong>"{pedido_venta}"</strong></p>
        <p>Error devuelto por Supabase: {JSON.stringify(error)}</p>
        <pre className="mt-4 p-4 bg-slate-100 rounded text-sm">
          {JSON.stringify({ pedido_venta, type: typeof pedido_venta }, null, 2)}
        </pre>
      </div>
    );
  }

  return <CarpetaClient negocio={negocio} />;
}
