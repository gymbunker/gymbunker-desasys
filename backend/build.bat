@echo off
chcp 65001 >nul
title GYM-ATLAS — Build Tool
color 0A

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║     GYM-ATLAS  —  Build Automatico      ║
echo  ║     Convierte la app a .exe portable     ║
echo  ╚══════════════════════════════════════════╝
echo.

:: ── Verificar Python ─────────────────────────────────────────────────────────
set PYTHON_CMD=python
python --version >nul 2>&1
if errorlevel 1 (
    py --version >nul 2>&1
    if not errorlevel 1 (
        set PYTHON_CMD=py
    ) else (
        echo  [ERROR] Python no encontrado en PATH.
        echo  Descargalo de https://python.org e instala marcando "Add to PATH".
        pause & exit /b 1
    )
)
echo  [OK] Python detectado (%PYTHON_CMD%).

:: ── Instalar dependencias ────────────────────────────────────────────────────
echo.
echo  [1/4] Instalando dependencias de Python...
%PYTHON_CMD% -m pip install -r requirements.txt --quiet --disable-pip-version-check
if errorlevel 1 (
    echo  [ERROR] Fallo la instalacion de dependencias.
    pause & exit /b 1
)
echo  [OK] Dependencias instaladas.

:: ── Instalar PyInstaller ─────────────────────────────────────────────────────
echo.
echo  [2/4] Verificando PyInstaller...
%PYTHON_CMD% -m pip install pyinstaller --quiet --disable-pip-version-check
echo  [OK] PyInstaller listo.

:: ── Descargar modelo YOLOv8 si no existe ─────────────────────────────────────
echo.
echo  [3/4] Verificando modelo YOLOv8...
if not exist "yolov8n.pt" (
    echo  Descargando yolov8n.pt ^(~6 MB^)...
    %PYTHON_CMD% -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"
    echo  [OK] Modelo descargado.
) else (
    echo  [OK] Modelo yolov8n.pt ya existe.
)

:: ── Build con PyInstaller ────────────────────────────────────────────────────
echo.
echo  [4/4] Empaquetando con PyInstaller...
echo  ^(Esto puede tardar entre 3 y 10 minutos segun tu maquina^)
echo.
%PYTHON_CMD% -m PyInstaller gym_atlas.spec --clean --noconfirm
echo  [OK] Build Principal completado.

echo.
echo  [5/5] Empaquetando version Adicional con PyInstaller...
%PYTHON_CMD% -m PyInstaller gym_atlas_adicional.spec --clean --noconfirm

if errorlevel 1 (
    echo.
    echo  [ERROR] El build fallo. Revisa los mensajes arriba.
    pause & exit /b 1
)

:: ── Resultado ─────────────────────────────────────────────────────────────────
echo.
echo  ╔══════════════════════════════════════════╗
echo  ║           BUILD EXITOSO                 ║
echo  ╚══════════════════════════════════════════╝
echo.
echo  Aplicacion Principal en:  dist\BunkerGym\BunkerGym.exe
echo  Aplicacion Adicional en:  dist\BunkerGymAdicional\BunkerGymAdicional.exe
echo.
echo  PROXIMOS PASOS:
echo  ─────────────────────────────────────────
echo  1. Edita dist\BunkerGym\.env con tu DATABASE_URL
echo  2. Prueba ejecutando dist\BunkerGym\BunkerGym.exe
echo  3. Para crear el INSTALADOR (.exe de setup):
echo     - Instala Inno Setup desde https://jrsoftware.org/isinfo.php
echo     - Abre installer.iss y presiona Compile (F9)
echo     - El instalador quedara en: Output\BunkerGym_Setup.exe
echo.
pause
