const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'condominio.db');
const migrationPath = path.join(__dirname, 'migracion_historial_mensual.sql');

// Leer archivo SQL
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error al conectar con la base de datos:', err.message);
        return;
    }
    console.log('Conectado a la base de datos SQlite.');
});

console.log('Iniciando migración de historial mensual...');

db.exec(migrationSql, (err) => {
    if (err) {
        console.error('Error ejecutando la migración:', err.message);
    } else {
        console.log('Migración completada exitosamente.');
    }
    db.close();
});
