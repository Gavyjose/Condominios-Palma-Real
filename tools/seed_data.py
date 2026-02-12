import pandas as pd
import sqlite3
import os
import sys

# Definir directorios base
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, 'condominio.db')
SCHEMA_PATH = os.path.join(BASE_DIR, 'esquema.sql')
EXCEL_PATH = os.path.join(BASE_DIR, 'Condominio.xlsx')

def importar():
    print(f"[INFO] Iniciando migracion de datos...")
    print(f"       DB: {DB_PATH}")
    print(f"       Excel: {EXCEL_PATH}")

    if os.path.exists(DB_PATH):
        if "--force" not in sys.argv:
            print("\n[PELIGRO] La base de datos 'condominio.db' ya existe.")
            print("         Ejecutar este script borrara TODOS los datos actuales (pagos, etc).")
            print("         Para proceder, ejecute: python tools/seed_data.py --force\n")
            sys.exit(1)

        try:
            os.remove(DB_PATH)
            print("[INFO] DB anterior eliminada (--force detectado).")
        except PermissionError:
            print("[ERROR] No se puede eliminar la DB. Cierre cualquier programa que la este usando.")
            sys.exit(1)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    if not os.path.exists(SCHEMA_PATH):
        print(f"[ERROR] No se encuentra {SCHEMA_PATH}")
        sys.exit(1)

    with open(SCHEMA_PATH, 'r', encoding='utf-8') as f:
        cursor.executescript(f.read())
    
    if not os.path.exists(EXCEL_PATH):
        print(f"[ERROR] No se encuentra {EXCEL_PATH}")
        sys.exit(1)

    # --- 1. APARTAMENTOS (Hoja3) ---
    df_aptos = pd.read_excel(EXCEL_PATH, sheet_name='Hoja3', skiprows=2)
    aptos_data = []
    for _, row in df_aptos.iterrows():
        if pd.isna(row['APTO']) or row['APTO'] == 'POR COBRAR': continue
        aptos_data.append((row['APTO'], row['PROPIETARIO']))
    cursor.executemany("INSERT INTO apartamentos (codigo, propietario) VALUES (?, ?)", aptos_data)
    
    # --- 2. GASTOS ENERO (Hoja2) ---
    df_gastos = pd.read_excel(EXCEL_PATH, sheet_name='Hoja2', skiprows=2)
    gastos_data = []
    for _, row in df_gastos.iterrows():
        concepto = row['Concepto']
        if pd.isna(concepto) or concepto == 'Totales Finales' or concepto == 'Alicuota por Apto /16': continue
        
        monto_usd = row['BCV ($)'] if not pd.isna(row['BCV ($)']) and row['BCV ($)'] != '-' else 0
        monto_bs = row['Bolívares (Bs)'] if not pd.isna(row['Bolívares (Bs)']) and row['Bolívares (Bs)'] != '-' else 0
        
        gastos_data.append(('2026-01', concepto, float(monto_usd), float(monto_bs)))
    cursor.executemany("INSERT INTO gastos (mes_anio, concepto, monto_usd, monto_bs) VALUES (?, ?, ?, ?)", gastos_data)
    
    # --- 3. COBRANZAS / DEUDAS (Hoja3) ---
    # Usaremos el total acumulado como deuda pendiente en la tabla cobranzas
    for _, row in df_aptos.iterrows():
        if pd.isna(row['APTO']) or row['APTO'] == 'POR COBRAR': continue
        apto_codigo = row['APTO']
        total_deuda = float(row['TOTAL'])
        
        cursor.execute("SELECT id FROM apartamentos WHERE codigo = ?", (apto_codigo,))
        apto_id = cursor.fetchone()[0]
        
        # Insertamos una entrada para Enero con la deuda total acumulada
        cursor.execute("INSERT INTO cobranzas (apartamento_id, mes_anio, alicuota_usd, monto_pagado_usd) VALUES (?, ?, ?, ?)",
                       (apto_id, '2026-01', total_deuda, 0))

    # --- 4. TERRAZA (Hoja5) ---
    df_terraza = pd.read_excel(EXCEL_PATH, sheet_name='Hoja5', skiprows=5)
    for _, row in df_terraza.iterrows():
        if pd.isna(row['APTO']) or row['PROPIETARIO'] == 'TOTAL (BS)': continue
        apto_codigo = row['APTO']
        cursor.execute("SELECT id FROM apartamentos WHERE codigo = ?", (apto_codigo,))
        res = cursor.fetchone()
        if not res: continue
        apto_id = res[0]
        
        if not pd.isna(row['CUOTA 1']):
            cursor.execute("INSERT INTO cuotas_especiales (apartamento_id, descripcion, monto_usd) VALUES (?, ?, ?)",
                           (apto_id, 'Proyecto Terraza - Cuota 1', 11.41))
        if not pd.isna(row['CUOTA 2']):
            cursor.execute("INSERT INTO cuotas_especiales (apartamento_id, descripcion, monto_usd) VALUES (?, ?, ?)",
                           (apto_id, 'Proyecto Terraza - Cuota 2', 11.41))

    # --- 5. RESERVA / SALDOS REALES (Hoja4 / Hoja1) ---
    # Según Hoja4 Row 883: SALDO RESERVA AL 31 01 2026 = 134.69 $
    # Según Hoja4 Row 903: EFECTIVO EN CAJA = 2.22 Bs
    cursor.execute("INSERT INTO reserva (descripcion, tipo, monto_usd, monto_bs) VALUES (?, ?, ?, ?)",
                   ('Saldo Final Reserva Enero 2026', 'ENTRADA', 134.69, 0))
    cursor.execute("INSERT INTO reserva (descripcion, tipo, monto_usd, monto_bs) VALUES (?, ?, ?, ?)",
                   ('Efectivo en Caja al 31-01-26', 'ENTRADA', 0, 2.22))

    conn.commit()
    conn.close()
    print("Migración de DATOS REALES completada con éxito en 'condominio.db'")

if __name__ == "__main__":
    importar()
