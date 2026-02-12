const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'condominio.db');
const db = new sqlite3.Database(dbPath);

console.log('🔍 VERIFICANDO APARTAMENTOS EN BASE DE DATOS\n');
console.log('='.repeat(60));

// 1. Ver todos los apartamentos con su condominio
db.all(`
    SELECT a.id, a.codigo, a.propietario, a.condominio_id, c.nombre as condominio, c.activo
    FROM apartamentos a
    LEFT JOIN condominios c ON a.condominio_id = c.id
    ORDER BY a.condominio_id, a.codigo
`, (err, rows) => {
    if (err) {
        console.error('Error:', err);
        db.close();
        return;
    }

    console.log('\n📋 TODOS LOS APARTAMENTOS:\n');
    rows.forEach(row => {
        const activo = row.activo ? '✅ ACTIVO' : '⚪ Inactivo';
        console.log(`[${row.condominio_id}] ${row.codigo.padEnd(10)} | ${row.propietario?.substring(0, 20).padEnd(20) || 'Sin propietario'.padEnd(20)} | ${row.condominio} ${activo}`);
    });

    // 2. Detectar duplicados por (codigo, condominio_id)
    console.log('\n🔍 BUSCANDO DUPLICADOS (mismo código en misma torre):\n');
    db.all(`
        SELECT codigo, condominio_id, COUNT(*) as cantidad
        FROM apartamentos
        GROUP BY codigo, condominio_id
        HAVING cantidad > 1
    `, (err, dups) => {
        if (err) {
            console.error('Error:', err);
        } else if (dups.length === 0) {
            console.log('✅ No hay duplicados (mismo código en misma torre)');
        } else {
            console.log('❌ DUPLICADOS ENCONTRADOS:');
            dups.forEach(d => {
                console.log(`   - Código "${d.codigo}" en condominio_id=${d.condominio_id}: ${d.cantidad} registros`);
            });
        }

        // 3. Ver cuál es el condominio activo
        console.log('\n🏢 CONDOMINIO ACTIVO:\n');
        db.get("SELECT id, nombre, nombre_torre FROM condominios WHERE activo = 1", (err, activo) => {
            if (err) {
                console.error('Error:', err);
            } else if (activo) {
                console.log(`   ID: ${activo.id} | ${activo.nombre} - ${activo.nombre_torre}`);

                // 4. Mostrar SOLO apartamentos del condominio activo
                console.log(`\n📍 APARTAMENTOS DEL CONDOMINIO ACTIVO (ID=${activo.id}):\n`);
                db.all(`
                    SELECT id, codigo, propietario
                    FROM apartamentos
                    WHERE condominio_id = ?
                    ORDER BY codigo
                `, [activo.id], (err, aptos) => {
                    if (err) {
                        console.error('Error:', err);
                    } else {
                        aptos.forEach(a => {
                            console.log(`   ${a.codigo.padEnd(10)} | ${a.propietario || 'Sin propietario'}`);
                        });
                    }
                    console.log('\n' + '='.repeat(60));
                    db.close();
                });
            } else {
                console.log('   ⚠️ No hay condominio activo');
                db.close();
            }
        });
    });
});
