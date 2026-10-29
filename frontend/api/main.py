from fastapi import FastAPI, Depends, WebSocket, WebSocketDisconnect
import os
import datetime
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import asyncio
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from . import models
from .database import engine, get_db
from .cv_engine import CVEngine

import admin_routes
import user_routes

models.Base.metadata.create_all(bind=engine)

def auto_migrate():
    migrations = [
        "ALTER TABLE members ADD COLUMN IF NOT EXISTS fixed_billing_day INTEGER;",
        "ALTER TABLE members ADD COLUMN IF NOT EXISTS keep_billing_day BOOLEAN DEFAULT FALSE;",
        "ALTER TABLE members ADD COLUMN IF NOT EXISTS next_due_date TIMESTAMP;",
        "ALTER TABLE payments ADD COLUMN IF NOT EXISTS billing_date TIMESTAMP;",
        "ALTER TABLE payments ADD COLUMN IF NOT EXISTS next_due_date TIMESTAMP;",
        "ALTER TABLE plans ADD COLUMN IF NOT EXISTS enable_custom_payment_methods BOOLEAN DEFAULT FALSE;",
        "ALTER TABLE plans ADD COLUMN IF NOT EXISTS price_cash DOUBLE PRECISION;",
        "ALTER TABLE plans ADD COLUMN IF NOT EXISTS price_transfer DOUBLE PRECISION;",
        "ALTER TABLE members ADD COLUMN IF NOT EXISTS is_new BOOLEAN DEFAULT FALSE;",
        "UPDATE members SET dni = NULL WHERE dni = '' OR TRIM(dni) = '';",
        "UPDATE members SET email = NULL WHERE email = '' OR TRIM(email) = '';",
        "UPDATE members SET phone = NULL WHERE phone = '' OR TRIM(phone) = '';"
    ]
    for sql in migrations:
        try:
            with engine.begin() as conn:
                conn.execute(text(sql))
        except Exception as e:
            print(f"Auto-migration notice ({sql}): {e}")

try:
    auto_migrate()
except Exception as e:
    print(f"Initial auto_migrate error: {e}")


cv_engine = CVEngine()

# Start camera only if explicitly requested or in local environments
if os.getenv("LOCAL_CAMERA", "false").lower() == "true":
    try:
        cv_engine.start()
    except Exception as e:
        print(f"Failed to start camera: {e}")

app = FastAPI(title="Gym-Atlas API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(admin_routes.router)
app.include_router(user_routes.router)

@app.get("/")
def read_root():
    return {"status": "Gym-Atlas Backend is running", "version": "2.0.0"}

@app.get("/members/{dni}")
def get_member(dni: str, db: Session = Depends(get_db)):
    member = db.query(models.Member).filter(models.Member.dni == dni).first()
    if not member:
        return {"error": "Member not found"}
    
    if member.status != "INACTIVO":
        now = datetime.datetime.utcnow()
        if member.next_due_date:
            days_until_due = (member.next_due_date.date() - now.date()).days
            if days_until_due < 0:
                new_status = "DEUDA"
            elif days_until_due <= 7:
                new_status = "POR VENCER"
            else:
                new_status = "ACTIVO"
        elif member.joined_at:
            days_since = (now - member.joined_at).days
            plan = (member.membership_type or "").upper()
            total_days = 30
            if plan == "TRIMESTRAL":
                total_days = 90
            elif plan == "SEMESTRAL":
                total_days = 180
            elif plan == "ANUAL":
                total_days = 365
                
            if days_since >= total_days:
                new_status = "DEUDA"
            elif days_since >= total_days - 7:
                new_status = "POR VENCER"
            else:
                new_status = "ACTIVO"
        else:
            new_status = member.status
        
        if member.status != new_status:
            member.status = new_status
            db.commit()
            db.refresh(member)

    # Logic for access control
    cv_engine.set_member_status(member.name, member.status)
    return member

def gen_frames():
    while True:
        frame = cv_engine.get_frame()
        if frame is not None:
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
            # Cap at ~30 FPS
            # Note: time is not imported in original, but needed for sleep
            # import time 
            # time.sleep(0.03) 
        else:
            # Wait for next frame
            # time.sleep(0.1)
            pass

@app.get("/video_feed")
def video_feed():
    return StreamingResponse(gen_frames(), media_type="multipart/x-mixed-replace; boundary=frame")

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            await connection.send_json(message)

manager = ConnectionManager()

async def ws_announcer():
    last_alarm_state = False
    while True:
        current_alarm = cv_engine.is_alarm_active
        if current_alarm != last_alarm_state:
            await manager.broadcast({"type": "alarm_state", "active": current_alarm})
            last_alarm_state = current_alarm
        await asyncio.sleep(0.1)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(ws_announcer())

@app.websocket("/ws")
async def websocket_clients(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Just echo for now
            await websocket.send_text(f"Message text was: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
