@echo off
title Bunker Gym - Pasarela WhatsApp y Tunel
color 0E
echo.
echo ==============================================================
echo       BUNKER GYM - PASARELA WHATSAPP Y TUNEL
echo ==============================================================
echo Limpiando instancias previas si existen...
taskkill /F /IM ngrok.exe /T 2>nul
taskkill /F /IM cloudflared.exe /T 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001') do (
    taskkill /F /PID %%a 2>nul
)
timeout /t 1 >nul

echo Iniciando servidor Baileys y tunel de comunicacion...
echo.

cd /d "%~dp0whatsapp-gateway"
node run.js

pause
