import Papa from 'papaparse';

export interface VehiculoStock {
  INTERNO: string;
  MARCA: string;
  'MOD. VEHÍCULO': string;
  'DESCRIPCIÓN MODELO': string;
  COLOR: string;
  'N° DE CHASIS': string;
  AÑO: string;
}

const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRJ0mE3luOCBvq_o0Nr3jKqDo9k3HIVRtMPFxNGdPFBTlCEixseIwYT-obUNj608DGAvrpXonBQl0zk/pub?gid=0&single=true&output=csv';

// Cache simple en memoria para evitar descargar el CSV múltiples veces durante la navegación
let stockCache: VehiculoStock[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION_MS = 1000 * 60 * 5; // 5 minutos

/**
 * Descarga y procesa el CSV de stock de vehículos
 */
export async function fetchStockNuevos(): Promise<VehiculoStock[]> {
  const now = Date.now();
  if (stockCache && (now - lastFetchTime < CACHE_DURATION_MS)) {
    return stockCache;
  }

  try {
    const response = await fetch(CSV_URL);
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    const csvText = await response.text();

    return new Promise((resolve, reject) => {
      Papa.parse<VehiculoStock>(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header, index) => {
          if (index === 1) return 'MARCA'; // The 2nd column is always MARCA, even if the header is wrongly named in the CSV
          return header;
        },
        complete: (results) => {
          stockCache = results.data;
          lastFetchTime = Date.now();
          resolve(results.data);
        },
        error: (error: any) => {
          console.error('Error parseando CSV:', error);
          reject(error);
        }
      });
    });
  } catch (error) {
    console.error('Error obteniendo CSV de stock_nuevos:', error);
    return stockCache || []; // Retorna el caché antiguo si falla o arreglo vacío
  }
}

/**
 * Busca un vehículo por su código de modelo exacto
 */
export async function buscarPorModelo(codigoModelo: string): Promise<VehiculoStock | null> {
  if (!codigoModelo) return null;
  const stock = await fetchStockNuevos();
  const found = stock.find(v => v['MOD. VEHÍCULO'].toUpperCase() === codigoModelo.toUpperCase());
  return found || null;
}

/**
 * Busca un vehículo por su número interno
 */
export async function buscarPorInterno(interno: string): Promise<VehiculoStock | null> {
  if (!interno) return null;
  const stock = await fetchStockNuevos();
  const found = stock.find(v => v.INTERNO.toUpperCase() === interno.toUpperCase());
  return found || null;
}
