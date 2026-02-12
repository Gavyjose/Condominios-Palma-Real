-- =====================================================
-- MIGRACIÓN: CONTROL HISTÓRICO Y CIERRES MENSUALES
-- =====================================================
-- Este script crea las tablas necesarias para soportar el cierre de meses
-- y el congelamiento de deudas y estados de cuenta.
-- =====================================================

BEGIN TRANSACTION;

-- 1. Tabla Maestra de Cierres Mensuales
-- Registra qué meses han sido cerrados para cada condominio
CREATE TABLE IF NOT EXISTS cierres_mensuales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    condominio_id INTEGER NOT NULL REFERENCES condominios(id),
    anio INTEGER NOT NULL,
    mes INTEGER NOT NULL, -- 1-12
    fecha_cierre DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_gastos_usd DECIMAL(10,2) DEFAULT 0,
    total_pagos_usd DECIMAL(10,2) DEFAULT 0,
    tasa_bcv_cierre DECIMAL(10,4), -- Tasa BCV al momento del cierre
    observaciones TEXT,
    UNIQUE(condominio_id, anio, mes) -- Un solo cierre por mes y condominio
);

-- 2. Tabla de Historial de Deudas (Snapshot)
-- Guarda la "foto" exacta de la deuda de cada apartamento al momento del cierre
CREATE TABLE IF NOT EXISTS historial_deudas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cierre_id INTEGER NOT NULL REFERENCES cierres_mensuales(id) ON DELETE CASCADE,
    apartamento_id INTEGER NOT NULL REFERENCES apartamentos(id),
    
    -- Deuda acumulada ANTES de este mes (Saldo Inicial)
    deuda_anterior_usd DECIMAL(10,2) DEFAULT 0,
    
    -- Lo que se generó este mes (Alicuota + Cuotas)
    monto_generado_mes_usd DECIMAL(10,2) DEFAULT 0,
    
    -- Lo que se pagó este mes
    monto_pagado_mes_usd DECIMAL(10,2) DEFAULT 0,
    
    -- Saldo Final (Deuda Total) al cierre del mes
    saldo_final_usd DECIMAL(10,2) NOT NULL,
    
    UNIQUE(cierre_id, apartamento_id)
);

-- 3. Índices para optimización
CREATE INDEX IF NOT EXISTS idx_cierres_condominio ON cierres_mensuales(condominio_id);
CREATE INDEX IF NOT EXISTS idx_cierres_fecha ON cierres_mensuales(anio, mes);
CREATE INDEX IF NOT EXISTS idx_historial_cierre ON historial_deudas(cierre_id);
CREATE INDEX IF NOT EXISTS idx_historial_apto ON historial_deudas(apartamento_id);

COMMIT;

-- Verificación
SELECT 'Tablas de historial creadas exitosamente.' AS status;
