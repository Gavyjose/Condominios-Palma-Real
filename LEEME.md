# Manual de Usuario y Entrega Final

**Proyecto:** Gestión Condominio Torre 9
**Versión:** 1.0 (Protocolo E.T.A.P.A.)
**Última Actualización:** Febrero 2026

---

## 🚀 Inicio Rápido

Para utilizar el sistema, simplemente haz doble clic en el archivo:
📄 **`iniciar_sistema.bat`**

Este script se encargará de:
1.  Verificar que la base de datos esté sana.
2.  Iniciar el servidor Backend (Cerebro).
3.  Iniciar la Página Web (Interfaz).
4.  Abrir tu navegador automáticamente.

---

## 📂 Organización del Proyecto (E.T.A.P.A.)

Hemos reestructurado el proyecto para máxima durabilidad:

- **`gemini.md`**: La "Constitución" del proyecto. Contiene las reglas sagradas y el esquema de datos.
- **`tools/`**: Carpeta de herramientas técnicas.
    - `check_db.py`: Diagnóstico de salud.
    - `seed_data.py`: **⚠ Reset de Fábrica**. Borra todo y restaura desde Excel.
- **`architecture/`**: Documentación técnica para programadores futuros.
- **`.env`**: Archivos de configuración (Puertos, Rutas).

## 🆘 Solución de Problemas

### "No cargan los datos en la web"
1.  Asegúrate de que la ventana negra "Backend Condominio" esté abierta.
2.  Ejecuta `iniciar_sistema.bat` nuevamente para ver si hay errores en la verificación.

### "Necesito reiniciar todo desde cero (Borrar cambios)"
1.  Abre una terminal (`cmd`).
2.  Ejecuta: `python tools/seed_data.py --force`
    *(Nota: Esto borrará todos los pagos registrados y volverá al estado del Excel original)*.

### "No se generan los PDFs"
El sistema tiene un bloqueador de errores. Si falla, verás una alerta en pantalla. Asegúrate de que no haya caracteres extraños en los datos del Excel.

---
*Sistema desarrollado con metodología E.T.A.P.A. por Antigravity*
