# 🚗 Flujo Facturación - Suzuval CRM

![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-blue?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?logo=tailwind-css)
![Supabase](https://img.shields.io/badge/Supabase-DB_%26_Auth-3ECF8E?logo=supabase)

**Flujo Facturación Suzuval** es una aplicación web integral diseñada para **digitalizar, centralizar y agilizar** el flujo completo de ventas de vehículos nuevos. Conecta en tiempo real a equipos de ventas, jefaturas de sucursal y al departamento administrativo.

---

## ✨ Características Principales

- 📊 **Tablero Kanban Interactivo**: Visualiza y arrastra negocios entre diferentes etapas (Creación, Revisión, Aprobación, Facturación).
- 🗂️ **Carpeta Digital Automatizada**: Gestión completa en la nube de documentos y comprobantes (PDF, Imágenes). ¡Despídete del papel!
- 🧮 **Calculadora Financiera Integrada**: Calcula automáticamente los valores del vehículo, financiamiento, bonos, fletes, patentes e impuesto verde basado en parámetros actualizados del SII.
- 💬 **Centro de Interacción**: Chat interno e historial de auditoría (Audit Trail) por cada negocio.
- 🛡️ **Roles y Permisos (RBAC)**: Accesos seguros con vistas especializadas según tu rol (Vendedor, Jefe de Sucursal, Administrativo, Gerencia, Admin).

---

## 🛠️ Stack Tecnológico

El proyecto está construido sobre una arquitectura moderna orientada al rendimiento y la seguridad:

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Frontend**: React 19, Tailwind CSS 4, Lucide Icons, Hello-Pangea DND (Drag & Drop)
- **Backend & Base de Datos**: [Supabase](https://supabase.com/) (PostgreSQL), Supabase Storage
- **Lenguaje**: TypeScript (Tipado estricto)
- **Calidad de Código**: ESLint (0 errores garantizados en integración continua)

---

## 🚀 Instalación y Despliegue Local

Sigue estos pasos para ejecutar la aplicación en tu entorno local:

### 1. Clonar el Repositorio
```bash
git clone https://github.com/tu-organizacion/suzuval-crm.git
cd suzuval-crm
```

### 2. Instalar Dependencias
```bash
npm install
```

### 3. Configurar Variables de Entorno
Crea un archivo `.env.local` en la raíz del proyecto y añade las siguientes claves (solicítalas a tu administrador de infraestructura):

```env
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT-ID].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aqui
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui
```
> ⚠️ **Advertencia**: La clave `SUPABASE_SERVICE_ROLE_KEY` evade las políticas de seguridad (RLS). Jamás debe ser expuesta en el código del cliente.

### 4. Ejecutar el Servidor de Desarrollo
```bash
npm run dev
```

Abre tu navegador en [http://localhost:3000](http://localhost:3000) para ver la aplicación funcionando.

---

## 🏗️ Estructura del Proyecto

- `src/app/` - Rutas y vistas de Next.js (App Router).
- `src/components/` - Componentes reutilizables de UI (Kanban, Modales, Botones).
- `src/utils/` - Utilidades, hooks personalizados y configuración del cliente de Supabase.
- `src/proxy.ts` - Archivo encargado de interceptar y manejar el flujo seguro de sesiones y autenticación (Supabase Auth).

---

## 📚 Documentación Adicional

Para más detalles sobre las reglas de negocio específicas, modelos de la base de datos o arquitectura profunda, consulta la [Documentación Unificada](./DOCUMENTACION_UNIFICADA.md).

---
*Hecho con ❤️ para Suzuval.*
