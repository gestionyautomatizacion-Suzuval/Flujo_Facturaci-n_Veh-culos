import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// API Route para guardar la firma digital completa.
// Usa service_role para bypasear RLS de Supabase en todas las operaciones
// (Storage uploads + DB update), lo que garantiza que funcione en
// smartphones sin sesión activa (link público enviado al cliente).
export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const rut = formData.get("rut") as string;
    const vendedor = formData.get("vendedor") as string;
    const autorizacion = formData.get("autorizacion") === "true";
    const frontalFile = formData.get("frontal") as File;
    const traseroFile = formData.get("trasero") as File;
    const firmaBlob = formData.get("firma") as Blob;

    if (!rut || !vendedor || !frontalFile || !traseroFile || !firmaBlob) {
      return NextResponse.json({ error: "Faltan datos requeridos" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const rutSlug = rut.replace(/[^0-9kK]/g, "");
    const ts = Date.now();

    // 1. Subir Foto Frontal
    const fExt = frontalFile.type === "image/png" ? "png" : "jpg";
    const frontalPath = `capturas/${ts}_front_${rutSlug}.${fExt}`;
    const frontalBuffer = Buffer.from(await frontalFile.arrayBuffer());
    const { error: fError } = await supabase.storage
      .from("firmas")
      .upload(frontalPath, frontalBuffer, { contentType: frontalFile.type || "image/jpeg", upsert: true });
    if (fError) throw new Error(`Error Frontal: ${fError.message}`);

    // 2. Subir Foto Trasera
    const tExt = traseroFile.type === "image/png" ? "png" : "jpg";
    const traseroPath = `capturas/${ts}_back_${rutSlug}.${tExt}`;
    const traseroBuffer = Buffer.from(await traseroFile.arrayBuffer());
    const { error: tError } = await supabase.storage
      .from("firmas")
      .upload(traseroPath, traseroBuffer, { contentType: traseroFile.type || "image/jpeg", upsert: true });
    if (tError) throw new Error(`Error Trasero: ${tError.message}`);

    // 3. Subir Firma Digital
    const firmaPath = `capturas/${ts}_firma_${rutSlug}.png`;
    const firmaBuffer = Buffer.from(await firmaBlob.arrayBuffer());
    const { error: sigError } = await supabase.storage
      .from("firmas")
      .upload(firmaPath, firmaBuffer, { contentType: "image/png", upsert: true });
    if (sigError) throw new Error(`Error Firma: ${sigError.message}`);

    // 4. Obtener URLs públicas
    const { data: frontUrlData } = supabase.storage.from("firmas").getPublicUrl(frontalPath);
    const { data: backUrlData } = supabase.storage.from("firmas").getPublicUrl(traseroPath);
    const { data: firmaUrlData } = supabase.storage.from("firmas").getPublicUrl(firmaPath);

    // 5. Actualizar cliente en BD (service_role bypasea RLS)
    const { error: dbError } = await supabase
      .from("clientes")
      .update({
        ci_frontal: frontUrlData.publicUrl,
        ci_trasero: backUrlData.publicUrl,
        firma: firmaUrlData.publicUrl,
        autorizacion,
        link_firma_vendedor: vendedor,
      })
      .eq("rut", rut);

    if (dbError) throw new Error(`Error BD: ${dbError.message}`);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno al procesar";
    console.error("[guardar-firma]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
