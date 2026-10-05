# gym_atlas.spec — PyInstaller configuration for GYM-ATLAS Desktop Kiosk
# Run with: pyinstaller gym_atlas.spec --clean --noconfirm

import os
import sys
from pathlib import Path

block_cipher = None

# ─── Locate customtkinter assets (themes, images) ────────────────────────────
import customtkinter as _ctk
CTK_PATH = str(Path(_ctk.__file__).parent)

# ─── Data files to bundle ─────────────────────────────────────────────────────
added_datas = [
    # CustomTkinter themes and assets
    (CTK_PATH, "customtkinter"),
]

# YOLOv8 model (yolov8n.pt must be in backend/ folder)
if Path("yolov8n.pt").exists():
    added_datas.append(("yolov8n.pt", "."))

# .env config template for database connection
if Path(".env").exists():
    added_datas.append((".env", "."))
elif Path("config.env").exists():
    added_datas.append(("config.env", "."))

# ─── Analysis ─────────────────────────────────────────────────────────────────
a = Analysis(
    ["desktop_kiosk_adicional.py"],
    pathex=["."],
    binaries=[],
    datas=added_datas,
    hiddenimports=[
        # GUI
        "customtkinter",
        "PIL", "PIL.Image", "PIL.ImageTk", "PIL._tkinter_finder",
        # Computer Vision
        "cv2",
        # YOLOv8
        "ultralytics",
        "ultralytics.nn",
        "ultralytics.nn.tasks",
        "ultralytics.utils",
        "ultralytics.utils.checks",
        # FastAPI / Uvicorn
        "uvicorn",
        "uvicorn.logging",
        "uvicorn.loops",
        "uvicorn.loops.auto",
        "uvicorn.protocols",
        "uvicorn.protocols.http",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.websockets",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.lifespan",
        "uvicorn.lifespan.on",
        "fastapi",
        "fastapi.middleware.cors",
        "starlette",
        "starlette.middleware",
        "starlette.middleware.cors",
        "anyio",
        "anyio._backends._asyncio",
        "h11",
        "httptools",
        "websockets",
        # Database
        "sqlalchemy",
        "sqlalchemy.dialects",
        "sqlalchemy.dialects.postgresql",
        "sqlalchemy.dialects.postgresql.psycopg2",
        "psycopg2",
        "psycopg2.extras",
        "psycopg2._psycopg",
        "greenlet",
        "asyncpg",
        # Local modules
        "admin_routes",
        "user_routes",
        "totem_routes",
        "models",
        "schemas",
        "database",
        "cv_engine",
        # Env
        "dotenv",
        "python_dotenv",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "tkinter.test",
        "pytest",
        "matplotlib",
        "notebook",
        "IPython",
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="FusionFitnessAdicional",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,           # Sin ventana de consola negra
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon="bunker.ico" if Path("bunker.ico").exists() else None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="FusionFitnessAdicional",
)
