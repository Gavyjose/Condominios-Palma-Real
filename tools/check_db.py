import sqlite3
import os
import sys

# Asegurar ruta absoluta a condominio.db
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, 'condominio.db')

def check_db():
    print(f"[INFO] Verificando DB en: {DB_PATH}")
    
    if not os.path.exists(DB_PATH):
        print("[ERROR] Archivo condominio.db no encontrado.")
        sys.exit(1)
        
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Verificar tablas críticas
        tablas_esperadas = ['apartamentos', 'gastos', 'cobranzas', 'notificaciones_pago']
        
        print("\n[ESTADO DE TABLAS]")
        all_ok = True
        for tabla in tablas_esperadas:
            try:
                cursor.execute(f"SELECT COUNT(*) FROM {tabla}")
                count = cursor.fetchone()[0]
                print(f"  [OK] {tabla}: {count} registros")
            except sqlite3.OperationalError:
                print(f"  [FAIL] {tabla}: NO EXISTE")
                all_ok = False
                
        conn.close()
        
        if all_ok:
            print("\n[RESULTADO] Integridad de DB verificada: OK")
            sys.exit(0)
        else:
            print("\n[ADVERTENCIA] Faltan tablas criticas.")
            sys.exit(1)
            
    except Exception as e:
        print(f"[ERROR CRITICO] {e}")
        sys.exit(1)

if __name__ == "__main__":
    check_db()
