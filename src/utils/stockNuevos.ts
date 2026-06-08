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

// --- Precios y Bonos ---
const PRECIOS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRSuXOo9lZV_ArllKy2P8YBYkcpL-09r9aFjSnby3rienGZjBSoOBmIHOGcZGwbf-ffkyQ7Eo3iDgoT/pub?gid=2078446119&single=true&output=csv';

export interface PreciosBono {
  codigo: string;
  precioLista: number;
  bonoMarca: number;
}

let preciosCache: PreciosBono[] | null = null;
let lastPreciosFetchTime = 0;

export async function fetchPreciosData(): Promise<PreciosBono[]> {
  const now = Date.now();
  if (preciosCache && (now - lastPreciosFetchTime < CACHE_DURATION_MS)) {
    return preciosCache;
  }

  try {
    const response = await fetch(PRECIOS_CSV_URL);
    if (!response.ok) throw new Error(`HTTP: ${response.status}`);
    const csvText = await response.text();

    return new Promise((resolve, reject) => {
      Papa.parse<any>(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
        complete: (results) => {
          const parsed = results.data.map(row => {
            const parseAmount = (val: string) => {
              if (!val) return 0;
              return parseInt(val.replace(/[$\s.]/g, ''), 10) || 0;
            };
            return {
              codigo: (row['Código'] || '').trim(),
              precioLista: parseAmount(row['Precio Lista consolidada']),
              bonoMarca: parseAmount(row['Bono'])
            };
          }).filter(x => x.codigo !== '');
          
          preciosCache = parsed;
          lastPreciosFetchTime = Date.now();
          resolve(parsed);
        },
        error: (error: any) => {
          console.error('Error parseando CSV precios:', error);
          reject(error);
        }
      });
    });
  } catch (error) {
    console.error('Error obteniendo CSV de precios:', error);
    return preciosCache || [];
  }
}

export async function buscarPrecioBono(codigoModelo: string): Promise<PreciosBono | null> {
  if (!codigoModelo) return null;
  const precios = await fetchPreciosData();
  const found = precios.find(p => p.codigo.toUpperCase() === codigoModelo.toUpperCase());
  return found || null;
}
