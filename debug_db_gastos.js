const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'condominio.db');
const db = new sqlite3.Database(dbPath);

db.all("SELECT id, mes_anio, concepto, fecha FROM gastos LIMIT 10", (err, rows) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log("Muestra de gastos:");
    console.table(rows);

    db.all("SELECT DISTINCT mes_anio FROM gastos", (err, distinctRows) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log("Valores únicos en mes_anio:");
        console.log(distinctRows.map(r => r.mes_anio));
        db.close();
    });
});
