-- Migration para crear tabla de formularios de facturación (Calculadora)

CREATE TABLE IF NOT EXISTS public.formularios_facturacion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    rut TEXT NOT NULL UNIQUE,
    nombre_apellido TEXT,
    tipo_compra TEXT,
    precio_lista NUMERIC DEFAULT 0,
    bono_marca NUMERIC DEFAULT 0,
    bono_amicar_suzuval NUMERIC DEFAULT 0,
    bono_amicar_derco NUMERIC DEFAULT 0,
    flete_grabado NUMERIC DEFAULT 0,
    precio_venta_accesorios NUMERIC DEFAULT 0,
    mantencion_10 NUMERIC DEFAULT 0,
    mantencion_20 NUMERIC DEFAULT 0,
    mantencion_30 NUMERIC DEFAULT 0,
    inscripcion NUMERIC DEFAULT 0,
    permiso_circulacion NUMERIC DEFAULT 0,
    soap_sello_verde NUMERIC DEFAULT 0,
    impuesto_verde NUMERIC DEFAULT 0,
    dcto_suzuval_zqdv NUMERIC DEFAULT 0,
    aporte_marca_derco_z126 NUMERIC DEFAULT 0,
    pagos_comprobantes JSONB DEFAULT '[]'::jsonb,
    precio_final NUMERIC DEFAULT 0,
    saldo_pendiente NUMERIC DEFAULT 0,
    creador_email TEXT
);

-- Habilitar RLS si se desea (en este caso lo dejamos desactivado o agregamos politicas)
ALTER TABLE public.formularios_facturacion ENABLE ROW LEVEL SECURITY;

-- Politica para permitir todo temporalmente o permitir segun autenticacion
CREATE POLICY "Permitir todo a anon y authenticated" 
ON public.formularios_facturacion 
FOR ALL USING (true);
