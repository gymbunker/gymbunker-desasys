@echo off
title Detener Pasarela WhatsApp Bunker Gym
echo ==================================================
echo   Deteniendo Pasarela WhatsApp Bunker Gym...
echo ==================================================

taskkill /F /IM ngrok.exe /T 2>nul
taskkill /F /IM cloudflared.exe /T 2>nul

for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001') do (
    taskkill /F /PID %%a 2>nul
)

echo.
echo [OK] Servicios de WhatsApp detenidos correctamente.
timeout /t 3
