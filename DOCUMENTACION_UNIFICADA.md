# Documentación Unificada: Flujo Facturación (Suzuval CRM)

> [!NOTE]  
> Este documento unifica la visión de negocio, las reglas funcionales, la arquitectura técnica y el diccionario de datos de la plataforma "Flujo Facturación" (Suzuval CRM). Consolida el contenido de otros archivos dispersos en una sola fuente de verdad.

---

## 1. Visión y Propósito de la Aplicación

La aplicación **Flujo Facturación Suzuval** nace con el objetivo de **digitalizar, centralizar y agilizar** el flujo completo de ventas de vehículos nuevos. Funciona como un punto de encuentro entre los equipos de ventas, jefaturas de sucursal y el departamento administrativo.

### ¿Por qué esta app?
*   **Trazabilidad:** Permite saber en todo momento en qué estado exacto se encuentra la venta de un vehículo.
*   **Eficiencia:** Elimina la pérdida de documentos físicos y correos electrónicos, unificando todo en una "Carpeta Digital".
*   **Transparencia:** Conecta directamente a vendedores, jefes y administrativos bajo las mismas reglas de negocio y visibilidad en tiempo real.

### Alcance del Sistema
**El sistema SÍ incluye:**
*   Registro de datos personales y comerciales del comprador.
*   Calculadora financiera para valores del vehículo, financiamiento, bonos, fletes, patentes e impuesto verde.
*   Gestión documental (almacenamiento en la nube de PDFs, validación de notas de venta, cédulas, PEP, etc.).
*   Flujo de revisión por estados (Kanban) y chat de observaciones interno (Audit Trail).

**El sistema NO incluye:**
*   Gestión de inventario físico en bodega.
*   Pasarelas de pago directas para que el cliente pague desde la app.
*   Integración contable directa con ERPs externos para la emisión automática de factura electrónica.

---

## 2. Flujo Completo del Negocio (Pipeline)

El ciclo de vida estándar de un "Negocio" sigue estos pasos:

1.  **Creación (Ingreso):** El Vendedor o Jefe crea un negocio. Registra al cliente, completa la calculadora de valores y adjunta documentos.
2.  **Revisión:** El negocio pasa a estado "Para Revisión". El equipo administrativo audita los datos ingresados y la documentación oficial.
3.  **Iteración (Observaciones):** Si existen problemas, el administrativo cambia el estado a "Revisado en Espera" y deja comentarios. El vendedor debe corregir o adjuntar faltantes para enviar a una nueva revisión.
4.  **Aprobación:** Si todo está conforme, la administración aprueba el negocio pasándolo a "Revisado OK".
5.  **Facturación:** Finalmente se contabiliza y marca como "Facturado", impactando en la métrica de cumplimiento mensual de ventas.

### Módulos Principales
*   **Tablero de Negocios (Kanban / Tabla):** Interfaz central para mover y visualizar el avance de las ventas por estados.
*   **Carpeta Digital / Vista de Detalle:** Desglose exacto de la cuadratura del negocio y gestor de archivos adjuntos.
*   **Centro de Interacción:** Chats internos por negocio y registro automático de eventos de estado (Audit Log).
*   **Parámetros Automáticos (SII):** Configuración de valores mensuales (UTM, UTA, IPC) para cálculos impositivos automáticos.
*   **Panel de Rendimiento:** Dashboard con KPI's y seguimiento de metas mensuales.

---

## 3. Roles de Usuario y Permisos (RBAC)

La plataforma cuenta con un sistema de acceso seguro basado en *Row Level Security (RLS)* en la base de datos, lo que garantiza que cada usuario solo vea la información permitida.

| Rol | Nivel de Visibilidad | Permisos y Capacidades |
| :--- | :--- | :--- |
| **VENDEDOR** | Solo negocios de su propia sucursal | Crear negocios, adjuntar documentos, responder a observaciones. |
| **JEFE** | Todos los negocios de su sucursal | Supervisar a los vendedores de su local. No puede aprobar ventas a nivel administrativo. |
| **ADMINISTRATIVO** | Global (Todas las sucursales) | Recibir carpetas, auditar (Aprobar o Rechazar negocios), dejar observaciones. |
| **GERENCIA** | Global | Visualizar reportes y cuadros de mando. Acceso a todo el historial de ventas. |
| **ADMIN** | Global (Full Access) | Acceso maestro para configuración del sistema y administración de usuarios. |

---

## 4. Arquitectura y Stack Tecnológico

El proyecto sigue la arquitectura recomendada del App Router y está construido sobre:

*   **Core:** Next.js 16.2.4, React 19, TypeScript.
*   **Estilos y UI:** Tailwind CSS 4, `clsx`, `lucide-react` (Íconos). Funciones Drag & Drop (`@hello-pangea/dnd`).
*   **Base de Datos y Autenticación:** Supabase (PostgreSQL), `@supabase/ssr`. Autenticación vía OAuth y Credenciales.
*   **Almacenamiento:** Supabase Storage (Buckets segmentados).
*   **Patrones Next.js:** 
    * Uso predominante de *Server Components* para consultas directas y seguras a la DB.
    * Uso de *Server Actions* (`actions.ts`) para mutaciones de datos, no exponiendo lógicas en el cliente.
    * **Proxy (Antiguo Middleware):** Siguiendo las directrices modernas de Next.js (16.2+), el proyecto utiliza `src/proxy.ts` en reemplazo del antiguo `middleware.ts` para manejar de manera eficiente y nativa la intercepción de rutas y refresco de sesiones de Supabase.

### Calidad de Código y Optimización
El proyecto se mantiene con **0 advertencias y 0 errores de ESLint**. Se aplican reglas estrictas de React y TypeScript:
*   Eliminación de `any` para un tipado robusto.
*   Resolución estricta de dependencias en Hooks (`exhaustive-deps`) e inmutabilidad.
*   Prevención de renderizados en cascada extrayendo componentes estáticos fuera del flujo de render principal y evitando `setState` síncronos dentro de los efectos.

### Variables de Entorno (`.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT-ID].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsIn...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5...
```
> [!WARNING]  
> La `SUPABASE_SERVICE_ROLE_KEY` omite las políticas de seguridad (RLS). Únicamente debe usarse en entornos protegidos (*Server Actions*) para lógicas de Admin API.

---

## 5. Diccionario de Datos

Estructura de las tablas principales en la Base de Datos PostgreSQL:

### 5.1 Tabla: `perfiles`
Extiende los usuarios (`auth.users`) para manejar lógicas de negocio.
*   **PK:** `id` (FK hacia `auth.users(id)`)
*   **Atributos:** `nombre_completo`, `email`, `rol` (Enum), `estado`, `sucursales` (Array), `meta_mensual`.

### 5.2 Tabla: `negocios`
Tabla maestra de las operaciones comerciales.
*   **PK:** `pedido_venta` (Texto)
*   **Atributos clave:** `fecha_envio`, `rut` (cliente), `chasis`, `estado`, `suc_vta`, `vendedor_nombre`, `cuadratura_id` (FK hacia estructura financiera), booleanos operativos (`prepago_vigente`, `retoma_usado`, etc.).

### 5.3 Tabla: `negocios_documentos`
Archivos PDF adjuntos a un pedido de venta.
*   **PK:** `id` (UUID) / **FK:** `pedido_venta` -> `negocios(pedido_venta)`
*   **Atributos:** `nombre_archivo`, `tipo_documento`, `estado_validacion`, `url` (Storage), `es_firmado`, `tamano_kb`.

### 5.4 Tabla: `parametros_sii`
Indicadores económicos para automatización de impuestos.
*   **PK:** `id` (UUID) / **Unique:** `(anio, mes)`
*   **Atributos:** `utm`, `uta`, `ipc_puntos`, `ipc_mensual`, `ipc_12_meses`.

### 5.5 Tablas de Soporte y Flujo
*   `clientes`: Identidad, RUT centralizado, y referencias a documentos personales.
*   `clientes_datos_negocios`: Datos específicos del comprador al momento de hacer el trato (dirección, comuna, giro).
*   `cuadraturas` (y anexos `calculo_pc`, `cuadratura_valores_cliente`, `cuadratura_pagos`): Desglose del financiamiento, cobros, y cálculos relacionados a la venta.
*   `negocios_comentarios`: Historial del chat interno entre vendedores y control.
*   `negocios_validaciones`: Aprobaciones individuales de ciertos ítems.
*   `negocios_historial`: Bitácora inmutable (Audit Trail) que guarda un registro ante cambios de estado críticos.

---

## 6. Manual de Operación y Despliegue

### Procedimiento de Despliegue (Producción)
Dado que es una aplicación estándar Next.js, **Vercel** es la plataforma recomendada.
1. Conectar el repositorio a Vercel.
2. En las configuraciones del proyecto, establecer las 3 variables de entorno apuntando al entorno de Producción de Supabase.
3. Desplegar. Futuros `push` a la rama `main` iniciarán *deploys* automáticos.

### Manual Básico de Uso
1. **Acceso:** Inicia sesión con tus credenciales. (Si es primer ingreso por OAuth, el sistema auto-crea tu perfil base).
2. **Alta de Operación:** En el panel, presiona *Nuevo Negocio*, ingresa los parámetros requeridos de cliente, vehículo y cuadratura financiera.
3. **Carga de Archivos:** Selecciona la tarjeta del negocio creado y sube los documentos (PDFs) en la sección "Archivos".
4. **Flujo de Trabajo:** Usa la vista Kanban para arrastrar la tarjeta y cambiar los estados de tus ventas según avance la revisión y aprobación. Cada movimiento quedará auditado a tu nombre.
