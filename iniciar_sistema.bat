@echo off
TITLE Sistema Condominio Torre 9 - Launcher
CLS

ECHO ============================================================
ECHO      SISTEMA DE GESTION CONDOMINIO TORRE 9 - E.T.A.P.A.
ECHO ============================================================
ECHO.

:: 1. VERIFICACION DE SALUD (Handshake)
ECHO [1/3] Verificando integridad de Base de Datos...
python tools/check_db.py
IF %ERRORLEVEL% NEQ 0 (
    ECHO [ERROR] La base de datos tiene problemas. Revise los logs.
    PAUSE
    EXIT /B 1
)
ECHO [OK] Base de datos integra.
ECHO.

:: 2. INICIO DE SERVIDORES
ECHO [2/3] Iniciando Servidor Backend (Puerto 3001)...
start "Backend Condominio" /MIN cmd /c "npm start"

ECHO [3/3] Iniciando Interfaz Frontend (Puerto 5173)...
cd torre9-web
start "Frontend Condominio" /MIN cmd /c "npm run dev"

:: 3. APERTURA DE NAVEGADOR
timeout /t 5 >nul
start http://localhost:5173

ECHO.
ECHO [EXITO] Sistema iniciado correctamente.
ECHO Puede cerrar esta ventana, los servidores correran en segundo plano.
PAUSE
