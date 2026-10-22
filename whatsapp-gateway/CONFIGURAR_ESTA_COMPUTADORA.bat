@echo off
chcp 65001 >nul
title Instalador Bunker Gym WhatsApp Gateway
color 0A

echo ==============================================================
echo        INSTALADOR DE PASARELA WHATSAPP - BUNKER GYM
echo ==============================================================
echo.

:: 1. Verificar si Node.js está instalado
node -v >nul 2>&1
if %ERRORLEVEL% neq 0 (
    color 0C
    echo [ERROR] Node.js no está instalado en esta computadora.
    echo.
    echo Por favor descargalo e instalalo desde:
    echo https://nodejs.org/ (Version LTS recomendada)
    echo.
    echo O abri PowerShell como administrador y ejecuta:
    echo winget install OpenJS.NodeJS.LTS
    echo.
    pause
    exit /b
)

echo [OK] Node.js detectado:
node -v
echo.

:: 2. Instalar dependencias si faltan
if not exist "node_modules\" (
    echo [INFO] Instalando librerías necesarias (npm install)...
    call npm install
    echo.
)

:: 3. Configurar Authtoken de Ngrok
echo ==============================================================
echo Configuración de Ngrok (Dominio permanente)
echo ==============================================================
set /p NGROK_TOKEN="Pegá aquí tu Authtoken de Ngrok (o presiona ENTER si ya lo pusiste): "
if not "%NGROK_TOKEN%"=="" (
    if exist "ngrok.exe" (
        ngrok.exe config add-authtoken %NGROK_TOKEN%
    ) else (
        echo [AVISO] ngrok.exe no encontrado en esta carpeta.
    )
)

:: 4. Configurar .env con el dominio
if not exist ".env" (
    (
        echo NGROK_DOMAIN=caramel-gopher-ounce.ngrok-free.dev
        echo WHATSAPP_API_TOKEN=bunker_wa_secret_2026
        echo PORT=3001
    ) > .env
    echo [OK] Archivo .env configurado con el dominio caramel-gopher-ounce.ngrok-free.dev
)

:: 5. Instalar arranque invisible en Inicio de Windows
echo.
echo [INFO] Instalando arranque automático con Windows...
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "DEST_VBS=%STARTUP_FOLDER%\BunkerWhatsAppBot.vbs"

(
    echo Set WshShell = CreateObject^("WScript.Shell"^)
    echo WshShell.CurrentDirectory = "%~dp0"
    echo WshShell.Run "node run.js", 0, False
) > "%DEST_VBS%"

echo [OK] Acceso directo silencioso instalado en:
echo      %DEST_VBS%
echo.

:: 6. Iniciar ahora mismo
echo ==============================================================
echo   ¡INSTALACIÓN COMPLETADA CON ÉXITO!
echo   La pasarela se iniciará ahora en segundo plano.
echo   Se abrirá automáticamente cada vez que prendas la PC.
echo ==============================================================
echo.
wscript "%~dp0start_silent.vbs"
timeout /t 3 >nul

echo Comprobando estado...
timeout /t 2 >nul
start http://localhost:3001

pause
