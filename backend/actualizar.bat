@echo off
chcp 65001 >nul
echo.
echo  Actualizando Bunker Gym...
echo.

set DEST=C:\Program Files\BunkerGym

taskkill /F /IM BunkerGym.exe >nul 2>&1
echo  [OK] App cerrada (si estaba abierta)

xcopy /E /Y /I "dist\BunkerGym\*" "%DEST%\" >nul
echo  [OK] Archivos actualizados en %DEST%

echo.
echo  Listo! Abre la app desde el acceso directo del escritorio.
echo.
pause
