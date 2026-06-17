# Documento Funcional

Este documento describe el propósito, alcance y funcionamiento general de la plataforma **Flujo de Facturación Suzuval**, diseñado para presentar la aplicación desde un punto de vista de negocio, roles y módulos principales.

---

## 1. Visión y Propósito de la Aplicación

La aplicación **Flujo Facturación Suzuval** nace con el objetivo de **digitalizar, centralizar y agilizar** el flujo completo de ventas de vehículos nuevos. Su finalidad es reemplazar los procesos manuales de correos electrónicos o dependientes de papel por un entorno digital unificado donde la información fluye en tiempo real entre las sucursales (ventas) y la administración central (control).

### ¿Por qué esta app?
- **Trazabilidad:** Permite saber en todo momento en qué estado exacto se encuentra la venta de un vehículo.
- **Eficiencia:** Elimina la pérdida de documentos físicos y correos electrónicos dispersos, unificando todo en una "Carpeta Digital" por pedido de venta.
- **Transparencia:** Conecta directamente a vendedores, jefes y administrativos bajo las mismas reglas y estado de la información.

---

## 2. Alcance del Sistema

La plataforma abarca desde que se ingresa la cotización y los datos del cliente, hasta que el negocio es aprobado financieramente y facturado.

**El sistema SÍ incluye:**
- Registro de datos personales y comerciales del comprador.
- Calculadora de valores exactos del vehículo, financiamiento, bonos, fletes y mantenciones.
- Gestión documental: carga, validación y almacenamiento en la nube de PDFs (Nota de venta, cédulas, firmas, PEP, ).
- Flujo de revisión por estados (Kanban) y chat de observaciones interno.

**El sistema NO incluye (Fuera de alcance inicial):**
- Gestión de inventario físico en bodega.
- Pasarelas de pago directas para que el cliente pague desde la app.
- Integración contable directa con ERPs externos para la emisión automática de la factura electrónica.

---

## 3. Roles de Usuario y Permisos

La plataforma cuenta con un sistema de acceso seguro (RBAC) donde cada persona ve solo lo que le corresponde:

- **Vendedor:** Registra nuevos negocios, sube la documentación del cliente y visualiza **exclusivamente** las carpetas de su propia sucursal o cartera.
- **Jefe de Sucursal:** Rol de supervisión. Puede ver y apoyar en la gestión de todos los vendedores asignados a su sucursal, pero no tiene permisos para aprobar una venta a nivel administrativo.
- **Administrativo / Control de Ventas:** Cuenta con una vista global. Es el encargado de recibir las carpetas enviadas por los vendedores, auditar la documentación y los números, y finalmente **Aprobar** o **Rechazar** el negocio (o enviarlo de vuelta con observaciones).
- **Gerencia / Admin:** Acceso maestro. Puede visualizar reportes generales, modificar configuraciones del sistema (como los parámetros del SII) y gestionar usuarios.

---

## 4. Módulos y Funciones Principales

1. **Tablero Principal (Vista Kanban):** 
   Una pantalla visual de tarjetas organizadas por columnas (`Pendiente de Revisión` -> `En Revisión` -> `OK Revisado` -> `Facturado`). Permite ver el avance general del mes con un solo vistazo.
   
2. **Carpeta Digital del Negocio:**
   El corazón del sistema. Al entrar a un negocio, el usuario ve:
   - Los datos del cliente y del vehículo.
   - El desglose exacto de la "Cuadratura" (financiamiento, bonos, saldos).
   - Un gestor de archivos donde el vendedor sube PDFs y el administrativo los valida uno por uno.
   - Un chat integrado para dejar observaciones específicas.

3. **Módulo de Firmas:**
   Sección dedicada para gestionar, previsualizar y asegurar el cumplimiento de la recolección de firmas digitales.

4. **Parámetros Automáticos (SII):**
   Módulo de configuración que actualiza el valor mensual de la UTM/UTA e IPC, para que los cálculos de impuestos verdes y retenciones siempre sean exactos sin intervención manual.
