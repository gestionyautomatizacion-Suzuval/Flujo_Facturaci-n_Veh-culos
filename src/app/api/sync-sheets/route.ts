import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { google } from "googleapis";
import { startOfMonth } from "date-fns";

const SHEET_ID = "168gedcEFoh6qxPwsZoRpR8cIF-B2OxLUJqdv92idIqI";

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
];

// Helper to format date
function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication
    const authHeader = request.headers.get("authorization");
    const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
    
    if (!isCron) {
      const supabase = await createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
      }

      const { data: perfil } = await supabase
        .from("perfiles")
        .select("rol")
        .eq("id", user.id)
        .single();
      
      if (!perfil || (perfil.rol !== "ADMIN" && perfil.rol !== "ADMINISTRATIVO")) {
        return NextResponse.json({ error: "Permisos insuficientes" }, { status: 403 });
      }
    }

    // 2. Init Google Sheets API
    if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      return NextResponse.json(
        { error: "Credenciales de Google Sheets no configuradas en el entorno." },
        { status: 500 }
      );
    }

    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_CLIENT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    
    const sheets = google.sheets({ version: "v4", auth });

    // 3. Fetch data from Supabase
    // We use the service role key to bypass RLS and fetch all data
    const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: negocios, error: dbError } = await supabaseAdmin
      .from("negocios")
      .select(COLUMNS.join(", "))
      .order("created_at", { ascending: false });

    if (dbError) {
      console.error("DB Error:", dbError);
      return NextResponse.json({ error: "Error fetching data" }, { status: 500 });
    }

    interface NegocioRaw {
      pedido_venta?: string;
      estado?: string;
      nombre_apellido?: string;
      rut?: string;
      created_at?: string;
      [key: string]: unknown;
    }

    // Enriquecer con datos reales del cliente desde clientes_datos_negocios → clientes
    let enrichedNegocios = (negocios || []) as unknown as NegocioRaw[];
    if (enrichedNegocios.length > 0) {
      const pedidosVenta = enrichedNegocios.map((n) => n.pedido_venta).filter(Boolean) as string[];
      if (pedidosVenta.length > 0) {
        const { data: vinculos } = await supabaseAdmin
          .from("clientes_datos_negocios")
          .select("pedido_venta, clientes(nombre, segundo_nombre, apellido, segundo_apellido, rut)")
          .in("pedido_venta", pedidosVenta);

        if (vinculos && vinculos.length > 0) {
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
          enrichedNegocios = enrichedNegocios.map((n) => {
            const clienteReal = n.pedido_venta ? clienteMap[n.pedido_venta] : undefined;
            return {
              ...n,
              nombre_apellido: clienteReal?.nombre_apellido || n.nombre_apellido || "",
              rut: clienteReal?.rut || n.rut || "",
            };
          });
        }
      }
    }

    // 4. Group data by tabs
    const now = new Date();
    const startOfCurrentMonth = startOfMonth(now).toISOString();

    const groups: Record<string, unknown[][]> = {
      "Pedidos Pendientes de Revisión": [],
      "Pedidos en Revisión": [],
      "Pedidos Ok Revisados": [],
      "Pedidos Facturados en el Mes": [],
      "Pedidos Facturados": [],
    };

    if (enrichedNegocios) {
      for (const row of enrichedNegocios) {
        // Format row to array of values corresponding to COLUMNS
        const rowData = COLUMNS.map(col => {
          if (col === "created_at") return formatDate((row[col] as string) || null);
          return row[col] || "";
        });

        if (row.estado === "PARA_REVISIÓN") {
          groups["Pedidos Pendientes de Revisión"].push(rowData);
        } else if (row.estado === "REVISADO_EN_ESPERA") {
          groups["Pedidos en Revisión"].push(rowData);
        } else if (row.estado === "REVISADO_OK") {
          groups["Pedidos Ok Revisados"].push(rowData);
        } else if (row.estado === "FACTURADO") {
          groups["Pedidos Facturados"].push(rowData);
          if (row.created_at && row.created_at >= startOfCurrentMonth) {
            groups["Pedidos Facturados en el Mes"].push(rowData);
          }
        }
      }
    }

    const headerRow = COLUMNS.map(c => c.toUpperCase().replace("_", " "));

    // 5. Update Google Sheets
    // We will clear each tab and then append the new data
    for (const [tabName, rows] of Object.entries(groups)) {
      try {
        await sheets.spreadsheets.values.clear({
          spreadsheetId: SHEET_ID,
          range: `'${tabName}'!A:Z`,
        });

        const values = [headerRow, ...rows];
        
        await sheets.spreadsheets.values.update({
          spreadsheetId: SHEET_ID,
          range: `'${tabName}'!A1`,
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values,
          },
        });
      } catch (sheetErr) {
        console.error(`Error updating tab ${tabName}:`, sheetErr);
      }
    }

    return NextResponse.json({ success: true, message: "Sincronizado correctamente" });

  } catch (error: unknown) {
    console.error("API Sync Error:", error);
    return NextResponse.json({ error: (error as Error).message || "Error interno" }, { status: 500 });
  }
}
