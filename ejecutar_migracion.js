const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'condominio.db');
const db = new sqlite3.Database(DB_PATH);

// Leer el script SQL
const sqlScript = fs.readFileSync('migracion_multi_condominio.sql', 'utf8');

// Ejecutar la migración
db.exec(sqlScript, (err) => {
    if (err) {
        console.error('Error en la migración:', err.message);
        process.exit(1);
    }

    console.log('Migración completada exitosamente');

    // Verificar el resultado
    db.get('SELECT COUNT(*) as count FROM condominios', (err, row) => {
        if (err) {
            console.error('Error verificando:', err);
        } else {
            console.log(`Total de condominios registrados: ${row.count}`);
        }

        db.close();
    });
});
