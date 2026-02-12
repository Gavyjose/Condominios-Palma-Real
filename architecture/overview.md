# Arquitectura del Sistema (Overview)

## Visión General
El proyecto "Condominio Torre 9" es una aplicación web full-stack para la gestión financiera del condominio.

### Componentes Principales

1.  **Frontend (UI Layer)**
    *   **Tecnología**: React (Vite).
    *   **Puerto Local**: 5173.
    *   **Responsabilidad**: Visualización de datos, formularios de captura (pagos), generación de PDFs en cliente.
    *   **Archivo Principal**: `src/App.jsx`.

2.  **Backend (API Layer)**
    *   **Tecnología**: Node.js + Express.
    *   **Puerto Local**: 3001.
    *   **Responsabilidad**: Intermediario de datos, lógica de persistencia.
    *   **Endpoints**: `/api/resumen`, `/api/gastos`, `/api/cobranzas`, etc.
    *   **Archivo Principal**: `server.js`.

3.  **Persistencia (Data Layer)**
    *   **Motor**: SQLite.
    *   **Archivo**: `d:\Escritorio\Antigravity\Condominio\condominio.db`.
    *   **Migración**: Datos originales importados desde `Condominio.xlsx`.

## Flujo de Datos
1.  **Lectura**: `App.jsx` -> `fetch()` -> `server.js` (Express) -> `sqlite3` -> `condominio.db`.
2.  **Escritura (Pagos)**: `App.jsx` (POST) -> `server.js` -> INSERT `notificaciones_pago`.
3.  **Reportes**: Datos en memoria (React state) -> `jspdf` (Browser) -> Archivo PDF.

## Consideraciones de Seguridad
- La base de datos es local.
- No hay autenticación implementada actualmente (acceso 'admin' vs 'owner' es por selección de UI).
