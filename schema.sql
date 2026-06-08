-- ============================================================
-- SUZUVAL CRM — FLUJO FACTURACIÓN
-- Schema consolidado (modelo limpio)
-- Actualizado: 2026-06-02
-- ============================================================


-- ============================================================
-- TIPOS ENUM
-- ============================================================

-- Roles de usuario
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'VENDEDOR',
    'JEFE',
    'ADMINISTRATIVO',
    'GERENCIA',
    'ADMIN'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Códigos de sucursal
DO $$ BEGIN
  CREATE TYPE tipo_sucursal AS ENUM (
    'C026', -- CF. LA CALERA
    'C027', -- CF. VIÑA DEL MAR
    'C028', -- CF. VALPARAISO
    'C031', -- CF. SAN ANTONIO
    'C041', -- CF. CONCON
    'C157', -- CF. ESPACIO URBANO
    'C168'  -- CF. MELIPILLA
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- 1. PERFILES
-- Extiende auth.users con rol, sucursales, estado y meta.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.perfiles (
  id               uuid         REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nombre_completo  text,
  email            text,
  rol              user_role    DEFAULT 'VENDEDOR'::user_role,
  estado           text         DEFAULT 'ACTIVO',
  sucursales       tipo_sucursal[] DEFAULT '{}',
  meta_mensual     integer      DEFAULT 12,
  created_at       timestamptz  DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth leer perfiles" ON public.perfiles;
CREATE POLICY "Auth leer perfiles"
ON public.perfiles FOR SELECT TO authenticated
USING (true);


-- ============================================================
-- FUNCIONES DE SEGURIDAD PARA RLS
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_rol()
RETURNS text AS $$
  SELECT rol::text FROM public.perfiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_user_sucursales()
RETURNS tipo_sucursal[] AS $$
  SELECT sucursales FROM public.perfiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ============================================================
-- 2. NEGOCIOS
-- Tabla maestra de operaciones comerciales.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.negocios (
  -- Identificadores
  interno                       text        PRIMARY KEY,
  pedido_venta                  text        UNIQUE NOT NULL,

  -- Fechas
  fecha_envio                   date,
  
  -- Cliente
  rut                           text,
  observacion                   text,
  chasis                        text,
  cod_modelo_vehiculo           text,
  ano_facturacion               integer,
  
  -- Relación con la cuadratura de valores
  cuadratura_id                 bigint,
  
  -- Fechas/Estados internos
  estado                        text        DEFAULT 'INGRESADO',
  created_at                    timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  updated_at                    timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  
  -- Auditoría y revisiones
  observacion_inicial           text,
  suc_vta                       text,
  vendedor_id                   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  vendedor_nombre               text,
  tipo_compra                   text,
  saldo                         text,

  -- Booleans comerciales
  prepago_vigente               boolean     DEFAULT false,
  fecha_vencimiento_prepago     date,
  retoma_usado                  boolean     DEFAULT false,
  accesorios_instalados         boolean     DEFAULT false,
  gestion_accesorios            text,
  mantencion_prepagada          boolean     DEFAULT false,
  aporte_promocion_marca        boolean     DEFAULT false,

  -- Links externos
  link_drive_pedido_venta       text,
  link_archivos_supabase        text
);

ALTER TABLE public.negocios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Visibilidad libre"                        ON public.negocios;
DROP POLICY IF EXISTS "Visibilidad Negocios por Rol y Sucursal" ON public.negocios;
DROP POLICY IF EXISTS "Permitir Insertar a todos"               ON public.negocios;
DROP POLICY IF EXISTS "Permitir Modificar"                      ON public.negocios;

CREATE POLICY "Visibilidad Negocios por Rol y Sucursal"
ON public.negocios FOR SELECT TO authenticated
USING (
  (public.get_user_rol() IN ('ADMIN', 'GERENCIA', 'ADMINISTRATIVO'))
  OR (
    public.get_user_rol() IN ('VENDEDOR', 'JEFE')
    AND EXISTS (
      SELECT 1 FROM unnest(public.get_user_sucursales()) AS sucursal_codigo
      WHERE suc_vta LIKE '%' || sucursal_codigo::text || '%'
    )
  )
);

CREATE POLICY "Permitir Insertar a todos"
ON public.negocios FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Permitir Modificar"
ON public.negocios FOR UPDATE TO authenticated
USING (true);


-- ============================================================
-- 3. DOCUMENTOS DEL NEGOCIO
-- Archivos PDF y otros adjuntos a cada operación.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.negocios_documentos (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_venta     text        NOT NULL REFERENCES public.negocios(pedido_venta) ON DELETE CASCADE,
  nombre_archivo   text        NOT NULL,
  tipo_documento   text,
  estado_validacion text       DEFAULT 'PENDIENTE_REVISION',
  es_firmado       boolean     DEFAULT false,
  tamano_kb        numeric,
  url              text        NOT NULL,
  usuario_email    text,
  is_global        boolean     DEFAULT false,
  created_at       timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.negocios_documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth leer documentos"      ON public.negocios_documentos;
DROP POLICY IF EXISTS "Auth insertar documentos"   ON public.negocios_documentos;
DROP POLICY IF EXISTS "Auth actualizar documentos" ON public.negocios_documentos;
DROP POLICY IF EXISTS "Auth eliminar documentos"   ON public.negocios_documentos;

CREATE POLICY "Auth leer documentos"
ON public.negocios_documentos FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Auth insertar documentos"
ON public.negocios_documentos FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Auth actualizar documentos"
ON public.negocios_documentos FOR UPDATE TO authenticated
USING (true);

CREATE POLICY "Auth eliminar documentos"
ON public.negocios_documentos FOR DELETE TO authenticated
USING (true);


-- ============================================================
-- 4. PARÁMETROS SII (UTM / UTA / IPC)
-- Indicadores económicos mensuales para cálculos de impuesto.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.parametros_sii (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  anio            integer     NOT NULL,
  mes             integer     NOT NULL CHECK (mes BETWEEN 1 AND 12),
  utm             numeric,
  uta             numeric,
  ipc_puntos      numeric,
  ipc_mensual     numeric,
  ipc_acumulado   numeric,
  ipc_12_meses    numeric,
  created_at      timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE (anio, mes)
);

ALTER TABLE public.parametros_sii ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso autenticado a parametros_sii"             ON public.parametros_sii;
DROP POLICY IF EXISTS "Enable all actions for authenticated users"       ON public.parametros_sii;
CREATE POLICY "Acceso autenticado a parametros_sii"
ON public.parametros_sii FOR ALL TO authenticated
USING (true)
WITH CHECK (true);


-- ============================================================
-- NUEVA TABLA: DATOS ESPECÍFICOS DEL CLIENTE EN EL NEGOCIO
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clientes_datos_negocios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id bigint REFERENCES public.clientes(id) ON DELETE CASCADE,
  pedido_venta text REFERENCES public.negocios(pedido_venta) ON DELETE CASCADE,
  direccion text,
  comuna text,
  region text,
  mail text,
  movil text,
  contribuyente_electronico boolean DEFAULT false,
  tipo_negocio text,
  estado_civil text,
  comunidad_bienes boolean DEFAULT false,
  nacionalidad text,
  profesion_giro text,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.clientes_datos_negocios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth leer clientes_datos_negocios" ON public.clientes_datos_negocios;
DROP POLICY IF EXISTS "Auth insertar clientes_datos_negocios" ON public.clientes_datos_negocios;
DROP POLICY IF EXISTS "Auth actualizar clientes_datos_negocios" ON public.clientes_datos_negocios;

CREATE POLICY "Auth leer clientes_datos_negocios"
ON public.clientes_datos_negocios FOR SELECT TO authenticated USING (true);

CREATE POLICY "Auth insertar clientes_datos_negocios"
ON public.clientes_datos_negocios FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Auth actualizar clientes_datos_negocios"
ON public.clientes_datos_negocios FOR UPDATE TO authenticated USING (true);

-- ============================================================
-- 5. CUADRATURA Y PAGOS
-- ============================================================

-- Bucket principal de documentos
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos', 'documentos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow Public Select Documentos"  ON storage.objects;
DROP POLICY IF EXISTS "Allow Auth Insert Documentos"    ON storage.objects;
DROP POLICY IF EXISTS "Allow Auth Update Documentos"    ON storage.objects;
DROP POLICY IF EXISTS "Allow Auth Delete Documentos"    ON storage.objects;

CREATE POLICY "Allow Public Select Documentos"
ON storage.objects FOR SELECT
USING (bucket_id = 'documentos');

CREATE POLICY "Allow Auth Insert Documentos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documentos');

CREATE POLICY "Allow Auth Update Documentos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documentos');

CREATE POLICY "Allow Auth Delete Documentos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documentos');

-- Bucket para documentos de identidad (privado)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos_identidad', 'documentos_identidad', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Permitir subida publica de documentos"    ON storage.objects;
DROP POLICY IF EXISTS "Permitir lectura autenticada de documentos" ON storage.objects;

CREATE POLICY "Permitir subida publica de documentos"
ON storage.objects FOR INSERT TO public
WITH CHECK (bucket_id = 'documentos_identidad');

CREATE POLICY "Permitir lectura autenticada de documentos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documentos_identidad');

-- Bucket para firmas
INSERT INTO storage.buckets (id, name, public)
VALUES ('firmas', 'firmas', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Subida publica de firmas"     ON storage.objects;
DROP POLICY IF EXISTS "Lectura autenticada de firmas" ON storage.objects;
CREATE POLICY "Subida publica de firmas"
ON storage.objects FOR INSERT TO public
WITH CHECK (bucket_id = 'firmas');

CREATE POLICY "Lectura autenticada de firmas"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'firmas');


-- ============================================================
-- REALTIME
-- Habilitar replicación en tiempo real para tablas activas.
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'negocios'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.negocios;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'negocios_documentos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.negocios_documentos;
  END IF;
END $$;
