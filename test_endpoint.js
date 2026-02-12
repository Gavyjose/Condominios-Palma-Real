const fetch = require('node-fetch'); // Nota: node-fetch v2 es commonjs compatible, v3 es ESM.
// Si no hay node-fetch instalado, usar http nativo.
// Pero asumamos fetch nativo si es node 18+. De lo contrario, usaré http.
// Usaré http nativo para compatibilidad 100% sin deps.

const http = require('http');

function get(path) {
    return new Promise((resolve, reject) => {
        http.get({
            hostname: 'localhost',
            port: 3001,
            path: path,
            headers: { 'Content-Type': 'application/json' }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        resolve(data); // Tal vez no es json
                    }
                } else {
                    reject(`Status: ${res.statusCode} - ${data}`);
                }
            });
        }).on('error', reject);
    });
}

async function test() {
    try {
        console.log("Probando endpoint /api/gastos...");

        // 1. Probar Febrero 2026 (Debería tener datos)
        const feb = await get('/api/gastos?mes_anio=2026-02');
        console.log(`[2026-02] Registros encontrados: ${feb.length}`);
        if (feb.length > 0) console.log("✅ OK: Febrero tiene datos.");
        else console.warn("⚠️ ALERTA: Febrero está vacío (inesperado si había datos).");

        // 2. Probar Enero 2026 (Debería estar vacío)
        const ene = await get('/api/gastos?mes_anio=2026-01');
        console.log(`[2026-01] Registros encontrados: ${ene.length}`);
        if (ene.length === 0) console.log("✅ OK: Enero está vacío (filtrado correcto).");
        else {
            console.error("❌ ERROR: Enero tiene datos. El filtrado falló.");
            console.log("Muestra de datos en Enero:", ene.slice(0, 3));
        }

        // 3. Probar Sin Filtro (Debería tener todo)
        const all = await get('/api/gastos');
        console.log(`[SIN FILTRO] Registros totales: ${all.length}`);

    } catch (error) {
        console.error("Error en test:", error);
    }
}

test();
