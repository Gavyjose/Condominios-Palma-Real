# Constitución del Proyecto (Gemini Memory)

**Proyecto:** Gestión Condominio Torre 9
**Protocolo:** E.T.A.P.A. (v1.0)
**Estado:** Fase 0 (Inicialización)

Esta es la Fuente Única de Verdad (Single Source of Truth). Ningún código o decisión puede contradecir este archivo.

## 1. Reglas de Comportamiento (Leyes)
1.  **Determinismo**: Todo cambio debe ser reproducible mediante scripts en `tools/`. Nada manual.
2.  **Seguridad de Datos**: `condominio.db` es sagrada. Siempre respaldar antes de escribir.
3.  **Frontend Pasivo**: El frontend (React) es solo visualización. No debe contener lógica crítica de negocio (ej. cálculos de mora complejos) que no esté respaldada por el Backend/DB.
4.  **Bimoneda**: El sistema es híbrido (Bs y USD), pero la referencia de valor a largo plazo es USD.

## 2. Esquema de Datos (Data Schema)

El esquema SQL oficial (`esquema.sql`) se representa aquí como JSON estricto para referencia de agentes.

```json
{
  "database": "condominio.db",
  "tables": {
    "apartamentos": {
      "columns": ["id (PK)", "codigo (TEXT UNIQUE)", "propietario (TEXT)"],
      "description": "Unidades habitacionales (16 aptos)."
    },
    "gastos": {
      "columns": [
        "id (PK)", "mes_anio (TEXT YYYY-MM)", "concepto (TEXT)",
        "monto_usd (DEC)", "monto_bs (DEC)", "tasa_bcv (DEC)",
        "pago_usd (DEC)", "diferencia_usd (DEC)"
      ],
      "description": "Egresos mensuales que conforman la alícuota."
    },
    "cobranzas": {
      "columns": [
        "id (PK)", "apartamento_id (FK)", "mes_anio (TEXT)",
        "alicuota_usd (DEC)", "monto_pagado_usd (DEC)", "monto_pagado_bs (DEC)",
        "saldo_pendiente_usd (DEC)"
      ],
      "description": "Estado de cuenta por apartamento."
    },
    "notificaciones_pago": {
      "columns": [
        "id (PK)", "apartamento_codigo (TEXT)", "fecha_pago (DATE)",
        "monto (DEC)", "referencia (TEXT)", "estatus (ENUM: PENDIENTE, APROBADO, RECHAZADO)",
        "fecha_registro (DATETIME)"
      ],
      "description": "Bandeja de entrada de pagos reportados por usuarios."
    }
  }
}
```

## 3. Invariantes del Sistema
- **Backend Port**: 3001
- **Frontend Port**: 5173
- **DB Path**: `./condominio.db`
- **PDF Engine**: `jspdf` + `jspdf-autotable` (Importación explícita requerida).

## 4. Configuración (.env)
Todas las variables de entorno están centralizadas.
- `PORT`: Puerto Backend (Default: 3001).
- `DB_PATH`: Ruta relativa a la base de datos (Default: `condominio.db`).
- `VITE_API_URL`: URL de la API para el frontend.

## 5. Herramientas Maestras (tools/)
- `seed_data.py`: **PELIGRO**. Requiere flag `--force`. Borra la DB y la recrea desde `Condominio.xlsx`. Usar solo para reset total.
- `check_db.py`: Valida integridad de tablas. Seguro de usar.
- `test_api.py`: Valida disponibilidad del backend. Seguro de usar.
- `migrate_auth.js`: Crea tabla de usuarios y admin por defecto (user: admin, pass: admin123).

## 6. Autenticación y Seguridad
- **Login Obligatorio**: La aplicación requiere autenticación para acceder.
- **Usuario Admin**: `admin` / `admin123` (cambiar en producción).
- **JWT**: Token de sesión válido por 1 hora.
- **Rutas Protegidas**: POST/DELETE en `/api/gastos` requieren rol ADMIN.
