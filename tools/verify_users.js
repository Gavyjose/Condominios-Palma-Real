const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../condominio.db');

console.log(`[INFO] Verificando usuarios en: ${DB_PATH}\n`);

const db = new sqlite3.Database(DB_PATH);

db.all("SELECT * FROM usuarios", [], (err, rows) => {
    if (err) {
        console.error("[ERROR]", err.message);
        db.close();
        return;
    }

    console.log(`[USUARIOS EN LA BASE DE DATOS] (${rows.length} encontrados)\n`);

    rows.forEach((row, i) => {
        console.log(`Usuario ${i + 1}:`);
        console.log(`  ID: ${row.id}`);
        console.log(`  Username: ${row.username}`);
        console.log(`  Rol: ${row.rol}`);
        console.log(`  Hash: ${row.password_hash.substring(0, 20)}...`);

        // Probar la contraseña
        const testPassword = "admin123";
        const isValid = bcrypt.compareSync(testPassword, row.password_hash);
        console.log(`  Test password '${testPassword}': ${isValid ? '✓ VÁLIDA' : '✗ INVÁLIDA'}`);
        console.log('');
    });

    db.close();
});
