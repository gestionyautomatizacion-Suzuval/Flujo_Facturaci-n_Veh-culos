import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// Columnas de la tabla negocios que se exponen al cliente
const COLUMNS = [
  "interno",
  "pedido_venta",
  "nombre_apellido",
  "rut",
  "marca",
  "modelo",
  "color",
  "suc_vta",
  "vendedor_nombre",
  "tipo_compra",
  "estado",
  "created_at",
].join(", ");

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // 1. Verificar sesión
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // 2. Obtener perfil del usuario (rol + sucursales + email)
  const { data: perfil, error: perfilError } = await supabase
    .from("perfiles")
    .select("rol, sucursales, email, nombre_completo")
    .eq("id", user.id)
    .single();

  if (perfilError || !perfil) {
    return NextResponse.json(
      { error: "No se pudo obtener el perfil del usuario" },
      { status: 500 }
    );
  }

  // 3. Leer query params
  const { searchParams } = new URL(request.url);
  const estado = searchParams.get("estado");

  // 4. Construir query base
  let query = supabase.from("negocios").select(COLUMNS);

  // 5. Filtrar por estado si se provee
  if (estado) {
    query = query.eq("estado", estado);
  }

  // 6. Aplicar filtros de visibilidad según el rol (RBAC)
  const rol = perfil.rol as string;

  if (rol === "VENDEDOR") {
    // El vendedor solo ve los pedidos donde el campo vendedor_nombre = su email
    const emailVendedor = perfil.email ?? user.email;
    query = query.eq("vendedor_nombre", emailVendedor);
  } else if (rol === "JEFE") {
    // El jefe de sucursal ve los pedidos de sus sucursales asignadas
    const sucursales: string[] = perfil.sucursales ?? [];
    if (sucursales.length > 0) {
      query = query.in("suc_vta", sucursales);
    }
  } else if (rol === "ADMINISTRATIVO") {
    // El administrativo solo ve pedidos que tengan adjunta la Nota de Venta
    const { data: notaVentaDocs } = await supabase
      .from("negocios_documentos")
      .select("pedido_venta")
      .or("tipo_documento.eq.NOTA_VENTA,nombre_archivo.ilike.%Nota de Venta%,nombre_archivo.ilike.%Nota_de_Venta%");

    const pvsConNotaVenta = Array.from(
      new Set(notaVentaDocs?.map((d) => d.pedido_venta).filter(Boolean) || [])
    );

    if (pvsConNotaVenta.length > 0) {
      query = query.in("pedido_venta", pvsConNotaVenta);
    } else {
      query = query.in("pedido_venta", ["__SIN_RESULTADOS__"]);
    }
  }

  // 7. Ordenar por fecha de creación descendente
  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error("[API /pedidos] Error:", error.message);
    return NextResponse.json(
      { error: "Error al consultar la base de datos" },
      { status: 500 }
    );
  }

  // 8. Enriquecer con nombre_apellido y rut real usando la relación:
  //    clientes_datos_negocios (pedido_venta → cliente_id) → clientes (nombre, rut)
  //    El campo rut/nombre_apellido en negocios es solo un placeholder ("S/N")
  interface NegocioRaw {
    pedido_venta?: string;
    nombre_apellido?: string;
    rut?: string;
    [key: string]: unknown;
  }

  let enrichedData = (data || []) as unknown as NegocioRaw[];
  if (enrichedData.length > 0) {
    const pedidosVenta = enrichedData.map((n) => n.pedido_venta).filter(Boolean) as string[];

    if (pedidosVenta.length > 0) {
      // Traer el vínculo pedido_venta → datos reales del cliente
      const { data: vinculos } = await supabase
        .from("clientes_datos_negocios")
        .select("pedido_venta, clientes(nombre, segundo_nombre, apellido, segundo_apellido, rut)")
        .in("pedido_venta", pedidosVenta);

      if (vinculos && vinculos.length > 0) {
        // Construir mapa: pedido_venta → { nombre_apellido, rut }
        const clienteMap: Record<string, { nombre_apellido: string; rut: string }> = {};
        for (const v of vinculos as unknown as Array<{ pedido_venta: string; clientes: unknown }>) {
          const c = (Array.isArray(v.clientes) ? v.clientes[0] : v.clientes) as Record<string, string | null> | undefined;
          if (c) {
            const fullName = [c.nombre, c.segundo_nombre, c.apellido, c.segundo_apellido]
              .filter(Boolean)
              .join(" ")
              .trim();
            clienteMap[v.pedido_venta] = {
              nombre_apellido: fullName || "",
              rut: c.rut || "",
            };
          }
        }

        enrichedData = enrichedData.map((n) => {
          const clienteReal = n.pedido_venta ? clienteMap[n.pedido_venta] : undefined;
          return {
            ...n,
            nombre_apellido: clienteReal?.nombre_apellido || n.nombre_apellido || "",
            rut: clienteReal?.rut || n.rut || "",
          };
        });
      } else {
        // Sin vínculo todavía: mantener lo que viene de negocios
        enrichedData = enrichedData.map((n) => ({
          ...n,
          nombre_apellido: n.nombre_apellido || "",
        }));
      }
    }
  }

  return NextResponse.json({ data: enrichedData, rol });
}
