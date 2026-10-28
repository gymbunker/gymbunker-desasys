@echo off
title Instalador Bunker Gym WhatsApp Gateway
color 0A
cd /d "%~dp0"

:: Asegurar que Node.js este en el PATH incluso recien instalado sin reiniciar
if exist "C:\Program Files\nodejs" set "PATH=%PATH%;C:\Program Files\nodejs"
if exist "C:\Program Files (x86)\nodejs" set "PATH=%PATH%;C:\Program Files (x86)\nodejs"
if exist "%APPDATA%\npm" set "PATH=%PATH%;%APPDATA%\npm"

echo ==============================================================
echo        INSTALADOR DE PASARELA WHATSAPP - BUNKER GYM
echo ==============================================================
echo.

where node >nul 2>&1
if not errorlevel 1 goto node_ok

color 0C
echo [ERROR] Node.js no fue detectado en esta computadora.
echo.
echo Si acabas de instalar Node.js hace un momento:
echo 1. Cerra esta ventana.
echo 2. Reinicia la PC para que Windows aplique la instalacion.
echo 3. Volve a ejecutar este archivo.
echo.
echo Si todavia no lo instalaste, descargalo e instalalo desde:
echo https://nodejs.org/ - Version LTS recomendada
echo.
pause
exit /b

:node_ok
echo [OK] Node.js detectado correctamente:
node -v
echo.

:: 2. Instalar dependencias si faltan
if exist "node_modules\" goto node_modules_ok
echo [INFO] Instalando librerias necesarias (npm install)...
call npm install
echo.
:node_modules_ok

:: 3. Configurar Authtoken de Ngrok directamente
echo ==============================================================
echo Configurando Ngrok y Credenciales del Bunker Gym...
echo ==============================================================
set "NGROK_TOKEN=3L2II5liPkUz9dUV1U9SLjX32cF_3t7hqpWDrgBepTkqSP5Ru"

if not exist "ngrok.exe" goto no_ngrok
ngrok.exe config add-authtoken %NGROK_TOKEN%
echo [OK] Authtoken de Ngrok configurado con exito.
goto ngrok_done
:no_ngrok
echo [AVISO] ngrok.exe no se encontro en esta carpeta.
:ngrok_done

:: 4. Configurar .env con el dominio y credenciales oficiales
echo NGROK_DOMAIN=caramel-gopher-ounce.ngrok-free.dev> .env
echo WHATSAPP_API_TOKEN=bunker_wa_secret_2026>> .env
echo PORT=3001>> .env
echo [OK] Archivo .env configurado con el dominio caramel-gopher-ounce.ngrok-free.dev

:: 5. Instalar arranque invisible en Inicio de Windows
echo.
echo [INFO] Instalando arranque automatico con Windows...

:: Generar start_silent.vbs dinamico con la ruta de ESTA computadora
echo Set WshShell = CreateObject("WScript.Shell")> "%~dp0start_silent.vbs"
echo WshShell.CurrentDirectory = "%~dp0">> "%~dp0start_silent.vbs"
echo WshShell.Run "node run.js", 0, False>> "%~dp0start_silent.vbs"

set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
copy /Y "%~dp0start_silent.vbs" "%STARTUP_FOLDER%\BunkerWhatsAppBot.vbs" >nul

echo [OK] Inicio automatico invisible instalado en Windows.
echo.

:: 6. Iniciar ahora mismo la pasarela
echo ==============================================================
echo   INSTALACION COMPLETADA CON EXITO
echo   La pasarela se iniciara ahora en segundo plano.
echo   Se abrira el navegador con el codigo QR para escanear.
echo ==============================================================
echo.

:: Cerrar procesos previos en el puerto 3001 si habia alguno
taskkill /F /IM ngrok.exe /T 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001') do taskkill /F /PID %%a 2>nul
timeout /t 1 >nul

wscript "%~dp0start_silent.vbs"
timeout /t 4 >nul

echo Abriendo panel de WhatsApp en el navegador...
start http://localhost:3001

echo.
echo ==============================================================
echo ¡TODO LISTO! Escanea el codigo QR que se abrio en tu navegador.
echo Podes cerrar esta ventana cuando quieras.
echo ==============================================================
pause
