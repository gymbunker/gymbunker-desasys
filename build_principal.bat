@echo off
echo Construyendo ejecutable de Bunker Gym Principal...
cd backend
pyinstaller --noconfirm --onedir --windowed --name "BunkerGymPrincipal" --add-data "bunker.png;." --add-data "..\yolov8n.pt;." --add-data ".env;." desktop_kiosk.py
cd ..
echo ============================================================
echo Construccion terminada. El programa esta en:
echo backend\dist\BunkerGymPrincipal
echo ============================================================
echo.
echo Ahora puedes abrir tu archivo de Inno Setup (si tienes uno para el principal)
echo para compilar el instalador final.
pause
