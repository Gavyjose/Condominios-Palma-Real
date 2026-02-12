# SOP: Generación de Reportes PDF

## Contexto
El sistema genera reportes oficiales (Actas, Relaciones, etc.) directamente en el navegador del cliente para evitar carga en el servidor.

## Stack Tecnológico
- **Core**: `jspdf` (v2.x).
- **Tablas**: `jspdf-autotable`.

## Reglas de Implementación (Invariantes)

### 1. Importación Explícita
Debido a problemas de bundling con Vite/React, **NUNCA** confiar en la inyección automática de `autoTable` en el prototipo de `jsPDF`.

**Incorrecto ❌**:
```javascript
import "jspdf-autotable";
// ...
doc.autoTable({ ... }); // Puede fallar silenciosamente
```

**Correcto ✅**:
```javascript
import autoTable from "jspdf-autotable";
// ...
autoTable(doc, { ... }); // Invocación directa
```

### 2. Manejo de Errores
Toda función generadora debe envolverse en un bloque `try/catch` user-friendly.

```javascript
try {
  generatePDF.miReporte(data);
} catch (error) {
  alert("Error al generar PDF: " + error.message);
}
```

### 3. Origen de Datos
Los reportes deben usar **estrictamente** los datos pasados como argumento (snapshot), no leer variables globales ni hacer fetchs nuevos, para garantizar consistencia con lo que el usuario ve en pantalla.
