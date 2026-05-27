# Documentación del Sistema: Flujo Facturación (Suzuval CRM)

> [!NOTE]
> Este documento contiene la arquitectura, reglas de negocio y especificaciones técnicas de la aplicación "Flujo Facturación" construida sobre Next.js y Supabase.

---

## 1. Descripción General de la App
**Suzuval CRM - Flujo de Facturación** es una aplicación web moderna orientada a la gestión comercial automotriz. Digitaliza de forma integral el seguimiento de las ventas de vehículos, desde la apertura del negocio (cotización) hasta la facturación definitiva. Funciona como un punto de encuentro entre los equipos de ventas, jefaturas de sucursal y el departamento administrativo.

## 2. Objetivo del Sistema
El objetivo principal es proveer visibilidad, control y trazabilidad en el pipeline de ventas. El sistema busca:
- Estandarizar la recolección de datos de ventas (precios, bonos, retomas, impuestos).
- Asegurar que todo negocio pase por un filtro de auditoría administrativa antes de la facturación.
- Centralizar la documentación requerida por normativas (RNVM, MPP, PEP, DJBF).
- Medir la eficiencia a través de indicadores de cumplimiento de metas mensuales.

## 3. Módulos y Funcionalidades
1. **Tablero de Negocios (Pipeline):** Múltiples vistas (Kanban interactivo con *Drag & Drop*, Lista tabular y Vista apilada) para gestionar el estado de los negocios.
2. **Calculadora Financiera:** Formulario avanzado de facturación (`formularios_facturacion`) que procesa bonos (Marca, Amicar), costos de flete, patentes, impuesto verde y saldo final.
3. **Gestión Documental:** Almacenamiento y vinculación de archivos PDF a cada operación, con historial de versiones.
4. **Centro de Interacción y Auditoría:** Registro de eventos (Audit Trail) automáticos por cambio de estado y chats internos en cada negocio.
5. **Dashboard de Rendimiento:** Tarjetas de métricas (Negocios Pendientes, Con Observaciones, Aprobados) y seguimiento de meta mensual.
6. **Panel de Administración:** Gestión de usuarios, perfiles, sucursales y configuraciones iniciales del sistema.

## 4. Flujo Completo de Usuarios

El ciclo de vida estándar de un "Negocio" dentro de la aplicación sigue estos pasos:

```text
┌──────────────────┐
│   📝 Creación    │ (Vendedor / Jefe crea negocio)
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ ⏳ Para Revisión │ 
└────────┬─────────┘
         │
         ├───(Control Ventas detecta problemas)───► ┌────────────────────────┐
         │                                          │ ⚠️ Revisado en Espera  │
         ◄───(Vendedor corrige)─────────────────────└────────────────────────┘
         │
         │ (Admin aprueba negocio)
         ▼
┌──────────────────┐
│ ✅ Revisado OK   │
└────────┬─────────┘
         │
         │
         ▼
┌──────────────────┐
│ 🏁 Facturado     │
└──────────────────┘
```

1. **Ingreso:** El vendedor crea un registro y completa la calculadora de valores.
2. **Revisión:** El equipo administrativo revisa la coherencia de datos y los documentos cargados.
3. **Iteración:** Si faltan datos, el negocio retrocede con comentarios u observaciones.
4. **Cierre:** Al estar todo conforme, se aprueba y posteriormente se marca como facturado (sumando a la meta mensual).

## 5. Roles y Permisos (RBAC)

La base de datos (Supabase) cuenta con políticas de *Row Level Security (RLS)* que limitan la visibilidad de datos basados en el `user_role` y la sucursal asignada (`tipo_sucursal`).

| Rol | Alcance de Visibilidad | Capacidades principales |
| :--- | :--- | :--- |
| **VENDEDOR** | Solo negocios de su propia sucursal | Crear negocios, adjuntar documentos, responder observaciones. |
| **JEFE** | Negocios de su sucursal asignada | Supervisar a vendedores, editar condiciones comerciales. |
| **ADMINISTRATIVO** | Global (Todas las sucursales) | Mover a *Revisado OK* o *Revisado en Espera*, auditar. |
| **GERENCIA** | Global | Ver métricas, cuadros de mando, historial sin restricciones. |
| **ADMIN** | Global (Full Access) | Configuración de sistema, administración de usuarios. |

## 6. Pantallas Principales
*   **`/` (Dashboard Summary):** KPI's en tiempo real, desglose de estados de negocios y progreso mensual (`page.tsx`).
*   **Vista Kanban / Tablas:** Tableros de seguimiento donde los negocios se organizan por columnas de estado.
*   **Nuevo Negocio Modal:** Interface de alta densidad para capturar información del cliente, vehículo y estructura de pagos.
*   **Vista de Detalle / Chat:** *Sidebar* y modales de revisión donde se aloja la caja de comentarios, historial y visualizador de PDFs.

## 7. Estructura de Base de Datos
Implementado en **PostgreSQL** (vía Supabase). Tablas críticas:
*   `perfiles`: Extiende `auth.users`, almacena rol, meta mensual y array de sucursales (`C026`, `C027`, etc.).
*   `negocios`: Tabla maestra de operaciones comerciales (RUT, ID de Vendedor, Estado).
*   `formularios_facturacion`: Estructura 1:1 con negocios, detalla valores financieros.
*   `documentos_negocio`: Almacena referencias a los *buckets* de Storage.
*   `comentarios_negocio` / `chats_generales`: Hilos de comunicación.
*   `vehiculos`: Catálogo y asignación de unidades (patentes, VINs).

## 8. APIs e Integraciones Externas
*   **Supabase Auth & Database:** Gestión de sesiones seguras vía OAuth (Google) y Email/Password, operaciones CRUD vía Supabase Client (App Router SSR).
*   **Supabase Storage:** Alojamiento seguro para PDFs de los negocios.
*   **Supabase Realtime:** *(Fase 9.2)* Sincronización en vivo de cambios en los tableros Kanban entre distintos usuarios.

## 9. Automatizaciones y Procesos Internos
*   **Auto-Healing de Perfiles:** Al ingresar por OAuth, se verifica si el usuario existe en `perfiles`; si no, se inicializa automáticamente con rol predeterminado.
*   **Auditoría Automática (Audit Log):** *Triggers* o funciones en el cliente que documentan automáticamente cuando un negocio cambia de estado o cuando se carga un documento oficial (RNVM, PEP, etc.).
*   **Filtro de Notificaciones:** Separación algorítmica entre *Logs de Sistema* (ocultos en la campana global pero visibles en la auditoría del negocio) y menciones humanas.

## 10. Variables de Entorno Utilizadas
Ubicadas en `.env.local` o provistas por el hosting (Vercel):
```env
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT-ID].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsIn...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5...
```
> [!WARNING]
> La `SUPABASE_SERVICE_ROLE_KEY` omite las políticas de seguridad (RLS). Únicamente debe usarse en *Server Actions* restringidos (Admin API).

## 11. Dependencias y Tecnologías
*   **Core:** Next.js 16.2.4 (App Router), React 19, TypeScript.
*   **Estilos:** Tailwind CSS 4, `clsx`, `tailwind-merge`, `lucide-react` (Íconos).
*   **Backend & DB:** `@supabase/ssr`, `@supabase/supabase-js`.
*   **Utilidades:** `@hello-pangea/dnd` (Drag & Drop para Kanban), `date-fns` (Fechas), `pdf-lib` / `pdf-parse` (Manipulación de Documentos), `xlsx` (Reportes Excel).

## 12. Arquitectura General
El proyecto sigue la arquitectura recomendada del **Next.js App Router**:
*   **Server Components por Defecto:** Las consultas directas a base de datos (ej. Dashboard) ocurren en el servidor garantizando seguridad y menor tiempo de carga.
*   **Server Actions (`actions.ts`):** Mutaciones de datos (crear negocio, actualizar estados) sin exponer lógicas SQL en el cliente.
*   **Middleware (`middleware.ts`):** Renueva los tokens de sesión de Supabase activamente y protege rutas privadas.
*   **UI Components:** Aislados en `src/components`, inyectados con `use client` solo cuando se requiere interactividad (formularios, dnd).

## 13. Posibles Mejoras (Roadmap)
1. **Gráficos Avanzados:** Implementar bibliotecas como *Recharts* para el dashboard de conversión que actualmente figura como "Próximamente".
2. **Firma Electrónica:** Integrar APIs de firma de documentos digitales nativamente.
3. **PWA (Progressive Web App):** Habilitar Service Workers y Manifiesto para poder instalar el CRM como app de escritorio/móvil nativa.
4. **Alertas por Email/SMS:** Usar Supabase Edge Functions + Resend para notificar a vendedores si un negocio fue rechazado.

## 14. Manual Básico de Uso
1. **Autenticación:** Accede vía el portal web e ingresa credenciales (Google o email).
2. **Crear Negocio:** En el panel principal, haz clic en *Nuevo Negocio*, completa los datos obligatorios del cliente y los valores de venta. Guarda el registro.
3. **Subir Documentos:** Entra al detalle del negocio (Click en la tarjeta) y usa la sección de Archivos para adjuntar PDFs.
4. **Cambiar Estado:** Si posees permisos, arrastra la tarjeta a "Revisado" o edita su estado. Los cambios quedarán registrados con tu nombre en el historial.

## 15. Procedimiento de Despliegue
> [!TIP]
> Dado que es una aplicación estándar de Next.js, Vercel es la plataforma recomendada (Zero Config).

**Despliegue a Producción (Vercel):**
1. Subir el repositorio a GitHub/GitLab.
2. Conectar el repositorio en la plataforma de Vercel.
3. En la configuración del proyecto, definir las 3 variables de entorno exactas de la sección 10 (apuntando al entorno de Producción de Supabase).
4. Hacer click en *Deploy*. Las futuras integraciones (push a la rama `main`) se autodesplegarán.

**Despliegue en Servidor Privado (Node.js/Docker):**
```bash
npm install
npm run build
npm start
```
Asegurar que el servidor tenga el puerto 3000 expuesto y configurado bajo un proxy reverso (Nginx) con soporte HTTPS.
