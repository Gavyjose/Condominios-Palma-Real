@echo off
TITLE Reiniciador de Backend Torre 9
CLS
ECHO [1/2] Matando procesos antiguos en el puerto 3001...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001') do taskkill /f /pid %%a
timeout /t 2 >nul
ECHO.
ECHO [2/2] Iniciando Servidor Backend (Puerto 3001)...
node server.js
PAUSE
