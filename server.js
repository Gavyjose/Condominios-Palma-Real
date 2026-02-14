require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const xlsx = require('xlsx');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const pdf = require('pdf-parse');
const { readBCVFromTelegram } = require('./utils/telegramBCVReader');

const app = express();
const port = process.env.PORT || 3001;
const dbPath = path.join(__dirname, process.env.DB_PATH || 'condominio.db');

app.use(cors());
app.use(bodyParser.json());
app.use((req, res, next) => {
    console.log(`[DEBUG] ${req.method} ${req.url} - Auth: ${req.headers['authorization'] ? 'SÍ' : 'NO'}`);
    next();
});

// Configuración de Multer para archivos temporales
const upload = multer({ dest: 'uploads/' });

// Configuración de Multer para comprobantes de gastos
const storageGastos = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'uploads/gastos';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const uploadGastos = multer({ storage: storageGastos });

const db = new sqlite3.Database(dbPath);

// Inicializar tablas adicionales
db.serialize(() => {
    // Tabla para estados de cuenta bancarios
    db.run(`CREATE TABLE IF NOT EXISTS movimientos_bancarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha DATE,
        referencia TEXT UNIQUE,
        monto DECIMAL(10,2)
    )`);

    // Actualizar notificaciones_pago con campos de verificación
    db.run("ALTER TABLE notificaciones_pago ADD COLUMN status_banco TEXT DEFAULT 'PENDIENTE'", (err) => {
        if (!err) console.log("Columna status_banco añadida.");
    });
    db.run("ALTER TABLE notificaciones_pago ADD COLUMN validacion_ocr TEXT DEFAULT 'NO_VALIDADO'", (err) => {
        if (!err) console.log("Columna validacion_ocr añadida.");
    });
    db.run("ALTER TABLE gastos ADD COLUMN fecha DATE", (err) => {
        if (!err) console.log("Columna fecha añadida a gastos.");
    });
    db.run("ALTER TABLE gastos ADD COLUMN monto_pagado_usd DECIMAL(10,2) DEFAULT 0", (err) => {
        if (!err) console.log("Columna monto_pagado_usd añadida a gastos.");
    });
    db.run("ALTER TABLE gastos ADD COLUMN fecha_pago DATE", (err) => {
        if (!err) console.log("Columna fecha_pago añadida a gastos.");
    });
    db.run("ALTER TABLE gastos ADD COLUMN tasa_pago DECIMAL(10,2)", (err) => {
        if (!err) console.log("Columna tasa_pago añadida a gastos.");
    });
    db.run("ALTER TABLE gastos ADD COLUMN monto_pagado_bs DECIMAL(10,2) DEFAULT 0", (err) => {
        if (!err) console.log("Columna monto_pagado_bs añadida.");
    });
    db.run("ALTER TABLE gastos ADD COLUMN referencia TEXT", (err) => {
        if (!err) console.log("Columna referencia añadida.");
    });
    db.run("ALTER TABLE gastos ADD COLUMN comprobante_url TEXT", (err) => {
        if (!err) console.log("Columna comprobante_url añadida.");
    });
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_change_me';

// Middleware de autenticación
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        console.log(">>> AUTH FAIL: No token");
        return res.sendStatus(401);
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.log(">>> AUTH FAIL: JWT Verify Error", err.message);
            return res.sendStatus(403);
        }
        req.user = user;
        next();
    });
}

// ... (existente db connection)

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM usuarios WHERE username = ?", [username], async (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(400).json({ error: "Usuario no encontrado" });

        const validPass = await bcrypt.compare(password, user.password_hash);
        if (!validPass) return res.status(400).json({ error: "Contraseña incorrecta" });

        const token = jwt.sign({ id: user.id, rol: user.rol }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, rol: user.rol, username: user.username });
    });
});

// Middleware para asegurar que la tabla de notificaciones existe (Legacy support)
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS notificaciones_pago (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        apartamento_codigo TEXT NOT NULL,
        fecha_pago DATE NOT NULL,
        monto DECIMAL(10, 2) NOT NULL,
        referencia TEXT NOT NULL,
        estatus TEXT DEFAULT 'PENDIENTE',
        fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 8. Tabla de Ajustes Globales
    db.run(`CREATE TABLE IF NOT EXISTS ajustes (
        clave TEXT PRIMARY KEY,
        valor TEXT
    )`, () => {
        // Semillas iniciales si no existen
        const defaults = [
            ['nombre_condominio', 'Residencia Palma Real'],
            ['nombre_torre', 'Torre 9'],
            ['rif', 'J-00000000-0'],
            ['direccion', 'Urbanización Palma Real, Valencia, Venezuela']
        ];
        defaults.forEach(([clave, valor]) => {
            db.run("INSERT OR IGNORE INTO ajustes (clave, valor) VALUES (?, ?)", [clave, valor]);
        });
    });
});

// Endpoints
// ==============================================================================
// ENDPOINTS DE CONDOMINIOS (MULTI-EDIFICIO)
// ==============================================================================

// Listar todos los condominios
app.get('/api/condominios', (req, res) => {
    db.all("SELECT id, nombre, nombre_torre, rif, direccion, activo, fecha_creacion FROM condominios ORDER BY nombre", (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Obtener condominio activo
app.get('/api/condominios/activo', (req, res) => {
    db.get("SELECT id, nombre, nombre_torre, rif, direccion FROM condominios WHERE activo = 1", (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: "No hay condominio activo" });
        res.json(row);
    });
});

// Crear nuevo condominio
app.post('/api/condominios', authenticateToken, (req, res) => {
    if (req.user.rol !== 'ADMIN') return res.status(403).json({ error: "Acceso denegado" });

    const { nombre, nombre_torre, rif, direccion } = req.body;

    db.run(
        "INSERT INTO condominios (nombre, nombre_torre, rif, direccion, activo) VALUES (?, ?, ?, ?, 0)",
        [nombre, nombre_torre || '', rif || '', direccion || ''],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, message: "Condominio creado con éxito" });
        }
    );
});

// Actualizar condominio
app.put('/api/condominios/:id', authenticateToken, (req, res) => {
    if (req.user.rol !== 'ADMIN') return res.status(403).json({ error: "Acceso denegado" });

    const { id } = req.params;
    const { nombre, nombre_torre, rif, direccion } = req.body;

    db.run(
        "UPDATE condominios SET nombre = ?, nombre_torre = ?, rif = ?, direccion = ? WHERE id = ?",
        [nombre, nombre_torre || '', rif || '', direccion || '', id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Condominio actualizado con éxito" });
        }
    );
});

// Activar un condominio (desactivar los demás)
app.put('/api/condominios/:id/activar', authenticateToken, (req, res) => {
    if (req.user.rol !== 'ADMIN') return res.status(403).json({ error: "Acceso denegado" });

    const { id } = req.params;

    db.serialize(() => {
        // Desactivar todos
        db.run("UPDATE condominios SET activo = 0", (err) => {
            if (err) return res.status(500).json({ error: err.message });

            // Activar el seleccionado
            db.run("UPDATE condominios SET activo = 1 WHERE id = ?", [id], function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: "Condominio activado con éxito" });
            });
        });
    });
});

// Eliminar condominio (con validación)
app.delete('/api/condominios/:id', authenticateToken, (req, res) => {
    if (req.user.rol !== 'ADMIN') return res.status(403).json({ error: "Acceso denegado" });

    const { id } = req.params;

    // Verificar que no sea el último condominio
    db.get("SELECT COUNT(*) as count FROM condominios", (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row.count <= 1) {
            return res.status(400).json({ error: "No se puede eliminar el único condominio" });
        }

        // Verificar que no esté activo
        db.get("SELECT activo FROM condominios WHERE id = ?", [id], (err, condo) => {
            if (err) return res.status(500).json({ error: err.message });
            if (condo && condo.activo === 1) {
                return res.status(400).json({ error: "No se puede eliminar el condominio activo" });
            }

            // Eliminar el condominio
            db.run("DELETE FROM condominios WHERE id = ?", [id], function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: "Condominio eliminado con éxito" });
            });
        });
    });
});

// ==============================================================================
// ENDPOINTS DE CONFIGURACIÓN (LEGACY - MIGRADO)
// ==============================================================================

app.get('/api/config', (req, res) => {
    // 1. Obtener Ajustes Globales (Base)
    db.all("SELECT clave, valor FROM ajustes", (err, ajustesRows) => {
        if (err) return res.status(500).json({ error: err.message });
        const config = {};
        ajustesRows.forEach(r => config[r.clave] = r.valor);

        // 2. Obtener Condominio Activo (Sobreescribir)
        db.get("SELECT id, nombre, nombre_torre, rif, direccion FROM condominios WHERE activo = 1", (err, condo) => {
            if (err) {
                console.error("Error obteniendo condominio activo para config:", err);
                // Si falla, devolvemos solo ajustes (graceful degradation)
                return res.json(config);
            }

            if (condo) {
                config['nombre_condominio'] = condo.nombre;
                config['nombre_torre'] = condo.nombre_torre;
                config['rif'] = condo.rif;
                config['direccion'] = condo.direccion;
                config['condominio_id'] = condo.id;
            }

            res.json(config);
        });
    });
});

app.post('/api/config', authenticateToken, (req, res) => {
    if (req.user.rol !== 'ADMIN') return res.status(403).json({ error: "Acceso denegado" });
    const updates = req.body;

    db.serialize(() => {
        let hasError = false;
        Object.entries(updates).forEach(([clave, valor]) => {
            const valorFinal = typeof valor === 'string' ? valor.toUpperCase().trim() : valor;
            db.run("INSERT OR REPLACE INTO ajustes (clave, valor) VALUES (?, ?)", [clave, valorFinal], (err) => {
                if (err) {
                    console.error(`Error actualizando ${clave}:`, err);
                    hasError = true;
                }
            });
        });

        // Wait for all statements to execute
        db.get("SELECT 1", () => {
            if (hasError) {
                res.status(500).json({ error: "Ocurrió un error al actualizar algunos ajustes" });
            } else {
                res.json({ message: "Configuración actualizada con éxito" });
            }
        });
    });
});

app.get('/api/apartamentos', (req, res) => {
    // Obtener apartamentos del condominio activo
    db.get("SELECT id FROM condominios WHERE activo = 1", (err, condo) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!condo) return res.status(404).json({ error: "No hay condominio activo" });

        db.all("SELECT id, codigo, propietario FROM apartamentos WHERE condominio_id = ? ORDER BY codigo", [condo.id], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    });
});

app.post('/api/apartamentos', authenticateToken, (req, res) => {
    if (req.user.rol !== 'ADMIN') return res.status(403).json({ error: "Acceso denegado" });

    const { codigo, propietario } = req.body;
    const finalCodigo = String(codigo).toUpperCase().trim();
    const finalPropietario = String(propietario).toUpperCase().trim();

    // Obtener condominio activo
    db.get("SELECT id FROM condominios WHERE activo = 1", (err, condo) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!condo) return res.status(404).json({ error: "No hay condominio activo" });

        db.run("INSERT INTO apartamentos (codigo, propietario, condominio_id) VALUES (?, ?, ?)", [finalCodigo, finalPropietario, condo.id], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, message: "Apartamento creado con éxito" });
        });
    });
});

app.put('/api/apartamentos/:id', authenticateToken, (req, res) => {
    if (req.user.rol !== 'ADMIN') return res.status(403).json({ error: "Acceso denegado" });
    const { id } = req.params;
    const { codigo, propietario } = req.body;
    const finalCodigo = String(codigo).toUpperCase().trim();
    const finalPropietario = String(propietario).toUpperCase().trim();

    db.run("UPDATE apartamentos SET codigo = ?, propietario = ? WHERE id = ?", [finalCodigo, finalPropietario, id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Apartamento actualizado con éxito" });
    });
});

app.delete('/api/apartamentos/:id', authenticateToken, (req, res) => {
    if (req.user.rol !== 'ADMIN') return res.status(403).json({ error: "Acceso denegado" });
    const { id } = req.params;

    db.run("DELETE FROM apartamentos WHERE id = ?", [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Apartamento eliminado con éxito" });
    });
});
app.get('/api/resumen', (req, res) => {
    const { mes_anio } = req.query; // Formato: "2026-02"

    const query = `
        SELECT 
            (SELECT COALESCE(SUM(CASE WHEN tipo = 'ENTRADA' THEN monto_usd ELSE -monto_usd END), 0) FROM reserva) as fondoReserva,
            (SELECT COALESCE(SUM(monto_bs), 0) FROM reserva WHERE tipo = 'ENTRADA') as efectivoCajaBs
    `;

    db.get(query, (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        // Calcular promedio_alicuota para el mes solicitado
        const fechaLike = mes_anio ? `${mes_anio}%` : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}%`;

        // Obtener condominio activo
        db.get("SELECT id FROM condominios WHERE activo = 1", (err, condoRow) => {
            if (err || !condoRow) {
                // Si no hay condominio, devolver solo los datos básicos
                return res.json({
                    fondoReserva: row.fondoReserva || 0,
                    cuentasPorCobrar: row.cuentasPorCobrar || 0,
                    efectivoCajaBs: row.efectivoCajaBs || 0,
                    totalCirculanteUSD: (row.fondoReserva || 0) + (row.cuentasPorCobrar || 0),
                    promedio_alicuota: 0
                });
            }

            const condoId = condoRow.id;

            // Obtener total de gastos del mes
            db.get(
                `SELECT COALESCE(SUM(monto_usd), 0) as total_gastos FROM gastos WHERE condominio_id = ? AND fecha LIKE ?`,
                [condoId, fechaLike],
                (err, gastosRow) => {
                    if (err) {
                        return res.json({
                            fondoReserva: row.fondoReserva || 0,
                            cuentasPorCobrar: row.cuentasPorCobrar || 0,
                            efectivoCajaBs: row.efectivoCajaBs || 0,
                            totalCirculanteUSD: (row.fondoReserva || 0) + (row.cuentasPorCobrar || 0),
                            promedio_alicuota: 0
                        });
                    }

                    // Obtener número de apartamentos
                    db.get(
                        `SELECT COUNT(*) as num_aptos FROM apartamentos WHERE condominio_id = ?`,
                        [condoId],
                        (err, aptosRow) => {
                            const totalGastos = gastosRow ? gastosRow.total_gastos : 0;
                            const numAptos = aptosRow ? aptosRow.num_aptos : 16;
                            const promedioAlicuota = numAptos > 0 ? totalGastos / numAptos : 0;

                            console.log(`[DEBUG SERVER] /api/resumen - Total Gastos: ${totalGastos}, Aptos: ${numAptos}, Alicuota: ${promedioAlicuota}`);

                            // --- CÁLCULO DE CUENTAS POR COBRAR DINÁMICO ---
                            // Cuentas Por Cobrar = Suma de todos los gastos del condominio - Suma de pagos verificados
                            db.get(`
                                SELECT 
                                    (SELECT COALESCE(SUM(monto_usd), 0) FROM gastos WHERE condominio_id = ?) as total_gastos_historicos,
                                    (SELECT COALESCE(SUM(monto), 0) FROM notificaciones_pago WHERE status_banco = 'VERIFICADO' AND condominio_id = ?) as total_pagos_recibidos,
                                    (SELECT COALESCE(SUM(alicuota_usd - monto_pagado_usd), 0) FROM cobranzas WHERE condominio_id = ?) as saldo_tabla_estatica
                            `, [condoId, condoId, condoId], (err, calcRow) => {
                                const deudaDinamica = (calcRow.total_gastos_historicos - calcRow.total_pagos_recibidos) + calcRow.saldo_tabla_estatica;

                                res.json({
                                    fondoReserva: row.fondoReserva || 0,
                                    cuentasPorCobrar: deudaDinamica || 0,
                                    efectivoCajaBs: row.efectivoCajaBs || 0,
                                    totalCirculanteUSD: (row.fondoReserva || 0) + (deudaDinamica || 0),
                                    promedio_alicuota: promedioAlicuota
                                });
                            });
                        }
                    );
                }
            );
        });
    });
});

app.get('/api/gastos', (req, res) => {
    const { mes_anio } = req.query;
    let query = "SELECT id, mes_anio, concepto, monto_bs AS bs, monto_usd AS usd, fecha, tasa_bcv, monto_pagado_usd, monto_pagado_bs, fecha_pago, tasa_pago, referencia, comprobante_url FROM gastos";
    const params = [];

    if (mes_anio) {
        query += " WHERE mes_anio = ?";
        params.push(mes_anio.toUpperCase());
    }

    query += " ORDER BY fecha DESC, id DESC";

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.patch('/api/gastos/:id/pago', authenticateToken, uploadGastos.single('comprobante'), (req, res) => {
    if (req.user.rol !== 'ADMIN') return res.sendStatus(403);
    const { id } = req.params;
    let { monto_pagado_usd, monto_pagado_bs, fecha_pago, tasa_pago, referencia } = req.body;

    const comprobante_url = req.file ? `/uploads/gastos/${req.file.filename}` : undefined;

    // Si recibimos comprobante_url como undefined en el body (no hay cambio), mantenemos el actual si no hay nuevo archivo
    // Pero en este caso, el update debe ser condicional o manejar nulls.

    let query = "UPDATE gastos SET monto_pagado_usd = ?, monto_pagado_bs = ?, fecha_pago = ?, tasa_pago = ?, referencia = ?";
    let params = [monto_pagado_usd, monto_pagado_bs, fecha_pago, tasa_pago, referencia];

    if (comprobante_url) {
        query += ", comprobante_url = ?";
        params.push(comprobante_url);
    }

    query += " WHERE id = ?";
    params.push(id);

    db.run(query, params, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: "Pago de gasto actualizado correctamente", comprobante_url });
    }
    );
});

// Función auxiliar para verificar si un mes está cerrado
const checkMesCerrado = (condominioId, fecha, callback) => {
    // fecha puede ser YYYY-MM-DD o YYYY-MM
    const dateObj = new Date(fecha);
    const anio = dateObj.getFullYear();
    const mes = dateObj.getMonth() + 1;

    db.get("SELECT id FROM cierres_mensuales WHERE condominio_id = ? AND anio = ? AND mes = ?", [condominioId, anio, mes], (err, row) => {
        if (err) return callback(err);
        if (row) return callback(null, true); // Mes cerrado
        callback(null, false); // Mes abierto
    });
};

app.post('/api/gastos', authenticateToken, (req, res) => {
    if (req.user.rol !== 'ADMIN') return res.sendStatus(403);
    const { mes_anio, concepto, monto_usd, monto_bs, fecha, tasa_bcv, condominio_id } = req.body;

    // Default condominio_id para compatibilidad
    // En el futuro, el frontend debe enviar condominio_id siempre
    // Por ahora obtenemos el activo si no viene

    const proceed = (condoId) => {
        checkMesCerrado(condoId, fecha, (err, cerrado) => {
            if (err) return res.status(500).json({ error: err.message });
            if (cerrado) return res.status(400).json({ error: "No se pueden agregar gastos a un mes cerrado." });

            db.run("INSERT INTO gastos (mes_anio, concepto, monto_usd, monto_bs, fecha, tasa_bcv, condominio_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
                [mes_anio.toUpperCase(), concepto.toUpperCase().trim(), monto_usd, monto_bs, fecha, tasa_bcv, condoId],
                function (err) {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ id: this.lastID, success: true });
                });
        });
    };

    if (condominio_id) {
        proceed(condominio_id);
    } else {
        db.get("SELECT id FROM condominios WHERE activo = 1", (err, row) => {
            if (err || !row) return res.status(400).json({ error: "No hay condominio activo" });
            proceed(row.id);
        });
    }
});

app.delete('/api/gastos/:id', authenticateToken, (req, res) => {
    if (req.user.rol !== 'ADMIN') return res.sendStatus(403);

    // Primero obtener la fecha del gasto para saber a qué mes pertenece
    db.get("SELECT fecha, condominio_id FROM gastos WHERE id = ?", [req.params.id], (err, gasto) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!gasto) return res.status(404).json({ error: "Gasto no encontrado" });

        checkMesCerrado(gasto.condominio_id, gasto.fecha, (err, cerrado) => {
            if (err) return res.status(500).json({ error: err.message });
            if (cerrado) return res.status(400).json({ error: "No se pueden eliminar gastos de un mes cerrado." });

            db.run("DELETE FROM gastos WHERE id = ?", req.params.id, function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true });
            });
        });
    });
});

app.get('/api/cobranzas', (req, res) => {
    // 1. Obtener condominio activo
    db.get("SELECT id FROM condominios WHERE activo = 1", (err, condo) => {
        if (err || !condo) return res.status(500).json({ error: "No hay condominio activo" });

        // 2. Obtener total de gastos históricos y número de apartamentos para calcular la alicuota por apto
        db.get(`
            SELECT 
                (SELECT COALESCE(SUM(monto_usd), 0) FROM gastos WHERE condominio_id = ?) as total_gastos,
                (SELECT COUNT(*) FROM apartamentos WHERE condominio_id = ?) as num_aptos
        `, [condo.id, condo.id], (err, info) => {
            const alicuotaAcumulada = info.num_aptos > 0 ? info.total_gastos / info.num_aptos : 0;

            // 3. Obtener deuda real por apartamento cruzando:
            // Alicuota Acumulada - Pagos Verificados + Saldo en tabla fija (si existe)
            db.all(`
                SELECT 
                    a.codigo as apto, 
                    a.propietario,
                    ? - COALESCE((SELECT SUM(monto) FROM notificaciones_pago WHERE apartamento_codigo = a.codigo AND status_banco = 'VERIFICADO'), 0)
                    + COALESCE((SELECT SUM(alicuota_usd - monto_pagado_usd) FROM cobranzas WHERE apartamento_id = a.id), 0) as deuda
                FROM apartamentos a
                WHERE a.condominio_id = ?
                GROUP BY a.id
            `, [alicuotaAcumulada, condo.id], (err, rows) => {
                if (err) return res.status(500).json({ error: err.message });
                // Solvente si la deuda es despreciable (menor a 10 centavos para evitar temas de redondeo)
                res.json(rows.map(r => ({ ...r, solvente: r.deuda <= 0.1 })));
            });
        });
    });
});

app.get('/api/terraza', (req, res) => {
    db.all(`
        SELECT a.codigo as apto, 
        EXISTS(SELECT 1 FROM cuotas_especiales ce WHERE ce.apartamento_id = a.id AND ce.descripcion LIKE '%Cuota 1%') as cuota1,
        EXISTS(SELECT 1 FROM cuotas_especiales ce WHERE ce.apartamento_id = a.id AND ce.descripcion LIKE '%Cuota 2%') as cuota2
        FROM apartamentos a
    `, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/pagos', (req, res) => {
    const { apto, fecha, monto, referencia, monto_bs, tasa_bcv } = req.body;

    // Obtener condominio del apartamento
    db.get("SELECT condominio_id FROM apartamentos WHERE codigo = ?", [apto], (err, aptoRow) => {
        if (err) return res.status(500).json({ error: err.message });
        // Si no encontramos el apto, quizás es un error, pero por compatibilidad seguimos
        // Asumimos condominio activo si no se encuentra

        const doInsert = (condoId) => {
            // Validar cierre
            checkMesCerrado(condoId, fecha, (err, cerrado) => {
                if (err) return res.status(500).json({ error: err.message });
                if (cerrado) return res.status(400).json({ error: "No se pueden registrar pagos en un mes cerrado." });

                const stmt = db.prepare("INSERT INTO notificaciones_pago (apartamento_codigo, fecha_pago, monto, referencia, monto_bs, tasa_bcv, condominio_id) VALUES (?, ?, ?, ?, ?, ?, ?)");
                stmt.run(apto, fecha, monto, referencia, monto_bs, tasa_bcv, condoId, function (err) {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ id: this.lastID, success: true });
                });
            });
        };

        if (aptoRow && aptoRow.condominio_id) {
            doInsert(aptoRow.condominio_id);
        } else {
            db.get("SELECT id FROM condominios WHERE activo = 1", (err, activeRow) => {
                if (activeRow) doInsert(activeRow.id);
                else res.status(400).json({ error: "No se pudo determinar el condominio para este pago" });
            });
        }
    });
});

// Endpoint para Aprobar Pago (Conciliación Administrativa)
app.patch('/api/pagos/:id/aprobar', authenticateToken, (req, res) => {
    if (req.user.rol !== 'ADMIN') return res.status(403).json({ error: "Acceso denegado" });
    const { id } = req.params;

    db.run("UPDATE notificaciones_pago SET estatus = 'APROBADO' WHERE id = ?", [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: "Pago aprobado y registrado." });
    });
});

app.get('/api/notificaciones', (req, res) => {
    const { status, apto } = req.query;
    let query = "SELECT * FROM notificaciones_pago WHERE 1=1";
    let params = [];

    if (status !== 'ALL' && status !== 'TODOS') {
        query += " AND estatus = 'PENDIENTE'";
    }

    if (apto) {
        query += " AND apartamento_codigo = ?";
        params.push(apto);
    }

    query += " ORDER BY fecha_pago DESC";

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(r => ({ ...r, apto: r.apartamento_codigo })));
    });
});

// --- ENDPOINTS DE TASAS ---
app.get('/api/tasas/sync', authenticateToken, async (req, res) => {
    if (req.user.rol !== 'ADMIN') return res.sendStatus(403);
    try {
        const limit = parseInt(req.query.limit) || 1;
        const tasas = await readBCVFromTelegram(limit);

        const stmt = db.prepare("INSERT OR IGNORE INTO tasas (fecha, valor) VALUES (?, ?)");
        tasas.forEach(t => stmt.run(t.fecha, t.valor));
        stmt.finalize();

        res.json({ success: true, message: `Sincronización completada. ${tasas.length} tasas procesadas.` });
    } catch (error) {
        console.error("Error sincronizando tasas:", error);
        res.status(500).json({ error: "Error al sincronizar con Telegram", details: error.message });
    }
});

app.get('/api/tasas/:fecha', async (req, res) => {
    const { fecha } = req.params;

    const findInDB = (date) => {
        return new Promise((resolve, reject) => {
            db.get("SELECT * FROM tasas WHERE fecha <= ? ORDER BY fecha DESC LIMIT 1", [date], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    };

    try {
        // 1. Intentar buscar en DB (exacta o más cercana anterior)
        const row = await findInDB(fecha);

        if (row) {
            const isExact = row.fecha === fecha;
            const targetDate = new Date(fecha + 'T12:00:00');
            const dayOfWeek = targetDate.getDay(); // 0=Dom, 6=Sab

            // Si es exacta, o si es fin de semana y la tasa es reciente (viernes/jueves)
            // devolvemos de inmediato para no bloquear la UI con el OCR lento.
            if (isExact || dayOfWeek === 0 || dayOfWeek === 6) {
                console.log(`[BCV] Usando tasa ${isExact ? 'exacta' : 'de fin de semana (fallback)'} para ${fecha}: ${row.valor}`);
                return res.json({ ...row, exacto: isExact });
            }
        }

        // 2. Si no es exacta y no es fin de semana (o no hay ninguna tasa cercana), 
        // intentamos sincronizar con Telegram por si es un día laborable y no la tenemos en DB.
        console.log(`[BCV] Tasa no encontrada o requiere actualización para ${fecha}. Sincronizando con Telegram...`);
        try {
            const nuevasTasas = await readBCVFromTelegram(15);
            if (nuevasTasas.length > 0) {
                const stmt = db.prepare("INSERT OR IGNORE INTO tasas (fecha, valor) VALUES (?, ?)");
                nuevasTasas.forEach(t => stmt.run(t.fecha, t.valor));
                await new Promise(resolve => stmt.finalize(resolve));
            }
        } catch (syncErr) {
            console.error("[BCV Sync Error] Falló sincronización, se intentará fallback local:", syncErr.message);
        }

        // 3. Volver a buscar la más cercana después de sincronizar (o si falló la sincronización)
        const finalRow = await findInDB(fecha);
        if (finalRow) {
            res.json({ ...finalRow, exacto: finalRow.fecha === fecha });
        } else {
            res.status(404).json({ error: "No hay ninguna tasa disponible en el sistema" });
        }
    } catch (error) {
        console.error("[BCV Global Error]", error);
        res.status(500).json({ error: "Error interno del servidor al procesar tasa" });
    }
});

// --- MÓDULO DE CONCILIACIÓN Y OCR ---

// 1. Carga de Estado de Cuenta (ADMIN)
app.post('/api/admin/upload-banco', authenticateToken, upload.single('archivo'), async (req, res) => {
    if (req.user.rol !== 'ADMIN') return res.status(403).json({ error: "Acceso denegado" });
    if (!req.file) return res.status(400).json({ error: "No se subió ningún archivo" });

    const isPDF = req.file.mimetype === 'application/pdf' || req.file.originalname.toLowerCase().endsWith('.pdf');

    try {
        let movimientos = [];
        let totalComisiones = 0;

        if (isPDF) {
            console.log(`[BANCO] Recibido archivo PDF: ${req.file.originalname} (${req.file.size} bytes)`);
            if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

            const dataBuffer = fs.readFileSync(req.file.path);
            let data;
            try {
                data = await pdf(dataBuffer);
            } catch (pdfErr) {
                console.error("[BANCO] Fallo crítico de pdf-parse:", pdfErr);
                throw new Error("No se pudo leer el contenido del PDF.");
            }

            const text = data.text;
            fs.writeFileSync('uploads/debug_banco.txt', text);
            console.log(`[BANCO] Auditoría: Texto de PDF capturado (${text.length} caracteres).`);

            // MOTOR V3: Búsqueda Global por Patrones segmentados por Fecha
            const dateMatches = [...text.matchAll(/(\d{2}\/\d{2}\/\d{4})/g)];
            console.log(`[BANCO] Se encontraron ${dateMatches.length} posibles fechas.`);

            dateMatches.forEach((dMatch, index) => {
                const dateStr = dMatch[1];
                const datePos = dMatch.index;
                const nextDatePos = dateMatches[index + 1] ? dateMatches[index + 1].index : text.length;

                const segment = text.substring(datePos, nextDatePos);
                const refMatch = segment.match(/\d{8,13}/);
                const amountMatch = segment.match(/[\d\.]+\,\d{2}/);

                if (refMatch && amountMatch) {
                    const referencia = refMatch[0];
                    const montoRaw = amountMatch[0];
                    const monto = parseFloat(montoRaw.replace(/\./g, '').replace(',', '.'));

                    const [d, m, y] = dateStr.split('/');
                    const fecha = `${y}-${m}-${d}`;

                    const segUpper = segment.toUpperCase();
                    const isComision = /COMISION|COMISIÓN|IVA|RETENCION/.test(segUpper);
                    const isCargo = isComision || /DEBITO|TARJETA|REVERSO|PAGO SERVICIO/.test(segUpper);

                    const montoFinal = isCargo ? -Math.abs(monto) : Math.abs(monto);

                    if (isComision) {
                        totalComisiones += Math.abs(monto);
                    }

                    if (!movimientos.find(m => m.referencia === referencia && m.monto === montoFinal)) {
                        movimientos.push({ fecha, referencia, monto: montoFinal });
                    }
                }
            });
            console.log(`[BANCO] Motor V3 completado. ${movimientos.length} transacciones detectadas.`);
        } else {
            console.log("[BANCO] Procesando Estado de Cuenta Excel (Motor Robusto)...");
            const workbook = xlsx.readFile(req.file.path);
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];

            // Leer como arreglo de arreglos para buscar la cabecera dinámicamente
            const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
            console.log(`[BANCO] Excel cargado: ${data.length} filas brutas.`);

            let headerRowIndex = -1;
            let colMap = { fecha: -1, referencia: -1, monto: -1, descripcion: -1 };

            // 1. Localizar fila de cabecera y mapear columnas
            for (let i = 0; i < Math.min(20, data.length); i++) {
                const row = data[i];
                if (!row || !Array.isArray(row)) continue;

                const lowerRow = row.map(cell => String(cell || '').toUpperCase());
                const fIdx = lowerRow.findIndex(c => c && c.includes('FECHA'));
                const rIdx = lowerRow.findIndex(c => c && c.includes('REFERENCIA'));
                const mIdx = lowerRow.findIndex(c => c && c.includes('MONTO'));
                const dIdx = lowerRow.findIndex(c => c && (c.includes('DESC') || c.includes('CONCEP') || c.includes('DETALLE')));

                if (fIdx !== -1 && rIdx !== -1 && mIdx !== -1) {
                    headerRowIndex = i;
                    colMap = { fecha: fIdx, referencia: rIdx, monto: mIdx, descripcion: dIdx };
                    console.log(`[BANCO] Cabecera encontrada en fila ${i}:`, colMap);
                    break;
                }
            }

            if (headerRowIndex !== -1) {
                // 2. Procesar filas de datos desde la siguiente a la cabecera
                for (let i = headerRowIndex + 1; i < data.length; i++) {
                    const row = data[i];
                    if (!row || row.length === 0) continue;

                    let fechaRaw = row[colMap.fecha];
                    let refRaw = row[colMap.referencia];
                    let montoRaw = row[colMap.monto];
                    let descRaw = colMap.descripcion !== -1 ? row[colMap.descripcion] : '';

                    if (!fechaRaw || !refRaw || montoRaw === undefined) continue;

                    // Normalizar Fecha
                    let fecha = String(fechaRaw);
                    if (fecha.includes('/')) {
                        const [d, m, y] = fecha.split('/');
                        fecha = `${y}-${m}-${d}`;
                    }

                    // Normalizar Referencia
                    const referencia = String(refRaw).trim();

                    // Normalizar Monto (Robustez ante strings y formatos mixtos)
                    const cleanMonto = (v) => {
                        if (typeof v === 'number') return v;
                        let s = String(v || '0').replace(/\s/g, '');
                        if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
                        else if (s.includes(',')) s = s.replace(',', '.');
                        return parseFloat(s);
                    };
                    let monto = cleanMonto(montoRaw);

                    // Identificar comisiones (insensible a acentos)
                    const descUpper = String(descRaw || '').toUpperCase();
                    if (/COMISION|COMISIÓN|IVA|RETENCION/.test(descUpper)) {
                        totalComisiones += Math.abs(monto);
                    }

                    // Ignorar la fila de Saldo Final si tiene referencia de ceros
                    if (referencia && !isNaN(monto) && referencia !== '000000000000000') {
                        movimientos.push({ fecha, referencia, monto });
                    }
                }
            } else {
                console.warn("[BANCO] Fallback: No se detectó cabecera, intentando lectura simple.");
                const simpleRows = xlsx.utils.sheet_to_json(sheet);
                simpleRows.forEach(row => {
                    const fecha = row.Fecha || row.FECHA || row.date;
                    const referencia = String(row.Referencia || row.REFERENCIA || row.ref || '');

                    const cleanMontoSimple = (v) => {
                        if (typeof v === 'number') return v;
                        let s = String(v || '0').replace(/\s/g, '');
                        if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
                        else if (s.includes(',')) s = s.replace(',', '.');
                        return parseFloat(s);
                    };
                    const monto = cleanMontoSimple(row.Monto || row.MONTO || 0);

                    const desc = String(row.Descripcion || row.DESCRIPCION || row.Concepto || row.CONCEPTO || '');
                    if (/COMISION|COMISIÓN|IVA|RETENCION/.test(desc.toUpperCase())) {
                        totalComisiones += Math.abs(monto);
                    }

                    if (referencia && monto) movimientos.push({ fecha, referencia, monto });
                });
            }
            console.log(`[BANCO] Excel procesado. ${movimientos.length} movimientos detectados.`);
        }

        // Insertar en Base de Datos con Auditoría
        if (movimientos.length === 0) {
            console.warn("[BANCO] No se detectaron movimientos para insertar.");
        }

        const stmt = db.prepare("INSERT OR IGNORE INTO movimientos_bancarios (fecha, referencia, monto) VALUES (?, ?, ?)");
        let insertCount = 0;

        db.serialize(() => {
            movimientos.forEach(m => {
                stmt.run(m.fecha, m.referencia, m.monto, function (err) {
                    if (err) console.error(`[BANCO DB ERROR] Ref ${m.referencia}:`, err.message);
                    else if (this.changes > 0) insertCount++;
                });
            });

            stmt.finalize(() => {
                console.log(`[BANCO] Resumen DB: ${insertCount} movimientos nuevos registrados. Comisiones: ${totalComisiones}`);

                if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

                // --- AUTOMATIZACIÓN: Registro de Gasto por Comisiones ---
                if (totalComisiones > 0) {
                    db.get("SELECT id FROM condominios WHERE activo = 1", (err, condo) => {
                        const condoId = condo ? condo.id : 1;
                        const mesAnio = new Date().toISOString().slice(0, 7);
                        const fechaPrimero = `${mesAnio}-01`;
                        const fechaHoy = new Date().toISOString().slice(0, 10);

                        // Buscar tasa del primero del mes (o la más cercana anterior)
                        db.get("SELECT valor FROM tasas WHERE fecha <= ? ORDER BY fecha DESC LIMIT 1", [fechaPrimero], (err, tasaRow) => {
                            const tasa = tasaRow ? tasaRow.valor : 36.5; // Fallback
                            const montoUsd = totalComisiones / tasa;

                            // Verificar si ya existe la comisión para este mes
                            db.get("SELECT id FROM gastos WHERE condominio_id = ? AND mes_anio = ? AND concepto = 'COMISIÓN BANCÁRIA'",
                                [condoId, mesAnio], (err, existing) => {
                                    if (existing) {
                                        // Actualizar (PRESERVANDO monto_usd / Estimado $)
                                        db.run(`UPDATE gastos SET 
                                            monto_bs = ?, tasa_bcv = ?, 
                                            monto_pagado_bs = ?, monto_pagado_usd = ?, 
                                            fecha_pago = ?, comprobante_url = 'Edo Cta', referencia = 'SISTEMA'
                                            WHERE id = ?`,
                                            [totalComisiones, tasa, totalComisiones, montoUsd, fechaHoy, existing.id]);
                                    } else {
                                        // Insertar (Nuevo registro con monto_usd inicial igual al primer cálculo)
                                        db.run(`INSERT INTO gastos (condominio_id, mes_anio, concepto, monto_usd, monto_bs, tasa_bcv, monto_pagado_bs, monto_pagado_usd, fecha_pago, comprobante_url, referencia, status_banco) 
                                            VALUES (?, ?, 'COMISIÓN BANCÁRIA', ?, ?, ?, ?, ?, ?, 'Edo Cta', 'SISTEMA', 'VERIFICADO')`,
                                            [condoId, mesAnio, montoUsd, totalComisiones, tasa, totalComisiones, montoUsd, fechaHoy]);
                                    }
                                });
                        });
                    });
                }

                // Disparar conciliación automática
                ejecutarConciliacionGlobal((err) => {
                    if (err) return res.status(500).json({ error: "Procesado pero falló conciliación: " + err.message });
                    res.json({
                        success: true,
                        detected: movimientos.length,
                        newlyInserted: insertCount,
                        totalComisiones: totalComisiones,
                        message: `Conciliación terminada: ${movimientos.length} detectados, ${insertCount} nuevos. Total Comisiones: ${totalComisiones.toFixed(2)}`
                    });
                });
            });
        });

    } catch (error) {
        console.error("[BANCO ERROR CRÍTICO]", error);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: "Error procesando archivo: " + error.message });
    }
});

// ==============================================================================
// MÓDULO DE CIERRES MENSUALES E HISTORIAL
// ==============================================================================

// ==============================================================================
// MÓDULO DE REPORTES AVANZADOS (Sábana de Cobranzas y Recibos)
// ==============================================================================

// Endpoint para obtener la Sábana de Cobranzas Mensual
app.get('/api/reportes/sabana', authenticateToken, (req, res) => {
    const { anio, mes, condominio_id } = req.query;

    if (!anio || !mes) return res.status(400).json({ error: "Faltan parámetros anio/mes" });

    // Determinar Condominio ID
    const getCondominioId = (cb) => {
        if (condominio_id) return cb(null, condominio_id);
        db.get("SELECT id FROM condominios WHERE activo = 1", (err, row) => {
            if (err || !row) return cb("No se encontró condominio activo");
            cb(null, row.id);
        });
    };

    getCondominioId((err, condoId) => {
        if (err) return res.status(400).json({ error: err });

        const mesInt = parseInt(mes);
        const anioInt = parseInt(anio);

        // Calcular mes anterior para buscar saldo inicial
        let mesAnt = mesInt - 1;
        let anioAnt = anioInt;
        if (mesAnt === 0) { mesAnt = 12; anioAnt = anioInt - 1; }

        console.log(`Generando Sábana para Condo ${condoId} - Mes ${mesInt}/${anioInt}`);

        // 1. Buscar Cierre del Mes Anterior (para Saldo Inicial)
        const queryCierrePrevio = `SELECT id FROM cierres_mensuales WHERE condominio_id = ? AND anio = ? AND mes = ?`;

        db.get(queryCierrePrevio, [condoId, anioAnt, mesAnt], (err, cierrePrevio) => {
            if (err) return res.status(500).json({ error: err.message });

            // 2. Obtener lista de apartamentos
            db.all("SELECT id, codigo, propietario FROM apartamentos WHERE condominio_id = ?", [condoId], (err, aptos) => {
                if (err) return res.status(500).json({ error: err.message });

                // Preparar queries para iterar (optimizable, pero funcional para MVP)
                const resultados = [];
                let procesados = 0;

                if (aptos.length === 0) return res.json({ meta: { anio: anioInt, mes: mesInt }, data: [] });

                aptos.forEach(apto => {
                    // A. Saldo Inicial
                    let promiseSaldoInicial;
                    if (cierrePrevio) {
                        // Si hay cierre, tomamos el saldo final de ese cierre
                        promiseSaldoInicial = new Promise((resolve, reject) => {
                            db.get("SELECT saldo_final_usd FROM historial_deudas WHERE cierre_id = ? AND apartamento_id = ?", [cierrePrevio.id, apto.id], (err, row) => {
                                if (err) reject(err);
                                resolve(row ? row.saldo_final_usd : 0);
                            });
                        });
                    } else {
                        // Si NO hay cierre, calculamos deuda histórica hasta el día 1 del mes actual
                        // Por simplicidad en MVP sin cierres previos: Deuda Total Actual - Movimientos del Mes Actual
                        // O mejor: Tomamos la deuda TOTAL REPORTADA en la tabla de cobranzas como base y restamos lo del mes (aproximación)
                        // Para exactitud real, necesitaríamos sumar todas las alícuotas históricas - todos los pagos históricos antes del 1ro.
                        // IMPLEMENTACIÓN ROBUSTA:
                        promiseSaldoInicial = new Promise((resolve, reject) => {
                            // Suma de todas las deudas (alícuotas) pasadas
                            // Menos suma de todos los pagos pasados anteriores al 1er dia del mes
                            const fechaInicioMes = `${anioInt}-${String(mesInt).padStart(2, '0')}-01`;

                            // Nota: Como no tenemos tabla histórica de "generación de deuda mensual", usamos cobranzas (acumulado actual).
                            // Esto es una limitación si no hay cierres. Asumiremos 0 si es el primer mes de uso o calculamos deuda actual - cuota actual + pagos mes.
                            // ESTRATEGIA: Saldo Inicial = (Deuda Actual en Cobranzas) - (Cuota Estimada Mes) + (Pagos este Mes)

                            // Para MVP sin históricos: Usaremos 0 si no hay cierre previo, o la deuda actual.
                            // Mejor aproximación: Deuda Actual (Cobranzas)
                            // El problema es que Cobranzas ya tiene restado los pagos.
                            // Usaremos la Deuda Actual reportada en `cobranzas` como "Saldo Final" y reconstruiremos hacia atrás.

                            db.get(`SELECT COALESCE(SUM(alicuota_usd - monto_pagado_usd), 0) as deuda_actual FROM cobranzas WHERE apartamento_id = ?`, [apto.id], (err, row) => {
                                if (err) reject(err);
                                resolve(row ? row.deuda_actual : 0);
                                // OJO: Esto es Saldo FINAL. Ajustaremos después.
                            });
                        });
                    }

                    // B. Pagos del Mes (Bs y USD)
                    const mesStr = String(mesInt).padStart(2, '0');
                    const fechaLike = `${anioInt}-${mesStr}%`;
                    const promisePagos = new Promise((resolve, reject) => {
                        db.get(`
                            SELECT 
                                COALESCE(SUM(monto_bs), 0) as total_bs,
                                COALESCE(SUM(monto), 0) as total_usd
                            FROM notificaciones_pago 
                            WHERE apartamento_codigo = ? AND condominio_id = ? AND fecha_pago LIKE ? AND status_banco = 'VERIFICADO'
                        `, [apto.codigo, condoId, fechaLike], (err, row) => {
                            if (err) reject(err);
                            resolve(row || { total_bs: 0, total_usd: 0 });
                        });
                    });

                    // C. Cuota del Mes (Gastos Comunes)
                    // Calculamos el total de gastos del mes y dividimos entre total aptos (o alícuota específica)
                    // Por ahora: Equitativo
                    const promiseGastos = new Promise((resolve, reject) => {
                        console.log(`[DEBUG SERVER] Consultando gastos para alicuota. Condo: ${condoId}, FechaLike: ${fechaLike}`);
                        db.get(`SELECT COALESCE(SUM(monto_usd), 0) as total_gastos FROM gastos WHERE condominio_id = ? AND fecha LIKE ?`, [condoId, fechaLike], (err, row) => {
                            if (err) {
                                console.error("[DEBUG SERVER] Error en query gastos:", err);
                                reject(err);
                            }
                            const totalGastos = row ? row.total_gastos : 0;
                            const alicuota = totalGastos / (aptos.length || 1);
                            console.log(`[DEBUG SERVER] Total Gastos: ${totalGastos}, Aptos: ${aptos.length}, Alicuota Calc: ${alicuota}`);
                            resolve(alicuota);
                        });
                    });

                    Promise.all([promiseSaldoInicial, promisePagos, promiseGastos]).then(([saldoInicialRaw, pagos, cuotaMes]) => {

                        let saldoInicial = saldoInicialRaw;
                        let saldoFinal = 0;

                        if (cierrePrevio) {
                            // Flujo Normal:
                            // Saldo Inicial (viene del cierre anterior)
                            // Saldo Final = Saldo Inicial + Cuota Mes - Pagos USD
                            saldoFinal = saldoInicial + cuotaMes - pagos.total_usd;
                        } else {
                            // Flujo Sin Cierre Previo (Reconstrucción inversa desde Deuda Actual):
                            // Deuda Actual (BD) = Saldo Final
                            // Saldo Inicial = Saldo Final - Cuota Mes + Pagos USD
                            saldoFinal = saldoInicialRaw; // La query devolvió deuda actual
                            saldoInicial = saldoFinal - cuotaMes + pagos.total_usd;
                        }

                        // Cálculo del Saldo Neto después de pagos (antes de cargar el nuevo mes)
                        const saldoPreCuota = saldoInicial - pagos.total_usd;

                        resultados.push({
                            apto: apto.codigo,
                            propietario: apto.propietario,
                            saldo_inicial_usd: saldoInicial,
                            pagos_bs: pagos.total_bs,
                            pagos_usd: pagos.total_usd,
                            saldo_pre_cuota_usd: saldoPreCuota, // Nuevo campo solicitado
                            cuota_mes_usd: cuotaMes,
                            saldo_final_usd: saldoFinal
                        });

                        procesados++;
                        if (procesados === aptos.length) {
                            // Ordenar por apartamento
                            resultados.sort((a, b) => a.apto.localeCompare(b.apto, undefined, { numeric: true, sensitivity: 'base' }));
                            res.json({
                                meta: { anio: anioInt, mes: mesInt },
                                data: resultados
                            });
                        }
                    }).catch(err => {
                        console.error("Error en promises reporte:", err);
                        res.status(500).json({ error: "Error calculando datos" });
                    });
                });
            });
        });
    });
});

// Endpoint para obtener datos del Recibo de Condominio
app.get('/api/reportes/recibo', authenticateToken, (req, res) => {
    const { anio, mes, condominio_id, apto } = req.query; // apto codigo opcional

    if (!anio || !mes) return res.status(400).json({ error: "Faltan parámetros anio/mes" });

    // Determinar Condominio ID (Reutilizar lógica)
    const getCondominioId = (cb) => {
        if (condominio_id) return cb(null, condominio_id);
        db.get("SELECT id FROM condominios WHERE activo = 1", (err, row) => {
            if (err || !row) return cb("No se encontró condominio activo");
            cb(null, row.id);
        });
    };

    getCondominioId((err, condoId) => {
        if (err) return res.status(400).json({ error: err });

        const mesStr = String(mes).padStart(2, '0');
        const fechaLike = `${anio}-${mesStr}%`;

        // 1. Obtener Gastos del Mes
        db.all("SELECT concepto, monto_usd, monto_bs FROM gastos WHERE condominio_id = ? AND fecha LIKE ?", [condoId, fechaLike], (err, gastos) => {
            if (err) return res.status(500).json({ error: err.message });

            const totalGastos = gastos.reduce((sum, g) => sum + g.monto_usd, 0);

            // 2. Obtener Apartamentos y sus deudas
            let queryAptos = "SELECT id, codigo, propietario FROM apartamentos WHERE condominio_id = ?";
            let paramsAptos = [condoId];

            if (apto) {
                queryAptos += " AND codigo = ?";
                paramsAptos.push(apto);
            }

            db.all(queryAptos, paramsAptos, (err, aptos) => {
                if (err) return res.status(500).json({ error: err.message });

                // Calcular alicuota general (asumiendo equitativa por ahora o tomando del total / num aptos TOTALES del edificio no filtrado)
                // Para exactitud: contar total de aptos del edificio siempre
                db.get("SELECT COUNT(*) as total FROM apartamentos WHERE condominio_id = ?", [condoId], (err, countRow) => {
                    const totalAptosEdificio = countRow.total || 1;
                    const alicuotaGeneral = totalGastos / totalAptosEdificio;

                    // Construir respuesta para cada apto solicitado
                    const recibos = [];
                    let procesados = 0;
                    if (aptos.length === 0) return res.json({ gastos, total_gastos: totalGastos, alicuota_general: alicuotaGeneral, recibos: [] });

                    aptos.forEach(a => {
                        // Obtener Deuda Anterior (Saldo Inicial del mes)
                        // Misma lógica que Sábana: Si hay cierre previo usarlo, sino calcular reverso
                        // AQUI SIMPLIFICAREMOS: Usaremos la "Deuda Actual" de la tabla cobranzas como Saldo Total a Pagar hoy.
                        // Y Deuda Anterior = Total - Alicuota Mes.

                        db.get(`SELECT COALESCE(SUM(alicuota_usd - monto_pagado_usd), 0) as deuda_actual FROM cobranzas WHERE apartamento_id = ?`, [a.id], (err, row) => {
                            const deudaActual = row ? row.deuda_actual : 0;

                            // Aproximación de Deuda Anterior para el Recibo
                            // Deuda Anterior = Deuda Total Actual - Alicuota de ESTE mes (que se está cobrando)
                            // Nota: Si el usuario ya pagó la alicuota de este mes, esto podría dar negativo o inexacto sin lógica de cierres.
                            // Pero para "Aviso de Cobro" se asume que se emite antes de pagar el mes.
                            let deudaAnterior = deudaActual - alicuotaGeneral;
                            //if (deudaAnterior < 0) deudaAnterior = 0; // No necesariamente, puede tener saldo a favor

                            recibos.push({
                                codigo: a.codigo,
                                propietario: a.propietario,
                                deuda_anterior: deudaAnterior,
                                alicuota_mes: alicuotaGeneral,
                                total_pagar: deudaAnterior + alicuotaGeneral // Matemáticamente debería ser igual a deudaActual si no ha pagado nada
                            });

                            procesados++;
                            if (procesados === aptos.length) {
                                res.json({
                                    anio, mes,
                                    gastos,
                                    total_gastos: totalGastos,
                                    alicuota_general: alicuotaGeneral,
                                    recibos
                                });
                            }
                        });
                    });
                });
            });
        });
    });
});


// 1. Ejecutar Cierre de Mes (Corte de Cuenta)
app.post('/api/cierres/cerrar', authenticateToken, (req, res) => {
    if (req.user.rol !== 'ADMIN') return res.status(403).json({ error: "Acceso denegado" });

    const { anio, mes } = req.body; // mes 1-12
    const condominioId = req.body.condominio_id; // O obtener del contexto si se envía

    if (!condominioId) return res.status(400).json({ error: "Falta condominio_id" });

    // Validar que no exista cierre previo
    db.get("SELECT id FROM cierres_mensuales WHERE condominio_id = ? AND anio = ? AND mes = ?", [condominioId, anio, mes], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row) return res.status(400).json({ error: "Este mes ya ha sido cerrado anteriormente." });

        // Iniciar Transacción de Cierre
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");

            // 1. Calcular Totales del Mes (Gastos y Pagos)
            // NOTA: Asumimos que gastos y pagos tienen fecha y se pueden filtrar por mes/anio
            // Necesitamos asegurarnos que las tablas gastos y notificaciones_pago tengan fechas parseables

            // FIXME: Ajustar queries según estructura real de fechas en DB. 
            // Asumiendo formato YYYY-MM-DD o similar ISO8601
            const mesStr = String(mes).padStart(2, '0');
            const fechaLike = `${anio}-${mesStr}%`;

            // Obtener Totales
            const queryTotales = `
                SELECT 
                    (SELECT COALESCE(SUM(monto_usd), 0) FROM gastos WHERE condominio_id = ? AND fecha LIKE ?) as total_gastos,
                    (SELECT COALESCE(SUM(monto), 0) FROM notificaciones_pago WHERE condominio_id = ? AND fecha_pago LIKE ? AND status_banco = 'VERIFICADO') as total_pagos
            `;

            db.get(queryTotales, [condominioId, fechaLike, condominioId, fechaLike], (err, totales) => {
                if (err) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ error: "Error calculando totales: " + err.message });
                }

                // 2. Crear Registro de Cierre
                // Obtener tasa BCV actual (o la última registrada para ese mes)
                // Por simplicidad usaremos null o una consulta rápida si es crítico
                const tasaCierre = 0; // TODO: Implementar búsqueda de tasa

                db.run(`INSERT INTO cierres_mensuales (condominio_id, anio, mes, total_gastos_usd, total_pagos_usd, tasa_bcv_cierre) 
                        VALUES (?, ?, ?, ?, ?, ?)`,
                    [condominioId, anio, mes, totales.total_gastos, totales.total_pagos, tasaCierre],
                    function (err) {
                        if (err) {
                            db.run("ROLLBACK");
                            return res.status(500).json({ error: "Error creando cierre: " + err.message });
                        }
                        const cierreId = this.lastID;

                        // 3. Generar Snapshot de Deudas (Historial)
                        // Calculamos la deuda DE CADA APARTAMENTO en este momento preciso y la guardamos
                        const querySnapshot = `
                        INSERT INTO historial_deudas (cierre_id, apartamento_id, deuda_acumulada_usd, monto_pagado_mes_usd, saldo_final_usd)
                        SELECT 
                            ?, 
                            a.id,
                            -- Aquí deberíamos tener la lógica exacta de deuda acumulada
                            (SELECT COALESCE(SUM(c.alicuota_usd - c.monto_pagado_usd), 0) FROM cobranzas c WHERE c.apartamento_id = a.id) as deuda_total, 
                            -- Pagado este mes
                            (SELECT COALESCE(SUM(p.monto), 0) FROM notificaciones_pago p WHERE p.apartamento_codigo = a.codigo AND p.fecha_pago LIKE ? AND p.status_banco = 'VERIFICADO') as pagado_mes,
                            -- Saldo Final (Igual a deuda total por ahora, ajustar lógica si se requiere diferenciar)
                            (SELECT COALESCE(SUM(c.alicuota_usd - c.monto_pagado_usd), 0) FROM cobranzas c WHERE c.apartamento_id = a.id)
                        FROM apartamentos a
                        WHERE a.condominio_id = ?
                    `;

                        db.run(querySnapshot, [cierreId, fechaLike, condominioId], (err) => {
                            if (err) {
                                console.error("Error snapshot:", err);
                                db.run("ROLLBACK");
                                return res.status(500).json({ error: "Error generando historial de deudas: " + err.message });
                            }

                            db.run("COMMIT");
                            res.json({ success: true, message: `Cierre del mes ${mes}/${anio} realizado con éxito.`, cierre_id: cierreId });
                        });
                    });
            });
        });
    });
});

// 2. Listar Cierres Mensuales
app.get('/api/cierres', (req, res) => {
    const { condominio_id } = req.query;
    if (!condominio_id) return res.status(400).json({ error: "Falta condominio_id" });

    db.all("SELECT * FROM cierres_mensuales WHERE condominio_id = ? ORDER BY anio DESC, mes DESC", [condominio_id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 3. Obtener Detalle de un Cierre (Historial)
app.get('/api/cierres/:id/detalle', (req, res) => {
    const { id } = req.params;

    db.all(`
        SELECT h.*, a.codigo, a.propietario
        FROM historial_deudas h
        JOIN apartamentos a ON h.apartamento_id = a.id
        WHERE h.cierre_id = ?
        ORDER BY a.codigo
    `, [id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 2. Validación de Comprobante por OCR (OWNER) con Extracción Inteligente
app.post('/api/pagos/validate-receipt', authenticateToken, upload.single('imagen'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No se subió la imagen del comprobante" });
    const { referenciaManual, montoManual } = req.body;

    try {
        const { data: { text } } = await Tesseract.recognize(req.file.path, 'spa');
        fs.unlinkSync(req.file.path);

        console.log("[OCR DEBUG] Texto extraído:", text.substring(0, 500) + "...");

        // --- EXTRACCIÓN INTELIGENTE ---

        // 1. Extraer Referencia (Buscamos números de 6 a 12 dígitos)
        const refPatterns = [
            /(?:Ref|Referencia|Nro|Número|Confirmación|Transacción)[:\s]*(\d{6,12})/i,
            /(\d{6,12})/
        ];
        let refExtraida = null;
        for (const pattern of refPatterns) {
            const match = text.match(pattern);
            if (match) { refExtraida = match[1]; break; }
        }

        // 2. Extraer Fecha (DD/MM/YYYY, DD-MM-YYYY, DD/MM/YY)
        const datePattern = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/;
        const dateMatch = text.match(datePattern);
        let fechaExtraida = null;
        if (dateMatch) {
            let [_, day, month, year] = dateMatch;
            if (year.length === 2) year = "20" + year;
            fechaExtraida = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }

        // 3. Extraer Monto (Buscamos números con decimales , o .)
        const amountPatterns = [
            /(?:Monto|Importe|Total|Pagado|Bs|USD)[:\s]*([\d\.,]+)/i,
            /([\d\.,]+)/
        ];
        let montoExtraido = null;
        for (const pattern of amountPatterns) {
            const matches = text.matchAll(new RegExp(pattern, 'gi'));
            for (const m of matches) {
                let valStr = m[1].replace(/\./g, '').replace(',', '.');
                let val = parseFloat(valStr);
                // Filtramos montos muy pequeños o inválidos para evitar detectar números de cuenta/fechas como montos
                if (val > 1) {
                    montoExtraido = val;
                    // Si el patrón encontró una etiqueta de "monto", priorizamos este resultado
                    if (pattern.source.includes('Monto|Importe')) break;
                }
            }
            if (montoExtraido) break;
        }

        // --- VALIDACIÓN ---
        // Función para comparar solo los últimos 6 dígitos (Flexibilidad bancaria)
        const matchLast6 = (r1, r2) => {
            if (!r1 || !r2) return false;
            const c1 = String(r1).trim();
            const c2 = String(r2).trim();
            if (c1 === c2) return true;
            if (c1.length >= 6 && c2.length >= 6) return c1.slice(-6) === c2.slice(-6);
            return false;
        };

        const refValida = matchLast6(referenciaManual, refExtraida) || (referenciaManual && text.includes(referenciaManual));

        // Búsqueda flexible de monto manual
        const montoLimpio = String(montoManual).replace('.', ',');
        const montoEncontrado = text.includes(montoLimpio) || text.includes(String(montoManual));

        res.json({
            valid: refValida,
            extracted: {
                referencia: refExtraida,
                monto: montoExtraido,
                fecha: fechaExtraida
            },
            montoMatch: montoEncontrado,
            message: refValida ? "Referencia validada" : "Referencia no encontrada en la imagen"
        });

    } catch (error) {
        console.error("OCR Error:", error);
        res.status(500).json({ error: "Error en OCR: " + error.message });
    }
});

// 3. Analítica y Proyecciones
app.get('/api/analytics/projections', authenticateToken, async (req, res) => {
    try {
        const queryGastos = `
            SELECT mes_anio, SUM(monto_usd) as total_usd 
            FROM gastos 
            GROUP BY mes_anio 
            ORDER BY mes_anio DESC
        `;

        db.all(queryGastos, [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });

            const numMeses = rows.length;
            const promedioGastos = numMeses > 0
                ? rows.reduce((acc, row) => acc + row.total_usd, 0) / numMeses
                : 0;

            const proyeccionProximoMes = promedioGastos * 1.10;

            const queryAnomalias = `
                SELECT concepto, monto_usd, mes_anio 
                FROM gastos 
                WHERE monto_usd > ?
                ORDER BY monto_usd DESC LIMIT 5
            `;

            db.all(queryAnomalias, [promedioGastos * 0.5 || 100], (err, anomalias) => {
                if (err) return res.status(500).json({ error: err.message });

                const mesActual = new Date().toISOString().slice(0, 7);
                const queryCobranza = `
                    SELECT SUM(monto) as total_ingresado 
                    FROM notificaciones_pago 
                    WHERE estatus = 'APROBADO' AND strftime('%Y-%m', fecha_pago) = ?
                `;

                db.get(queryCobranza, [mesActual], (err, cobranza) => {
                    const ingresos = cobranza?.total_ingresado || 0;
                    const egresosMesActual = rows.find(r => r.mes_anio === mesActual)?.total_usd || 0;

                    const saludFinanciera = egresosMesActual > 0
                        ? (ingresos / egresosMesActual) * 100
                        : 100;

                    res.json({
                        promedio: promedioGastos,
                        proyeccion: proyeccionProximoMes,
                        anomalias: anomalias,
                        salud: Math.min(saludFinanciera, 100).toFixed(2),
                        mesActual: mesActual,
                        confianza: numMeses >= 3 ? 'ALTA' : 'BAJA'
                    });
                });
            });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Función auxiliar de Conciliación
function ejecutarConciliacionGlobal(callback) {
    db.serialize(() => {
        // 1. Conciliar Ingresos (Notificaciones de Pago)
        // Incluimos ERROR_MONTO para re-evaluar si llega el movimiento correcto
        db.all("SELECT id, referencia, monto, monto_bs FROM notificaciones_pago WHERE status_banco IN ('PENDIENTE', 'ERROR_MONTO')", (err, notifis) => {
            if (err) return callback(err);
            if (notifis && notifis.length > 0) {
                notifis.forEach(n => {
                    const refBusqueda = n.referencia.length >= 6 ? n.referencia.slice(-6) : n.referencia;
                    // Búsqueda más flexible en la referencia para evitar fallos por ceros a la izquierda o prefijos
                    db.get("SELECT monto FROM movimientos_bancarios WHERE referencia LIKE ?", [`%${refBusqueda}`], (err, mov) => {
                        if (mov) {
                            const montoBanco = Math.abs(mov.monto);
                            const montoNotif = Math.abs(n.monto_bs); // ✅ USAR MONTO EN BOLÍVARES
                            const diff = Math.abs(montoBanco - montoNotif);
                            const nuevoStatus = (diff < 0.1) ? 'VERIFICADO' : 'ERROR_MONTO';
                            console.log(`[CONCILIACIÓN] Notif ID:${n.id} | Ref:${n.referencia} (6dig:${refBusqueda}) | Banco:${montoBanco} Bs vs Notif:${montoNotif} Bs | Diff:${diff.toFixed(2)} → ${nuevoStatus}`);
                            db.run("UPDATE notificaciones_pago SET status_banco = ? WHERE id = ?", [nuevoStatus, n.id]);
                        }
                    });
                });
            }
        });

        // 2. Conciliar Egresos (Gastos)
        db.all("SELECT id, referencia, monto_pagado_bs FROM gastos WHERE status_banco = 'PENDIENTE' AND referencia IS NOT NULL AND referencia != ''", (err, gastos) => {
            if (err) return callback(err);
            if (gastos && gastos.length > 0) {
                gastos.forEach(g => {
                    const refBusqueda = g.referencia.length >= 6 ? g.referencia.slice(-6) : g.referencia;
                    db.get("SELECT monto FROM movimientos_bancarios WHERE referencia LIKE ?", [`%${refBusqueda}`], (err, mov) => {
                        if (mov) {
                            const montoBanco = Math.abs(mov.monto);
                            const cargoCoincide = (Math.abs(montoBanco - g.monto_pagado_bs) < 0.05);
                            const nuevoStatus = cargoCoincide ? 'VERIFICADO' : 'ERROR_MONTO';
                            db.run("UPDATE gastos SET status_banco = ? WHERE id = ?", [nuevoStatus, g.id]);
                        }
                    });
                });
            }
            setTimeout(() => callback(null), 1000);
        });
    });
}

app.listen(port, () => {
    console.log(`Servidor de Condominio corriendo en http://localhost:${port}`);
});
