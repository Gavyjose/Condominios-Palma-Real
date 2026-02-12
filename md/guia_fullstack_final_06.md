# Guía de Entrega Full-Stack - Versión Final

¡La transformación digital de la Torre 9 está completa! Hemos pasado de un archivo Excel estático a una aplicación web moderna y conectada.

## Estructura del Proyecto
- **Backend**: Servidor Node.js/Express (`server.js`) conectado a `condominio.db`.
- **Frontend**: Aplicación React con Tailwind CSS v4 (`torre9-web`).
- **Base de Datos**: SQLite con soporte bimoneda total ($ y Bs).

## Funcionalidades de Primer Nivel

### 1. Datos Reales en Tiempo Real
Ya no hay datos de prueba. Si cambias un valor en `condominio.db`, se reflejará instantáneamente en el Dashboard.
- **Fondo de Reserva**: Calculado de los movimientos de caja.
- **Cuentas por Cobrar**: Suma dinámica de deudas de los 16 apartamentos.

### 2. Portal del Propietario Inteligente
- **Consulta Personalizada**: El Sr. Chuy de PB-D verá sus **$292.42** exactos sacados de la base de datos.
- **Notificación de Pagos**: Los vecinos pueden enviar sus comprobantes. Estas notificaciones se guardan en la base de datos y aparecen en la vista del Administrador para su aprobación.

### 3. Automatización de Solvencias
- El botón de descarga de PDF se habilita solo cuando el sistema confirma que el saldo en la base de datos es **$0.00**.

## Instrucciones para Ejecutar
Para que el sistema funcione, ambos procesos deben estar corriendo:

1. **Servidor Backend**:
   - Ubicación: Raíz del proyecto.
   - Comando: `node server.js`
   - Puerto: `http://localhost:3001`

2. **Frontend React**:
   - Ubicación: Carpeta `torre9-web`.
   - Comando: `npm run dev`
   - Puerto: `http://localhost:5173`

¡El sistema está listo para profesionalizar la gestión de la Torre 9!
