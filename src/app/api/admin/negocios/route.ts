import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const pedido_venta = searchParams.get("pedido_venta");

    if (!pedido_venta) {
      return NextResponse.json({ error: "Falta parámetro pedido_venta" }, { status: 400 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!serviceKey || !projectUrl) {
      return NextResponse.json({ error: "Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor" }, { status: 500 });
    }

    // Usar cliente maestro Bypass para saltar RLS y eliminar.
    const supabaseAdmin = createClient(projectUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { error: dbError } = await supabaseAdmin
      .from('negocios')
      .delete()
      .eq('pedido_venta', pedido_venta);

    if (dbError) {
      throw new Error(dbError.message);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
