# Guía de Transición al Sistema Maestro E.T.A.P.A.

Esta guía resume los entregables y pasos necesarios para aplicar el protocolo E.T.A.P.A. al proyecto Condominio Torre 9.

## 1. Tareas de Inicialización (Fase 0)

Deberemos crear los siguientes archivos "semilla" en la raíz del proyecto:

### A. `gemini.md` (La Constitución)
Este será el archivo más importante. Contendrá:
- **Esquema de Datos Oficial**: La definición JSON estricta de las tablas `apartamentos`, `gastos`, `pagos`, etc.
- **Reglas de Negocio**: Ej. "El dólar se usa como referencia, pero la contabilidad base es Bs", "La mora se visualiza pero no bloquea pagos".
- **Infraestructura**: Puertos, rutas de archivos clave.

### B. `task_plan.md` (El Mapa)
Reemplazará nuestro `task.md` actual. Tendrá secciones claras para:
- **Estrategia**: Definición de objetivos.
- **Checklists**: Pasos atómicos para cada tarea.

### C. Carpetas de Soporte
- `tools/`: Aquí moveremos scripts como `importar_datos.py` y crearemos nuevos scripts de diagnóstico (`health_check.py`).
- `architecture/`: Aquí crearemos documentos explicando módulos específicos (ej. `architecture/report_generation_sop.md`).
- `.tmp/`: Carpeta ignorada por git para archivos temporales (PDFs generados, logs de depuración).

## 2. Plan de Acción Inmediato

Si autorizas este plan, procederé en este orden:

1.  **Creación de Archivos**: Generaré `gemini.md` extrayendo la estructura de `esquema.sql` y `App.jsx`.
2.  **Organización**: Crearé las carpetas `architecture`, `tools` y `.tmp`.
3.  **Migración de Herramientas**: Moveré `importar_datos.py` a `tools/` y lo adaptaré para que sea un script "autónomo" y determinista bajo el estándar E.T.A.P.A.
4.  **Handshake**: Crearé un script `tools/verify_system.py` para probar que todo el sistema (backend + frontend serving) está operativo.

## 3. Beneficios Esperados
- **Auto-reparación**: Si algo falla en el futuro, tendremos scripts en `tools/` para diagnosticarlo.
- **Determinismo**: No habrá dudas sobre "dónde va este código", `gemini.md` dictará la ley.
- **Claridad**: Cualquier desarrollador (o IA) futuro sabrá exactamente cómo funciona el sistema leyendo `architecture/`.
