# Biblioteca de Hallazgos (Findings)

Registro de conocimientos adquiridos, errores solucionados y restricciones técnicas descubiertas.

## 1. Generación de PDF (Frontend)
- **Problema**: `jspdf-autotable` falla si se importa solo como efecto secundario (`import "jspdf-autotable"`).
- **Solución E.T.A.P.A.**: Siempre usar importación explícita: `import autoTable from "jspdf-autotable"` y llamar a `autoTable(doc, options)`.
- **Restricción**: Las funciones de reporte deben tener manejo de errores `try/catch` con feedback visual al usuario.

## 2. Base de Datos (SQLite)
- **Estado**: Migrada desde Excel.
- **Precaución**: Las tablas `gastos` y `cobranzas` son el núcleo financiero. Cualquier script que las modifique debe hacer backup previo de la DB.

## 3. Entorno de Desarrollo (Node)
- **Dependencias**: A veces `npm install` falla por bloqueos de archivos en Windows. Solución: detener procesos node, borrar `node_modules` y reinstalar.
