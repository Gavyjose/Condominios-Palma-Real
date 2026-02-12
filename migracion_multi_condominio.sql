-- =====================================================
-- MIGRACIÓN A SISTEMA MULTI-CONDOMINIO
-- =====================================================
-- Este script convierte la base de datos actual de condominio único
-- a un sistema que soporta múltiples condominios independientes
-- =====================================================

BEGIN TRANSACTION;

-- 1. Crear tabla de condominios
CREATE TABLE IF NOT EXISTS condominios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    nombre_torre TEXT,
    rif TEXT,
    direccion TEXT,
    activo INTEGER DEFAULT 0,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Migrar configuración actual a primer condominio
INSERT INTO condominios (nombre, nombre_torre, rif, direccion, activo)
SELECT 
    COALESCE((SELECT valor FROM ajustes WHERE clave = 'nombre_condominio'), 'RESIDENCIA PALMA REAL'),
    COALESCE((SELECT valor FROM ajustes WHERE clave = 'nombre_torre'), 'TORRE 9'),
    COALESCE((SELECT valor FROM ajustes WHERE clave = 'rif'), 'J-00000000-0'),
    COALESCE((SELECT valor FROM ajustes WHERE clave = 'direccion'), 'VALENCIA, VENEZUELA'),
    1;

-- 3. Agregar columna condominio_id a apartamentos
ALTER TABLE apartamentos ADD COLUMN condominio_id INTEGER DEFAULT 1 REFERENCES condominios(id);

-- 4. Agregar columna condominio_id a gastos
ALTER TABLE gastos ADD COLUMN condominio_id INTEGER DEFAULT 1 REFERENCES condominios(id);

-- 5. Agregar columna condominio_id a cobranzas
ALTER TABLE cobranzas ADD COLUMN condominio_id INTEGER DEFAULT 1 REFERENCES condominios(id);

-- 6. Agregar columna condominio_id a cuotas_especiales
ALTER TABLE cuotas_especiales ADD COLUMN condominio_id INTEGER DEFAULT 1 REFERENCES condominios(id);

-- 7. Agregar columna condominio_id a reserva
ALTER TABLE reserva ADD COLUMN condominio_id INTEGER DEFAULT 1 REFERENCES condominios(id);

-- 8. Agregar columna condominio_id a notificaciones_pago
ALTER TABLE notificaciones_pago ADD COLUMN condominio_id INTEGER DEFAULT 1 REFERENCES condominios(id);

-- 9. Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_apartamentos_condominio ON apartamentos(condominio_id);
CREATE INDEX IF NOT EXISTS idx_gastos_condominio ON gastos(condominio_id);
CREATE INDEX IF NOT EXISTS idx_cobranzas_condominio ON cobranzas(condominio_id);
CREATE INDEX IF NOT EXISTS idx_cuotas_condominio ON cuotas_especiales(condominio_id);
CREATE INDEX IF NOT EXISTS idx_reserva_condominio ON reserva(condominio_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_condominio ON notificaciones_pago(condominio_id);

COMMIT;

-- Verificación
SELECT 'Migración completada. Total de condominios:', COUNT(*) FROM condominios;
