const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'condominio.db');
const db = new sqlite3.Database(dbPath);

console.log('🧹 LIMPIEZA DE APARTAMENTOS HUÉRFANOS\n');
console.log('='.repeat(60));

// Eliminar apartamentos que pertenecen a condominios no existentes o desactivados
db.run(`
    DELETE FROM apartamentos
    WHERE condominio_id NOT IN (SELECT id FROM condominios WHERE activo = 1)
`, function (err) {
    if (err) {
        console.error('❌ Error:', err);
        db.close();
        return;
    }

    console.log(`\n✅ Apartamentos huérfanos eliminados: ${this.changes}`);

    // Mostrar apartamentos restantes
    db.all(`
        SELECT a.id, a.codigo, a.propietario, a.condominio_id, c.nombre
        FROM apartamentos a
        LEFT JOIN condominios c ON a.condominio_id = c.id
        ORDER BY a.codigo
    `, (err, rows) => {
        if (err) {
            console.error('❌ Error:', err);
        } else {
            console.log('\n📋 APARTAMENTOS RESTANTES (solo del condominio activo):\n');
            rows.forEach(row => {
                console.log(`   ${row.codigo.padEnd(10)} | ${row.propietario || 'Sin propietario'} | Condominio: ${row.nombre}`);
            });
        }
        console.log('\n' + '='.repeat(60));
        db.close();
    });
});
