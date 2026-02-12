import sqlite3

def check_db():
    conn = sqlite3.connect('condominio.db')
    cursor = conn.cursor()
    
    print("--- ALICUOTAS MENSUALES ---")
    cursor.execute("SELECT * FROM vista_alicuotas_mensuales")
    print(cursor.fetchall())
    
    print("\n--- CONTEO APARTAMENTOS ---")
    cursor.execute("SELECT COUNT(*) FROM apartamentos")
    print(cursor.fetchone())
    
    print("\n--- MOVIMIENTOS RESERVA ---")
    cursor.execute("SELECT * FROM reserva")
    print(cursor.fetchall())
    
    conn.close()

if __name__ == "__main__":
    check_db()
