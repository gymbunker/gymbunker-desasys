@echo off
title Reparar y Vincular WhatsApp - Bunker Gym
color 0E
cd /d "%~dp0"

echo ==============================================================
echo     REPARADOR DE SESION Y CLAVES WHATSAPP - BUNKER GYM
echo ==============================================================
echo.
echo Este asistente resuelve el problema de:
echo 'Esperando el mensaje. Esto puede demorar un poco'
echo.
echo Pasos que hara:
echo  1. Cerrar procesos colgados de WhatsApp y Ngrok.
echo  2. Limpiar las claves de sesion desincronizadas.
echo  3. Iniciar el servicio limpio en segundo plano.
echo  4. Abrir la ventana para escanear el codigo QR nuevo.
echo.
echo Presiona cualquier tecla para continuar...
pause >nul
echo.

echo [1/4] Deteniendo servicios anteriores...
taskkill /F /IM ngrok.exe /T 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001') do taskkill /F /PID %%a 2>nul
timeout /t 1 >nul

echo [2/4] Limpiando claves desincronizadas (auth_info)...
if exist "auth_info\" (
    rd /s /q "auth_info" 2>nul
    mkdir "auth_info" 2>nul
)

echo [3/4] Iniciando pasarela en segundo plano...
wscript "%~dp0start_silent.vbs"
timeout /t 3 >nul

echo [4/4] Abriendo el panel en el navegador para escanear el QR...
start http://localhost:3001

echo.
echo ==============================================================
echo  AHORA: Abre WhatsApp en el celular del gimnasio:
echo  1. Ve a Ajustes / Menu -> Dispositivos vinculados.
echo  2. Toca 'Vincular un dispositivo' y escanea el QR de la pantalla.
echo.
echo  IMPORTANTE: Deja el celular con internet y NO cierres el celular.
echo  A partir de ahi, los comprobantes saldran descifrados y directos!
echo ==============================================================
echo.
timeout /t 6
exit
