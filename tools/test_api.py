import urllib.request
import json
import sys

API_URL = "http://localhost:3001/api"

def test_endpoint(name, path):
    url = f"{API_URL}{path}"
    try:
        with urllib.request.urlopen(url) as response:
            if response.status == 200:
                data = json.load(response)
                # Verificaciones básicas de contenido si es array
                count = len(data) if isinstance(data, list) else "Obj"
                print(f"  [OK] {name:<15} ({url}) -> (Data: {count})")
                return True
            else:
                print(f"  [FAIL] {name:<15} ({url}) -> HTTP {response.status}")
                return False
    except Exception as e:
        print(f"  [FAIL] {name:<15} ({url}) -> Error: {e}")
        return False

def check_backend():
    print(f"[INFO] Verificando Backend API en: {API_URL}")
    print("\n[TEST ENDPOINTS]")
    
    checks = [
        ("Resumen", "/resumen"),
        ("Gastos", "/gastos"),
        ("Cobranzas", "/cobranzas"),
        ("Notificaciones", "/notificaciones")
    ]
    
    success_count = 0
    for name, path in checks:
        if test_endpoint(name, path):
            success_count += 1
            
    if success_count == len(checks):
        print(f"\n[RESULTADO] Backend verificado: {success_count}/{len(checks)} servicios operativos.")
        sys.exit(0)
    else:
        print(f"\n[ADVERTENCIA] Solo {success_count}/{len(checks)} servicios operativos.")
        sys.exit(1)

if __name__ == "__main__":
    check_backend()
