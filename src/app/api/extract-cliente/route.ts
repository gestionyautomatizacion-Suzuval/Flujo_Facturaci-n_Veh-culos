import { NextResponse } from "next/server";
import pdfParse from "pdf-parse";
import { obtenerRegionPorComuna } from "@/lib/chile";

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "No URL provided" }, { status: 400 });
    }

    // Download PDF
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse PDF using pdf-parse v1.1.1
    const parsed = await pdfParse(buffer);
    const text = parsed.text;

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const data = { 
      nombre_apellido: "", 
      rut: "", 
      direccion_cliente: "", 
      region_cliente: "", 
      comuna_cliente: "", 
      mail_cliente: "", 
      movil_cliente: "" 
    };

    // 1. Nombres y Apellidos & RUT
    const nameIdx = lines.findIndex(l => l.includes("Nombres y Apellidos"));
    if (nameIdx !== -1 && lines[nameIdx + 1]) {
      const raw = lines[nameIdx + 1];
      const parts = raw.split(/\s{2,}/);
      if (parts.length > 1) {
        data.nombre_apellido = parts[0].trim();
        data.rut = parts[parts.length - 1].trim();
      } else {
        const rutMatch = raw.match(/\d{1,2}\.?\d{3}\.?\d{3}-[0-9kK]/i);
        if (rutMatch) {
          data.rut = rutMatch[0];
          data.nombre_apellido = raw.replace(rutMatch[0], '').trim();
        } else {
          data.nombre_apellido = raw;
        }
      }
    }

    // 2. Dirección, Región, Comuna
    const dirIdx = lines.findIndex(l => l.includes("Dirección") && l.includes("Región"));
    if (dirIdx !== -1 && lines[dirIdx + 1]) {
      const raw = lines[dirIdx + 1];
      const parts = raw.split(/\s{2,}/);
      if (parts.length >= 3) {
         data.direccion_cliente = parts[0].replace(/,$/, '').trim();
         data.region_cliente = parts[1].trim();
         data.comuna_cliente = parts[2].trim();
      } else {
         // Fallback manual 
         const commaParts = raw.split(',');
         if (commaParts.length > 1) {
            data.direccion_cliente = commaParts[0].trim();
            const rest = commaParts.slice(1).join(',').trim(); // "V - Valparaiso Llaillay"
            const words = rest.split(' ');
            if (words.length > 1) {
               data.comuna_cliente = words.pop() || "";
               data.region_cliente = words.join(' ');
            }
         } else {
            data.direccion_cliente = raw;
         }
      }
    }

    // 3. Mail, Fono, Movil
    const mailIdx = lines.findIndex(l => l.includes("Mail") && (l.includes("Fono") || l.includes("Móvil") || l.includes("Movil")));
    if (mailIdx !== -1 && lines[mailIdx + 1]) {
       const raw = lines[mailIdx + 1];
       const parts = raw.split(/\s{2,}/);
       if (parts.length >= 2) {
          data.mail_cliente = parts[0].trim();
          data.movil_cliente = parts[parts.length - 1].trim();
       } else {
          const mailMatch = raw.match(/[\w.-]+@[\w.-]+\.\w+/);
          if (mailMatch) data.mail_cliente = mailMatch[0];
          const phoneMatch = raw.match(/\d{8,11}/);
          if (phoneMatch) data.movil_cliente = phoneMatch[0];
       }
    }

    // Fallbacks globales
    if (!data.mail_cliente) {
       const m = text.match(/[\w.-]+@[\w.-]+\.\w+/);
       if (m) data.mail_cliente = m[0];
    }
    if (!data.rut) {
       // Soporta RUT con o sin puntos
       const m = text.match(/\b\d{1,2}\.?\d{3}\.?\d{3}-[0-9kK]\b/i);
       if (m) data.rut = m[0];
    }
    if (!data.movil_cliente) {
       const m = text.match(/\b9\d{8}\b/);
       if (m) data.movil_cliente = m[0];
    }

    if (data.comuna_cliente) {
        const regionInferida = obtenerRegionPorComuna(data.comuna_cliente);
        if (regionInferida) {
            data.region_cliente = regionInferida;
        }
    }

    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error("Error analyzing PDF:", error);
    return NextResponse.json({ error: error.message || "Failed to process PDF" }, { status: 500 });
  }
}
