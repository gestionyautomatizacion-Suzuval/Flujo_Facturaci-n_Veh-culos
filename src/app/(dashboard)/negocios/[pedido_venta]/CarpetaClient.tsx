"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, MessageSquare, Paperclip, Send, File, Image as ImageIcon, UploadCloud, Download, Loader2, Eye, X, AlertTriangle, ExternalLink, Check, Trash2, FileSignature, Calendar, RefreshCw, Play } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { Negocio } from "@/components/KanbanBoard";
import CuadraturaSection from "./CuadraturaSection";
import { todasLasComunas, obtenerRegionPorComuna, regionesYcomunas } from "@/lib/chile";

interface Comentario {
  id: string;
  usuario_nombre: string;
  usuario_email: string;
  comentario: string;
  created_at: string;
}

interface DocumentoInterno {
  id: string;
  nombre_archivo: string;
  tamano_kb: number;
  url: string;
  created_at: string;
  usuario_email?: string;
  es_firmado?: boolean;
  is_global?: boolean;
  ctrl_ventas_estado?: string | null;
  ctrl_ventas_por?: string | null;
  ctrl_ventas_en?: string | null;
}

interface Props {
  negocio: Negocio;
}

export default function CarpetaClient({ negocio }: Props) {
  const router = useRouter();
  const [rightActiveTab, setRightActiveTab] = useState<"requeridos" | "cliente" | "valores" | "archivos" | "firmados" | "historial">("requeridos");
  const [leftActiveTab, setLeftActiveTab] = useState<"chat">("chat");
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [docs, setDocs] = useState<DocumentoInterno[]>([]);
  
  const [nuevoComentario, setNuevoComentario] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingSpec, setUploadingSpec] = useState<string | null>(null); // 'nota_venta' o 'carnet'
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState("VENDEDOR");
  const [firmaJefaturaNV, setFirmaJefaturaNV] = useState((negocio as any).firma_jefatura_nv || null);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [ctrlVentas, setCtrlVentas] = useState({
    vehiculo: (negocio as any).ctrl_ventas_vehiculo || null as string | null,
    observaciones: (negocio as any).ctrl_ventas_observaciones || null as string | null,
    cuadratura: (negocio as any).ctrl_ventas_cuadratura || null as string | null,
    cliente: (negocio as any).ctrl_ventas_cliente || null as string | null,
    firma: (negocio as any).ctrl_ventas_firma || null as string | null,
    por: (negocio as any).ctrl_ventas_por || null as string | null,
    en: (negocio as any).ctrl_ventas_en || null as string | null,
  });
  const [cvPopupKey, setCvPopupKey] = useState<string | null>(null);
  const [isStartingRevision, setIsStartingRevision] = useState(false);
  
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editDocName, setEditDocName] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const notaVentaInputRef = useRef<HTMLInputElement>(null);
  const rnvmInputRef = useRef<HTMLInputElement>(null);
  const mppInputRef = useRef<HTMLInputElement>(null);
  const pepPersonaInputRef = useRef<HTMLInputElement>(null);
  const pepEmpresaInputRef = useRef<HTMLInputElement>(null);
  const djbfInputRef = useRef<HTMLInputElement>(null);
  const carnetInputRef = useRef<HTMLInputElement>(null);
  const aporteMarcaInputRef = useRef<HTMLInputElement>(null);
  const cartaMutuoInputRef = useRef<HTMLInputElement>(null);
  const retomaInputRef = useRef<HTMLInputElement>(null);
  const facturaInputRef = useRef<HTMLInputElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const firmadoInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  
  const [extractedCliente, setExtractedCliente] = useState<any>(null);
  const [isExtractingCliente, setIsExtractingCliente] = useState(false);
  const [isEditingCliente, setIsEditingCliente] = useState(false);
  const [manualCliente, setManualCliente] = useState<any>({});
  
  const [firmaDigitalData, setFirmaDigitalData] = useState<any>(null);
  const [isLoadingFirmaDigital, setIsLoadingFirmaDigital] = useState(false);

  const [extraData, setExtraData] = useState({
    contribuyente_electronico: (negocio as any).contribuyente_electronico || "",
    tipo_negocio: (negocio as any).tipo_negocio || "",
    estado_civil: (negocio as any).estado_civil || "",
    comunidad_bienes: (negocio as any).comunidad_bienes || "",
    nacionalidad: (negocio as any).nacionalidad || "",
    profesion_giro: (negocio as any).profesion_giro || ""
  });

  const [valoresNegocio, setValoresNegocio] = useState({
    precio_lista: (negocio as any).precio_lista || 0,
    bono_marca: (negocio as any).bono_marca || 0,
    bono_amicar_suzuval: (negocio as any).bono_amicar_suzuval || 0,
    bono_amicar_inchcape: (negocio as any).bono_amicar_inchcape || 0,
    flete_grabado: (negocio as any).flete_grabado ?? 181000,
    venta_accesorios_mantencion: (negocio as any).venta_accesorios_mantencion || 0,
    mantencion_10000: (negocio as any).mantencion_10000 || 0,
    mantencion_20000: (negocio as any).mantencion_20000 || 0,
    mantencion_30000: (negocio as any).mantencion_30000 || 0
  });

  const [valoresTab, setValoresTab] = useState<"negocio" | "papeles">("negocio");
  const [anioUtm] = useState<number>(new Date().getFullYear());
  const [utmData, setUtmData] = useState<Record<number, any>>({});
  const [loadingUtm, setLoadingUtm] = useState(true);
  const [mesFacturaA, setMesFacturaA] = useState<number>(new Date().getMonth() + 1);
  const [mesFacturaB, setMesFacturaB] = useState<number>(9);
  const [selloVerde, setSelloVerde] = useState<number>(4000);
  const [inscripcion, setInscripcion] = useState<number>(89560);
  const [permisoCirculacion, setPermisoCirculacion] = useState<number>(0);
  const [seguroObligatorio, setSeguroObligatorio] = useState<number>(33000);
  const [impuestoVerde, setImpuestoVerde] = useState<number>(0);
  const [facturarProximoMes, setFacturarProximoMes] = useState<string>("NO");

  const [pepOpciones, setPepOpciones] = useState({
    personaStatus: "NO ser una Persona Políticamente Expuesta (PEP)",
    personaVinculo: "NO tener vínculo alguno",
    empresaStatus: "NO ser una Persona Políticamente Expuesta (PEP)",
    empresaVinculo: "NO tener vínculo alguno"
  });

  const handleValoresChange = (field: string, value: string) => {
    const numValue = value.replace(/\D/g, '');
    setValoresNegocio(prev => ({ ...prev, [field]: Number(numValue) }));
  };

  const logAuditoria = async (detalles: string) => {
    const nombreExtraido = userEmail.split("@")[0] || "Sistema";
    const comentarioEspecial = `[AUDITORIA]|${detalles}`;
    
    const { data: chatData } = await supabase
      .from("negocios_comentarios")
      .insert([{
        pedido_venta: negocio.pedido_venta,
        usuario_nombre: nombreExtraido,
        usuario_email: userEmail || "sistema@suzuval.cl",
        comentario: comentarioEspecial
      }])
      .select()
      .single();

    if (chatData) {
      setComentarios(prev => [...prev, chatData]);
    }
  };

  const handleValoresSave = async (field: string, value: number) => {
    const { error } = await supabase.from('negocios').update({ [field]: value }).eq('pedido_venta', negocio.pedido_venta);
    if (error) console.error("Error auto-saving valores data:", error);
  };

  const handleExtraDataChange = (field: string, value: string) => {
    setExtraData(prev => ({ ...prev, [field]: value }));
  };

  const handleExtraDataSave = async (field: string, value: string) => {
    const { error } = await supabase.from('negocios').update({ [field]: value }).eq('pedido_venta', negocio.pedido_venta);
    if (error) console.error("Error auto-saving extra data:", error);
  };

  const fetchFirmaDigital = useCallback(async () => {
    const cli = extractedCliente || (negocio as any).cliente || negocio || {};
    const rutStr = manualCliente.rut || cli.rut || (negocio as any).rut;
    
    if (!rutStr) {
      setFirmaDigitalData(null);
      return;
    }
    
    setIsLoadingFirmaDigital(true);
    const { data, error } = await supabase
      .from('copia_firmas')
      .select('*')
      .eq('rut', rutStr)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
      
    if (!error && data) {
      setFirmaDigitalData(data);
    } else {
      setFirmaDigitalData(null);
    }
    setIsLoadingFirmaDigital(false);
  }, [negocio, extractedCliente, manualCliente.rut]);

  useEffect(() => {
    fetchFirmaDigital();
  }, [fetchFirmaDigital]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user?.email) setUserEmail(data.user.email);
      if (data.user?.id) {
        const { data: perfil } = await supabase.from('perfiles').select('rol').eq('id', data.user.id).single();
        if (perfil) {
          setUserRole(perfil.rol);
        }
      }
    });

    async function fetchUtm() {
      setLoadingUtm(true);
      const { data, error } = await supabase
        .from("parametros_sii")
        .select("anio, mes, utm")
        .eq("anio", anioUtm);
      if (!error && data) {
        const map: Record<number, any> = {};
        data.forEach((r: any) => { map[r.mes] = r; });
        setUtmData(map);
      }
      setLoadingUtm(false);
    }
    fetchUtm();

    const initData = async () => {
      const resChats = await supabase
        .from("negocios_comentarios")
        .select("*")
        .eq("pedido_venta", negocio.pedido_venta)
        .order("created_at", { ascending: true });
        
      if (!resChats.error && resChats.data) {
        setComentarios(resChats.data);
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }
      setLoading(false);

      const resDocs = await supabase
        .from("negocios_documentos")
        .select("*")
        .eq("pedido_venta", negocio.pedido_venta)
        .order("created_at", { ascending: false });
      
      if (!resDocs.error && resDocs.data) {
        setDocs(resDocs.data);
      }
      setLoadingDocs(false);
    };

    initData();
  }, [negocio.pedido_venta]);

  const handleFirmaNV = async (nuevoEstado: string) => {
    setFirmaJefaturaNV(nuevoEstado);
    const updateData: any = { firma_jefatura_nv: nuevoEstado };
    if (nuevoEstado === 'SOLICITADA') {
        updateData.firma_jefatura_solicitada_por = userEmail;
        updateData.firma_jefatura_solicitada_en = new Date().toISOString();
        (negocio as any).firma_jefatura_solicitada_por = updateData.firma_jefatura_solicitada_por;
        (negocio as any).firma_jefatura_solicitada_en = updateData.firma_jefatura_solicitada_en;
    } else if (nuevoEstado === 'FIRMADA' || nuevoEstado === 'RECHAZADA') {
        updateData.firma_jefatura_resuelta_por = userEmail;
        updateData.firma_jefatura_resuelta_en = new Date().toISOString();
        (negocio as any).firma_jefatura_resuelta_por = updateData.firma_jefatura_resuelta_por;
        (negocio as any).firma_jefatura_resuelta_en = updateData.firma_jefatura_resuelta_en;
    }

    const { error } = await supabase.from('negocios').update(updateData).eq('pedido_venta', negocio.pedido_venta);
    if (error) {
       console.error("Error updating firma:", error);
       alert("Error de conexión al actualizar firma.");
    } else {
       logAuditoria(`Se ha cambiado el estado de Firma Jefatura a: ${nuevoEstado}`);
    }
  };

  const handleGenerateRNVM = async () => {
    try {
      setUploadingSpec('RNVM');
      const cli = extractedCliente || (negocio as any).cliente || negocio || {};
      const rut = manualCliente.rut || cli.rut || (negocio as any).rut || '';
      const nombre = manualCliente.nombre_apellido || cli.nombre_apellido || (negocio as any).nombre_apellido || '';
      const direccion = manualCliente.direccion_cliente || (cli as any).direccion_cliente || (negocio as any).direccion_cliente || '';
      const comuna = manualCliente.comuna_cliente || (cli as any).comuna_cliente || (negocio as any).comuna_cliente || '';
      const region = manualCliente.region_cliente || (cli as any).region_cliente || (negocio as any).region_cliente || '';
      const correo = manualCliente.mail_cliente || (cli as any).mail_cliente || (negocio as any).mail_cliente || '';
      const telefono = manualCliente.movil_cliente || (cli as any).movil_cliente || (negocio as any).movil_cliente || '';

      const url = '/templates/rnvm_template.pdf';
      const response = await fetch(url);
      if(!response.ok) throw new Error("Plantilla no encontrada en public/templates/rnvm_template.pdf. Por favor, asegúrese de que el archivo existe.");
      const existingPdfBytes = await response.arrayBuffer();

      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];

      const size = 10;
      const color = rgb(0, 0, 0);
      const pageHeight = firstPage.getHeight();

      // Ajustes de coordenadas estimadas para dibujar los textos
      
      // Título (Centrado aprox)
      firstPage.drawText('FICHA DE CONOCIMIENTO DE CLIENTE', { x: 180, y: pageHeight - 120, size: 13, color });

      // Estado Civil y Datos Adicionales
      firstPage.drawText(`Estado Civil: ${extraData.estado_civil || ''}`, { x: 80, y: pageHeight - 150, size, color });
      firstPage.drawText(`Comunidad de Bienes: ${extraData.comunidad_bienes || ''}`, { x: 350, y: pageHeight - 150, size, color });
      firstPage.drawText(`Acuerdo Unión Civil: ${extraData.estado_civil === 'AUC' ? 'SI' : 'NO'}`, { x: 80, y: pageHeight - 170, size, color });
      firstPage.drawText(`Cliente Empresa: ${extraData.tipo_negocio === 'CLIENTE EMPRESA' ? 'SI' : 'NO'}`, { x: 350, y: pageHeight - 170, size, color });

      // Leyenda / Advertencia
      const legendColor = rgb(0.5, 0.5, 0.5);
      const legendSize = 8;
      firstPage.drawText('Si hay un Acuerdo de Union Civil adjuntar 2\' Cedula de Identidad y Certificado de Matrimonio. Si rechazo es por Acuerdo de Union', { x: 80, y: pageHeight - 195, size: legendSize, color: legendColor });
      firstPage.drawText('Civil con Comunidad de bienes, el trámite de solución debe ser realizado por cliente o con un costo de 1,5 UF.', { x: 80, y: pageHeight - 210, size: legendSize, color: legendColor });
      firstPage.drawText('SOLUCION DEL RECHAZO, GENERARÁ DEMORAS DE 6 O MAS MESES EN OBTENER CAV Y PADRON', { x: 80, y: pageHeight - 225, size: legendSize, color: legendColor });

      // Datos Cliente
      firstPage.drawText(`Rut: ${rut}`, { x: 80, y: pageHeight - 250, size, color });
      firstPage.drawText(`Nombre Completo: ${nombre}`, { x: 80, y: pageHeight - 270, size, color });
      firstPage.drawText(`Nacionalidad: ${extraData.nacionalidad || ''}`, { x: 80, y: pageHeight - 290, size, color });
      firstPage.drawText(`Profesión o Giro: ${extraData.profesion_giro || ''}`, { x: 80, y: pageHeight - 310, size, color });

      // Dirección
      firstPage.drawText(`Dirección: ${direccion}`, { x: 80, y: pageHeight - 345, size, color });
      firstPage.drawText(`Comuna: ${comuna}`, { x: 80, y: pageHeight - 365, size, color });
      firstPage.drawText(`Región: ${region}`, { x: 350, y: pageHeight - 365, size, color });
      firstPage.drawText(`Teléfono: ${telefono}`, { x: 80, y: pageHeight - 385, size, color });
      firstPage.drawText(`Correo Electrónico: ${correo}`, { x: 80, y: pageHeight - 405, size, color });

      // Declaración legal
      firstPage.drawText('Declaro que mis datos personales indicados precedentemente son los correctos, para los efectos de la inscripción del vehículo', { x: 80, y: pageHeight - 440, size: legendSize, color: legendColor });
      firstPage.drawText('que estoy adquiriendo, en el Registro Nacional de Vehículos Motorizados.', { x: 80, y: pageHeight - 455, size: legendSize, color: legendColor });
      firstPage.drawText('Asimismo, declaro conocer que Distribuidora de Vehículos Suzuval SPA ha implementado un Manual de Prevención de Delitos', { x: 80, y: pageHeight - 480, size: legendSize, color: legendColor });
      firstPage.drawText('conforme a la Ley N° 19.913 para los delitos de lavados de activos, financiamiento de terrorismo y los demás delitos', { x: 80, y: pageHeight - 495, size: legendSize, color: legendColor });
      firstPage.drawText('precedentes, y conforme a ello, declara que los fondos con los que realiza esta operación provienen de un origen lícito.', { x: 80, y: pageHeight - 510, size: legendSize, color: legendColor });

      // Inserción de firma digital si existe
      if (firmaDigitalData) {
        // Buscar la URL o base64 de la firma
        const firmaUrlStr = firmaDigitalData.firma || Object.values(firmaDigitalData).find((v: any) => typeof v === 'string' && (v.startsWith('data:image') || v.startsWith('http')));
        
        if (firmaUrlStr && typeof firmaUrlStr === 'string') {
          try {
            let firmaImageBytes;
            if (firmaUrlStr.startsWith('data:image')) {
              const base64Data = firmaUrlStr.split(',')[1];
              const binaryString = window.atob(base64Data);
              const len = binaryString.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              firmaImageBytes = bytes.buffer;
            } else if (firmaUrlStr.startsWith('http')) {
              const res = await fetch(firmaUrlStr);
              if (res.ok) {
                firmaImageBytes = await res.arrayBuffer();
              }
            }

            if (firmaImageBytes) {
              let firmaImage;
              try {
                firmaImage = await pdfDoc.embedPng(firmaImageBytes);
              } catch (e) {
                firmaImage = await pdfDoc.embedJpg(firmaImageBytes);
              }
              
              if (firmaImage) {
                let width = firmaImage.width;
                let height = firmaImage.height;
                const maxWidth = 200;
                const maxHeight = 100;
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width = width * ratio;
                height = height * ratio;

                firstPage.drawImage(firmaImage, {
                  x: (firstPage.getWidth() - width) / 2, // Centrado horizontal
                  y: pageHeight - 620, // Posición ajustada para centrar mejor en el espacio en blanco (más arriba)
                  width,
                  height
                });
              }
            }
          } catch(e) {
            console.error("Error incrustando firma en PDF:", e);
          }
        }
      }

      // Fecha de generación del documento (recuadro amarillo derecho)
      const fechaActual = new Date();
      const fechaFormateada = fechaActual.toLocaleDateString('es-CL');
      firstPage.drawText(`Generado el: ${fechaFormateada}`, { 
        x: 430, // Alineado lo más posible a la derecha
        y: pageHeight - 570, // Subimos la altura para que quede alineado al centro de la firma
        size: 9, 
        color: rgb(0.4, 0.4, 0.4) 
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const fileName = `RNVM_${negocio.pedido_venta}_${rut}.pdf`;
      const storagePath = `${negocio.pedido_venta}/${Date.now()}_${fileName}`;
      const { error: uploadError } = await supabase
        .storage
        .from('documentos')
        .upload(storagePath, blob, { contentType: 'application/pdf' });

      if (uploadError) throw new Error("Error al subir el documento RNVM al servidor.");

      const { data: publicUrlData } = supabase.storage.from('documentos').getPublicUrl(storagePath);
      const kbSize = Math.round(blob.size / 1024);
      
      const { data: docData, error: dbError } = await supabase
        .from('negocios_documentos')
        .insert([{
          pedido_venta: negocio.pedido_venta,
          nombre_archivo: fileName,
          tamano_kb: kbSize,
          url: publicUrlData.publicUrl,
          usuario_email: userEmail
        }])
        .select()
        .single();

      if (dbError) throw new Error("Error al guardar el documento en la base de datos.");
      if (docData) setDocs(prev => [docData, ...prev]);

      // Descarga automática eliminada a petición del usuario.
      
      logAuditoria(`Documento generado y guardado: RNVM`);
      alert("Documento generado y guardado exitosamente.");
    } catch (err: any) {
      console.error(err);
      alert('Error generando RNVM: ' + err.message);
    } finally {
      setUploadingSpec(null);
    }
  };

  const handleGenerateMPP = async () => {
    try {
      setUploadingSpec('MPP');
      const cli = extractedCliente || (negocio as any).cliente || negocio || {};
      const rut = manualCliente.rut || cli.rut || (negocio as any).rut || '';

      const url = '/templates/mpp_template.pdf';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Plantilla no encontrada en public/templates/mpp_template.pdf.');
      const existingPdfBytes = await response.arrayBuffer();

      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const pageHeight = firstPage.getHeight();
      const pageWidth = firstPage.getWidth();

      // Solo insertar la firma digital si existe
      if (firmaDigitalData) {
        const firmaUrlStr = firmaDigitalData.firma || Object.values(firmaDigitalData).find((v: any) => typeof v === 'string' && (v.startsWith('data:image') || v.startsWith('http')));
        if (firmaUrlStr && typeof firmaUrlStr === 'string') {
          try {
            let firmaImageBytes;
            if (firmaUrlStr.startsWith('data:image')) {
              const base64Data = firmaUrlStr.split(',')[1];
              const binaryString = window.atob(base64Data);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
              firmaImageBytes = bytes.buffer;
            } else if (firmaUrlStr.startsWith('http')) {
              const res = await fetch(firmaUrlStr);
              if (res.ok) firmaImageBytes = await res.arrayBuffer();
            }
            if (firmaImageBytes) {
              let firmaImage;
              try { firmaImage = await pdfDoc.embedPng(firmaImageBytes); }
              catch { firmaImage = await pdfDoc.embedJpg(firmaImageBytes); }
              if (firmaImage) {
                let w = firmaImage.width, h = firmaImage.height;
                // Área del rectángulo amarillo: x≈144–388, y≈155–235 (pdf-lib, origen abajo-izq)
                const boxX = 200, boxY = 155, boxW = 244, boxH = 80;
                const ratio = Math.min(boxW / w, boxH / h);
                w = w * ratio; h = h * ratio;
                firstPage.drawImage(firmaImage, {
                  x: boxX + (boxW - w) / 2,
                  y: boxY + (boxH - h) / 2,
                  width: w, height: h
                });
              }
            }
          } catch (e) { console.error('Error incrustando firma en MPP:', e); }
        }
      }

      // Fecha al lado derecho de la firma, parte inferior
      const fechaMPP = new Date().toLocaleDateString('es-CL');
      firstPage.drawText(`Generado el: ${fechaMPP}`, {
        x: 200 + 244 + 10, // a la derecha del área de firma
        y: 185,             // un poco más arriba del borde inferior del área de firma
        size: 8,
        color: rgb(0.3, 0.3, 0.3)
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const fileName = `MPP_${negocio.pedido_venta}_${rut}.pdf`;
      const storagePath = `${negocio.pedido_venta}/${Date.now()}_${fileName}`;

      const { error: uploadError } = await supabase.storage.from('documentos').upload(storagePath, blob, { contentType: 'application/pdf' });
      if (uploadError) throw new Error('Error al subir el documento MPP al servidor.');

      const { data: publicUrlData } = supabase.storage.from('documentos').getPublicUrl(storagePath);
      const kbSize = Math.round(blob.size / 1024);

      const { data: docData, error: dbError } = await supabase
        .from('negocios_documentos')
        .insert([{
          pedido_venta: negocio.pedido_venta,
          nombre_archivo: fileName,
          tamano_kb: kbSize,
          url: publicUrlData.publicUrl,
          usuario_email: userEmail,
          es_firmado: true
        }])
        .select()
        .single();

      if (dbError) throw new Error('Error al guardar el documento MPP en la base de datos.');
      if (docData) setDocs(prev => [docData, ...prev]);

      logAuditoria(`Documento generado y guardado: MPP`);
      alert('Documento MPP generado y guardado exitosamente.');
    } catch (err: any) {
      console.error(err);
      alert('Error generando MPP: ' + err.message);
    } finally {
      setUploadingSpec(null);
    }
  };

  const handleGeneratePEP = async (tipo: 'PEP_PERSONA' | 'PEP_EMPRESA') => {
    try {
      setUploadingSpec(tipo);
      const cli = extractedCliente || (negocio as any).cliente || negocio || {};
      const rut = manualCliente.rut || cli.rut || (negocio as any).rut || '';
      const nombre = manualCliente.nombre_apellido || cli.nombre_apellido || (negocio as any).nombre_apellido || '';
      const nacionalidad = (extraData as any)?.nacionalidad || manualCliente.nacionalidad || (cli as any).nacionalidad || '';

      const templateName = tipo === 'PEP_PERSONA' ? 'pep_persona_template.pdf' : 'pep_empresas_template.pdf';
      const response = await fetch(`/templates/${templateName}`);
      if (!response.ok) throw new Error(`Plantilla ${templateName} no encontrada en public/templates/.`);
      const existingPdfBytes = await response.arrayBuffer();

      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const pageHeight = firstPage.getHeight();

      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      const textColor = rgb(0, 0, 0);
      const textSize = 10;

      // Datos del cliente — coordenadas exactas del template (pdfjs-dist)
      // "Yo :" está en y=635, "cédula nacional...\" en y=620, "de nacionalidad :" en y=605
      // Bajamos 2 puntos para alinear perfectamente la base del texto con la de la etiqueta
      firstPage.drawText(nombre,       { x: 55,  y: 633, size: textSize, color: textColor });
      firstPage.drawText(rut,          { x: 235, y: 618, size: textSize, color: textColor });
      firstPage.drawText(nacionalidad, { x: 110, y: 603, size: textSize, color: textColor });

      const statusText = tipo === 'PEP_PERSONA' ? pepOpciones.personaStatus : pepOpciones.empresaStatus;
      const vinculoText = tipo === 'PEP_PERSONA' ? pepOpciones.personaVinculo : pepOpciones.empresaVinculo;

      firstPage.drawText(statusText, { x: 50, y: 574, size: textSize, color: textColor });
      const statusWidth = font.widthOfTextAtSize(statusText, textSize);
      firstPage.drawLine({ start: { x: 50, y: 572 }, end: { x: 50 + statusWidth, y: 572 }, thickness: 1, color: textColor });

      firstPage.drawText(vinculoText, { x: 50, y: 543, size: textSize, color: textColor });
      const vinculoWidth = font.widthOfTextAtSize(vinculoText, textSize);
      firstPage.drawLine({ start: { x: 50, y: 541 }, end: { x: 50 + vinculoWidth, y: 541 }, thickness: 1, color: textColor });
      // Insertar firma digital si existe
      if (firmaDigitalData) {
        const firmaUrlStr = firmaDigitalData.firma || Object.values(firmaDigitalData).find((v: any) => typeof v === 'string' && (v.startsWith('data:image') || v.startsWith('http')));
        if (firmaUrlStr && typeof firmaUrlStr === 'string') {
          try {
            let firmaImageBytes;
            if (firmaUrlStr.startsWith('data:image')) {
              const base64Data = firmaUrlStr.split(',')[1];
              const binaryString = window.atob(base64Data);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
              firmaImageBytes = bytes.buffer;
            } else if (firmaUrlStr.startsWith('http')) {
              const res = await fetch(firmaUrlStr);
              if (res.ok) firmaImageBytes = await res.arrayBuffer();
            }
            if (firmaImageBytes) {
              let firmaImage;
              try { firmaImage = await pdfDoc.embedPng(firmaImageBytes); }
              catch { firmaImage = await pdfDoc.embedJpg(firmaImageBytes); }
              if (firmaImage) {
                let w = firmaImage.width, h = firmaImage.height;
                const boxX = 200, boxY = tipo === 'PEP_EMPRESA' ? 40 : 70, boxW = 244, boxH = 80;
                const ratio = Math.min(boxW / w, boxH / h);
                w = w * ratio; h = h * ratio;
                firstPage.drawImage(firmaImage, {
                  x: boxX + (boxW - w) / 2,
                  y: boxY + (boxH - h) / 2,
                  width: w, height: h
                });
              }
            }
          } catch (e) { console.error('Error incrustando firma en PEP:', e); }
        }
      }

      // Fecha al lado derecho de la firma
      const fechaPEP = new Date().toLocaleDateString('es-CL');
      firstPage.drawText(`Generado el: ${fechaPEP}`, {
        x: 200 + 244 + 10,
        y: tipo === 'PEP_EMPRESA' ? 65 : 95,
        size: 8,
        color: rgb(0.3, 0.3, 0.3)
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const fileName = `${tipo}_${negocio.pedido_venta}_${rut}.pdf`;
      const storagePath = `${negocio.pedido_venta}/${Date.now()}_${fileName}`;

      const { error: uploadError } = await supabase.storage.from('documentos').upload(storagePath, blob, { contentType: 'application/pdf' });
      if (uploadError) throw new Error(`Error al subir el documento ${tipo} al servidor.`);

      const { data: publicUrlData } = supabase.storage.from('documentos').getPublicUrl(storagePath);
      const kbSize = Math.round(blob.size / 1024);

      const { data: docData, error: dbError } = await supabase
        .from('negocios_documentos')
        .insert([{
          pedido_venta: negocio.pedido_venta,
          nombre_archivo: fileName,
          tamano_kb: kbSize,
          url: publicUrlData.publicUrl,
          usuario_email: userEmail,
          es_firmado: true
        }])
        .select()
        .single();

      if (dbError) throw new Error(`Error al guardar el documento ${tipo} en la base de datos.`);
      if (docData) setDocs(prev => [docData, ...prev]);

      logAuditoria(`Documento generado y guardado: ${tipo.replace('_', ' ')}`);
      alert(`Documento ${tipo.replace('_', ' ')} generado y guardado exitosamente.`);
    } catch (err: any) {
      console.error(err);
      alert(`Error generando ${tipo}: ` + err.message);
    } finally {
      setUploadingSpec(null);
    }
  };

  const handleGenerateDJBF = async () => {
    try {
      setUploadingSpec('DJBF');
      const url = '/templates/djbf_template.pdf';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Plantilla no encontrada en public/templates/djbf_template.pdf.');
      
      const existingPdfBytes = await response.arrayBuffer();
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const pdfBytes = await pdfDoc.save();
      
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const fileName = `DJBF_${negocio.pedido_venta}.pdf`;
      const storagePath = `${negocio.pedido_venta}/${Date.now()}_${fileName}`;
      
      const { error: uploadError } = await supabase.storage.from('documentos').upload(storagePath, blob, { contentType: 'application/pdf' });
      if (uploadError) throw new Error('Error al subir el documento DJBF al servidor.');

      const { data: publicUrlData } = supabase.storage.from('documentos').getPublicUrl(storagePath);
      const kbSize = Math.round(blob.size / 1024);

      const { data: docData, error: dbError } = await supabase
        .from('negocios_documentos')
        .insert([{
          pedido_venta: negocio.pedido_venta,
          nombre_archivo: fileName,
          tamano_kb: kbSize,
          url: publicUrlData.publicUrl,
          usuario_email: userEmail,
          es_firmado: true
        }])
        .select()
        .single();

      if (dbError) throw new Error('Error al guardar el documento DJBF en la base de datos.');
      if (docData) setDocs(prev => [docData, ...prev]);

      logAuditoria(`Documento generado y guardado: DJBF`);
      alert('Documento DJBF generado y guardado exitosamente.');
    } catch (err: any) {
      console.error(err);
      alert('Error generando DJBF: ' + err.message);
    } finally {
      setUploadingSpec(null);
    }
  };

  const canMarkCV = ['ADMINISTRATIVO', 'ADMIN'].includes(userRole) && !!(negocio as any).primer_admin_email;

  const handleCtrlVentasSec = async (campo: 'vehiculo' | 'observaciones' | 'cuadratura' | 'cliente' | 'firma', valor: string | null) => {
    const update: Record<string, any> = { [`ctrl_ventas_${campo}`]: valor };
    const now = new Date().toISOString();
    if (valor) { update.ctrl_ventas_por = userEmail; update.ctrl_ventas_en = now; }
    const { error } = await supabase.from('negocios').update(update).eq('pedido_venta', negocio.pedido_venta);
    if (!error) {
      setCtrlVentas(prev => ({ 
        ...prev, 
        [campo]: valor,
        ...(valor ? { por: userEmail, en: now } : {})
      }));
      logAuditoria(`Control Ventas: ${valor === 'OK' ? 'Aprobado' : valor === 'RECHAZADO' ? 'Rechazado' : 'Marca quitada'} en la sección ${campo.toUpperCase()}`);
    }
    setCvPopupKey(null);
  };

  const handleCtrlVentasDoc = async (docId: string, valor: string | null) => {
    const update: Record<string, any> = { ctrl_ventas_estado: valor };
    const now = new Date().toISOString();
    if (valor) { update.ctrl_ventas_por = userEmail; update.ctrl_ventas_en = now; }
    const { error } = await supabase.from('negocios_documentos').update(update).eq('id', docId);
    if (!error) {
      setDocs(prev => prev.map(d => d.id === docId ? { 
        ...d, 
        ctrl_ventas_estado: valor,
        ...(valor ? { ctrl_ventas_por: userEmail, ctrl_ventas_en: now } : {})
      } : d));
      const docName = docs.find(d => d.id === docId)?.nombre_archivo || 'Documento';
      logAuditoria(`Control Ventas: ${valor === 'OK' ? 'Aprobado' : valor === 'RECHAZADO' ? 'Rechazado' : 'Marca quitada'} en el documento "${docName}"`);
    }
    setCvPopupKey(null);
  };

  const CvSecBadge = ({ campo, valor }: { campo: 'vehiculo' | 'observaciones' | 'cuadratura' | 'cliente' | 'firma'; valor: string | null }) => {
    const key = `sec_${campo}`;
    const isOpen = cvPopupKey === key;
    return (
      <div className="relative inline-flex items-center ml-3">
        <button
          onClick={canMarkCV ? (e) => { e.stopPropagation(); setCvPopupKey(isOpen ? null : key); } : undefined}
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded border-2 text-xs font-bold transition-all min-w-[80px] h-[26px] justify-center ${valor === 'OK' ? 'bg-green-500 border-green-600 text-white' : valor === 'RECHAZADO' ? 'bg-red-500 border-red-600 text-white' : (!canMarkCV ? 'bg-slate-100 border-slate-300 text-slate-400' : 'bg-white border-green-400 text-green-600')} ${canMarkCV ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed opacity-80'}`}
          title={canMarkCV ? 'Control Ventas' : (valor || 'Sin marcar')}
        >
          {valor === 'OK' && <><Check className="w-3 h-3" /><span>OK</span></>}
          {valor === 'RECHAZADO' && <><X className="w-3 h-3" /><span>Rechaz.</span></>}
        </button>
        {(valor === 'OK' || valor === 'RECHAZADO') && ctrlVentas.por && ctrlVentas.en && (
          <span className="ml-2 text-[10px] text-slate-500 font-medium whitespace-nowrap bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
            {ctrlVentas.por.split('@')[0]} • {format(new Date(ctrlVentas.en), "dd/MM HH:mm")}
          </span>
        )}
        {isOpen && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 flex flex-col gap-0.5 min-w-[160px]">
            <button onClick={() => handleCtrlVentasSec(campo, 'OK')} className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-green-700 hover:bg-green-50 rounded-lg w-full text-left"><Check className="w-3 h-3 shrink-0" /> Marcar como OK</button>
            <button onClick={() => handleCtrlVentasSec(campo, 'RECHAZADO')} className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg w-full text-left"><X className="w-3 h-3 shrink-0" /> Rechazado</button>
            {valor && <button onClick={() => handleCtrlVentasSec(campo, null)} className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 rounded-lg w-full text-left">Quitar marca</button>}
          </div>
        )}
      </div>
    );
  };

  const CvDocBadge = ({ doc }: { doc: DocumentoInterno }) => {
    const valor = doc.ctrl_ventas_estado || null;
    const key = `doc_${doc.id}`;
    const isOpen = cvPopupKey === key;
    return (
      <div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-1" onClick={e => e.stopPropagation()}>
        <button
          onClick={canMarkCV ? () => setCvPopupKey(isOpen ? null : key) : undefined}
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded border-2 text-xs font-bold transition-all shadow-sm min-w-[70px] h-[26px] justify-center ${valor === 'OK' ? 'bg-green-500 border-green-600 text-white' : valor === 'RECHAZADO' ? 'bg-red-500 border-red-600 text-white' : (!canMarkCV ? 'bg-slate-100 border-slate-300 text-slate-400' : 'bg-white border-green-400 text-green-600')} ${canMarkCV ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed opacity-80'}`}
          title={canMarkCV ? 'Control Ventas' : (valor || 'Sin marcar')}
        >
          {valor === 'OK' && <><Check className="w-3 h-3" /><span>OK</span></>}
          {valor === 'RECHAZADO' && <><X className="w-3 h-3" /><span>Rechaz.</span></>}
        </button>
        {(valor === 'OK' || valor === 'RECHAZADO') && doc.ctrl_ventas_por && doc.ctrl_ventas_en && (
          <span className="text-[10px] text-slate-500 bg-white/95 px-1.5 py-0.5 rounded border border-slate-200/50 shadow-sm whitespace-nowrap backdrop-blur-sm">
            {doc.ctrl_ventas_por.split('@')[0]} • {format(new Date(doc.ctrl_ventas_en), "dd/MM HH:mm")}
          </span>
        )}
        {isOpen && (
          <div className="absolute top-full right-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 flex flex-col gap-0.5 min-w-[160px]">
            <button onClick={() => handleCtrlVentasDoc(doc.id, 'OK')} className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-green-700 hover:bg-green-50 rounded-lg w-full text-left"><Check className="w-3 h-3 shrink-0" /> Marcar como OK</button>
            <button onClick={() => handleCtrlVentasDoc(doc.id, 'RECHAZADO')} className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg w-full text-left"><X className="w-3 h-3 shrink-0" /> Rechazado</button>
            {valor && <button onClick={() => handleCtrlVentasDoc(doc.id, null)} className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 rounded-lg w-full text-left">Quitar marca</button>}
          </div>
        )}
      </div>
    );
  };

  const handleInicioRevision = async () => {
    setIsStartingRevision(true);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('negocios')
      .update({ primer_admin_email: userEmail, primer_admin_fecha: now })
      .eq('pedido_venta', negocio.pedido_venta);
      
    if (error) {
      alert("Error al iniciar revisión: " + error.message);
      setIsStartingRevision(false);
      return;
    }
    
    (negocio as any).primer_admin_email = userEmail;
    (negocio as any).primer_admin_fecha = now;
    
    logAuditoria(`Ha iniciado la primera revisión de la carpeta`);
    router.refresh();
    setIsStartingRevision(false);
  };

  const handleDeleteNegocio = async () => {
    if (!window.confirm("¿Estás seguro de que quieres eliminar este negocio y todos sus documentos correspondientes? Esta acción es irreversible.")) return;
    
    const { error } = await supabase.from('negocios').delete().eq('pedido_venta', negocio.pedido_venta);
    if (error) {
      alert("Error al eliminar el negocio: " + error.message);
      return;
    }
    
    router.replace("/negocios");
  };

  // Función para extracción manual de Datos del Cliente desde Nota de Venta
  const extractDocumentData = async () => {
    const notaVentaDoc = docs.find(d => d.nombre_archivo.toLowerCase().includes('nota') && d.nombre_archivo.toLowerCase().includes('venta'));
    if (!notaVentaDoc) {
      alert("No se encontró el documento de Nota de Venta.");
      return;
    }

    setIsExtractingCliente(true);
    try {
      const res = await fetch('/api/extract-cliente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: notaVentaDoc.url })
      });
      
      const textResponse = await res.text();
      let json;
      try {
        json = JSON.parse(textResponse);
      } catch (e) {
        console.error("API Error Response (Not JSON):", textResponse);
        alert("Error de Servidor: La API no devolvió JSON válido. Revisar logs.");
        setIsExtractingCliente(false);
        return;
      }
      
      if (json.success && json.data) {
        // En lugar de guardar automáticamente, rellenamos el formulario para que el usuario revise y guarde
        // Preservamos el RUT actual si ya existe para no sobrescribirlo con el de la Nota de Venta
        const cli = extractedCliente || (negocio as any).cliente || negocio || {};
        const dataToSet = { ...json.data };
        
        // Si el cliente ya tiene un RUT válido, mantenemos ese RUT
        if (cli.rut && cli.rut.trim() !== "" && cli.rut !== "S/A" && cli.rut !== "S/N") {
          dataToSet.rut = cli.rut;
        }

        if (dataToSet.comuna_cliente && !dataToSet.region_cliente) {
          const regionEncontrada = obtenerRegionPorComuna(dataToSet.comuna_cliente);
          if (regionEncontrada) {
            dataToSet.region_cliente = regionEncontrada;
          }
        }

        setManualCliente(dataToSet);
        setIsEditingCliente(true);
      } else {
        alert("Error de extracción: " + (json.error || "Datos no encontrados en el PDF"));
      }
    } catch (err) {
      console.error("Error auto extract:", err);
      alert("Fallo de red tratando de leer el PDF.");
    } finally {
      setIsExtractingCliente(false);
    }
  };

  const handleSaveManualCliente = async () => {
    setIsExtractingCliente(true); // Reusing loader visually
    const { error } = await supabase
      .from('negocios')
      .update({
        nombre_apellido: manualCliente.nombre_apellido,
        rut: manualCliente.rut,
        direccion_cliente: manualCliente.direccion_cliente,
        comuna_cliente: manualCliente.comuna_cliente,
        region_cliente: manualCliente.region_cliente,
        mail_cliente: manualCliente.mail_cliente,
        movil_cliente: manualCliente.movil_cliente
      })
      .eq('pedido_venta', negocio.pedido_venta);
      
    setIsExtractingCliente(false);
    if (error) {
       alert("Error guardando datos: " + error.message);
    } else {
       setExtractedCliente(manualCliente);
       setIsEditingCliente(false);
    }
  };

  const handleSendComentario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoComentario.trim()) return;

    setSending(true);
    const nombreExtraido = userEmail.split("@")[0] || "Usuario";

    const comentarioData = {
      pedido_venta: negocio.pedido_venta,
      usuario_nombre: nombreExtraido,
      usuario_email: userEmail,
      comentario: nuevoComentario.trim()
    };

    const { data, error } = await supabase
      .from("negocios_comentarios")
      .insert([comentarioData])
      .select()
      .single();

    if (!error && data) {
      setComentarios([...comentarios, data]);
      setNuevoComentario("");
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
    setSending(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    // Asignar nombre personalizado
    const ext = file.name.includes('.') ? file.name.split('.').pop()! : '';
    const baseName = file.name.replace(/\.[^/.]+$/, "");
    const customNameRaw = window.prompt("Ingresa el nombre para este documento (opcional):", baseName);
    
    if (customNameRaw === null) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return; 
    }
    
    const customName = customNameRaw.trim() || baseName;
    const finalFileName = ext ? `${customName}.${ext}` : customName;
    
    setUploading(true);
    
    const cleanFileName = finalFileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${negocio.pedido_venta}/${Date.now()}_${cleanFileName}`;

    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('documentos')
      .upload(storagePath, file);

    if (uploadError) {
      alert("Error subiendo el archivo. Revisa los permisos de Supabase.");
      console.error(uploadError);
      setUploading(false);
      return;
    }

    const { data: publicUrlData } = supabase
      .storage
      .from('documentos')
      .getPublicUrl(storagePath);

    const kbSize = Math.round(file.size / 1024);
    
    const { data: docData, error: dbError } = await supabase
      .from('negocios_documentos')
      .insert([{
        pedido_venta: negocio.pedido_venta,
        nombre_archivo: finalFileName,
        tamano_kb: kbSize,
        url: publicUrlData.publicUrl,
        usuario_email: userEmail
      }])
      .select()
      .single();

    if (!dbError && docData) {
      setDocs([docData, ...docs]);
      logAuditoria(`Documento adjuntado: ${finalFileName}`);
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFirmadoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    // Asignar nombre personalizado
    const ext = file.name.includes('.') ? file.name.split('.').pop()! : '';
    const baseName = file.name.replace(/\.[^/.]+$/, "");
    const customNameRaw = window.prompt("Ingresa el nombre para este documento firmado (opcional):", baseName);
    
    if (customNameRaw === null) {
      if (firmadoInputRef.current) firmadoInputRef.current.value = "";
      return; 
    }
    
    const customName = customNameRaw.trim() || baseName;
    const finalFileName = ext ? `${customName}.${ext}` : customName;
    
    setUploading(true);
    
    const cleanFileName = finalFileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${negocio.pedido_venta}/${Date.now()}_${cleanFileName}`;

    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('documentos')
      .upload(storagePath, file);

    if (uploadError) {
      alert("Error subiendo el archivo. Revisa los permisos de Supabase.");
      console.error(uploadError);
      setUploading(false);
      return;
    }

    const { data: publicUrlData } = supabase
      .storage
      .from('documentos')
      .getPublicUrl(storagePath);

    const kbSize = Math.round(file.size / 1024);
    
    const { data: docData, error: dbError } = await supabase
      .from('negocios_documentos')
      .insert([{
        pedido_venta: negocio.pedido_venta,
        nombre_archivo: finalFileName,
        tamano_kb: kbSize,
        url: publicUrlData.publicUrl,
        usuario_email: userEmail,
        es_firmado: true
      }])
      .select()
      .single();

    if (!dbError && docData) {
      setDocs([docData, ...docs]);
      logAuditoria(`Documento firmado adjuntado: ${finalFileName}`);
    }
    setUploading(false);
    if (firmadoInputRef.current) firmadoInputRef.current.value = "";
  };

  const [replacingDocId, setReplacingDocId] = useState<string | null>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const handleReplaceDocClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setReplacingDocId(id);
    replaceInputRef.current?.click();
  };

  const handleReplaceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!replacingDocId) return;
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    const docToReplace = docs.find(d => d.id === replacingDocId);
    if (!docToReplace) {
      setReplacingDocId(null);
      return;
    }
    
    setUploading(true);
    
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${negocio.pedido_venta}/${Date.now()}_${cleanFileName}`;

    const { error: uploadError } = await supabase.storage.from('documentos').upload(storagePath, file);
    
    if (uploadError) {
      alert("Error subiendo el archivo de reemplazo.");
      console.error(uploadError);
      setUploading(false);
      setReplacingDocId(null);
      if (replaceInputRef.current) replaceInputRef.current.value = "";
      return;
    }
    
    const { data: publicUrlData } = supabase.storage.from('documentos').getPublicUrl(storagePath);
    const kbSize = Math.round(file.size / 1024);
    
    const { data: docData, error: dbError } = await supabase
      .from('negocios_documentos')
      .update({ 
        url: publicUrlData.publicUrl,
        tamano_kb: kbSize,
        usuario_email: userEmail,
        is_global: false // Convertir en documento local para que se pueda borrar o renombrar si lo desea
      })
      .eq('id', replacingDocId)
      .select()
      .single();
      
    if (!dbError && docData) {
      setDocs(prev => prev.map(d => d.id === replacingDocId ? docData : d));
      logAuditoria(`Documento reemplazado: ${docToReplace?.nombre_archivo} por ${cleanFileName}`);
    } else {
      alert("Error actualizando la base de datos.");
    }
    
    setUploading(false);
    setReplacingDocId(null);
    if (replaceInputRef.current) replaceInputRef.current.value = "";
  };

  const handleSpecialUpload = async (e: React.ChangeEvent<HTMLInputElement>, tipo: 'Nota de Venta' | 'Carnet Identidad Cliente' | 'Aporte Marca Z126' | 'Carta Mutuo Crédito' | 'Retoma Auto Usado' | 'RNVM' | 'MPP' | 'PEP_PERSONA' | 'PEP_EMPRESA' | 'DJBF' | 'Factura', setter: (v: string | null) => void, inputRef: React.RefObject<HTMLInputElement | null>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setter(tipo);
    
    const ext = file.name.split('.').pop() || 'pdf';
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${negocio.pedido_venta}/${Date.now()}_${cleanFileName}`;

    const { error: uploadError } = await supabase.storage.from('documentos').upload(storagePath, file);

    if (uploadError) {
      alert(`Error subiendo ${tipo}.`);
      setter(null);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from('documentos').getPublicUrl(storagePath);
    const kbSize = Math.round(file.size / 1024);
    
    const { data: docData, error: dbError } = await supabase
      .from('negocios_documentos')
      .insert([{
        pedido_venta: negocio.pedido_venta,
        nombre_archivo: `${tipo}.${ext}`,
        tamano_kb: kbSize,
        url: publicUrlData.publicUrl,
        usuario_email: userEmail
      }])
      .select()
      .single();

    if (!dbError && docData) {
      setDocs(prev => [docData, ...prev]);
      logAuditoria(`Documento especial adjuntado (${tipo}): ${cleanFileName}`);
    }

    setter(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleRenameDoc = async (id: string, newName: string) => {
    if (!newName.trim()) {
      setEditingDocId(null);
      return;
    }

    // Preserve extension
    const oldName = docs.find(d => d.id === id)?.nombre_archivo || "";
    const extMatch = oldName.match(/\.[0-9a-z]+$/i);
    const ext = extMatch ? extMatch[0] : "";
    
    // Remove extension from newName if user typed it, to avoid .pdf.pdf
    let finalName = newName.trim();
    if (ext && finalName.toLowerCase().endsWith(ext.toLowerCase())) {
        // user included it, do nothing to finalName
    } else {
        finalName += ext;
    }

    const { error } = await supabase
      .from('negocios_documentos')
      .update({ nombre_archivo: finalName })
      .eq('id', id);

    if (!error) {
      setDocs(prev => prev.map(d => d.id === id ? { ...d, nombre_archivo: finalName } : d));
    } else {
      alert("Error al renombrar el archivo.");
    }
    setEditingDocId(null);
  };

  const handleDeleteDoc = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("¿Estás seguro de que quieres eliminar este documento?")) return;
    
    const docToDelete = docs.find(d => d.id === id);
    const { error } = await supabase.from('negocios_documentos').delete().eq('id', id);
    if (error) {
      alert("Error al eliminar el documento.");
      console.error(error);
      return;
    }
    
    setDocs(prev => prev.filter(d => d.id !== id));
    if (docToDelete) {
      logAuditoria(`Documento eliminado: ${docToDelete.nombre_archivo}`);
    }
  };

  const handleChatFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setSending(true);
    
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${negocio.pedido_venta}/${Date.now()}_${cleanFileName}`;

    const { error: uploadError } = await supabase
      .storage
      .from('documentos')
      .upload(storagePath, file);

    if (uploadError) {
      alert("Error subiendo el archivo adjunto.");
      setSending(false);
      return;
    }

    const { data: publicUrlData } = supabase
      .storage
      .from('documentos')
      .getPublicUrl(storagePath);

    const kbSize = Math.round(file.size / 1024);
    
    const { data: docData } = await supabase
      .from('negocios_documentos')
      .insert([{
        pedido_venta: negocio.pedido_venta,
        nombre_archivo: file.name,
        tamano_kb: kbSize,
        url: publicUrlData.publicUrl
      }])
      .select()
      .single();

    if (docData) {
      setDocs(prev => [docData, ...prev]);
    }

    const nombreExtraido = userEmail.split("@")[0] || "Usuario";
    const comentarioEspecial = `[ARCHIVO]|${file.name}|${publicUrlData.publicUrl}|${kbSize}`;
    
    const { data: chatData } = await supabase
      .from("negocios_comentarios")
      .insert([{
        pedido_venta: negocio.pedido_venta,
        usuario_nombre: nombreExtraido,
        usuario_email: userEmail,
        comentario: comentarioEspecial
      }])
      .select()
      .single();

    if (chatData) {
      setComentarios(prev => [...prev, chatData]);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }

    setSending(false);
    if (chatFileInputRef.current) chatFileInputRef.current.value = "";
  };

  const getDocIcon = (nombre: string) => {
    const ext = nombre.split(".").pop()?.toLowerCase();
    if (ext === 'pdf') return <File className="h-5 w-5" />;
    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext || '')) return <ImageIcon className="h-5 w-5" />;
    return <File className="h-5 w-5" />;
  };

  // Cálculos derivados para Papeles
  const mesUtm = mesFacturaA;
  const valorUtmMes = utmData[mesUtm]?.utm || 0;
  const valorVehiculoCalculado = valoresNegocio.precio_lista - valoresNegocio.bono_marca;
  const netoVehiculoCalculado = Math.round(valorVehiculoCalculado / 1.19);

  let tramoCalculado = 0;
  if (valorUtmMes > 0 && valorVehiculoCalculado > 0) {
    const d5 = valorVehiculoCalculado;
    const d6 = valorUtmMes;
    if (d5 >= d6 * 1.19 && d5 <= d6 * 60 * 1.19) tramoCalculado = 1;
    else if (d5 > d6 * 60 * 1.19 && d5 <= d6 * 120 * 1.19) tramoCalculado = 2;
    else if (d5 > d6 * 120 * 1.19 && d5 <= d6 * 250 * 1.19) tramoCalculado = 3;
    else if (d5 > d6 * 250 * 1.19 && d5 <= d6 * 400 * 1.19) tramoCalculado = 4;
    else if (d5 > d6 * 400 * 1.19) tramoCalculado = 5;
  }
  const totalPapeles = inscripcion + permisoCirculacion + seguroObligatorio + impuestoVerde;

  return (
    <div className="w-full bg-white flex flex-col shadow-none rounded-2xl overflow-hidden border border-slate-200" style={{ height: 'calc(100vh - 120px)', minHeight: '600px', maxHeight: 'calc(100vh - 40px)' }}>
      
      {/* HEADER SUPERIOR */}
      <div className="flex items-center justify-between border-b border-blue-800 bg-blue-800 px-6 py-4 shadow-sm">
        <div className="flex flex-col">
          <div className="flex items-center gap-3 mb-1">
            <button 
              onClick={() => router.push("/negocios")}
              className="flex items-center text-blue-200 hover:text-white transition-colors text-sm font-medium pr-2 border-r border-blue-700/50"
            >
              <ChevronLeft className="w-5 h-5 mr-1" />
              Volver
            </button>
            <span className="inline-flex items-center rounded bg-slate-500 px-3 py-1 text-sm font-bold text-white shadow-sm border border-slate-400/50">
              INTERNO: {negocio.interno}
            </span>
            <span className="inline-flex items-center rounded bg-slate-500 px-3 py-1 text-sm font-bold text-white shadow-sm border border-slate-400/50">
              PV: {negocio.pedido_venta}
            </span>
            {(() => {
              let badgeColors = 'bg-slate-100 text-slate-800 border-slate-300';
              let displayText = negocio.estado ? negocio.estado.replace(/_/g, ' ') : '';
              
              const estadoStr = negocio.estado as string;
              if (estadoStr === 'PARA_REVISION' || estadoStr === 'PARA_REVISIÓN') {
                badgeColors = 'bg-yellow-100 text-yellow-800 border-yellow-300';
                displayText = 'Pendiente Revisión';
              } else if (estadoStr === 'REVISADO_EN_ESPERA') {
                badgeColors = 'bg-orange-500 text-white border-orange-400';
                displayText = 'NEGOCIO CON OBSERVACIÓN';
              } else if (estadoStr === 'APROBADO' || estadoStr === 'FACTURADO' || estadoStr === 'REVISADO_OK' || estadoStr === 'REVISADO OK') {
                badgeColors = 'bg-emerald-100 text-emerald-800 border-emerald-300';
              } else if (estadoStr === 'RECHAZADO') {
                badgeColors = 'bg-red-100 text-red-800 border-red-300';
              }
              return (
                <span className={`inline-flex items-center rounded px-3 py-1 text-sm font-bold shadow-sm border ${badgeColors}`}>
                  Estado: {displayText}
                </span>
              );
            })()}
            {userRole === 'ADMIN' && (
              <button
                onClick={handleDeleteNegocio}
                className="ml-2 flex items-center justify-center gap-1.5 py-1 px-3 bg-red-600 text-white font-bold text-sm rounded shadow-sm hover:bg-red-700 transition-colors border border-red-500"
                title="Eliminar Negocio"
              >
                <Trash2 className="w-4 h-4" /> Eliminar
              </button>
            )}
            {['ADMINISTRATIVO', 'ADMIN'].includes(userRole) && !(negocio as any).primer_admin_email && (
              <button
                onClick={handleInicioRevision}
                disabled={isStartingRevision}
                className="ml-2 flex items-center justify-center gap-1.5 py-1 px-3 bg-amber-500 text-white font-bold text-sm rounded shadow-sm hover:bg-amber-600 transition-colors border border-amber-500 disabled:opacity-70 disabled:cursor-not-allowed"
                title="Iniciar Revisión de Carpeta"
              >
                {isStartingRevision ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Inicio Revisión
              </button>
            )}
          </div>
          {negocio.nombre_apellido?.trim() !== 'S/N' && (
            <h2 className="text-xl font-bold text-white tracking-tight mt-1">{negocio.nombre_apellido}</h2>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="text-blue-200 text-sm font-medium flex items-center gap-1.5">
            {negocio.vendedor_nombre && (
              <span>
                {negocio.vendedor_nombre.split('@')[0]}
              </span>
            )}
            <Calendar className="w-4 h-4 ml-1" />
            <span>
              Creado el {format(new Date(negocio.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
            </span>
          </div>
          {(negocio as any).primer_admin_email && (
            <div className="text-white text-base font-bold flex items-center gap-1.5 bg-blue-900/60 px-3 py-1.5 rounded-lg shadow-sm border border-blue-400/30" title="Primer Administrativo en revisar la carpeta">
              <Eye className="w-5 h-5" />
              <span>1ra Revisión: {(negocio as any).primer_admin_email.split('@')[0]} • {format(new Date((negocio as any).primer_admin_fecha), "dd/MM HH:mm")}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Lado izquierdo: Tabs de chat y archivos */}
        <div className={`transition-all duration-300 ease-in-out border-r border-slate-200 flex flex-col bg-[#F0F2F5] relative shrink-0 ${isPanelCollapsed ? 'w-12 items-center' : 'w-full max-w-lg'}`}>
          
          <div className={`flex border-b border-slate-200 bg-white shadow-[0_2px_4px_-2px_rgba(0,0,0,0.05)] z-10 shrink-0 ${isPanelCollapsed ? 'flex-col h-full items-center py-4 w-full' : ''}`}>
            {isPanelCollapsed ? (
              <button 
                onClick={() => setIsPanelCollapsed(false)}
                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Expandir panel principal"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            ) : (
              <>
                <button 
                  onClick={() => setIsPanelCollapsed(true)}
                  className="px-4 text-slate-400 hover:text-blue-600 hover:bg-slate-50 transition-colors border-r border-slate-100 flex items-center justify-center shrink-0"
                  title="Ocultar panel"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex flex-1">
                  <div className="flex-1 py-3 text-sm font-bold text-center flex items-center justify-center border-b-2 transition-colors text-blue-700 bg-white border-blue-600">
                    Chat del Negocio
                  </div>
                </div>
              </>
            )}
          </div>

          <div className={`flex-1 overflow-y-auto ${isPanelCollapsed ? 'hidden' : 'block'}`}>
            <div className="flex flex-col min-h-full justify-end">
                <>
                  <div className="flex-1 p-4 space-y-4">
                    {loading ? (
                    <div className="flex justify-center py-6 text-slate-400">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                    </div>
                  ) : comentarios.filter(msg => !msg.comentario.startsWith("[AUDITORIA]|")).length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full pt-10 text-slate-400 opacity-60">
                      <MessageSquare className="w-12 h-12 mb-3 text-slate-300" />
                      <p className="text-sm font-medium">Inicia la conversación en esta carpeta</p>
                    </div>
                  ) : (
                    comentarios
                      .filter(msg => !msg.comentario.startsWith("[AUDITORIA]|"))
                      .map((msg) => {
                        const esMio = msg.usuario_email === userEmail;
                        const esArchivo = msg.comentario.startsWith("[ARCHIVO]|");
                        const esAuditoria = msg.comentario.startsWith("[AUDITORIA]|");
                        
                        let contentNode;
                        if (esArchivo) {
                          const [, nombreBase, docUrl, tamanoStr] = msg.comentario.split("|");
                          contentNode = (
                            <div className="flex flex-col gap-1.5 mt-1">
                              <div className={`flex items-center gap-3 p-3 rounded-xl mb-1 cursor-pointer transition-colors ${esMio ? 'bg-blue-700 hover:bg-blue-800' : 'bg-slate-50 hover:bg-slate-100 border border-slate-200'}`} onClick={() => window.open(docUrl, "_blank")}>
                                <div className={`p-2 rounded-lg ${esMio ? 'bg-white/20 text-white' : 'bg-white text-blue-600 shadow-sm'}`}>
                                   <Paperclip className="w-5 h-5" />
                                </div>
                                <div className="overflow-hidden flex-1 pr-2">
                                  <p className={`text-sm font-bold truncate max-w-[200px] ${esMio ? 'text-white' : 'text-slate-700'}`}>{nombreBase}</p>
                                  <p className={`text-xs ${esMio ? 'text-blue-200' : 'text-slate-500'}`}>{tamanoStr} KB</p>
                                </div>
                                <Download className={`w-4 h-4 shrink-0 ${esMio ? 'text-blue-200' : 'text-slate-400'}`} />
                              </div>
                            </div>
                          );
                        } else {
                          contentNode = msg.comentario;
                        }

                        return (
                          <div key={msg.id} className={`flex gap-3 ${esMio ? "justify-end" : "justify-start"}`}>
                            <div className={`flex flex-col max-w-[85%] ${esMio ? "items-end" : "items-start"}`}>
                              <div className={`text-xs font-medium text-slate-500 mb-1 px-1`}>
                                {msg.usuario_nombre} • {format(new Date(msg.created_at), "HH:mm", { locale: es })}
                              </div>
                              <div className={`px-4 py-3 rounded-2xl text-[14px] ${
                                esMio 
                                  ? "bg-blue-600 text-white rounded-br-sm shadow-sm" 
                                  : "bg-white text-slate-800 border border-slate-100 shadow-sm rounded-bl-sm"
                              }`}>
                                {contentNode}
                              </div>
                            </div>
                          </div>
                        );
                      })
                  )}
                  <div ref={chatEndRef} />
                </div>
                
                <div className="p-4 bg-white border-t border-slate-200 shrink-0 shadow-[0_-2px_4px_rgba(0,0,0,0.02)]">
                  <form onSubmit={handleSendComentario} className="flex gap-2 items-center">
                    <input 
                      type="file" 
                      ref={chatFileInputRef} 
                      onChange={handleChatFileUpload} 
                      className="hidden" 
                      accept=".pdf,.png,.jpg,.jpeg"
                    />
                    <button 
                      type="button"
                      onClick={() => chatFileInputRef.current?.click()}
                      disabled={sending}
                      className="flex shrink-0 items-center justify-center rounded-full text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors active:scale-95 disabled:opacity-50 p-2.5"
                      title="Adjuntar archivo al área de actividad"
                    >
                      <Paperclip className="h-6 w-6" />
                    </button>

                    <input 
                      type="text" 
                      value={nuevoComentario}
                      onChange={(e) => setNuevoComentario(e.target.value)}
                      placeholder="Escribe un mensaje en la carpeta del negocio..." 
                      className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-5 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-transparent transition-all"
                    />
                    <button 
                      type="submit"
                      disabled={sending || !nuevoComentario.trim()}
                      className="flex shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-50 disabled:bg-slate-100 disabled:text-slate-400 font-bold p-3 shadow-md disabled:shadow-none"
                    >
                      <Send className="h-5 w-5" />
                    </button>
                  </form>
                </div>
                </>
            </div>
          </div>
        </div>
        
        {/* Lado derecho: Placeholder para más acciones (notas internas, checklist, info estructurada, etc) */}
        <div className="hidden md:flex flex-1 bg-slate-100 relative flex-col overflow-hidden min-h-0">
          
          {/* TAB BAR SUPERIOR DERECHA */}
          <div className="flex border-b border-slate-200 bg-white shadow-[0_2px_4px_-2px_rgba(0,0,0,0.05)] w-full shrink-0 px-8 pt-4 z-10 relative">
             <button onClick={() => setRightActiveTab('requeridos')} className={`mr-8 pb-3 text-sm font-bold border-b-[3px] transition-all ${rightActiveTab === 'requeridos' ? 'border-blue-700 text-blue-800' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>
                Datos del Negocio
             </button>
             <button onClick={() => setRightActiveTab('cliente')} className={`mr-8 pb-3 text-sm font-bold border-b-[3px] transition-all ${rightActiveTab === 'cliente' ? 'border-blue-700 text-blue-800' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>
                Datos del Cliente
             </button>
             <button onClick={() => setRightActiveTab('archivos')} className={`mr-8 pb-3 text-sm font-bold border-b-[3px] transition-all ${rightActiveTab === 'archivos' ? 'border-blue-700 text-blue-800' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>
                Documentos Adjuntados
             </button>
             <button onClick={() => setRightActiveTab('firmados')} className={`mr-8 pb-3 text-sm font-bold border-b-[3px] transition-all ${rightActiveTab === 'firmados' ? 'border-blue-700 text-blue-800' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>
                Documentos Firmados
             </button>
             <button onClick={() => setRightActiveTab('historial')} className={`mr-8 pb-3 text-sm font-bold border-b-[3px] transition-all ${rightActiveTab === 'historial' ? 'border-blue-700 text-blue-800' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>
                Historial Negocio
             </button>
          </div>
          
          {/* Botón flotante para reabrir el chat cuando está colapsado */}
          {isPanelCollapsed && (
            <button 
              onClick={() => setIsPanelCollapsed(false)}
              className="absolute left-0 top-1/2 -translate-y-1/2 bg-blue-600 text-white p-3 rounded-r-xl shadow-lg hover:bg-blue-700 hover:pr-4 transition-all z-50 flex items-center gap-2 group border border-l-0 border-blue-500"
              title="Abrir Chat del Pedido Venta"
            >
              <MessageSquare className="w-6 h-6 group-hover:scale-110 transition-transform" />
              <span className="text-sm font-bold opacity-0 w-0 group-hover:opacity-100 group-hover:w-auto overflow-hidden transition-all whitespace-nowrap">
                Abrir Chat
              </span>
            </button>
          )}

          <div className="w-full flex flex-col p-6 overflow-y-scroll overflow-x-hidden flex-1 scrollbar-custom min-h-0">
            {rightActiveTab === 'historial' ? (
              <div className="h-full flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 p-6 overflow-y-auto">
                <div className="space-y-6 mb-10 pb-10 shrink-0">
                  <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Historial del Negocio</h4>
                  <div className="flex flex-col space-y-4 mt-4">
                    {loading ? (
                      <div className="flex justify-center py-6 text-slate-400">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                      </div>
                    ) : comentarios.filter(msg => msg.comentario.startsWith("[AUDITORIA]|")).length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full pt-10 text-slate-400 opacity-60">
                        <FileSignature className="w-12 h-12 mb-3 text-slate-300" />
                        <p className="text-sm font-medium">No hay registros de historial aún</p>
                      </div>
                    ) : (
                      comentarios
                        .filter(msg => msg.comentario.startsWith("[AUDITORIA]|"))
                        .map((msg) => {
                          const details = msg.comentario.replace("[AUDITORIA]|", "");
                          return (
                            <div key={msg.id} className="flex gap-3 justify-start">
                              <div className="flex flex-col items-start w-full">
                                <div className="text-xs font-medium text-slate-500 mb-1 px-1">
                                  {msg.usuario_nombre} • {format(new Date(msg.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                                </div>
                                <div className="px-4 py-3 rounded-2xl text-[13px] bg-slate-100 text-slate-700 border border-slate-200 shadow-sm break-words whitespace-pre-wrap w-full">
                                  {details}
                                </div>
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              </div>
            ) : rightActiveTab === 'requeridos' ? (
              <>
                <div className="mb-0">
                  <h3 className="text-2xl font-bold text-slate-800 mb-6">Pedido de Venta {negocio.pedido_venta}</h3>
                  
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8">
                    <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
                      <div className="flex items-center flex-1">
                        <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Datos del Vehículo</h4>
                      </div>
                      <div className="flex items-center justify-center">
                        <CvSecBadge campo="vehiculo" valor={ctrlVentas.vehiculo} />
                      </div>
                      <div className="flex-1" />
                    </div>
                    <div className="p-5 flex flex-wrap gap-x-6 gap-y-6">
                      <div className="flex-1 min-w-[100px] max-w-xs">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Interno</p>
                        <p className="text-sm font-semibold text-slate-800 break-words">{negocio.interno || "S/A"}</p>
                      </div>
                      <div className="flex-1 min-w-[150px] max-w-xs">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">N° de Chasis</p>
                        <p className="text-sm font-semibold text-slate-800 break-words">{(negocio as any).chasis || (negocio as any).numero_chasis || "S/A"}</p>
                      </div>
                      <div className="flex-1 min-w-[120px] max-w-xs">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Marca</p>
                        <p className="text-sm font-semibold text-slate-800 break-words">{negocio.marca || "S/A"}</p>
                      </div>
                      <div className="flex-1 min-w-[120px] max-w-xs">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Año Facturación</p>
                        <p className="text-sm font-semibold text-slate-800 break-words">{negocio.ano || (negocio as any).ano_facturacion || (negocio as any).anio || "S/A"}</p>
                      </div>
                      
                      <div className="w-full h-px bg-slate-50 border-0 m-0 shrink-0"></div>

                      <div className="flex-1 min-w-[140px] max-w-xs">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Cód. Mod. Vehículo</p>
                        <p className="text-sm font-semibold text-slate-800 break-words">{(negocio as any).codigo_modelo || (negocio as any).cod_modelo_vehiculo || "S/A"}</p>
                      </div>
                      <div className="flex-[2] min-w-[200px] max-w-md">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Descripción Modelo</p>
                        <p className="text-sm font-semibold text-slate-800 break-words">{negocio.modelo || (negocio as any).descripcion_modelo || "S/A"}</p>
                      </div>
                      <div className="flex-1 min-w-[120px] max-w-xs">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Color</p>
                        <p className="text-sm font-semibold text-slate-800 break-words">{negocio.color || "S/A"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8">
                    <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
                      <div className="flex items-center flex-1">
                        <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Observaciones de Venta</h4>
                      </div>
                      <div className="flex items-center justify-center">
                        <CvSecBadge campo="observaciones" valor={ctrlVentas.observaciones} />
                      </div>
                      <div className="flex-1" />
                    </div>
                    <div className="p-5 flex flex-wrap gap-x-6 gap-y-6">
                      <div className="flex-1 min-w-[150px] max-w-xs">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tipo Compra</p>
                        <p className="text-sm font-semibold text-slate-800 break-words">{negocio.tipo_compra || "S/A"}</p>
                      </div>
                      <div className="flex-1 min-w-[150px] max-w-xs">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Saldo Inicial</p>
                        <p className="text-sm font-semibold text-slate-800 break-words">{negocio.saldo || "S/A"}</p>
                      </div>
                      <div className="flex-1 min-w-[150px] max-w-xs">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Prepago Vigente</p>
                        <div className="text-sm font-semibold text-slate-800 break-words">
                          {(negocio as any).prepago_vigente ? (
                            <span className="flex items-center gap-1 text-emerald-600 font-bold"><Check className="w-4 h-4" /> SÍ</span>
                          ) : (
                            <span className="flex items-center gap-1 text-red-500 font-bold"><X className="w-4 h-4" /> NO</span>
                          )}
                        </div>
                      </div>

                      <div className="w-full h-px bg-slate-50 border-0 m-0 shrink-0"></div>

                      <div className="flex-1 min-w-[180px] max-w-xs">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Retoma Usado</p>
                        <p className="text-sm font-semibold text-slate-800 break-words">
                          {(negocio as any).retoma_usado ? (
                            <span className="flex items-center gap-1 text-emerald-600 font-bold"><Check className="w-4 h-4" /> SÍ</span>
                          ) : (
                            <span className="flex items-center gap-1 text-red-500 font-bold"><X className="w-4 h-4" /> NO</span>
                          )}
                        </p>
                      </div>
                      <div className="flex-1 min-w-[180px] max-w-xs">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Mantención Prepagada</p>
                        <p className="text-sm font-semibold text-slate-800 break-words">
                          {(negocio as any).mantencion_prepagada ? (
                            <span className="flex items-center gap-1 text-emerald-600 font-bold"><Check className="w-4 h-4" /> SÍ</span>
                          ) : (
                            <span className="flex items-center gap-1 text-red-500 font-bold"><X className="w-4 h-4" /> NO</span>
                          )}
                        </p>
                      </div>
                      <div className="flex-1 min-w-[180px] max-w-xs">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Fecha Prepago</p>
                        <div className="text-sm font-semibold text-slate-800 break-words">
                          {((negocio as any).prepago_vigente && (negocio as any).fecha_prepago) ? (
                            <span className="text-sm text-slate-800">{format(new Date(`${(negocio as any).fecha_prepago}T12:00:00`), "dd MMM yyyy", { locale: es })}</span>
                          ) : (
                            <span className="text-slate-400 italic">N/A</span>
                          )}
                        </div>
                      </div>

                      <div className="w-full h-px bg-slate-50 border-0 m-0 shrink-0"></div>

                      <div className="flex-1 min-w-[180px] max-w-xs">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Aporte Promoción Marca</p>
                        <p className="text-sm font-semibold text-slate-800 break-words">
                          {(negocio as any).aporte_promocion_marca ? (
                            <span className="flex items-center gap-1 text-emerald-600 font-bold"><Check className="w-4 h-4" /> SÍ</span>
                          ) : (
                            <span className="flex items-center gap-1 text-red-500 font-bold"><X className="w-4 h-4" /> NO</span>
                          )}
                        </p>
                      </div>
                      <div className="flex-1 min-w-[180px] max-w-xs">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Accesorios Instalados</p>
                        <p className="text-sm font-semibold text-slate-800 break-words">
                          {(negocio as any).accesorios_instalados ? (
                            <span className="flex items-center gap-1 text-emerald-600 font-bold"><Check className="w-4 h-4" /> SÍ</span>
                          ) : (
                            <span className="flex items-center gap-1 text-red-500 font-bold"><X className="w-4 h-4" /> NO</span>
                          )}
                        </p>
                      </div>
                      <div className="flex-1 min-w-[150px] max-w-xs">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Gestión de Accesorios</p>
                        <p className="text-sm font-semibold text-slate-800 break-words">{(negocio as any).gestion_accesorios || "S/A"}</p>
                      </div>
                      
                      <div className="w-full h-px bg-slate-50 border-0 m-0 shrink-0"></div>
                      
                      <div className="w-full">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Observación Inicial</p>
                        <p className="text-sm font-semibold text-slate-800 whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-100 mt-1">{(negocio as any).observacion_inicial || "Sin observación inicial"}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* SECCIÓN DE CUADRATURA */}
                  <CuadraturaSection negocio={negocio} badgeSlot={<CvSecBadge campo="cuadratura" valor={ctrlVentas.cuadratura} />} />
                </div>
              </>
            ) : rightActiveTab === 'cliente' ? (
              <>
                <div className="mb-0">
                  <h3 className="text-2xl font-bold text-slate-800 mb-6">Pedido de Venta {negocio.pedido_venta}</h3>
                
                {/* NUEVA SECCIÓN: DATOS DEL CLIENTE */}
                {(() => {
                  const notaVentaDoc = docs.find(d => d.nombre_archivo.toLowerCase().includes('nota') && d.nombre_archivo.toLowerCase().includes('venta'));
                  const cli = extractedCliente || (negocio as any).cliente || negocio || {};
                  const missingDoc = !notaVentaDoc;

                  return (
                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm mb-8">
                        <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-2 group transition-colors">
                          {/* Izquierda: Título + ambos botones de acción */}
                          <div className="flex items-center gap-2 flex-1">
                            <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mr-2">Datos del Cliente</h3>
                            {isEditingCliente ? (
                              <>
                                <button
                                  onClick={handleSaveManualCliente}
                                  disabled={isExtractingCliente}
                                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs border border-transparent rounded-md shadow-sm transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                                >
                                  {isExtractingCliente ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Guardar Cambios"}
                                </button>
                                <button
                                  onClick={() => setIsEditingCliente(false)}
                                  disabled={isExtractingCliente}
                                  className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-600 font-medium text-xs border border-slate-200 rounded-md shadow-sm transition-all"
                                >
                                  Cancelar
                                </button>
                              </>
                            ) : (
                              <>
                                {!missingDoc && (
                                  <button
                                    onClick={extractDocumentData}
                                    disabled={isExtractingCliente}
                                    className="px-3 py-1 bg-white hover:bg-slate-100 text-indigo-600 font-medium text-xs border border-indigo-200 hover:border-indigo-300 rounded-md shadow-sm transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                                  >
                                    {isExtractingCliente ? (
                                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Escaneando...</>
                                    ) : (
                                      <><Eye className="w-3.5 h-3.5" /> Extraer desde Nota Venta</>
                                    )}
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    setManualCliente({
                                      nombre_apellido: cli.nombre_apellido || (negocio as any).nombre_apellido,
                                      rut: cli.rut || (negocio as any).rut,
                                      direccion_cliente: (cli as any).direccion_cliente || (negocio as any).direccion_cliente,
                                      comuna_cliente: (cli as any).comuna_cliente || (negocio as any).comuna_cliente,
                                      region_cliente: (cli as any).region_cliente || (negocio as any).region_cliente,
                                      mail_cliente: (cli as any).mail_cliente || (negocio as any).mail_cliente,
                                      movil_cliente: (cli as any).movil_cliente || (negocio as any).movil_cliente,
                                    });
                                    setIsEditingCliente(true);
                                  }}
                                  className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-600 font-medium text-xs border border-slate-200 hover:border-slate-300 rounded-md shadow-sm transition-all flex items-center justify-center gap-1.5 active:scale-95"
                                >
                                  Editar Manual
                                </button>
                              </>
                            )}
                          </div>
                          {/* Centro: Badge OK/Rechazado */}
                          <div className="flex items-center justify-center">
                            <CvSecBadge campo="cliente" valor={ctrlVentas.cliente} />
                          </div>
                          {/* Derecha: espaciador simétrico */}
                          <div className="flex-1" />
                        </div>
                      <div className="block w-full p-4 md:p-6 bg-white min-h-[100px]">
                        {missingDoc && (
                          <div className="mb-6 bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg flex items-start gap-4">
                            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                            <div>
                               <p className="text-sm font-bold text-amber-800">Nota de Venta No Adjuntada</p>
                               <p className="text-sm text-amber-700 mt-1">Sube el documento de Nota de Venta en la pestaña Documentos para poder extraer los datos automáticamente.</p>
                            </div>
                          </div>
                        )}
                        <div className="flex flex-col gap-6 w-full">
                            {/* Fila 1 */}
                            <div className="flex flex-col md:flex-row gap-6 w-full">
                              <div className="flex-1">
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nombres y Apellidos</p>
                                {isEditingCliente ? 
                                  <input type="text" className="w-full text-sm border-b border-slate-300 focus:border-indigo-500 outline-none pb-1 bg-slate-50 px-1 rounded-t-sm" value={manualCliente.nombre_apellido || ""} onChange={e => setManualCliente({...manualCliente, nombre_apellido: e.target.value})} /> :
                                  <p className="text-sm font-semibold text-slate-800 break-words">{cli.nombre_apellido || (negocio as any).nombre_apellido || "S/A"}</p>
                                }
                              </div>
                              <div className="flex-1">
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">RUT</p>
                                {isEditingCliente ? 
                                  <input type="text" className="w-full text-sm border-b border-slate-300 focus:border-indigo-500 outline-none pb-1 bg-slate-50 px-1 rounded-t-sm" value={manualCliente.rut || ""} onChange={e => setManualCliente({...manualCliente, rut: e.target.value})} /> :
                                  <p className="text-sm font-semibold text-slate-800 break-words">{cli.rut || (negocio as any).rut || "S/A"}</p>
                                }
                              </div>
                            </div>

                            <div className="w-full h-px bg-slate-100 my-1"></div>

                            {/* Fila 2 */}
                            <div className="flex flex-col md:flex-row gap-6 w-full">
                              <div className="flex-1 md:flex-[2]">
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Dirección</p>
                                {isEditingCliente ? 
                                  <input type="text" className="w-full text-sm border-b border-slate-300 focus:border-indigo-500 outline-none pb-1 bg-slate-50 px-1 rounded-t-sm" value={manualCliente.direccion_cliente || ""} onChange={e => setManualCliente({...manualCliente, direccion_cliente: e.target.value})} /> :
                                  <p className="text-sm font-semibold text-slate-800 break-words">{(cli as any).direccion_cliente || (negocio as any).direccion_cliente || "S/A"}</p>
                                }
                              </div>
                              <div className="flex-1">
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Comuna</p>
                                {isEditingCliente ? 
                                  <select 
                                    className="w-full text-sm border-b border-slate-300 focus:border-indigo-500 outline-none pb-1 bg-slate-50 px-1 rounded-t-sm" 
                                    value={manualCliente.comuna_cliente || ""} 
                                    onChange={e => {
                                      const newComuna = e.target.value;
                                      const newRegion = obtenerRegionPorComuna(newComuna) || manualCliente.region_cliente;
                                      setManualCliente({...manualCliente, comuna_cliente: newComuna, region_cliente: newRegion});
                                    }}
                                  >
                                    <option value="">Seleccione una comuna...</option>
                                    {todasLasComunas.map(c => (
                                      <option key={c} value={c}>{c}</option>
                                    ))}
                                  </select> :
                                  <p className="text-sm font-semibold text-slate-800 break-words">{(cli as any).comuna_cliente || (negocio as any).comuna_cliente || "S/A"}</p>
                                }
                              </div>
                              <div className="flex-1">
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Región</p>
                                {isEditingCliente ? 
                                  <select 
                                    className="w-full text-sm border-b border-slate-300 focus:border-indigo-500 outline-none pb-1 bg-slate-50 px-1 rounded-t-sm" 
                                    value={manualCliente.region_cliente || ""} 
                                    onChange={e => setManualCliente({...manualCliente, region_cliente: e.target.value})}
                                  >
                                    <option value="">Seleccione una región...</option>
                                    {regionesYcomunas.map(r => (
                                      <option key={r.region} value={r.region}>{r.region}</option>
                                    ))}
                                  </select> :
                                  <p className="text-sm font-semibold text-slate-800 break-words">{(cli as any).region_cliente || (negocio as any).region_cliente || "S/A"}</p>
                                }
                              </div>
                            </div>

                            <div className="w-full h-px bg-slate-100 my-1"></div>

                            {/* Fila 3 */}
                            <div className="flex flex-col md:flex-row gap-6 w-full">
                              <div className="flex-[2]">
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Mail</p>
                                {isEditingCliente ? 
                                  <input type="text" className="w-full text-sm border-b border-slate-300 focus:border-indigo-500 outline-none pb-1 bg-slate-50 px-1 rounded-t-sm" value={manualCliente.mail_cliente || ""} onChange={e => setManualCliente({...manualCliente, mail_cliente: e.target.value})} /> :
                                  <p className="text-sm font-semibold text-slate-800 break-all">{(cli as any).mail_cliente || (negocio as any).mail_cliente || "S/A"}</p>
                                }
                              </div>
                              <div className="flex-[2]">
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Móvil</p>
                                {isEditingCliente ? 
                                  <input type="text" className="w-full text-sm border-b border-slate-300 focus:border-indigo-500 outline-none pb-1 bg-slate-50 px-1 rounded-t-sm" value={manualCliente.movil_cliente || ""} onChange={e => setManualCliente({...manualCliente, movil_cliente: e.target.value})} /> :
                                  <p className="text-sm font-semibold text-slate-800 break-words">{(cli as any).movil_cliente || (negocio as any).movil_cliente || "S/A"}</p>
                                }
                              </div>
                            </div>

                            <div className="w-full h-px bg-slate-100 my-1"></div>

                            {/* Fila 4: Extra data section. Always editable */}
                            <div className="flex flex-col gap-6 w-full my-4">
                              <div className="flex flex-col md:flex-row gap-6 w-full">
                                <div className="flex-1">
                                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Contribuyente Electrónico</p>
                                  <select 
                                    className="w-full text-sm border-b border-slate-300 focus:border-indigo-500 outline-none pb-1 bg-transparent px-1" 
                                    value={extraData.contribuyente_electronico} 
                                    onChange={e => {
                                      handleExtraDataChange("contribuyente_electronico", e.target.value);
                                      handleExtraDataSave("contribuyente_electronico", e.target.value);
                                    }}
                                  >
                                    <option value="">Seleccione...</option>
                                    <option value="SI">SI</option>
                                    <option value="NO">NO</option>
                                  </select>
                                  <div className="mt-1 flex items-center justify-start">
                                    <a href="https://www2.sii.cl/stc/noauthz" target="_blank" rel="noreferrer" className="text-[10px] text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1">
                                      <ExternalLink className="w-3 h-3" /> Consultar en SII.cl
                                    </a>
                                  </div>
                                </div>
                              <div className="flex-1">
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tipo de Negocio</p>
                                <select 
                                  className="w-full text-sm border-b border-slate-300 focus:border-indigo-500 outline-none pb-1 bg-transparent px-1" 
                                  value={extraData.tipo_negocio} 
                                  onChange={e => {
                                    handleExtraDataChange("tipo_negocio", e.target.value);
                                    handleExtraDataSave("tipo_negocio", e.target.value);
                                  }}
                                >
                                  <option value="">Seleccione...</option>
                                  <option value="NEGOCIO VENTA DIRECTA">NEGOCIO VENTA DIRECTA</option>
                                  <option value="NEGOCIO COMPRA PARA">NEGOCIO COMPRA PARA</option>
                                  <option value="CLIENTE EMPRESA">CLIENTE EMPRESA</option>
                                </select>
                              </div>
                            </div>
                            </div>

                            <div className="w-full h-px bg-slate-100 my-1"></div>

                            {/* Fila 5 */}
                            <div className="flex flex-col md:flex-row gap-6 w-full">
                              <div className="flex-1 md:flex-[2]">
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Estado Civil</p>
                                <select 
                                  className="w-full text-sm border-b border-slate-300 focus:border-indigo-500 outline-none pb-1 bg-transparent px-1" 
                                  value={extraData.estado_civil} 
                                  onChange={e => {
                                    handleExtraDataChange("estado_civil", e.target.value);
                                    handleExtraDataSave("estado_civil", e.target.value);
                                  }}
                                >
                                  <option value="">Seleccione...</option>
                                  <option value="SOLTERO/A">SOLTERO/A</option>
                                  <option value="CASADO/A">CASADO/A</option>
                                  <option value="AUC">AUC</option>
                                  <option value="CONVIVIENTE CIVIL">CONVIVIENTE CIVIL</option>
                                  <option value="VIUDO/A">VIUDO/A</option>
                                  <option value="DIVORCIADO/A">DIVORCIADO/A</option>
                                  <option value="CLIENTE EMPRESA">CLIENTE EMPRESA</option>
                                </select>
                              </div>
                              <div className="flex-1">
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Comunidad de Bienes</p>
                                <select 
                                  className="w-full text-sm border-b border-slate-300 focus:border-indigo-500 outline-none pb-1 bg-transparent px-1" 
                                  value={extraData.comunidad_bienes} 
                                  onChange={e => {
                                    handleExtraDataChange("comunidad_bienes", e.target.value);
                                    handleExtraDataSave("comunidad_bienes", e.target.value);
                                  }}
                                >
                                  <option value="">Seleccione...</option>
                                  <option value="SI">SI</option>
                                  <option value="NO">NO</option>
                                </select>
                              </div>
                            </div>

                            <div className="w-full h-px bg-slate-100 my-1"></div>

                            {/* Fila 6 */}
                            <div className="flex flex-col md:flex-row gap-6 w-full">
                              <div className="flex-1">
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nacionalidad</p>
                                <input 
                                  type="text" 
                                  className="w-full text-sm border-b border-slate-300 focus:border-indigo-500 outline-none pb-1 bg-transparent px-1" 
                                  value={extraData.nacionalidad} 
                                  onChange={e => handleExtraDataChange("nacionalidad", e.target.value)}
                                  onBlur={e => handleExtraDataSave("nacionalidad", e.target.value)}
                                />
                              </div>
                              <div className="flex-1">
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Profesión y/o Giro Empresa</p>
                                <input 
                                  type="text" 
                                  className="w-full text-sm border-b border-slate-300 focus:border-indigo-500 outline-none pb-1 bg-transparent px-1" 
                                  value={extraData.profesion_giro} 
                                  onChange={e => handleExtraDataChange("profesion_giro", e.target.value)}
                                  onBlur={e => handleExtraDataSave("profesion_giro", e.target.value)}
                                />
                              </div>
                            </div>
                          </div>
                      </div>
                    </div>
                  );
                })()}
                {/* NUEVA TARJETA: FIRMA DIGITAL CLIENTE */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm mb-8">
                  <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-2 group transition-colors">
                    {/* Izquierda: título */}
                    <div className="flex items-center flex-1">
                      <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">Carnet Identidad / Firma Digital</h3>
                    </div>
                    {/* Centro: Badge OK/Rechazado */}
                    <div className="flex items-center justify-center">
                      <CvSecBadge campo="firma" valor={ctrlVentas.firma} />
                    </div>
                    {/* Derecha: espacio simétrico */}
                    <div className="flex-1" />
                  </div>
                  <div className="p-4 md:p-6 bg-white min-h-[100px]">
                    {isLoadingFirmaDigital ? (
                      <div className="flex flex-col justify-center items-center py-8">
                         <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-2" />
                         <p className="text-xs text-slate-500 font-medium">Buscando firma digital...</p>
                      </div>
                    ) : firmaDigitalData ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Object.entries(firmaDigitalData).filter(([k, v]) => k !== 'id' && k !== 'created_at' && v !== null && v !== '').map(([key, value]) => (
                          <div key={key}>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">{key.replace(/_/g, ' ')}</p>
                            {key.toLowerCase() === 'rut' ? (
                              <div className="flex flex-col gap-2">
                                <p className="text-sm font-semibold text-slate-800 break-words">{String(value)}</p>
                                <button
                                  onClick={fetchFirmaDigital}
                                  disabled={isLoadingFirmaDigital}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-md transition-colors disabled:opacity-50"
                                >
                                  {isLoadingFirmaDigital ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                  Actualizar Firma
                                </button>
                              </div>
                            ) : key.toLowerCase() === 'ci' ? (
                              <a 
                                href={typeof value === 'string' && value.startsWith('http') ? value : supabase.storage.from('firmas').getPublicUrl(String(value)).data.publicUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md transition-colors mt-1"
                              >
                                <File className="w-3.5 h-3.5" />
                                Ver Documento CI
                              </a>
                            ) : typeof value === 'string' && (value.startsWith('data:image') || value.startsWith('http')) ? (
                              <img src={value} alt={key} className="max-h-32 object-contain border border-slate-200 rounded-md p-1 bg-slate-50" />
                            ) : (
                              <p className="text-sm font-semibold text-slate-800 break-words">{String(value)}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-slate-200 p-8 rounded-lg flex flex-col items-center justify-center text-center">
                        <FileSignature className="w-10 h-10 text-slate-300 mb-3" />
                        <p className="text-sm font-semibold text-slate-700">No se encontraron registros</p>
                        <p className="text-xs text-slate-500 mt-1">No hay una firma digital asociada al RUT del cliente en el sistema.</p>
                      </div>
                    )}
                  </div>
                </div>

                </div>
              </>
            ) : rightActiveTab === 'archivos' ? (
              <div className="h-full flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 p-6 overflow-y-auto">
                
                <div className="space-y-6 mb-10 pb-10 border-b border-slate-100 shrink-0">
                  <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Documentos Requeridos</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { tipo: 'Nota de Venta', desc: 'Nota Venta Salesforce / SAP', icon: File, ref: notaVentaInputRef },
                      { tipo: 'Carnet Identidad Cliente', desc: 'Frontal y Reverso', icon: ImageIcon, ref: carnetInputRef },
                      { tipo: 'Aporte Marca Z126', desc: 'Copia Correo u Otro', icon: File, ref: aporteMarcaInputRef },
                      { tipo: 'Carta Mutuo Crédito', desc: 'Carta Amicar', icon: File, ref: cartaMutuoInputRef },
                      { tipo: 'Retoma Auto Usado', desc: 'Documentación de Retoma', icon: ImageIcon, ref: retomaInputRef },
                      ...(['ADMINISTRATIVO', 'ADMIN'].includes(userRole) ? [{ tipo: 'Factura', desc: 'Factura del negocio', icon: File, ref: facturaInputRef }] : [])
                    ].map((item: any) => {
                      const doc = docs.find(d => d.nombre_archivo.includes(item.tipo));
                      const Icon = item.icon;
                      return (
                        <div 
                          key={item.tipo}
                          onClick={() => { if (!doc) item.ref.current?.click() }}
                          className={`relative p-5 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center
                            ${uploadingSpec === item.tipo ? 'bg-indigo-50 border-indigo-200' : (doc ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-300 hover:border-indigo-400 hover:shadow-md cursor-pointer')}
                          `}
                        >
                          <input type="file" ref={item.ref} onChange={(e) => handleSpecialUpload(e, item.tipo, setUploadingSpec, item.ref)} className="hidden" accept=".pdf,.jpeg,.jpg,.png" />
                          {uploadingSpec === item.tipo ? (
                            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
                          ) : (
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors ${doc ? 'bg-green-100 text-green-600' : 'bg-indigo-100 text-indigo-600'}`}>
                              <Icon className="w-5 h-5" />
                            </div>
                          )}
                          
                          <p className="text-sm font-bold text-slate-800">{item.tipo}</p>
                          <p className="text-[10px] text-slate-500 mt-1 px-2 truncate w-full" title={doc ? doc.usuario_email : undefined}>{doc ? `${doc.usuario_email || 'Usuario'} • ${format(new Date(doc.created_at), "dd/MM/yyyy HH:mm")}` : item.desc}</p>
                          
                          {doc && (
                            <div className="flex flex-col gap-2 mt-4 items-center w-full justify-center">
                              <button 
                                onClick={(e) => { e.stopPropagation(); setPreviewUrl(doc.url); }}
                                className="flex items-center justify-center gap-1.5 py-1.5 px-4 bg-blue-600 text-white font-medium text-xs rounded-lg hover:bg-blue-700 shadow-sm transition-colors w-auto"
                              >
                                <Eye className="w-3.5 h-3.5" /> Ver
                              </button>
                              <div className="flex gap-2 items-center justify-center w-full">
                                <a 
                                  href={doc.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="px-3 flex items-center justify-center py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shrink-0"
                                  title="Descargar documento"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); item.ref.current?.click(); }}
                                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shrink-0"
                                  title="Reemplazar documento"
                                >
                                  Reemplazar
                                </button>
                              </div>
                            </div>
                          )}

                          {doc && (
                            <span className="absolute top-3 right-12 flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-700 shadow-sm">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                            </span>
                          )}
                          {doc && <CvDocBadge doc={doc} />}

                          {doc && item.tipo === 'Nota de Venta' && (
                            <div className="w-full mt-4 flex flex-col items-center justify-center border-t border-slate-100 pt-3">
                              {firmaJefaturaNV === 'FIRMADA' ? (
                                <div className="flex flex-col items-center text-center w-full">
                                  <div className="text-xs text-green-700 font-bold bg-green-100 py-1.5 px-3 rounded-lg border border-green-200 w-full mb-2">Aprobado por Jefatura</div>
                                  {(negocio as any).firma_jefatura_resuelta_por && (
                                    <p className="text-[10px] text-slate-500 mb-2">Aprobado por {(negocio as any).firma_jefatura_resuelta_por} el {format(new Date((negocio as any).firma_jefatura_resuelta_en), "dd/MM/yy HH:mm")}</p>
                                  )}
                                  {['JEFE', 'ADMIN', 'GERENCIA'].includes(userRole) && (
                                    <button onClick={(e) => { e.stopPropagation(); handleFirmaNV('RECHAZADA'); }} className="w-full text-xs text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 font-bold py-1.5 px-3 rounded-lg transition-colors mt-1">Cambiar a Rechazado</button>
                                  )}
                                </div>
                              ) : firmaJefaturaNV === 'RECHAZADA' ? (
                                <div className="flex flex-col items-center text-center w-full">
                                  <div className="text-xs text-red-700 font-bold bg-red-100 py-1.5 px-3 rounded-lg border border-red-200 mb-2">Rechazado por Jefatura</div>
                                  {(negocio as any).firma_jefatura_resuelta_por && (
                                    <p className="text-[10px] text-slate-500 mb-2">Rechazado por {(negocio as any).firma_jefatura_resuelta_por} el {format(new Date((negocio as any).firma_jefatura_resuelta_en), "dd/MM/yy HH:mm")}</p>
                                  )}
                                  <button onClick={(e) => { e.stopPropagation(); handleFirmaNV('SOLICITADA'); }} className="w-full text-xs text-slate-700 bg-slate-100 border border-slate-300 hover:bg-slate-200 font-bold py-1.5 px-3 rounded-lg transition-colors">Volver a Solicitar Firma</button>
                                </div>
                              ) : firmaJefaturaNV === 'SOLICITADA' ? (
                                <div className="flex flex-col items-center text-center w-full">
                                  {['JEFE', 'ADMIN', 'GERENCIA'].includes(userRole) ? (
                                    <div className="flex gap-2 w-full">
                                      <button onClick={(e) => { e.stopPropagation(); handleFirmaNV('FIRMADA'); }} className="flex-1 text-xs text-white bg-green-500 hover:bg-green-600 font-bold py-1.5 px-2 rounded-lg transition-colors text-center">Aprobar</button>
                                      <button onClick={(e) => { e.stopPropagation(); handleFirmaNV('RECHAZADA'); }} className="flex-1 text-xs text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 font-bold py-1.5 px-2 rounded-lg transition-colors text-center">Rechazar</button>
                                    </div>
                                  ) : (
                                    <div className="text-xs text-amber-700 font-bold bg-amber-100 py-1.5 px-3 rounded-lg border border-amber-200">Firma Solicitada (Pendiente)</div>
                                  )}
                                  {(negocio as any).firma_jefatura_solicitada_por && (
                                    <p className="text-[10px] text-slate-500 mt-1">Solicitado por {(negocio as any).firma_jefatura_solicitada_por} el {format(new Date((negocio as any).firma_jefatura_solicitada_en), "dd/MM/yy HH:mm")}</p>
                                  )}
                                </div>
                              ) : (
                                <button onClick={(e) => { e.stopPropagation(); handleFirmaNV('SOLICITADA'); }} className="w-full text-xs text-slate-700 bg-slate-100 border border-slate-300 hover:bg-slate-200 font-bold py-1.5 px-3 rounded-lg transition-colors">Solicitar Firma Jefatura</button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {docs.filter(d => !d.es_firmado && !['Ficha Conocimiento Cliente', 'Nota de Venta', 'Carnet Identidad Cliente', 'Aporte Marca Z126', 'Carta Mutuo Crédito', 'Retoma Auto Usado', 'RNVM', 'Factura'].some(rt => d.nombre_archivo.includes(rt))).map(doc => (
                      <div 
                        key={doc.id}
                        className="relative p-5 rounded-2xl border-2 border-solid border-slate-200 transition-all flex flex-col items-center justify-center text-center bg-white hover:border-slate-300 hover:shadow-md"
                      >
                        <CvDocBadge doc={doc} />
                        <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3 bg-slate-100 text-slate-600">
                          <File className="w-5 h-5" />
                        </div>
                        
                        {editingDocId === doc.id ? (
                          <div className="w-full px-2 mb-2">
                            <input 
                              autoFocus
                              type="text"
                              value={editDocName}
                              onChange={(e) => setEditDocName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameDoc(doc.id, editDocName);
                                if (e.key === 'Escape') setEditingDocId(null);
                              }}
                              onBlur={() => handleRenameDoc(doc.id, editDocName)}
                              className="w-full text-center px-2 py-1 text-sm border-2 border-blue-500 rounded text-slate-800 outline-none"
                            />
                          </div>
                        ) : (
                          <>
                            <p 
                              className="text-sm font-bold text-slate-800 truncate w-full px-2 cursor-pointer hover:underline" 
                              title="Clic para renombrar"
                              onClick={() => {
                                setEditingDocId(doc.id);
                                setEditDocName(doc.nombre_archivo.replace(/\.[^/.]+$/, ""));
                              }}
                            >
                              {doc.nombre_archivo}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-1 px-2 truncate w-full" title={doc.usuario_email}>{doc.usuario_email || 'Usuario'} • {format(new Date(doc.created_at), "dd/MM/yyyy HH:mm")}</p>
                          </>
                        )}
                        
                        <div className="flex gap-2 mt-4 items-center w-full justify-center">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setPreviewUrl(doc.url); }}
                            className="flex items-center justify-center gap-1.5 py-1.5 px-4 bg-blue-600 text-white font-medium text-xs rounded-lg hover:bg-blue-700 shadow-sm transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" /> Ver
                          </button>
                          <a 
                            href={doc.url}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 flex items-center justify-center py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
                            title="Descargar documento"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                          {doc.usuario_email === userEmail && (
                            <button
                              onClick={(e) => handleDeleteDoc(doc.id, e)}
                              className="px-3 flex items-center justify-center py-1.5 text-xs font-medium text-red-500 hover:text-white bg-red-50 border border-red-100 rounded-lg hover:bg-red-500 transition-colors shrink-0"
                              title="Eliminar documento"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className={`relative p-5 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center flex flex-col items-center justify-center
                        ${uploading ? 'bg-slate-50 border-slate-200' : 'bg-blue-50/30 border-blue-200 hover:border-blue-500 hover:bg-blue-50 hover:shadow-md'}
                      `}
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
                          <p className="text-sm font-bold text-slate-700">Subiendo...</p>
                        </>
                      ) : (
                        <>
                          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm border border-blue-100 mb-3 text-blue-600 transition-colors">
                            <UploadCloud className="w-5 h-5" />
                          </div>
                          <p className="text-sm font-bold text-slate-800">Cargar Otro Documento</p>
                          <p className="text-xs text-slate-500 mt-1">Soporta PDF, PNG, JPG (50MB)</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  className="hidden" 
                  accept=".pdf,.png,.jpg,.jpeg"
                />


              </div>
            ) : rightActiveTab === 'firmados' ? (
              <div className="h-full flex flex-col bg-slate-50/50 rounded-2xl shadow-sm border border-slate-200">
                <div className="px-6 py-5 border-b border-slate-200 bg-white rounded-t-2xl flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <FileSignature className="w-5 h-5 text-blue-600" />
                      Documentos Firmados
                    </h3>
                    <p className="text-sm text-slate-500 mt-0.5">Sube aquí los contratos y documentos legales finalizados</p>
                  </div>
                </div>
                <div className="p-6 overflow-y-auto flex-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {/* Tarjeta RNVM especial colocada en 1er lugar */}
                    {(() => {
                      const rnvmDoc = docs.find(d => d.nombre_archivo.includes('RNVM'));
                      return (
                        <div 
                          onClick={() => { if (!rnvmDoc) rnvmInputRef.current?.click() }}
                          className={`relative p-5 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center
                            ${uploadingSpec === 'RNVM' ? 'bg-indigo-50 border-indigo-200' : (rnvmDoc ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-300 hover:border-indigo-400 hover:shadow-md cursor-pointer')}
                          `}
                        >
                          <input type="file" ref={rnvmInputRef} onChange={(e) => handleSpecialUpload(e, 'RNVM', setUploadingSpec, rnvmInputRef)} className="hidden" accept=".pdf,.jpeg,.jpg,.png" />
                          {uploadingSpec === 'RNVM' ? (
                            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
                          ) : (
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors ${rnvmDoc ? 'bg-green-100 text-green-600' : 'bg-indigo-100 text-indigo-600'}`}>
                              <FileSignature className="w-5 h-5" />
                            </div>
                          )}
                          
                          <p className="text-sm font-bold text-slate-800">RNVM</p>
                          <p className="text-[10px] text-slate-500 mt-1 px-2 truncate w-full" title={rnvmDoc ? rnvmDoc.usuario_email : undefined}>{rnvmDoc ? `${rnvmDoc.usuario_email || 'Usuario'} • ${format(new Date(rnvmDoc.created_at), "dd/MM/yyyy HH:mm")}` : '(RNVM se generará de manera automática)'}</p>
                          
                          {!rnvmDoc && (
                            <div className="flex gap-2 mt-4 items-center w-full justify-center">
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleGenerateRNVM(); }}
                                className="flex items-center justify-center gap-1.5 py-1.5 px-4 bg-indigo-600 text-white font-medium text-xs rounded-lg hover:bg-indigo-700 shadow-sm transition-colors text-center"
                              >
                                <FileSignature className="w-3.5 h-3.5 shrink-0" /> <span className="whitespace-normal">Generar Documento y Guardar</span>
                              </button>
                            </div>
                          )}

                          {rnvmDoc && (
                            <div className="flex flex-col gap-2 mt-4 items-center w-full justify-center">
                              <button 
                                onClick={(e) => { e.stopPropagation(); setPreviewUrl(rnvmDoc.url); }}
                                className="flex items-center justify-center gap-1.5 py-1.5 px-4 bg-blue-600 text-white font-medium text-xs rounded-lg hover:bg-blue-700 shadow-sm transition-colors w-auto"
                              >
                                <Eye className="w-3.5 h-3.5" /> Ver
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleGenerateRNVM(); }}
                                className="flex items-center justify-center gap-1.5 py-1.5 px-4 bg-indigo-600 text-white font-medium text-xs rounded-lg hover:bg-indigo-700 shadow-sm transition-colors w-auto text-center"
                                title="Generar Documento y Guardar"
                              >
                                <FileSignature className="w-3.5 h-3.5 shrink-0" /> <span className="whitespace-normal">Generar Documento y Guardar</span>
                              </button>
                              <div className="flex gap-2 items-center justify-center w-full mt-1">
                                <a 
                                  href={rnvmDoc.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="px-3 flex items-center justify-center py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shrink-0"
                                  title="Descargar documento"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); rnvmInputRef.current?.click(); }}
                                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shrink-0"
                                  title="Reemplazar documento"
                                >
                                  Reemplazar
                                </button>
                                {rnvmDoc.usuario_email === userEmail && (
                                  <button
                                    onClick={(e) => handleDeleteDoc(rnvmDoc.id, e)}
                                    className="px-3 py-1.5 text-xs font-medium text-red-500 hover:text-white bg-red-50 border border-red-100 rounded-lg hover:bg-red-500 transition-colors shrink-0"
                                    title="Eliminar documento"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                          {rnvmDoc && <CvDocBadge doc={rnvmDoc} />}
                          {rnvmDoc && (
                            <span className="absolute top-3 right-12 flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-700 shadow-sm">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                            </span>
                          )}
                        </div>
                      );
                    })()}
                    {/* Tarjeta MPP especial */}
                    {(() => {
                      const mppDoc = docs.find(d => d.nombre_archivo.includes('MPP'));
                      return (
                        <div
                          onClick={() => { if (!mppDoc) mppInputRef.current?.click(); }}
                          className={`relative p-5 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center
                            ${uploadingSpec === 'MPP' ? 'bg-indigo-50 border-indigo-200' : (mppDoc ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-300 hover:border-indigo-400 hover:shadow-md cursor-pointer')}
                          `}
                        >
                          <input type="file" ref={mppInputRef} onChange={(e) => handleSpecialUpload(e, 'MPP', setUploadingSpec, mppInputRef)} className="hidden" accept=".pdf,.jpeg,.jpg,.png" />
                          {uploadingSpec === 'MPP' ? (
                            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
                          ) : (
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors ${mppDoc ? 'bg-green-100 text-green-600' : 'bg-indigo-100 text-indigo-600'}`}>
                              <FileSignature className="w-5 h-5" />
                            </div>
                          )}

                          <p className="text-sm font-bold text-slate-800">MPP</p>
                          <p className="text-[10px] text-slate-500 mt-1 px-2 truncate w-full" title={mppDoc ? mppDoc.usuario_email : undefined}>
                            {mppDoc ? `${mppDoc.usuario_email || 'Usuario'} • ${format(new Date(mppDoc.created_at), 'dd/MM/yyyy HH:mm')}` : '(MPP se generará de manera automática)'}
                          </p>

                          {!mppDoc && (
                            <div className="flex gap-2 mt-4 items-center w-full justify-center">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleGenerateMPP(); }}
                                className="flex items-center justify-center gap-1.5 py-1.5 px-4 bg-indigo-600 text-white font-medium text-xs rounded-lg hover:bg-indigo-700 shadow-sm transition-colors text-center"
                              >
                                <FileSignature className="w-3.5 h-3.5 shrink-0" /> <span className="whitespace-normal">Generar Documento y Guardar</span>
                              </button>
                            </div>
                          )}

                          {mppDoc && (
                            <div className="flex flex-col gap-2 mt-4 items-center w-full justify-center">
                              <button
                                onClick={(e) => { e.stopPropagation(); setPreviewUrl(mppDoc.url); }}
                                className="flex items-center justify-center gap-1.5 py-1.5 px-4 bg-blue-600 text-white font-medium text-xs rounded-lg hover:bg-blue-700 shadow-sm transition-colors w-auto"
                              >
                                <Eye className="w-3.5 h-3.5" /> Ver
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleGenerateMPP(); }}
                                className="flex items-center justify-center gap-1.5 py-1.5 px-4 bg-indigo-600 text-white font-medium text-xs rounded-lg hover:bg-indigo-700 shadow-sm transition-colors w-auto text-center"
                                title="Generar Documento y Guardar"
                              >
                                <FileSignature className="w-3.5 h-3.5 shrink-0" /> <span className="whitespace-normal">Generar Documento y Guardar</span>
                              </button>
                              <div className="flex gap-2 items-center justify-center w-full mt-1">
                                <a
                                  href={mppDoc.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="px-3 flex items-center justify-center py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shrink-0"
                                  title="Descargar documento"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                                <button
                                  onClick={(e) => { e.stopPropagation(); mppInputRef.current?.click(); }}
                                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shrink-0"
                                  title="Reemplazar documento"
                                >
                                  Reemplazar
                                </button>
                                {mppDoc.usuario_email === userEmail && (
                                  <button
                                    onClick={(e) => handleDeleteDoc(mppDoc.id, e)}
                                    className="px-3 py-1.5 text-xs font-medium text-red-500 hover:text-white bg-red-50 border border-red-100 rounded-lg hover:bg-red-500 transition-colors shrink-0"
                                    title="Eliminar documento"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                          {mppDoc && <CvDocBadge doc={mppDoc} />}
                          {mppDoc && (
                            <span className="absolute top-3 right-12 flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-700 shadow-sm">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                            </span>
                          )}
                        </div>
                      );
                    })()}
                    {/* Tarjeta PEP_PERSONA */}
                    {(() => {
                      const pepDoc = docs.find(d => d.nombre_archivo.includes('PEP_PERSONA'));
                      return (
                        <div
                          onClick={() => { if (!pepDoc) pepPersonaInputRef.current?.click(); }}
                          className={`relative p-5 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center
                            ${uploadingSpec === 'PEP_PERSONA' ? 'bg-indigo-50 border-indigo-200' : (pepDoc ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-300 hover:border-indigo-400 hover:shadow-md cursor-pointer')}
                          `}
                        >
                          <input type="file" ref={pepPersonaInputRef} onChange={(e) => handleSpecialUpload(e, 'PEP_PERSONA', setUploadingSpec, pepPersonaInputRef)} className="hidden" accept=".pdf,.xlsx,.jpeg,.jpg,.png" />
                          {uploadingSpec === 'PEP_PERSONA' ? (
                            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
                          ) : (
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors ${pepDoc ? 'bg-green-100 text-green-600' : 'bg-indigo-100 text-indigo-600'}`}>
                              <FileSignature className="w-5 h-5" />
                            </div>
                          )}
                          <p className="text-sm font-bold text-slate-800">PEP Persona</p>
                          <p className="text-[10px] text-slate-500 mt-1 px-2 truncate w-full" title={pepDoc ? pepDoc.usuario_email : undefined}>
                            {pepDoc ? `${pepDoc.usuario_email || 'Usuario'} • ${format(new Date(pepDoc.created_at), 'dd/MM/yyyy HH:mm')}` : '(Se generará automáticamente)'}
                          </p>
                          <div className="w-full mt-3 flex flex-col gap-2">
                            <select 
                              value={pepOpciones.personaStatus}
                              onChange={(e) => { e.stopPropagation(); setPepOpciones(p => ({...p, personaStatus: e.target.value})) }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                              <option value="NO ser una Persona Políticamente Expuesta (PEP)">NO ser PEP</option>
                              <option value="SI ser una Persona Políticamente Expuesta (PEP)">SÍ ser PEP</option>
                            </select>
                            <select 
                              value={pepOpciones.personaVinculo}
                              onChange={(e) => { e.stopPropagation(); setPepOpciones(p => ({...p, personaVinculo: e.target.value})) }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                              <option value="NO tener vínculo alguno">NO tener vínculo</option>
                              <option value="SI tener vínculo alguno">SÍ tener vínculo</option>
                            </select>
                          </div>
                          {!pepDoc && (
                            <div className="flex gap-2 mt-4 items-center w-full justify-center">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleGeneratePEP('PEP_PERSONA'); }}
                                className="flex items-center justify-center gap-1.5 py-1.5 px-4 bg-indigo-600 text-white font-medium text-xs rounded-lg hover:bg-indigo-700 shadow-sm transition-colors text-center"
                              >
                                <FileSignature className="w-3.5 h-3.5 shrink-0" /> <span className="whitespace-normal">Generar Documento y Guardar</span>
                              </button>
                            </div>
                          )}
                          {pepDoc && (
                            <div className="flex flex-col gap-2 mt-4 items-center w-full justify-center">
                              <button
                                onClick={(e) => { e.stopPropagation(); setPreviewUrl(pepDoc.url); }}
                                className="flex items-center justify-center gap-1.5 py-1.5 px-4 bg-blue-600 text-white font-medium text-xs rounded-lg hover:bg-blue-700 shadow-sm transition-colors w-auto"
                              >
                                <Eye className="w-3.5 h-3.5" /> Ver
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleGeneratePEP('PEP_PERSONA'); }}
                                className="flex items-center justify-center gap-1.5 py-1.5 px-4 bg-indigo-600 text-white font-medium text-xs rounded-lg hover:bg-indigo-700 shadow-sm transition-colors w-auto text-center"
                                title="Generar Documento y Guardar"
                              >
                                <FileSignature className="w-3.5 h-3.5 shrink-0" /> <span className="whitespace-normal">Generar Documento y Guardar</span>
                              </button>
                              <div className="flex gap-2 items-center justify-center w-full mt-1">
                                <a
                                  href={pepDoc.url} target="_blank" rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="px-3 flex items-center justify-center py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shrink-0"
                                  title="Descargar documento"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                                <button onClick={(e) => { e.stopPropagation(); pepPersonaInputRef.current?.click(); }}
                                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shrink-0"
                                  title="Reemplazar documento"
                                >
                                  Reemplazar
                                </button>
                                {pepDoc.usuario_email === userEmail && (
                                  <button onClick={(e) => handleDeleteDoc(pepDoc.id, e)}
                                    className="px-3 py-1.5 text-xs font-medium text-red-500 hover:text-white bg-red-50 border border-red-100 rounded-lg hover:bg-red-500 transition-colors shrink-0"
                                    title="Eliminar documento"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                          {pepDoc && <CvDocBadge doc={pepDoc} />}
                          {pepDoc && (
                            <span className="absolute top-3 right-12 flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-700 shadow-sm">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                            </span>
                          )}
                        </div>
                      );
                    })()}
                    {/* Tarjeta PEP_EMPRESA */}
                    {(() => {
                      const pepEmpDoc = docs.find(d => d.nombre_archivo.includes('PEP_EMPRESA'));
                      return (
                        <div
                          onClick={() => { if (!pepEmpDoc) pepEmpresaInputRef.current?.click(); }}
                          className={`relative p-5 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center
                            ${uploadingSpec === 'PEP_EMPRESA' ? 'bg-indigo-50 border-indigo-200' : (pepEmpDoc ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-300 hover:border-indigo-400 hover:shadow-md cursor-pointer')}
                          `}
                        >
                          <input type="file" ref={pepEmpresaInputRef} onChange={(e) => handleSpecialUpload(e, 'PEP_EMPRESA', setUploadingSpec, pepEmpresaInputRef)} className="hidden" accept=".pdf,.xlsx,.jpeg,.jpg,.png" />
                          {uploadingSpec === 'PEP_EMPRESA' ? (
                            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
                          ) : (
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors ${pepEmpDoc ? 'bg-green-100 text-green-600' : 'bg-indigo-100 text-indigo-600'}`}>
                              <FileSignature className="w-5 h-5" />
                            </div>
                          )}
                          <p className="text-sm font-bold text-slate-800">PEP Empresa</p>
                          <p className="text-[10px] text-slate-500 mt-1 px-2 truncate w-full" title={pepEmpDoc ? pepEmpDoc.usuario_email : undefined}>
                            {pepEmpDoc ? `${pepEmpDoc.usuario_email || 'Usuario'} • ${format(new Date(pepEmpDoc.created_at), 'dd/MM/yyyy HH:mm')}` : '(Se generará automáticamente)'}
                          </p>
                          <div className="w-full mt-3 flex flex-col gap-2">
                            <select 
                              value={pepOpciones.empresaStatus}
                              onChange={(e) => { e.stopPropagation(); setPepOpciones(p => ({...p, empresaStatus: e.target.value})) }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                              <option value="NO ser una Persona Políticamente Expuesta (PEP)">NO ser PEP</option>
                              <option value="SI ser una Persona Políticamente Expuesta (PEP)">SÍ ser PEP</option>
                            </select>
                            <select 
                              value={pepOpciones.empresaVinculo}
                              onChange={(e) => { e.stopPropagation(); setPepOpciones(p => ({...p, empresaVinculo: e.target.value})) }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                              <option value="NO tener vínculo alguno">NO tener vínculo</option>
                              <option value="SI tener vínculo alguno">SÍ tener vínculo</option>
                            </select>
                          </div>
                          {!pepEmpDoc && (
                            <div className="flex gap-2 mt-4 items-center w-full justify-center">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleGeneratePEP('PEP_EMPRESA'); }}
                                className="flex items-center justify-center gap-1.5 py-1.5 px-4 bg-indigo-600 text-white font-medium text-xs rounded-lg hover:bg-indigo-700 shadow-sm transition-colors text-center"
                              >
                                <FileSignature className="w-3.5 h-3.5 shrink-0" /> <span className="whitespace-normal">Generar Documento y Guardar</span>
                              </button>
                            </div>
                          )}
                          {pepEmpDoc && (
                            <div className="flex flex-col gap-2 mt-4 items-center w-full justify-center">
                              <button
                                onClick={(e) => { e.stopPropagation(); setPreviewUrl(pepEmpDoc.url); }}
                                className="flex items-center justify-center gap-1.5 py-1.5 px-4 bg-blue-600 text-white font-medium text-xs rounded-lg hover:bg-blue-700 shadow-sm transition-colors w-auto"
                              >
                                <Eye className="w-3.5 h-3.5" /> Ver
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleGeneratePEP('PEP_EMPRESA'); }}
                                className="flex items-center justify-center gap-1.5 py-1.5 px-4 bg-indigo-600 text-white font-medium text-xs rounded-lg hover:bg-indigo-700 shadow-sm transition-colors w-auto text-center"
                                title="Generar Documento y Guardar"
                              >
                                <FileSignature className="w-3.5 h-3.5 shrink-0" /> <span className="whitespace-normal">Generar Documento y Guardar</span>
                              </button>
                              <div className="flex gap-2 items-center justify-center w-full mt-1">
                                <a
                                  href={pepEmpDoc.url} target="_blank" rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="px-3 flex items-center justify-center py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shrink-0"
                                  title="Descargar documento"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                                <button onClick={(e) => { e.stopPropagation(); pepEmpresaInputRef.current?.click(); }}
                                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shrink-0"
                                  title="Reemplazar documento"
                                >
                                  Reemplazar
                                </button>
                                {pepEmpDoc.usuario_email === userEmail && (
                                  <button onClick={(e) => handleDeleteDoc(pepEmpDoc.id, e)}
                                    className="px-3 py-1.5 text-xs font-medium text-red-500 hover:text-white bg-red-50 border border-red-100 rounded-lg hover:bg-red-500 transition-colors shrink-0"
                                    title="Eliminar documento"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                          {pepEmpDoc && <CvDocBadge doc={pepEmpDoc} />}
                          {pepEmpDoc && (
                            <span className="absolute top-3 right-12 flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-700 shadow-sm">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                            </span>
                          )}
                        </div>
                      );
                    })()}
                    {/* Tarjeta DJBF */}
                    {(() => {
                      const djbfDoc = docs.find(d => d.nombre_archivo.includes('DJBF'));
                      return (
                        <div
                          onClick={() => { if (!djbfDoc) djbfInputRef.current?.click(); }}
                          className={`relative p-5 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center
                            ${uploadingSpec === 'DJBF' ? 'bg-indigo-50 border-indigo-200' : (djbfDoc ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-300 hover:border-indigo-400 hover:shadow-md cursor-pointer')}
                          `}
                        >
                          <input type="file" ref={djbfInputRef} onChange={(e) => handleSpecialUpload(e, 'DJBF', setUploadingSpec, djbfInputRef)} className="hidden" accept=".pdf,.xlsx,.jpeg,.jpg,.png" />
                          {uploadingSpec === 'DJBF' ? (
                            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
                          ) : (
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors ${djbfDoc ? 'bg-green-100 text-green-600' : 'bg-indigo-100 text-indigo-600'}`}>
                              <FileSignature className="w-5 h-5" />
                            </div>
                          )}
                          <p className="text-sm font-bold text-slate-800">DJBF</p>
                          <p className="text-[10px] text-slate-500 mt-1 px-2 truncate w-full" title={djbfDoc ? djbfDoc.usuario_email : undefined}>
                            {djbfDoc ? `${djbfDoc.usuario_email || 'Usuario'} • ${format(new Date(djbfDoc.created_at), 'dd/MM/yyyy HH:mm')}` : '(Se generará automáticamente)'}
                          </p>
                          
                          {!djbfDoc && (
                            <div className="flex gap-2 mt-4 items-center w-full justify-center">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleGenerateDJBF(); }}
                                className="flex items-center justify-center gap-1.5 py-1.5 px-4 bg-indigo-600 text-white font-medium text-xs rounded-lg hover:bg-indigo-700 shadow-sm transition-colors text-center"
                              >
                                <FileSignature className="w-3.5 h-3.5 shrink-0" /> <span className="whitespace-normal">Generar Documento y Guardar</span>
                              </button>
                            </div>
                          )}
                          {djbfDoc && (
                            <div className="flex flex-col gap-2 mt-4 items-center w-full justify-center">
                              <button
                                onClick={(e) => { e.stopPropagation(); setPreviewUrl(djbfDoc.url); }}
                                className="flex items-center justify-center gap-1.5 py-1.5 px-4 bg-blue-600 text-white font-medium text-xs rounded-lg hover:bg-blue-700 shadow-sm transition-colors w-auto"
                              >
                                <Eye className="w-3.5 h-3.5" /> Ver
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleGenerateDJBF(); }}
                                className="flex items-center justify-center gap-1.5 py-1.5 px-4 bg-indigo-600 text-white font-medium text-xs rounded-lg hover:bg-indigo-700 shadow-sm transition-colors w-auto text-center"
                                title="Generar Documento y Guardar"
                              >
                                <FileSignature className="w-3.5 h-3.5 shrink-0" /> <span className="whitespace-normal">Generar Documento y Guardar</span>
                              </button>
                              <div className="flex gap-2 items-center justify-center w-full mt-1">
                                <a
                                  href={djbfDoc.url} target="_blank" rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="px-3 flex items-center justify-center py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shrink-0"
                                  title="Descargar documento"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                                <button onClick={(e) => { e.stopPropagation(); djbfInputRef.current?.click(); }}
                                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shrink-0"
                                  title="Reemplazar documento"
                                >
                                  Reemplazar
                                </button>
                                {djbfDoc.usuario_email === userEmail && (
                                  <button onClick={(e) => handleDeleteDoc(djbfDoc.id, e)}
                                    className="px-3 py-1.5 text-xs font-medium text-red-500 hover:text-white bg-red-50 border border-red-100 rounded-lg hover:bg-red-500 transition-colors shrink-0"
                                    title="Eliminar documento"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                          {djbfDoc && <CvDocBadge doc={djbfDoc} />}
                          {djbfDoc && (
                            <span className="absolute top-3 right-12 flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-700 shadow-sm">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                            </span>
                          )}
                        </div>
                      );
                    })()}
                    {docs.filter(d => d.es_firmado && !d.nombre_archivo.includes('RNVM') && !d.nombre_archivo.includes('MPP') && !d.nombre_archivo.includes('PEP_PERSONA') && !d.nombre_archivo.includes('PEP_EMPRESA') && !d.nombre_archivo.includes('DJBF')).map(doc => (
                      <div 
                        key={doc.id}
                        className="relative p-5 rounded-2xl border-2 border-solid border-slate-200 transition-all flex flex-col items-center justify-center text-center bg-white hover:border-slate-300 hover:shadow-md"
                      >
                        <CvDocBadge doc={doc} />
                        <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3 bg-blue-50 text-blue-600">
                          <Check className="w-6 h-6" />
                        </div>
                        
                        {editingDocId === doc.id && doc.usuario_email !== 'sistema' ? (
                          <div className="w-full px-2 mb-2">
                            <input 
                              autoFocus
                              type="text"
                              value={editDocName}
                              onChange={(e) => setEditDocName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameDoc(doc.id, editDocName);
                                if (e.key === 'Escape') setEditingDocId(null);
                              }}
                              onBlur={() => handleRenameDoc(doc.id, editDocName)}
                              className="w-full text-center px-2 py-1 text-sm border-2 border-blue-500 rounded text-slate-800 outline-none"
                            />
                          </div>
                        ) : (
                          <>
                            <p 
                              className={`text-sm font-bold text-slate-800 truncate w-full px-2 ${doc.is_global ? '' : 'cursor-pointer hover:underline'}`} 
                              title={doc.is_global ? "" : "Clic para renombrar"}
                              onClick={() => {
                                if (doc.is_global) return;
                                setEditingDocId(doc.id);
                                setEditDocName(doc.nombre_archivo.replace(/\.[^/.]+$/, ""));
                              }}
                            >
                              {doc.nombre_archivo}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-1 px-2 truncate w-full" title={doc.usuario_email}>{doc.usuario_email || 'Usuario'} • {format(new Date(doc.created_at), "dd/MM/yyyy HH:mm")}</p>
                          </>
                        )}
                        
                        <div className="flex gap-2 mt-4 items-center w-full justify-center">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setPreviewUrl(doc.url); }}
                            className="flex items-center justify-center gap-1.5 py-1.5 px-4 bg-blue-600 text-white font-medium text-xs rounded-lg hover:bg-blue-700 shadow-sm transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" /> Ver
                          </button>
                          <a 
                            href={doc.url}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 flex items-center justify-center py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
                            title="Descargar documento"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                          {doc.is_global && (
                            <button
                               onClick={(e) => handleReplaceDocClick(doc.id, e)}
                               className="px-3 flex items-center justify-center py-1.5 text-xs font-medium text-slate-600 hover:text-indigo-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-indigo-50 hover:border-indigo-200 transition-colors shrink-0"
                               title="Reemplazar documento por versión firmada"
                            >
                               <UploadCloud className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {!doc.is_global && doc.usuario_email === userEmail && (
                            <button
                              onClick={(e) => handleDeleteDoc(doc.id, e)}
                              className="px-3 flex items-center justify-center py-1.5 text-xs font-medium text-red-500 hover:text-white bg-red-50 border border-red-100 rounded-lg hover:bg-red-500 transition-colors shrink-0"
                              title="Eliminar documento"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    <div 
                      onClick={() => firmadoInputRef.current?.click()}
                      className={`relative p-5 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center flex flex-col items-center justify-center
                        ${uploading ? 'bg-slate-50 border-slate-200' : 'bg-blue-50/30 border-blue-200 hover:border-blue-500 hover:bg-blue-50 hover:shadow-md'}
                      `}
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
                          <p className="text-sm font-bold text-slate-700">Subiendo...</p>
                        </>
                      ) : (
                        <>
                          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm border border-blue-100 mb-3 text-blue-600 transition-colors">
                            <UploadCloud className="w-5 h-5" />
                          </div>
                          <p className="text-sm font-bold text-slate-800">Cargar Doc Firmado</p>
                          <p className="text-xs text-slate-500 mt-1">Soporta PDF, PNG, JPG (50MB)</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <input 
                  type="file" 
                  ref={firmadoInputRef} 
                  onChange={handleFirmadoUpload} 
                  className="hidden" 
                  accept=".pdf,.png,.jpg,.jpeg"
                />
                <input 
                  type="file" 
                  ref={replaceInputRef} 
                  onChange={handleReplaceUpload} 
                  className="hidden" 
                  accept=".pdf,.png,.jpg,.jpeg"
                />
              </div>
            ) : null}
           </div>
        </div>
      </div>

      {/* Modal Visor de Documentos */}
      {previewUrl && (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 lg:p-8" onClick={() => setPreviewUrl(null)}>
          <div className="bg-white rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-white">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Eye className="w-5 h-5 text-blue-600" />
                Previsualización de Documento
              </h3>
              <div className="flex items-center gap-3">
                <a 
                  href={previewUrl} 
                  target="_blank"
                  className="px-4 py-2 text-sm font-bold text-blue-600 bg-blue-50 border border-blue-100 rounded-xl hover:bg-blue-100 hover:shadow-sm transition-all flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Pestaña Nueva / Descargar
                </a>
                <button 
                  onClick={() => setPreviewUrl(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 bg-slate-200 w-full relative">
              {previewUrl.toLowerCase().match(/\.(jpeg|jpg|gif|png|webp|svg)$/) ? (
                <div className="w-full h-full flex items-center justify-center p-6 bg-slate-800">
                  <img src={previewUrl} alt="Preview" className="max-w-full max-h-full object-contain rounded-lg shadow-xl" />
                </div>
              ) : previewUrl.toLowerCase().includes('pdf') ? (
                <iframe src={previewUrl + "#toolbar=1"} className="w-full h-full border-0 bg-slate-600" title="PDF Preview" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-slate-500">
                  <File className="w-20 h-20 mb-4 opacity-50" />
                  <p className="font-medium text-lg">La vista previa no está disponible para este tipo de archivo.</p>
                  <a href={previewUrl} target="_blank" className="mt-4 text-blue-600 font-bold hover:underline">Haz clic aquí para descargar.</a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
