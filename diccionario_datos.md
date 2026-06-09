# Documentación y Diccionario de Datos: Flujo Facturación (Suzuval CRM)

## 1. Tablas, Atributos y Claves (Diccionario de Datos)

A continuación se listan las tablas detectadas en la base de datos de la aplicación, indicando sus atributos, Llaves Primarias (PK) y Foráneas (FK).

### 1.1 Tabla: `perfiles`
Extiende los usuarios de autenticación (`auth.users`) con datos específicos del rol y configuración en la empresa.
- **PK**: `id` (FK hacia `auth.users(id)`)
- **Atributos**:
  - `nombre_completo` (text)
  - `email` (text)
  - `rol` (user_role enum: VENDEDOR, JEFE, ADMINISTRATIVO, GERENCIA, ADMIN)
  - `estado` (text)
  - `sucursales` (arreglo de tipo_sucursal)
  - `meta_mensual` (integer)
  - `created_at` (timestamptz)

### 1.2 Tabla: `negocios`
Tabla maestra de operaciones comerciales (cotizaciones y ventas).
- **PK**: `pedido_venta` (text)
- **Atributos Principales**:
  - `interno` (text)
  - `fecha_envio` (date)
  - `rut` (text)
  - `chasis` (text), `cod_modelo_vehiculo` (text), `ano_facturacion` (integer)
  - `estado` (text)
  - `observacion_inicial` (text), `suc_vta` (text), `vendedor_nombre` (text)
  - `tipo_compra` (text), `saldo` (text)
  - `cuadratura_id` (bigint)
  - booleanos comerciales (`prepago_vigente`, `retoma_usado`, `accesorios_instalados`, etc.)
  - `link_drive_pedido_venta`, `link_archivos_supabase` (text)

### 1.3 Tabla: `negocios_documentos`
Archivos y documentos PDF adjuntos a cada negocio.
- **PK**: `id` (uuid)
- **FK**: `pedido_venta` -> `negocios(pedido_venta)`
- **Atributos**:
  - `nombre_archivo`, `tipo_documento`, `estado_validacion`, `url`, `usuario_email` (text)
  - `es_firmado`, `is_global` (boolean)
  - `tamano_kb` (numeric)
  - `created_at` (timestamptz)

### 1.4 Tabla: `parametros_sii`
Indicadores económicos (UTM, UTA, IPC) para los cálculos de impuesto.
- **PK**: `id` (uuid)
- **Llave Única**: Compuesta por `(anio, mes)`
- **Atributos**: `anio`, `mes`, `utm`, `uta`, `ipc_puntos`, `ipc_mensual`, `ipc_acumulado`, `ipc_12_meses`, `created_at`

### 1.5 Tabla: `clientes_datos_negocios`
Datos específicos del cliente capturados en el momento del negocio.
- **PK**: `id` (uuid)
- **FK**: 
  - `cliente_id` -> `public.clientes(id)` 
  - `pedido_venta` -> `public.negocios(pedido_venta)`
- **Atributos**:
  - `direccion`, `comuna`, `region`, `mail`, `movil`, `tipo_negocio`, `estado_civil`, `nacionalidad`, `profesion_giro` (text)
  - `contribuyente_electronico`, `comunidad_bienes` (boolean)
  - `created_at` (timestamptz)

### 1.6 Tablas de Soporte y Relaciones Internas
Adicionalmente, el sistema cuenta con las siguientes tablas para sostener funcionalidades específicas:
- **`clientes`**: Almacena de forma centralizada la información e identidad de cada comprador (RUT como campo único, nombre, firma digital y URLs de cédulas de identidad).
- **`cuadraturas`**: Tabla base referencial que amarra los datos financieros de una venta.
- **`mantencion_prepagada`**: Vinculada a `cuadraturas`, registra los paquetes de mantención (10k, 20k, 30k) contratados por el cliente.
- **`negocios_comentarios`**: Almacena el historial del chat interno y "Observaciones" (entre vendedores y área administrativa) propio de cada negocio.
- **`negocios_validaciones`**: Registra individualmente la aprobación o rechazo de elementos específicos por parte de Control de Ventas (ej. firma, documentos, datos financieros).
- **`negocios_historial`**: Bitácora inmutable (Audit Trail) que guarda un registro cada vez que el negocio cambia de estado o ocurre un evento crítico de sistema.
- **`calculo_pc`**, **`cuadratura_valores_cliente`** y **`cuadratura_pagos`**: Extensiones de la tabla base de cuadraturas que manejan el desglose del financiamiento, cobros, y cálculos relacionados.
- **`sucursales`**: Catálogo base para mapear el código y nombre de cada punto de venta en lugar de usar solo ENUMS quemados en código.

---

## 2. Puntos de Mejora Pendientes en la Base de Datos

Revisando la arquitectura de la aplicación, dejo constancia de las siguientes consideraciones para futuras refactorizaciones:

1. **Campos UUID vs Text:**
   - La PK `pedido_venta` de `negocios` usa texto libre. Salvo que tenga un formato específico irremplazable, el estándar de escalabilidad y rendimiento sugiere usar `UUID`.
2. **Manejo de Enums:**
   - Al crear Enums (ej. roles), el SQL ignora errores silenciosamente en lugar de usar un flujo robusto de migraciones. Recomendable transicionar a un sistema de control de versiones de BD (como Prisma o Drizzle) si el equipo de desarrollo crece.

---

## 3. Documentación del Funcionamiento de la App

Tienes una excelente base en tu archivo `DOCUMENTACION.md`, aquí tienes el resumen del funcionamiento de **Suzuval CRM - Flujo de Facturación** ideal para entregar a quien lo solicite:

### 🎯 Objetivo Principal
Digitalizar de forma integral el seguimiento de las ventas de vehículos, desde la apertura de la cotización hasta la facturación, siendo un punto de encuentro entre vendedores, jefaturas y el área de administración.

### 🔄 Flujo Completo de un Negocio (Pipeline)
1. **Creación (Estado: Ingresado):** Un Vendedor (o Jefe de Sucursal) crea un negocio en la app. Llena datos de cliente, detalles del auto, calculadora financiera (fletes, bonos, impuesto verde) y sube documentos adjuntos (PDF).
2. **Revisión en Control de Ventas (Estado: Para Revisión):** El equipo administrativo audita los datos ingresados y los documentos oficiales obligatorios.
3. **Iteración de Auditoría:** 
   - Si faltan datos o hay incongruencias, el equipo administrativo regresa el negocio al vendedor adjuntando "Observaciones" (comentarios).
   - El vendedor corrige o sube los archivos faltantes para una nueva revisión.
4. **Aprobación (Estado: Revisado OK):** Una vez que todo cuadra perfectamente, la administración aprueba el negocio.
5. **Facturación (Estado: Facturado):** Finalmente, se contabiliza y factura. Esto impacta directamente en la medición de meta mensual del vendedor y de la sucursal.

### 🔐 Roles de Usuario (RBAC)
- **Vendedor:** Crea negocios y puede ver únicamente los de su propia sucursal.
- **Jefe de Sucursal:** Supervisa a los vendedores de su local, pero no puede aprobar las ventas a nivel administrativo.
- **Administrativo:** Posee visión global, y su responsabilidad es auditar (Aprobar o Rechazar).
- **Gerencia / Admin:** Cuentan con el acceso general para analizar métricas en el Dashboard de Rendimiento y configurar el sistema.

### ⚙️ Características Técnicas Clave
- **Frontend / Backend:** Desarrollado sobre Next.js (App Router).
- **Base de Datos & Seguridad:** Supabase (PostgreSQL) con políticas Row Level Security (RLS) estrictas para garantizar que los vendedores solo vean su información.
- **Gestor de Archivos:** Supabase Storage, empleando buckets segmentados (públicos y privados) para albergar documentos de identidad y contratos de forma segura.
