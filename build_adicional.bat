@echo off
echo Construyendo ejecutable de Bunker Gym Adicional...
cd backend
pyinstaller --noconfirm --onedir --windowed --name "BunkerGymAdicional" --add-data "bunker.png;." --add-data "..\yolov8n.pt;." --add-data ".env;." desktop_kiosk_adicional.py
cd ..
echo ============================================================
echo Construccion terminada. El programa esta en:
echo backend\dist\BunkerGymAdicional
echo ============================================================
echo.
echo Ahora puedes hacer doble clic en el archivo Installer_Adicional.iss
echo para compilar el instalador final usando Inno Setup.
pause
