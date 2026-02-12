const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'condominio.db');
const migrationPath = path.join(__dirname, 'migracion_fix_unique_apartamentos.sql');

console.log('🔧 EJECUTANDO MIGRACIÓN: Fix UNIQUE Constraint en Apartamentos');
console.log('================================================\n');

// Leer el script SQL
const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

// Conectar a la base de datos
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error conectando a la DB:', err.message);
        process.exit(1);
    }
    console.log('✅ Conectado a condominio.db\n');
});

// Ejecutar la migración
db.exec(migrationSQL, (err) => {
    if (err) {
        console.error('❌ Error ejecutando migración:', err.message);
        db.close();
        process.exit(1);
    }

    console.log('\n✅ Migración completada exitosamente!');
    console.log('📋 Ahora cada torre puede tener apartamentos con el mismo código.\n');

    // Verificar el schema resultante
    db.all("SELECT sql FROM sqlite_master WHERE type='table' AND name='apartamentos'", (err, rows) => {
        if (err) {
            console.error('Error:', err);
        } else {
            console.log('📝 Schema actualizado de apartamentos:');
            console.log(rows[0].sql);
        }
        db.close();
    });
});
