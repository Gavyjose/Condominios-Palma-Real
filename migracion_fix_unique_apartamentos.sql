-- =====================================================
-- MIGRACIÓN: Corrección de Restricción UNIQUE en Apartamentos
-- =====================================================
-- Problema: La restricción UNIQUE actual solo está en 'codigo',
-- impidiendo que diferentes torres tengan apartamentos con el mismo nombre.
-- Solución: UNIQUE sobre (codigo, condominio_id)
-- =====================================================

BEGIN TRANSACTION;

-- 1. Crear nueva tabla temporal con la restricción correcta
CREATE TABLE apartamentos_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT NOT NULL,
    propietario TEXT,
    condominio_id INTEGER DEFAULT 1 NOT NULL REFERENCES condominios(id),
    UNIQUE(codigo, condominio_id)  -- ✅ Restricción compuesta
);

-- 2. Copiar datos de la tabla anterior
INSERT INTO apartamentos_new (id, codigo, propietario, condominio_id)
SELECT id, codigo, propietario, COALESCE(condominio_id, 1)
FROM apartamentos;

-- 3. Eliminar tabla anterior
DROP TABLE apartamentos;

-- 4. Renombrar nueva tabla
ALTER TABLE apartamentos_new RENAME TO apartamentos;

-- 5. Recrear índice para optimización
CREATE INDEX IF NOT EXISTS idx_apartamentos_condominio ON apartamentos(condominio_id);

COMMIT;

-- Verificación
SELECT 'Migración completada. Apartamentos por condominio:',
       condominio_id, COUNT(*) as total
FROM apartamentos
GROUP BY condominio_id;
