-- Esquema SQL para Gestión de Condominio Torre 9
-- Soporta bimoneda (Bolívares Bs y Dólares $)

-- 1. Tabla de Apartamentos
CREATE TABLE apartamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT UNIQUE NOT NULL, -- Ej: 'PB-A', '3-D'
    propietario TEXT NOT NULL
);

-- 2. Tabla de Gastos Mensuales
CREATE TABLE gastos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mes_anio TEXT NOT NULL, -- Formato 'YYYY-MM'
    concepto TEXT NOT NULL,
    monto_usd DECIMAL(10, 2) DEFAULT 0.00,
    monto_bs DECIMAL(10, 2) DEFAULT 0.00,
    tasa_bcv DECIMAL(10, 4),
    pago_usd DECIMAL(10, 2) DEFAULT 0.00,
    diferencia_usd DECIMAL(10, 2) DEFAULT 0.00
);

-- 3. Tabla de Cobranzas (Cuentas por Cobrar)
CREATE TABLE cobranzas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    apartamento_id INTEGER NOT NULL,
    mes_anio TEXT NOT NULL,
    alicuota_usd DECIMAL(10, 2) NOT NULL,
    monto_pagado_usd DECIMAL(10, 2) DEFAULT 0.00,
    monto_pagado_bs DECIMAL(10, 2) DEFAULT 0.00,
    saldo_pendiente_usd DECIMAL(10, 2),
    FOREIGN KEY (apartamento_id) REFERENCES apartamentos(id)
);

-- 4. Tabla de Cuotas Especiales (Terraza, etc.)
CREATE TABLE cuotas_especiales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    apartamento_id INTEGER NOT NULL,
    descripcion TEXT NOT NULL,
    monto_usd DECIMAL(10, 2) NOT NULL,
    fecha_registro DATE DEFAULT CURRENT_DATE,
    FOREIGN KEY (apartamento_id) REFERENCES apartamentos(id)
);

-- 5. Tabla de Reserva (Movimientos de Caja)
CREATE TABLE reserva (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha DATE DEFAULT CURRENT_DATE,
    descripcion TEXT NOT NULL,
    tipo TEXT CHECK(tipo IN ('ENTRADA', 'SALIDA')) NOT NULL,
    monto_usd DECIMAL(10, 2) DEFAULT 0.00,
    monto_bs DECIMAL(10, 2) DEFAULT 0.00,
    referencia TEXT
);

-- Vista para calcular automáticamente la Alícuota por Mes
CREATE VIEW vista_alicuotas_mensuales AS
SELECT 
    mes_anio,
    SUM(monto_usd) as total_gastos_usd,
    (SUM(monto_usd) / 16.0) as alicuota_por_apto_usd
FROM gastos
GROUP BY mes_anio;

-- 6. Tabla de Notificaciones de Pago (Enviadas por vecinos)
CREATE TABLE notificaciones_pago (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    apartamento_codigo TEXT NOT NULL,
    fecha_pago DATE NOT NULL,
    monto DECIMAL(10, 2) NOT NULL,
    referencia TEXT NOT NULL,
    estatus TEXT CHECK(estatus IN ('PENDIENTE', 'APROBADO', 'RECHAZADO')) DEFAULT 'PENDIENTE',
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. Tabla de Usuarios (Autenticación)
CREATE TABLE usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    rol TEXT CHECK(rol IN ('ADMIN', 'PROPIETARIO')) NOT NULL,
    apartamento_id INTEGER, -- NULL para ADMIN, ID para PROPIETARIO
    FOREIGN KEY (apartamento_id) REFERENCES apartamentos(id)
);
