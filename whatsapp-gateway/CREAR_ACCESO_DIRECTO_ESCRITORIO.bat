@echo off
title Crear Accesos Directos en el Escritorio - Bunker Gym
color 0B
cd /d "%~dp0"

echo ==============================================================
echo    CREANDO ACCESOS DIRECTOS DE WHATSAPP EN EL ESCRITORIO
echo ==============================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell; " ^
  "$desktop = [Environment]::GetFolderPath('Desktop'); " ^
  "$s1 = $ws.CreateShortcut(\"$desktop\Activar WhatsApp Bunker.lnk\"); " ^
  "$s1.TargetPath = '%~dp0ACTIVAR_WHATSAPP_SEGUNDO_PLANO.bat'; " ^
  "$s1.WorkingDirectory = '%~dp0'; " ^
  "$s1.Description = 'Inicia la pasarela de WhatsApp Bunker Gym en segundo plano'; " ^
  "$s1.Save(); " ^
  "$s2 = $ws.CreateShortcut(\"$desktop\Detener WhatsApp Bunker.lnk\"); " ^
  "$s2.TargetPath = '%~dp0detener_whatsapp.bat'; " ^
  "$s2.WorkingDirectory = '%~dp0'; " ^
  "$s2.Description = 'Detiene la pasarela de WhatsApp Bunker Gym'; " ^
  "$s2.Save(); " ^
  "$s3 = $ws.CreateShortcut(\"$desktop\Ver Panel WhatsApp Bunker.lnk\"); " ^
  "$s3.TargetPath = 'http://localhost:3001'; " ^
  "$s3.Description = 'Abre el panel de estado o escaneo de QR de WhatsApp'; " ^
  "$s3.Save();"

echo [OK] Se crearon 3 accesos directos en tu Escritorio:
echo.
echo   1. 'Activar WhatsApp Bunker'  (Inicia el servicio en segundo plano)
echo   2. 'Detener WhatsApp Bunker'  (Apaga el servicio si no lo queres usar)
echo   3. 'Ver Panel WhatsApp Bunker' (Abre la web para ver si esta conectado o ver el QR)
echo.
echo ==============================================================
echo.
pause
