@echo off
title Pasarela WhatsApp Bunker Gym

taskkill /F /IM ngrok.exe /T 2>nul
taskkill /F /IM cloudflared.exe /T 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001') do (
    taskkill /F /PID %%a 2>nul
)
timeout /t 1 >nul

cd /d "%~dp0"
node run.js
pause
