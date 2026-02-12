import sqlite3
import pandas as pd

def verify():
    conn = sqlite3.connect(':memory:')
    cursor = conn.cursor()
    
    # Leer esquema
    with open('esquema.sql', 'r', encoding='utf-8') as f:
        cursor.executescript(f.read())
    
    # 1. Insertar Apartamentos (16 unidades)
    apts = [
        'PB-A', 'PB-B', 'PB-C', 'PB-D',
        '1-A', '1-B', '1-C', '1-D',
        '2-A', '2-B', '2-C', '2-D',
        '3-A', '3-B', '3-C', '3-D'
    ]
    for a in apts:
        cursor.execute("INSERT INTO apartamentos (codigo, propietario) VALUES (?, ?)", (a, "Propietario " + a))
    
    # 2. Insertar Gastos de Enero (basado en Hoja2 del Excel)
    gastos_enero = [
        ('Vigilancia', 60.0, 19523.36),
        ('Agua', 36.0, 12483.66),
        ('Piscina', 14.02, 4561.96),
        ('PH Operator', 6.0, 1952.34),
        ('Aseo', 10.0, 3253.89),
        ('Administracion', 50.0, 18365.35),
        ('Limpieza', 54.0, 19834.57),
        ('Productos', 12.0, 2441.00),
        ('Jardineria', 20.0, 7229.82),
        ('Riego', 12.0, 4407.68)
        # Añadiendo solo algunos para la prueba de concepto
    ]
    
    for concepto, usd, bs in gastos_enero:
        cursor.execute("INSERT INTO gastos (mes_anio, concepto, monto_usd, monto_bs) VALUES (?, ?, ?, ?)", 
                       ('2026-01', concepto, usd, bs))
                       
    # 3. Verificar Alícuota
    cursor.execute("SELECT total_gastos_usd, alicuota_por_apto_usd FROM vista_alicuotas_mensuales WHERE mes_anio = '2026-01'")
    total, alicuota = cursor.fetchone()
    
    print(f"Total Gastos Enero: {total} $")
    print(f"Alícuota calculada (/16): {alicuota} $")
    
    # 4. Movimiento de Reserva (Ejemplo de Hoja1/Hoja4)
    cursor.execute("""
        INSERT INTO reserva (descripcion, tipo, monto_usd, monto_bs) 
        VALUES ('Cobertura déficit caja Enero', 'SALIDA', 44.18, 0.00)
    """)
    
    cursor.execute("SELECT SUM(monto_usd) FROM reserva WHERE tipo = 'SALIDA'")
    total_reserva_salida = cursor.fetchone()[0]
    print(f"Total Salida Reserva: {total_reserva_salida} $")

    conn.close()

if __name__ == "__main__":
    verify()
