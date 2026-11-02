@echo off
title Activando WhatsApp Bunker Gym...
color 0A
cd /d "%~dp0"

:: Asegurar Node.js en el PATH por si no esta en las variables globales
if exist "C:\Program Files\nodejs" set "PATH=%PATH%;C:\Program Files\nodejs"
if exist "C:\Program Files (x86)\nodejs" set "PATH=%PATH%;C:\Program Files (x86)\nodejs"
if exist "%APPDATA%\npm" set "PATH=%PATH%;%APPDATA%\npm"

echo ==============================================================
echo       ACTIVANDO PASARELA WHATSAPP EN SEGUNDO PLANO
echo ==============================================================
echo.
echo [1/3] Cerrando instancias previas si habia alguna abierta...
taskkill /F /IM ngrok.exe /T 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001') do taskkill /F /PID %%a 2>nul
timeout /t 1 >nul

echo [2/3] Iniciando servicio en segundo plano (sin ventanas molestas)...
wscript "%~dp0start_silent.vbs"
timeout /t 3 >nul

echo [3/3] Abriendo panel de WhatsApp en el navegador...
start http://localhost:3001

echo.
echo ==============================================================
echo  LISTO! La pasarela ya quedo funcionando de fondo en esta PC.
echo  Podes cerrar esta ventana sin problema, el servicio NO se corta.
echo ==============================================================
echo.
timeout /t 4
exit
