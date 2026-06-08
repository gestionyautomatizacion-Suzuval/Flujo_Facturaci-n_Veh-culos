"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, MessageSquare, Paperclip, Send, File, Image as ImageIcon, UploadCloud, Download, Loader2, Eye, X, AlertTriangle, ExternalLink, Check, Trash2, FileSignature, Calendar, RefreshCw, Activity, Star, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { Negocio } from "@/components/KanbanBoard";
import CuadraturaSection from "./CuadraturaSection";
import DatosClienteTab from "./DatosClienteTab";
import { todasLasComunas, obtenerRegionPorComuna, regionesYcomunas } from "@/lib/chile";
import Papa from "papaparse";

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
  tipo_documento?: string;
}

interface Props {
  negocio: Negocio;
}

function mapTipo(tipo: string): string {
  switch (tipo) {
    case 'Nota de Venta': return 'NOTA_VENTA';
    case 'Carnet Identidad Cliente': return 'CARNET_IDENTIDAD';
    case 'Aporte Marca Z126': return 'APORTE_MARCA';
    case 'Carta Mutuo Crédito': return 'CARTA_MUTUO';
    case 'Retoma Auto Usado': return 'RETOMA_USADO';
    case 'RNVM': return 'RNVM';
    case 'MPP': return 'MPP';
    case 'PEP_PERSONA': return 'PEP_PERSONA';
    case 'PEP_EMPRESA': return 'PEP_EMPRESA';
    case 'DJBF': return 'DJBF';
    case 'Factura': return 'FACTURA';
    default: return 'OTRO';
  }
}

export default function CarpetaClient({ negocio }: Props) {
  const router = useRouter();
  const [rightActiveTab, setRightActiveTab] = useState<"requeridos" | "cliente" | "archivos" | "firmados" | "historial">("requeridos");
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
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(true);
  
  const [cartaMutuoDatos, setCartaMutuoDatos] = useState<any>((negocio as any).carta_mutuo_datos || null);
  const [isConsultingMutuo, setIsConsultingMutuo] = useState(false);

  const isPanelCollapsedRef = useRef(isPanelCollapsed);
  const userEmailRef = useRef(userEmail);
  const userRoleRef = useRef(userRole);

  useEffect(() => {
    userRoleRef.current = userRole;
  }, [userRole]);

  useEffect(() => {
    isPanelCollapsedRef.current = isPanelCollapsed;
  }, [isPanelCollapsed]);

  useEffect(() => {
    userEmailRef.current = userEmail;
  }, [userEmail]);

  
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
  const firmadoInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  
  const [linkedClienteInfo, setLinkedClienteInfo] = useState<{id: string, rut: string, nombre_apellido: string} | null>(null);
  
  const [firmaDigitalData, setFirmaDigitalData] = useState<any>(null);
  const [isLoadingFirmaDigital, setIsLoadingFirmaDigital] = useState(false);



  const [pepOpciones, setPepOpciones] = useState({
    personaStatus: "NO ser una Persona Políticamente Expuesta (PEP)",
    personaVinculo: "NO tener vínculo alguno",
    empresaStatus: "NO ser una Persona Políticamente Expuesta (PEP)",
    empresaVinculo: "NO tener vínculo alguno"
  });


  const [historial, setHistorial] = useState<any[]>([]);
  const [validaciones, setValidaciones] = useState<any[]>([]);

  const logAuditoria = async (detalles: string, tipo_evento: string = 'SISTEMA') => {
    const { data: histData } = await supabase
      .from("negocios_historial")
      .insert([{
        pedido_venta: negocio.pedido_venta,
        tipo_evento: tipo_evento,
        descripcion: detalles,
        usuario_email: userEmail || "sistema@suzuval.cl"
      }])
      .select()
      .single();

    if (histData) {
      setHistorial(prev => [histData, ...prev]);
    }
  };

  const fetchFirmaDigital = useCallback(async () => {
    const rutStr = linkedClienteInfo?.rut || (negocio as any).rut;
    
    if (!rutStr) {
      setFirmaDigitalData(null);
      return;
    }
    
    setIsLoadingFirmaDigital(true);
    const { data, error } = await supabase
      .from('clientes')
      .select('firma, ci_frontal, ci_trasero, autorizacion, updated_at')
      .eq('rut', rutStr)
      .limit(1)
      .maybeSingle();
      
    if (!error && data) {
      setFirmaDigitalData(data);
    } else {
      setFirmaDigitalData(null);
    }
    setIsLoadingFirmaDigital(false);
  }, [negocio, linkedClienteInfo]);

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

      const resValidaciones = await supabase
        .from("negocios_validaciones")
        .select("*")
        .eq("pedido_venta", negocio.pedido_venta);
      
      if (!resValidaciones.error && resValidaciones.data) {
        setValidaciones(resValidaciones.data);
      }

      const resHistorial = await supabase
        .from("negocios_historial")
        .select("*")
        .eq("pedido_venta", negocio.pedido_venta)
        .order("created_at", { ascending: false });
        
      if (!resHistorial.error && resHistorial.data) {
        setHistorial(resHistorial.data);
      }
    };

    initData();

    const channel = supabase.channel(`comentarios-${negocio.pedido_venta}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "negocios_comentarios",
          filter: `pedido_venta=eq.${negocio.pedido_venta}`
        },
        (payload) => {
          const newComentario = payload.new as Comentario;
          setComentarios(prev => {
            if (prev.some(c => c.id === newComentario.id)) return prev;
            return [...prev, newComentario];
          });
          setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "negocios_validaciones",
          filter: `pedido_venta=eq.${negocio.pedido_venta}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setValidaciones(prev => {
              const updated = prev.filter(v => v.elemento_id !== payload.new.elemento_id);
              return [...updated, payload.new];
            });
          } else if (payload.eventType === 'DELETE') {
            setValidaciones(prev => prev.filter(v => v.elemento_id !== payload.old.elemento_id));
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "negocios_historial",
          filter: `pedido_venta=eq.${negocio.pedido_venta}`
        },
        (payload) => {
          setHistorial(prev => [payload.new, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [negocio.pedido_venta]);

  useEffect(() => {
    const checkAllApproved = async () => {
      if (negocio.estado === 'FACTURADO') return;

      const notaVentaDoc = docs.find(d => d.tipo_documento === 'NOTA_VENTA');
      
      const requiredIds = [
        'DATOS_VEHICULO',
        'OBSERVACIONES_VENTA',
        'CUADRATURA',
        'DATOS_CLIENTE',
        'FIRMA_DIGITAL'
      ];
      
      if (notaVentaDoc) requiredIds.push(notaVentaDoc.id);

      const allApproved = !!notaVentaDoc && requiredIds.every(id => 
        validaciones.some(v => v.elemento_id === id && v.estado === 'APROBADO')
      );

      const hasAnyValidation = requiredIds.some(id => 
        validaciones.some(v => v.elemento_id === id && (v.estado === 'APROBADO' || v.estado === 'RECHAZADO'))
      );

      let targetStatus: string | null = null;
      let auditMsg: string | null = null;

      if (allApproved) {
        targetStatus = 'REVISADO_OK';
        auditMsg = "Estado del negocio cambiado automáticamente a OK Revisado por aprobaciones completas";
      } else if (hasAnyValidation) {
        targetStatus = 'REVISADO_EN_ESPERA';
        auditMsg = "Estado del negocio cambiado automáticamente a En Revisión";
      } else {
        targetStatus = 'PARA_REVISION';
        auditMsg = "Estado del negocio regresado automáticamente a Pendiente Revisión";
      }

      let currentNormalized = negocio.estado;
      if (currentNormalized === 'APROBADO' || currentNormalized === 'REVISADO OK') currentNormalized = 'REVISADO_OK';
      if (currentNormalized === 'PARA_REVISIÓN') currentNormalized = 'PARA_REVISION';

      if (targetStatus && currentNormalized !== targetStatus) {
        const { error } = await supabase
          .from('negocios')
          .update({ estado: targetStatus })
          .eq('pedido_venta', negocio.pedido_venta);

        if (!error) {
          if (auditMsg) logAuditoria(auditMsg);
          router.refresh();
        }
      }
    };

    checkAllApproved();
  }, [validaciones, docs, negocio.estado, negocio.pedido_venta, router, supabase]);

  const fetchClientDataForDocs = async () => {
    const { data: cdn } = await supabase
      .from("clientes_datos_negocios")
      .select("*")
      .eq("pedido_venta", negocio.pedido_venta)
      .maybeSingle();

    return {
      rut: linkedClienteInfo?.rut || negocio.rut || '',
      nombre: linkedClienteInfo?.nombre_apellido || negocio.nombre_apellido || '',
      direccion: cdn?.direccion || '',
      comuna: cdn?.comuna || '',
      region: cdn?.region || '',
      correo: cdn?.mail || '',
      telefono: cdn?.movil || '',
      estado_civil: cdn?.estado_civil || '',
      comunidad_bienes: cdn?.comunidad_bienes ? 'SI' : 'NO',
      tipo_negocio: cdn?.tipo_negocio || '',
      nacionalidad: cdn?.nacionalidad || '',
      profesion_giro: cdn?.profesion_giro || '',
    };
  };

  const handleConsultarMutuoCredito = async () => {
    setIsConsultingMutuo(true);
    try {
      const clientData = await fetchClientDataForDocs();
      let rut = clientData.rut;
      
      if (!rut) {
        alert("No se encontró el RUT del cliente para buscar.");
        setIsConsultingMutuo(false);
        return;
      }
      
      const cleanRut = rut.replace(/\./g, '').trim().toUpperCase();

      const csvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRG3luPdAVrYhat2iQ4gilXicaQEsvuICqR05qq689lCJ_kBIcr_kGRbl22jU65pNE-i8tlkIB6Ux5O/pub?gid=2035997132&single=true&output=csv";
      const res = await fetch(csvUrl);
      const csvText = await res.text();
      
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const data = results.data as any[];
          const found = data.find(row => {
            const rowRut = (row["Rut Cliente"] || "").replace(/\./g, '').trim().toUpperCase();
            return rowRut === cleanRut;
          });

          if (found) {
            const extractedData = {
              "ID Crédito": found["ID Crédito"],
              "Marca": found["Marca"],
              "Modelo": found["Modelo"],
              "Version": found["Version"],
              "Entidad Financiera": found["Entidad Financiera"],
              "Fec. Adj.": found["Fec. Adj."],
              "Tipo Crédito": found["Tipo Crédito"],
              "Nombre Producto": found["Nombre Producto"],
              "Saldo": found["Saldo"],
              "Vendedor": found["Vendedor"],
              "F&I": found["F&I"]
            };

            const { error } = await supabase.from('negocios').update({ carta_mutuo_datos: extractedData }).eq('pedido_venta', negocio.pedido_venta);
            if (error) {
              console.error("Error guardando datos carta mutuo:", error);
              alert("Error al guardar los datos en la base de datos.");
            } else {
              setCartaMutuoDatos(extractedData);
              logAuditoria(`Consultó Google Sheet Carta Mutuo con éxito para el RUT ${rut}`);
              alert("Datos consultados y guardados exitosamente.");
            }
          } else {
            alert(`No se encontró el RUT ${rut} en el Google Sheet.`);
          }
          setIsConsultingMutuo(false);
        },
        error: (error: any) => {
          console.error("Error parsing CSV:", error);
          alert("Error al procesar el archivo CSV.");
          setIsConsultingMutuo(false);
        }
      });
    } catch (e: any) {
      console.error(e);
      alert("Error al consultar Google Sheet.");
      setIsConsultingMutuo(false);
    }
  };



  const handleGenerateRNVM = async () => {
    try {
      setUploadingSpec('RNVM');
      const clientData = await fetchClientDataForDocs();
      const { rut, nombre, direccion, comuna, region, correo, telefono } = clientData;
      const extraData = clientData;

      const url = `/templates/rnvm_template.pdf?v=${Date.now()}`;
      const response = await fetch(url);
      if(!response.ok) throw new Error("Plantilla no encontrada en public/templates/rnvm_template.pdf. Por favor, asegúrese de que el archivo existe.");
      const existingPdfBytes = await response.arrayBuffer();

      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];

      const size = 10;
      const color = rgb(0, 0, 0);
      const pageHeight = firstPage.getHeight();

      // Ajustes de coordenadas para dibujar los valores EXACTAMENTE al lado de los textos fijos de la plantilla
      // Estado Civil y Datos Adicionales (Parte superior)
      firstPage.drawText(extraData.estado_civil || '', { x: 180, y: pageHeight - 150, size, color });
      firstPage.drawText(extraData.comunidad_bienes || '', { x: 480, y: pageHeight - 150, size, color });
      firstPage.drawText(extraData.estado_civil === 'AUC' ? 'SI' : 'NO', { x: 200, y: pageHeight - 170, size, color });
      firstPage.drawText(extraData.tipo_negocio === 'PERSONA NATURAL' ? 'NO' : 'SI', { x: 480, y: pageHeight - 170, size, color });

      // Datos Cliente (Columna izquierda alineada en X = 200)
      const leftX = 200;
      firstPage.drawText(rut, { x: leftX, y: pageHeight - 250, size, color });
      firstPage.drawText(nombre, { x: leftX, y: pageHeight - 270, size, color });
      firstPage.drawText(extraData.nacionalidad || '', { x: leftX, y: pageHeight - 290, size, color });
      firstPage.drawText(extraData.profesion_giro || '', { x: leftX, y: pageHeight - 310, size, color });

      // Dirección
      firstPage.drawText(direccion, { x: leftX, y: pageHeight - 345, size, color });
      firstPage.drawText(comuna, { x: leftX, y: pageHeight - 365, size, color });
      firstPage.drawText(region, { x: 420, y: pageHeight - 365, size, color });
      firstPage.drawText(telefono, { x: leftX, y: pageHeight - 385, size, color });
      firstPage.drawText(correo, { x: leftX, y: pageHeight - 405, size, color });

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
                const maxWidth = 180;
                const maxHeight = 70;
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width = width * ratio;
                height = height * ratio;

                // Colocar la firma centrada y más arriba para que no pise el pie de página
                firstPage.drawImage(firmaImage, {
                  x: (firstPage.getWidth() - width) / 2, 
                  y: pageHeight - 570, 
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

      // Fecha de generación del documento
      const fechaActual = new Date();
      const fechaFormateada = fechaActual.toLocaleDateString('es-CL');
      firstPage.drawText(`Generado el: ${fechaFormateada}`, { 
        x: 430, 
        y: pageHeight - 590, 
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
      const clientData = await fetchClientDataForDocs();
      const { rut } = clientData;

      // Obtener mantenciones contratadas desde la cuadratura
      let mantDataFetched = null;
      if (negocio.cuadratura_id) {
        const { data: mantData } = await supabase
          .from("mantencion_prepagada")
          .select("mantencion_10000, mantencion_20000, mantencion_30000")
          .eq("cuadratura_id", negocio.cuadratura_id)
          .maybeSingle();
          
        if (mantData) {
          mantDataFetched = mantData;
        }
      }

      const url = `/templates/mpp_template.pdf?v=${Date.now()}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Plantilla no encontrada en public/templates/mpp_template.pdf.');
      const existingPdfBytes = await response.arrayBuffer();

      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const pageHeight = firstPage.getHeight();
      const pageWidth = firstPage.getWidth();

      // Dibujar las mantenciones contratadas verticalmente
      let hasMantenciones = false;
      let yOffset = 210;
      if (mantDataFetched) {
        if (mantDataFetched.mantencion_10000) {
          const num = "10.000";
          const numW = boldFont.widthOfTextAtSize(num, 12);
          firstPage.drawText(num, { x: 90, y: yOffset, size: 12, font: boldFont, color: rgb(0,0,0) });
          firstPage.drawText(" KM", { x: 90 + numW + 2, y: yOffset, size: 11, font: boldFont, color: rgb(0,0,0) });
          yOffset -= 20;
          hasMantenciones = true;
        }
        if (mantDataFetched.mantencion_20000) {
          const num = "20.000";
          const numW = boldFont.widthOfTextAtSize(num, 12);
          firstPage.drawText(num, { x: 90, y: yOffset, size: 12, font: boldFont, color: rgb(0,0,0) });
          firstPage.drawText(" KM", { x: 90 + numW + 2, y: yOffset, size: 11, font: boldFont, color: rgb(0,0,0) });
          yOffset -= 20;
          hasMantenciones = true;
        }
        if (mantDataFetched.mantencion_30000) {
          const num = "30.000";
          const numW = boldFont.widthOfTextAtSize(num, 12);
          firstPage.drawText(num, { x: 90, y: yOffset, size: 12, font: boldFont, color: rgb(0,0,0) });
          firstPage.drawText(" KM", { x: 90 + numW + 2, y: yOffset, size: 11, font: boldFont, color: rgb(0,0,0) });
          hasMantenciones = true;
        }
      }
      
      if (!hasMantenciones) {
        firstPage.drawText("Ninguna", { x: 90, y: 190, size: 12, font: boldFont, color: rgb(0,0,0) });
      }

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
                // Mover la firma al centro, pero más arriba
                const boxW = 180, boxH = 80;
                const ratio = Math.min(boxW / w, boxH / h);
                w = w * ratio; h = h * ratio;
                firstPage.drawImage(firmaImage, {
                  x: (pageWidth - w) / 2,
                  y: 200,
                  width: w, height: h
                });
              }
            }
          } catch (e) { console.error('Error incrustando firma en MPP:', e); }
        }
      }

      // Fecha centrada debajo de la firma, más arriba que el pie de página
      const fechaMPP = new Date().toLocaleDateString('es-CL');
      const dateText = `Generado el: ${fechaMPP}`;
      firstPage.drawText(dateText, {
        x: (pageWidth - 125) / 2,
        y: 180,
        size: 9,
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
      const clientData = await fetchClientDataForDocs();
      const { rut, nombre, nacionalidad } = clientData;

      const templateName = tipo === 'PEP_PERSONA' ? 'pep_persona_template.pdf' : 'pep_empresas_template.pdf';
      const response = await fetch(`/templates/${templateName}?v=${Date.now()}`);
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
      const url = `/templates/djbf_template.pdf?v=${Date.now()}`;
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

  const handleDeleteNegocio = async () => {
    if (!window.confirm("¿Estás seguro de que quieres eliminar este negocio y todos sus documentos correspondientes? Esta acción es irreversible.")) return;
    
    const { error } = await supabase.from('negocios').delete().eq('pedido_venta', negocio.pedido_venta);
    if (error) {
      alert("Error al eliminar el negocio: " + error.message);
      return;
    }
    
    router.replace("/negocios");
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
        tipo_documento: 'OTRO',
        estado_validacion: null,
        es_firmado: false,
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
        tipo_documento: 'OTRO',
        estado_validacion: null,
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
        estado_validacion: null,
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
        tipo_documento: mapTipo(tipo),
        estado_validacion: null,
        es_firmado: false,
        tamano_kb: kbSize,
        url: publicUrlData.publicUrl,
        usuario_email: userEmail
      }])
      .select()
      .single();

    if (!dbError && docData) {
      setDocs(prev => [docData, ...prev]);
      logAuditoria(`Documento adjuntado (${tipo}): ${cleanFileName}`);

      if (tipo === 'Factura') {
        const { error: updateError } = await supabase
          .from('negocios')
          .update({ estado: 'FACTURADO' })
          .eq('pedido_venta', negocio.pedido_venta);
          
        if (!updateError) {
          logAuditoria(`Estado del negocio cambiado automáticamente a Facturado`);
          router.refresh();
        }
      }
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

  const handleValidacionCentral = async (elemento_id: string, accionEstado: 'APROBADO' | 'RECHAZADO') => {
    const currentVal = validaciones.find(v => v.elemento_id === elemento_id);
    let nuevoEstado = accionEstado;
    
    if (currentVal && currentVal.estado === accionEstado) {
      nuevoEstado = 'PENDIENTE';
    }

    const { error, data } = await supabase
      .from('negocios_validaciones')
      .upsert({
        pedido_venta: negocio.pedido_venta,
        elemento_id: elemento_id,
        estado: nuevoEstado,
        usuario_email: userEmail || "sistema@suzuval.cl",
        updated_at: new Date().toISOString()
      }, { onConflict: 'pedido_venta, elemento_id' })
      .select()
      .single();

    if (!error) {
      setValidaciones(prev => {
        const updated = prev.filter(v => v.elemento_id !== elemento_id);
        return [...updated, data || { elemento_id, estado: nuevoEstado }];
      });
      logAuditoria(`${elemento_id} marcado como ${nuevoEstado}`, 'VALIDACION');
    } else {
      alert("Error actualizando estado de validación");
    }
  };

  const RenderBotonesValidacion = ({ elemento_id, absolute = false }: { elemento_id: string, absolute?: boolean }) => {
    const docVal = validaciones.find(v => v.elemento_id === elemento_id)?.estado || 'PENDIENTE';
    const containerClasses = absolute ? "absolute top-3 right-3 flex gap-1.5" : "flex gap-1.5 ml-3";
    const canEdit = ['ADMINISTRATIVO', 'ADMIN', 'GERENCIA', 'JEFE'].includes(userRole || '');

    return (
      <div className={containerClasses} onClick={(e) => e.stopPropagation()}>
        <button
          onClick={(e) => { 
            e.preventDefault(); 
            if (canEdit) handleValidacionCentral(elemento_id, 'APROBADO'); 
          }}
          disabled={!canEdit}
          className={`flex h-6 w-6 items-center justify-center rounded-full shadow-sm transition-all ${
            docVal === 'APROBADO' 
              ? 'bg-green-500 text-white scale-110' 
              : `bg-green-50 text-green-400 ${canEdit ? 'hover:bg-green-100 hover:text-green-600 hover:scale-105 cursor-pointer' : 'opacity-60 cursor-default'}`
          }`}
          title={canEdit ? "Aprobar" : "Visto Bueno"}
        >
          <Check className="w-3.5 h-3.5" strokeWidth={3} />
        </button>
        <button
          onClick={(e) => { 
            e.preventDefault(); 
            if (canEdit) handleValidacionCentral(elemento_id, 'RECHAZADO'); 
          }}
          disabled={!canEdit}
          className={`flex h-6 w-6 items-center justify-center rounded-full shadow-sm transition-all ${
            docVal === 'RECHAZADO' 
              ? 'bg-red-500 text-white scale-110' 
              : `bg-red-50 text-red-400 ${canEdit ? 'hover:bg-red-100 hover:text-red-600 hover:scale-105 cursor-pointer' : 'opacity-60 cursor-default'}`
          }`}
          title={canEdit ? "Rechazar" : "Rechazado"}
        >
          <X className="w-3.5 h-3.5" strokeWidth={3} />
        </button>
      </div>
    );
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

  const getDocIcon = (nombre: string) => {
    const ext = nombre.split(".").pop()?.toLowerCase();
    if (ext === 'pdf') return <File className="h-5 w-5" />;
    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext || '')) return <ImageIcon className="h-5 w-5" />;
    return <File className="h-5 w-5" />;
  };


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
            <span className="inline-flex items-center rounded bg-slate-500 px-4 py-1.5 text-lg font-bold text-white shadow-sm border border-slate-400/50">
              Pedido Venta: {negocio.pedido_venta}
            </span>
            <span className="inline-flex items-center rounded bg-slate-500 px-4 py-1.5 text-lg font-bold text-white shadow-sm border border-slate-400/50">
              Interno: {negocio.interno}
            </span>

            {userRole === 'ADMIN' && (
              <button
                onClick={handleDeleteNegocio}
                className="ml-2 flex items-center justify-center gap-1.5 py-1 px-3 bg-red-600 text-white font-bold text-sm rounded shadow-sm hover:bg-red-700 transition-colors border border-red-500"
                title="Eliminar Negocio"
              >
                <Trash2 className="w-4 h-4" /> Eliminar
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
        </div>
      </div>

      {/* BARRA DE FLUJO ESTILO SALESFORCE */}
      {(() => {
        const STAGES = [
          { id: 'PARA_REVISIÓN', label: 'PENDIENTE REVISIÓN', activeBg: 'bg-yellow-500 text-white' },
          { id: 'REVISADO_EN_ESPERA', label: 'EN REVISIÓN', activeBg: 'bg-orange-500 text-white' },
          { id: 'REVISADO_OK', label: 'OK REVISADO', activeBg: 'bg-emerald-500 text-white' },
          { id: 'FACTURADO', label: 'FACTURADO', activeBg: 'bg-blue-600 text-white' },
        ];

        let normalizedEstado = negocio.estado;
        if (normalizedEstado === 'PARA_REVISION') normalizedEstado = 'PARA_REVISIÓN';
        if (normalizedEstado === 'APROBADO' || normalizedEstado === 'REVISADO OK') normalizedEstado = 'REVISADO_OK';

        const activeIndex = STAGES.findIndex(s => s.id === normalizedEstado) >= 0 
          ? STAGES.findIndex(s => s.id === normalizedEstado) 
          : 0;

        return (
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 w-full flex items-center shadow-sm z-10 relative shrink-0">
            <div className="flex w-full max-w-6xl mx-auto filter drop-shadow-sm">
              {STAGES.map((stage, idx) => {
                const isCompleted = idx < activeIndex;
                const isActive = idx === activeIndex;
                
                let bgColor = 'bg-white text-slate-500';
                if (isCompleted) bgColor = 'bg-emerald-500 text-white'; // Completed stages remain green
                else if (isActive) bgColor = stage.activeBg;
                
                const zIndex = STAGES.length - idx;
                let clipPath = '';
                if (idx === 0) {
                  clipPath = 'polygon(0 0, calc(100% - 16px) 0, 100% 50%, calc(100% - 16px) 100%, 0 100%)';
                } else if (idx === STAGES.length - 1) {
                  clipPath = 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 16px 50%)';
                } else {
                  clipPath = 'polygon(0 0, calc(100% - 16px) 0, 100% 50%, calc(100% - 16px) 100%, 0 100%, 16px 50%)';
                }

                return (
                  <div 
                    key={stage.id} 
                    className={`relative flex-1 flex items-center justify-center py-2.5 px-4 text-xs md:text-sm font-bold uppercase tracking-wider transition-colors ${bgColor}`}
                    style={{ 
                      clipPath,
                      marginLeft: idx !== 0 ? '-14px' : '0',
                      zIndex 
                    }}
                  >
                    {isCompleted && <Check className="w-4 h-4 mr-2 shrink-0" strokeWidth={3} />}
                    <span className="truncate">{stage.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        );
      })()}

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
                    Chat
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
                        const esAuditoria = msg.comentario.startsWith("[AUDITORIA]|");
                        
                        let contentNode = msg.comentario;

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
             <button onClick={() => setRightActiveTab('historial')} className={`mr-8 pb-3 text-sm font-bold border-b-[3px] transition-all ${rightActiveTab === 'historial' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>
                Historial
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
            {rightActiveTab === 'requeridos' ? (
              <>
                <div className="mb-0">
                  
                  
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8">
                      <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
                       <div className="flex items-center flex-1">
                         <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Datos del Vehículo</h4>
                         <RenderBotonesValidacion elemento_id="DATOS_VEHICULO" />
                       </div>
                     </div>
                    <div className="p-5 flex flex-wrap gap-x-6 gap-y-6">
                      <div className="flex-1 min-w-[100px] max-w-xs">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Interno</p>
                        <p className="text-sm font-semibold text-slate-800 break-words">{negocio.interno || "-"}</p>
                      </div>
                      <div className="flex-1 min-w-[150px] max-w-xs">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">N° de Chasis</p>
                        <p className="text-sm font-semibold text-slate-800 break-words">{(negocio as any).chasis || (negocio as any).numero_chasis || "-"}</p>
                      </div>
                      <div className="flex-1 min-w-[120px] max-w-xs">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Marca</p>
                        <p className="text-sm font-semibold text-slate-800 break-words">{negocio.marca || "-"}</p>
                      </div>
                      <div className="flex-1 min-w-[120px] max-w-xs">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Año Facturación</p>
                        <p className="text-sm font-semibold text-slate-800 break-words">{negocio.ano || (negocio as any).ano_facturacion || (negocio as any).anio || "-"}</p>
                      </div>
                      
                      <div className="w-full h-px bg-slate-50 border-0 m-0 shrink-0"></div>

                      <div className="flex-1 min-w-[140px] max-w-xs">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Cód. Mod. Vehículo</p>
                        <p className="text-sm font-semibold text-slate-800 break-words">{(negocio as any).codigo_modelo || (negocio as any).cod_modelo_vehiculo || "-"}</p>
                      </div>
                      <div className="flex-[2] min-w-[200px] max-w-md">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Descripción Modelo</p>
                        <p className="text-sm font-semibold text-slate-800 break-words">{negocio.modelo || (negocio as any).descripcion_modelo || "-"}</p>
                      </div>
                      <div className="flex-1 min-w-[120px] max-w-xs">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Color</p>
                        <p className="text-sm font-semibold text-slate-800 break-words">{negocio.color || "-"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8">
                      <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
                       <div className="flex items-center flex-1">
                         <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Observaciones de Venta</h4>
                         <RenderBotonesValidacion elemento_id="OBSERVACIONES_VENTA" />
                       </div>
                     </div>
                    <div className="p-5 flex flex-wrap gap-x-6 gap-y-6">
                      <div className="flex-1 min-w-[150px] max-w-xs">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tipo Compra</p>
                        <p className="text-sm font-semibold text-slate-800 break-words">{negocio.tipo_compra || "-"}</p>
                      </div>
                      <div className="flex-1 min-w-[150px] max-w-xs">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Saldo Inicial</p>
                        <p className="text-sm font-semibold text-slate-800 break-words">{negocio.saldo || "-"}</p>
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
                          {((negocio as any).prepago_vigente && (negocio as any).fecha_vencimiento_prepago) ? (
                            <span className="text-sm text-slate-800">{format(new Date(`${(negocio as any).fecha_vencimiento_prepago}T12:00:00`), "dd MMM yyyy", { locale: es })}</span>
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
                        <p className="text-sm font-semibold text-slate-800 break-words">{(negocio as any).gestion_accesorios || "-"}</p>
                      </div>
                      
                      <div className="w-full h-px bg-slate-50 border-0 m-0 shrink-0"></div>
                      
                      <div className="w-full">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Observación Inicial</p>
                        <p className="text-sm font-semibold text-slate-800 whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-100 mt-1">{(negocio as any).observacion_inicial || "Sin observación inicial"}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* SECCIÓN DE CUADRATURA */}
                  <CuadraturaSection 
                    negocio={negocio} 
                    onCuadraturaLinked={(id, rut, nombre) => setLinkedClienteInfo({ id, rut, nombre_apellido: nombre })}
                    renderValidacion={(id) => <RenderBotonesValidacion elemento_id={id} />}
                  />
                </div>
              </>
            ) : rightActiveTab === 'cliente' ? (
              <>
                <div className="mb-0">
                  
                
                {/* NUEVA SECCIÓN: DATOS DEL CLIENTE */}
                <DatosClienteTab 
                  pedidoVenta={negocio.pedido_venta} 
                  linkedClienteInfo={linkedClienteInfo} 
                  renderValidacion={(id) => <RenderBotonesValidacion elemento_id={id} />}
                />
                
                {/* NUEVA TARJETA: FIRMA DIGITAL CLIENTE */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm mb-8">
                  <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-2 group transition-colors">
                     <div className="flex items-center flex-1">
                       <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">Carnet Identidad / Firma Digital</h3>
                       <RenderBotonesValidacion elemento_id="FIRMA_DIGITAL" />
                     </div>
                   </div>
                  <div className="p-4 md:p-6 bg-white min-h-[100px]">
                    {isLoadingFirmaDigital ? (
                      <div className="flex flex-col justify-center items-center py-8">
                         <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-2" />
                         <p className="text-xs text-slate-500 font-medium">Buscando firma digital...</p>
                      </div>
                    ) : firmaDigitalData ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Object.entries(firmaDigitalData).filter(([k, v]) => k !== 'id' && k !== 'updated_at' && k !== 'created_at' && v !== null && v !== '').map(([key, value]) => (
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
                            ) : ['firma', 'ci_frontal', 'ci_trasero'].includes(key.toLowerCase()) ? (
                              <a 
                                href={typeof value === 'string' && (value.startsWith('http') || value.startsWith('data:image')) ? value : supabase.storage.from('firmas').getPublicUrl(String(value)).data.publicUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-block mt-1"
                              >
                                <img 
                                  src={typeof value === 'string' && (value.startsWith('http') || value.startsWith('data:image')) ? value : supabase.storage.from('firmas').getPublicUrl(String(value)).data.publicUrl} 
                                  alt={key} 
                                  className="max-h-32 object-contain border border-slate-200 rounded-md p-1 bg-slate-50 hover:opacity-80 transition-opacity" 
                                />
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
              <div className="h-full flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                
                <div className="space-y-6 mb-10 pb-10 border-b border-slate-100 shrink-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { tipo: 'Nota de Venta', desc: 'Nota Venta Salesforce / SAP', icon: File, ref: notaVentaInputRef },
                      { tipo: 'Carnet Identidad Cliente', desc: 'Frontal y Reverso', icon: ImageIcon, ref: carnetInputRef },
                      { tipo: 'Aporte Marca Z126', desc: 'Copia Correo u Otro', icon: File, ref: aporteMarcaInputRef },
                      { tipo: 'Carta Mutuo Crédito', desc: 'Carta Amicar', icon: File, ref: cartaMutuoInputRef },
                      { tipo: 'Retoma Auto Usado', desc: 'Documentación de Retoma', icon: ImageIcon, ref: retomaInputRef },
                      ...(['ADMINISTRATIVO', 'ADMIN'].includes(userRole) ? [{ tipo: 'Factura', desc: 'Factura del negocio', icon: File, ref: facturaInputRef }] : [])
                    ].map((item: any) => {
                      const doc = docs.find(d => d.tipo_documento === mapTipo(item.tipo) || (!d.tipo_documento && d.nombre_archivo.includes(item.tipo)));
                      const Icon = item.icon;
                      const isCartaMutuo = item.tipo === 'Carta Mutuo Crédito';
                      const hasDataMutuo = isCartaMutuo && cartaMutuoDatos;
                      const isCompleted = isCartaMutuo ? (doc || hasDataMutuo) : !!doc;

                      return (
                        <div 
                          key={item.tipo}
                          onClick={() => { 
                            if (!isCompleted) {
                              if (!isCartaMutuo) {
                                item.ref.current?.click();
                              }
                            }
                          }}
                          className={`relative p-5 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center
                            ${uploadingSpec === item.tipo ? 'bg-indigo-50 border-indigo-200' : (isCompleted ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-300 hover:border-indigo-400 hover:shadow-md cursor-pointer')}
                          `}
                        >
                          <input type="file" ref={item.ref} onChange={(e) => handleSpecialUpload(e, item.tipo, setUploadingSpec, item.ref)} className="hidden" accept=".pdf,.jpeg,.jpg,.png" />
                          {uploadingSpec === item.tipo || (isCartaMutuo && isConsultingMutuo) ? (
                            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
                          ) : (
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors ${isCompleted ? 'bg-green-100 text-green-600' : 'bg-indigo-100 text-indigo-600'}`}>
                              <Icon className="w-5 h-5" />
                            </div>
                          )}
                          
                          <p className="text-sm font-bold text-slate-800">{item.tipo}</p>
                          <p className="text-[10px] text-slate-500 mt-1 px-2 truncate w-full" title={doc ? doc.usuario_email : undefined}>{doc ? `${doc.usuario_email || 'Usuario'} • ${format(new Date(doc.created_at), "dd/MM/yyyy HH:mm")}` : (hasDataMutuo ? 'Datos obtenidos desde Google Sheet' : item.desc)}</p>

                          
                          {isCartaMutuo && !isCompleted && !isConsultingMutuo && (
                            <div className="flex flex-col gap-2 w-full mt-4">
                              <button 
                                onClick={(e) => { e.stopPropagation(); item.ref.current?.click(); }}
                                className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200 transition-colors"
                              >
                                Adjuntar Archivo
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleConsultarMutuoCredito(); }}
                                className="w-full py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 transition-colors"
                              >
                                Consultar a Reportería Amicar
                              </button>
                            </div>
                          )}

                          {isCartaMutuo && hasDataMutuo && !doc && (
                            <div className="w-full mt-4 flex flex-col items-center justify-center border-t border-slate-100 pt-3">
                              <div className="text-xs text-left w-full bg-white p-3 rounded-lg border border-slate-200 shadow-sm mb-3">
                                <p className="font-semibold text-slate-800 mb-1 border-b border-slate-100 pb-1">Datos Extraídos:</p>
                                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-slate-600">
                                  <span className="font-medium text-slate-500">ID Crédito:</span> <span className="truncate" title={cartaMutuoDatos["ID Crédito"]}>{cartaMutuoDatos["ID Crédito"]}</span>
                                  <span className="font-medium text-slate-500">Marca:</span> <span className="truncate" title={cartaMutuoDatos["Marca"]}>{cartaMutuoDatos["Marca"]}</span>
                                  <span className="font-medium text-slate-500">Modelo:</span> <span className="truncate" title={cartaMutuoDatos["Modelo"]}>{cartaMutuoDatos["Modelo"]}</span>
                                  <span className="font-medium text-slate-500">Version:</span> <span className="truncate" title={cartaMutuoDatos["Version"]}>{cartaMutuoDatos["Version"]}</span>
                                  <span className="font-medium text-slate-500">Entidad:</span> <span className="truncate" title={cartaMutuoDatos["Entidad Financiera"]}>{cartaMutuoDatos["Entidad Financiera"]}</span>
                                  <span className="font-medium text-slate-500">Fec. Adj.:</span> <span className="truncate" title={cartaMutuoDatos["Fec. Adj."]}>{cartaMutuoDatos["Fec. Adj."]}</span>
                                  <span className="font-medium text-slate-500">Tipo Crédito:</span> <span className="truncate" title={cartaMutuoDatos["Tipo Crédito"]}>{cartaMutuoDatos["Tipo Crédito"]}</span>
                                  <span className="font-medium text-slate-500">Producto:</span> <span className="truncate" title={cartaMutuoDatos["Nombre Producto"]}>{cartaMutuoDatos["Nombre Producto"]}</span>
                                  <span className="font-medium text-slate-500">Saldo:</span> <span className="truncate" title={cartaMutuoDatos["Saldo"]}>{cartaMutuoDatos["Saldo"]}</span>
                                  <span className="font-medium text-slate-500">Vendedor:</span> <span className="truncate" title={cartaMutuoDatos["Vendedor"]}>{cartaMutuoDatos["Vendedor"]}</span>
                                  <span className="font-medium text-slate-500">F&I:</span> <span className="truncate" title={cartaMutuoDatos["F&I"]}>{cartaMutuoDatos["F&I"]}</span>
                                </div>
                              </div>
                              <div className="flex gap-2 w-full mt-2">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); item.ref.current?.click(); }}
                                  className="flex-1 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-lg border border-indigo-200 transition-colors flex items-center justify-center gap-1"
                                >
                                  <Paperclip className="w-3 h-3" /> Adjuntar Archivo
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleConsultarMutuoCredito(); }}
                                  className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold rounded-lg border border-slate-200 transition-colors flex items-center justify-center gap-1"
                                >
                                  <RefreshCw className="w-3 h-3" /> Volver a Consultar
                                </button>
                              </div>
                            </div>
                          )}
                          
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

                          {isCompleted && (
                            <>
                              {!doc && hasDataMutuo && (
                                <div className="absolute top-3 right-3 flex gap-1.5">
                                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white shadow-sm">
                                    <Check className="w-3.5 h-3.5" />
                                  </span>
                                </div>
                              )}
                              {doc && <RenderBotonesValidacion elemento_id={doc.id} absolute={true} />}
                            </>
                          )}
                          {doc && null}
                        </div>
                      );
                    })}
                    {docs.filter(d => !d.es_firmado && (d.tipo_documento === 'OTRO' || (!d.tipo_documento && !['Ficha Conocimiento Cliente', 'Nota de Venta', 'Carnet Identidad Cliente', 'Aporte Marca Z126', 'Carta Mutuo Crédito', 'Retoma Auto Usado', 'RNVM', 'Factura'].some(rt => d.nombre_archivo.includes(rt))))).map(doc => (
                      <div 
                        key={doc.id}
                        className="relative p-5 rounded-2xl border-2 border-solid border-slate-200 transition-all flex flex-col items-center justify-center text-center bg-white hover:border-slate-300 hover:shadow-md"
                      >

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
                <div className="p-6 flex-1">
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
                            <div className="flex flex-col gap-2 mt-4 items-center w-full justify-center">
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleGenerateRNVM(); }}
                                className="flex items-center justify-center gap-1.5 py-1.5 px-4 bg-indigo-600 text-white font-medium text-xs rounded-lg hover:bg-indigo-700 shadow-sm transition-colors w-full text-center"
                              >
                                <FileSignature className="w-3.5 h-3.5 shrink-0" /> <span className="whitespace-normal">Generar Documento</span>
                              </button>
                              <a 
                                href={`/templates/rnvm_template.pdf?v=${Date.now()}`}
                                target="_blank"
                                download="RNVM_En_Blanco.pdf"
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center justify-center gap-1.5 py-1.5 px-4 bg-white text-slate-700 border border-slate-300 font-medium text-xs rounded-lg hover:bg-slate-50 shadow-sm transition-colors w-full text-center"
                                title="Descargar plantilla en blanco para llenado manual"
                              >
                                <Download className="w-3.5 h-3.5 shrink-0" /> <span className="whitespace-normal">Descargar en blanco</span>
                              </a>
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
                          {rnvmDoc && null}
                          {rnvmDoc && <RenderBotonesValidacion elemento_id={rnvmDoc.id} absolute={true} />}
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
                            <div className="flex flex-col gap-2 mt-4 items-center w-full justify-center">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleGenerateMPP(); }}
                                className="flex items-center justify-center gap-1.5 py-1.5 px-4 bg-indigo-600 text-white font-medium text-xs rounded-lg hover:bg-indigo-700 shadow-sm transition-colors text-center w-full"
                              >
                                <FileSignature className="w-3.5 h-3.5 shrink-0" /> <span className="whitespace-normal">Generar Documento</span>
                              </button>
                              <a 
                                href={`/templates/mpp_template.pdf?v=${Date.now()}`}
                                target="_blank"
                                download="MPP_En_Blanco.pdf"
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center justify-center gap-1.5 py-1.5 px-4 bg-white text-slate-700 border border-slate-300 font-medium text-xs rounded-lg hover:bg-slate-50 shadow-sm transition-colors w-full text-center"
                                title="Descargar plantilla en blanco para llenado manual"
                              >
                                <Download className="w-3.5 h-3.5 shrink-0" /> <span className="whitespace-normal">Descargar en blanco</span>
                              </a>
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
                          {mppDoc && null}
                          {mppDoc && <RenderBotonesValidacion elemento_id={mppDoc.id} absolute={true} />}
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
                          {pepDoc && <RenderBotonesValidacion elemento_id={pepDoc.id} absolute={true} />}
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
                          {pepEmpDoc && null}
                          {pepEmpDoc && <RenderBotonesValidacion elemento_id={pepEmpDoc.id} absolute={true} />}
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
                          {djbfDoc && null}
                          {djbfDoc && <RenderBotonesValidacion elemento_id={djbfDoc.id} absolute={true} />}
                        </div>
                      );
                    })()}
                    {docs.filter(d => d.es_firmado && (d.tipo_documento === 'OTRO' || (!d.tipo_documento && !d.nombre_archivo.includes('RNVM') && !d.nombre_archivo.includes('MPP') && !d.nombre_archivo.includes('PEP_PERSONA') && !d.nombre_archivo.includes('PEP_EMPRESA') && !d.nombre_archivo.includes('DJBF')))).map(doc => (
                      <div 
                        key={doc.id}
                        className="relative p-5 rounded-2xl border-2 border-solid border-slate-200 transition-all flex flex-col items-center justify-center text-center bg-white hover:border-slate-300 hover:shadow-md"
                      >

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
                          <RenderBotonesValidacion elemento_id={doc.id} absolute={true} />
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
            ) : rightActiveTab === 'historial' ? (
              <div className="mb-0">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-amber-100 text-amber-600 rounded-xl">
                    <Activity className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-800">Historial del Negocio</h3>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                  {historial.length === 0 ? (
                    <div className="text-center py-10 text-slate-500">
                      <Activity className="w-10 h-10 mx-auto mb-3 opacity-20" />
                      <p>No hay eventos registrados en el historial todavía.</p>
                    </div>
                  ) : (
                    <div className="relative pl-6 border-l-2 border-slate-100 space-y-8">
                      {historial.map((evento, idx) => {
                        let Icono = Activity;
                        let iconBg = "bg-slate-100 text-slate-500";
                        
                        if (evento.tipo_evento === 'CREACION' || evento.tipo_evento === 'CREACION_NEGOCIO') {
                          Icono = Star;
                          iconBg = "bg-yellow-100 text-yellow-600";
                        } else if (evento.tipo_evento === 'DOCUMENTO_CARGADO' || evento.tipo_evento === 'SISTEMA') {
                          Icono = Paperclip;
                          iconBg = "bg-blue-100 text-blue-600";
                        } else if (evento.tipo_evento === 'VALIDACION') {
                          Icono = evento.descripcion.includes('APROBADO') || evento.descripcion.includes('Visto Bueno') ? Check : X;
                          iconBg = evento.descripcion.includes('APROBADO') || evento.descripcion.includes('Visto Bueno') ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600";
                        } else if (evento.tipo_evento === 'KANBAN') {
                          Icono = ArrowRight;
                          iconBg = "bg-purple-100 text-purple-600";
                        }

                        return (
                          <div key={evento.id || idx} className="relative">
                            <div className={`absolute -left-[37px] p-1.5 rounded-full border-[3px] border-white ${iconBg}`}>
                              <Icono className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold text-slate-800">{evento.descripcion}</span>
                              <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 font-medium">
                                <span>{evento.usuario_email.split('@')[0]}</span>
                                <span>•</span>
                                <span>{format(new Date(evento.created_at), "dd MMM yyyy, HH:mm", { locale: es })}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
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
