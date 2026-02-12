const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../condominio.db');

console.log(`[INFO] Migrando DB auth en: ${DB_PATH}`);

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
    // Crear tabla usuarios
    db.run(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            rol TEXT CHECK(rol IN ('ADMIN', 'PROPIETARIO')) NOT NULL,
            apartamento_id INTEGER,
            FOREIGN KEY (apartamento_id) REFERENCES apartamentos(id)
        )
    `, (err) => {
        if (err) {
            console.error("  [ERROR] Creando tabla:", err.message);
            return;
        }
        console.log("  [OK] Tabla 'usuarios' verificada.");

        // Crear Admin por defecto
        const adminUser = "admin";
        const adminPass = "admin123";
        const hashed = bcrypt.hashSync(adminPass, 10);

        db.run(`INSERT INTO usuarios (username, password_hash, rol) VALUES (?, ?, ?)`,
            [adminUser, hashed, 'ADMIN'],
            function (err) {
                if (err) {
                    if (err.message.includes("UNIQUE constraint failed")) {
                        console.log(`  [INFO] Usuario '${adminUser}' ya existe.`);
                    } else {
                        console.error("  [ERROR] Insertando admin:", err.message);
                    }
                } else {
                    console.log(`  [OK] Usuario '${adminUser}' creado (Pass: ${adminPass}).`);
                }
                db.close(); // Cerrar conexión aquí, al final del trabajo
            }
        );
    });
});
// db.close() removido del final global
