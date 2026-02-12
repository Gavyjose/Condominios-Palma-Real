const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'condominio.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log(">>> Iniciando migración a MAYÚSCULAS...");

    // 1. Normalizar Apartamentos
    db.run("UPDATE apartamentos SET codigo = UPPER(TRIM(codigo)), propietario = UPPER(TRIM(propietario))", (err) => {
        if (err) console.error("Error migrando apartamentos:", err);
        else console.log("[OK] Apartamentos normalizados.");
    });

    // 2. Normalizar Ajustes
    db.run("UPDATE ajustes SET valor = UPPER(TRIM(valor)) WHERE clave IN ('nombre_condominio', 'nombre_torre', 'rif', 'direccion')", (err) => {
        if (err) console.error("Error migrando ajustes:", err);
        else console.log("[OK] Ajustes globales normalizados.");
    });

    // 3. Normalizar Gastos (Concepto y Mes/Año)
    db.run("UPDATE gastos SET concepto = UPPER(TRIM(concepto)), mes_anio = UPPER(TRIM(mes_anio))", (err) => {
        if (err) console.error("Error migrando gastos:", err);
        else console.log("[OK] Historial de gastos normalizado.");
    });

    // 4. Normalizar Pagos (Apartamento y Referencia)
    db.run("UPDATE notificaciones_pago SET apartamento_codigo = UPPER(TRIM(apartamento_codigo)), referencia = UPPER(TRIM(referencia))", (err) => {
        if (err) console.error("Error migrando notificaciones:", err);
        else console.log("[OK] Notificaciones de pago normalizadas.");
    });

    console.log(">>> Migración completada. Ya puedes borrar este archivo.");
});
db.close();
