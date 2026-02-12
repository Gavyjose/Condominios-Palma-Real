const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../condominio.db');

console.log(`[INFO] Reseteando usuario admin en: ${DB_PATH}`);

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
    // Eliminar usuario admin existente
    db.run(`DELETE FROM usuarios WHERE username = 'admin'`, (err) => {
        if (err) {
            console.error("  [ERROR] Eliminando admin:", err.message);
            db.close();
            return;
        }
        console.log("  [OK] Usuario admin anterior eliminado.");

        // Crear nuevo admin con contraseña correcta
        const adminUser = "admin";
        const adminPass = "admin123";
        const hashed = bcrypt.hashSync(adminPass, 10);

        db.run(`INSERT INTO usuarios (username, password_hash, rol) VALUES (?, ?, ?)`,
            [adminUser, hashed, 'ADMIN'],
            function (err) {
                if (err) {
                    console.error("  [ERROR] Creando admin:", err.message);
                } else {
                    console.log(`  [OK] Usuario '${adminUser}' creado con contraseña '${adminPass}'.`);
                }
                db.close();
            }
        );
    });
});
