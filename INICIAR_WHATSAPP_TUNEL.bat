@echo off
title Bunker Gym - Pasarela WhatsApp y Tunel
color 0E
echo.
echo ==============================================================
echo       BUNKER GYM - PASARELA WHATSAPP Y TUNEL
echo ==============================================================
echo.
echo Iniciando servidor Baileys y tunel de comunicacion...
echo.

cd /d "%~dp0whatsapp-gateway"
node run.js

pause
