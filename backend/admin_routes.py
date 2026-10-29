from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from database import get_db
import models
import schemas
from typing import List
import datetime
import threading
import json
import urllib.request
import urllib.parse
import smtplib
import base64
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from email.mime.application import MIMEApplication
import re
import os
import logging
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
try:
    from .security import hash_password, verify_password
except ImportError:
    from security import hash_password, verify_password

router = APIRouter(prefix="/admin", tags=["Admin"])

@router.post("/login")
def admin_login(credentials: schemas.StaffLogin, db: Session = Depends(get_db)):
    username_or_name = credentials.username.strip().lower()
    staff_member = db.query(models.Staff).filter(
        func.lower(models.Staff.username) == username_or_name
    ).first()
    if not staff_member:
        staff_member = db.query(models.Staff).filter(
            func.lower(models.Staff.name) == username_or_name
        ).first()

    if not staff_member or not verify_password(credentials.password, staff_member.password):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    # If unhashed legacy password in DB, upgrade to PBKDF2 hash automatically
    if staff_member.password and not staff_member.password.startswith("pbkdf2:"):
        staff_member.password = hash_password(credentials.password)
        db.commit()
        db.refresh(staff_member)

    return {
        "id": staff_member.id,
        "name": staff_member.name,
        "username": staff_member.username,
        "role": staff_member.role,
        "shift": staff_member.shift
    }

@router.get("/stats")
def get_gym_stats(db: Session = Depends(get_db)):
    active_members = db.query(models.Member).filter(models.Member.status == "ACTIVO").count()
    revenue = db.query(models.Payment).filter(models.Payment.status == "paid").all()
    total_revenue = sum(p.amount for p in revenue)
    
    churn_risk = db.query(models.Member).filter(models.Member.status == "DEUDA").count()
    por_vencer = db.query(models.Member).filter(models.Member.status == "POR VENCER").count()
    
    # Calculate real monthly growth for the last 4 months
    monthly_stats = []
    now = datetime.datetime.utcnow()
    for i in range(4):
        month_date = now - datetime.timedelta(days=30*i)
        month_label = month_date.strftime("%b")
        month_val = db.query(models.Payment).filter(
            models.Payment.status == "paid",
            func.extract('month', models.Payment.created_at) == month_date.month,
            func.extract('year', models.Payment.created_at) == month_date.year
        ).count()
        monthly_stats.append({"month": month_label, "v": month_val})
    monthly_stats.reverse()

    return {
        "active_members": active_members,
        "total_revenue": total_revenue,
        "churn_risk_count": churn_risk,
        "por_vencer_count": por_vencer,
        "monthly_growth": monthly_stats,
        "alerts": [
            {"type": "churn", "message": f"{churn_risk} members are in debt and at risk of cancellation."},
            {"type": "renewal", "message": f"{por_vencer} memberships are expiring soon."}
        ]
    }

@router.get("/members", response_model=List[schemas.MemberSchema])
def get_all_members(db: Session = Depends(get_db)):
    members = db.query(models.Member).all()
    now = datetime.datetime.utcnow()
    updated = False
    for m in members:
        # Sync from wellness_data if columns are None
        wdata = m.wellness_data or {}
        if m.keep_billing_day is None and "keep_billing_day" in wdata:
            m.keep_billing_day = wdata["keep_billing_day"]
        if m.fixed_billing_day is None and "fixed_billing_day" in wdata:
            m.fixed_billing_day = wdata["fixed_billing_day"]
        if m.next_due_date is None and "next_due_date" in wdata and wdata["next_due_date"]:
            try:
                m.next_due_date = datetime.datetime.fromisoformat(wdata["next_due_date"].replace("Z", ""))
            except Exception:
                pass

        if m.status != "INACTIVO":
            if m.next_due_date:
                days_until_due = (m.next_due_date.date() - now.date()).days
                if days_until_due <= -10:
                    new_status = "INACTIVO"
                elif days_until_due < 0:
                    new_status = "DEUDA"
                elif days_until_due <= 7:
                    new_status = "POR VENCER"
                else:
                    new_status = "ACTIVO"
            elif m.joined_at:
                membership_type = (m.membership_type or "").upper()
                validity_days = 30
                if "TRIMESTRAL" in membership_type:
                    validity_days = 90
                elif "SEMESTRAL" in membership_type:
                    validity_days = 180
                elif "ANUAL" in membership_type:
                    validity_days = 365

                days_since = (now - m.joined_at).days
                if days_since >= validity_days + 10:
                    new_status = "INACTIVO"
                elif days_since >= validity_days:
                    new_status = "DEUDA"
                elif days_since >= validity_days - 7:
                    new_status = "POR VENCER"
                else:
                    new_status = "ACTIVO"
            else:
                new_status = m.status
            
            if m.status != new_status:
                old_status = m.status
                m.status = new_status
                notify_member_status_change(m, old_status, new_status, db)
                updated = True
    if updated:
        db.commit()

    result = []
    for m in members:
        # Convert to dict first to avoid Pydantic mutability constraints
        m_dict = schemas.MemberSchema.from_orm(m).dict()
        m_dict["password"] = ""
        m_dict["billing_history"] = [
            {
                "id": p.id,
                "date": p.created_at.strftime("%Y-%m-%d"),
                "amount": p.amount,
                "plan": m.membership_type or "Musculación",
                "method": p.method,
                "processed_by": p.stripe_id or "—",
                "status": "PAGADO"
            } for p in sorted(m.payments, key=lambda x: x.created_at, reverse=True)
        ]
        result.append(m_dict)
    return result

@router.post("/members", response_model=schemas.MemberSchema)
def create_member(member: schemas.MemberCreate, db: Session = Depends(get_db)):
    print(f"Creating member: {member.name} with DNI {member.dni}")
    data = member.dict()

    # DNI sanitization: None if blank or empty
    raw_dni = data.get('dni')
    clean_dni = str(raw_dni).strip() if raw_dni is not None and str(raw_dni).strip() != "" else None
    data['dni'] = clean_dni
    if clean_dni:
        dup_dni = db.query(models.Member).filter(models.Member.dni == clean_dni).first()
        if dup_dni:
            raise HTTPException(
                status_code=400,
                detail=f"El DNI '{clean_dni}' ya está registrado para el socio {dup_dni.name}."
            )

    # Email sanitization: None if blank or empty
    raw_email = data.get('email')
    clean_email = str(raw_email).strip().lower() if raw_email is not None and str(raw_email).strip() != "" else None
    data['email'] = clean_email
    if clean_email:
        dup_email = db.query(models.Member).filter(func.lower(models.Member.email) == clean_email).first()
        if dup_email:
            raise HTTPException(
                status_code=400,
                detail=f"El correo '{clean_email}' ya está registrado para el socio {dup_email.name} (DNI: {dup_email.dni or 'Sin DNI'})."
            )

    # Phone sanitization: None if blank or empty
    raw_phone = data.get('phone')
    clean_phone = str(raw_phone).strip() if raw_phone is not None and str(raw_phone).strip() != "" else None
    data['phone'] = clean_phone

    if not data.get('joined_at'):
        data['joined_at'] = datetime.datetime.utcnow()
    if data.get('password'):
        if not data['password'].startswith("pbkdf2:"):
            data['password'] = hash_password(data['password'])
    else:
        data['password'] = hash_password("123")
    db_member = models.Member(**data)
    db.add(db_member)
    try:
        db.commit()
        db.refresh(db_member)
        print(f"Member created successfully with ID {db_member.id}")
        m_dict = schemas.MemberSchema.from_orm(db_member).dict()
        m_dict["password"] = ""
        return m_dict
    except IntegrityError as e:
        db.rollback()
        err_msg = str(e).lower()
        if "dni" in err_msg:
            raise HTTPException(status_code=400, detail="El DNI ingresado ya se encuentra registrado para otro socio.")
        elif "email" in err_msg:
            raise HTTPException(status_code=400, detail="El correo ingresado ya se encuentra registrado para otro socio.")
        else:
            raise HTTPException(status_code=400, detail="Error de datos duplicados (verifique DNI o Correo).")
    except Exception as e:
        db.rollback()
        print(f"Error creating member: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/members/{member_id}", response_model=schemas.MemberSchema)
def update_member(member_id: int, member_data: schemas.MemberCreate, db: Session = Depends(get_db)):
    db_member = db.query(models.Member).filter(models.Member.id == member_id).first()
    if not db_member:
        raise HTTPException(status_code=404, detail="Member not found")

    data = member_data.dict()

    # DNI sanitization: None if blank or empty
    raw_dni = data.get('dni')
    clean_dni = str(raw_dni).strip() if raw_dni is not None and str(raw_dni).strip() != "" else None
    data['dni'] = clean_dni
    if clean_dni:
        dup_dni = db.query(models.Member).filter(
            models.Member.dni == clean_dni,
            models.Member.id != member_id
        ).first()
        if dup_dni:
            raise HTTPException(
                status_code=400,
                detail=f"El DNI '{clean_dni}' ya está registrado para el socio {dup_dni.name}."
            )

    # Email sanitization: None if blank or empty
    raw_email = data.get('email')
    clean_email = str(raw_email).strip().lower() if raw_email is not None and str(raw_email).strip() != "" else None
    data['email'] = clean_email
    if clean_email:
        dup_email = db.query(models.Member).filter(
            func.lower(models.Member.email) == clean_email,
            models.Member.id != member_id
        ).first()
        if dup_email:
            raise HTTPException(
                status_code=400,
                detail=f"El correo '{clean_email}' ya está registrado para el socio {dup_email.name} (DNI: {dup_email.dni or 'Sin DNI'})."
            )

    # Phone sanitization: None if blank or empty
    raw_phone = data.get('phone')
    clean_phone = str(raw_phone).strip() if raw_phone is not None and str(raw_phone).strip() != "" else None
    data['phone'] = clean_phone

    if not data.get('joined_at'):
        data['joined_at'] = db_member.joined_at
    # Recalculate status from next_due_date (if present) or joined_at so editing reflects correctly
    joined = data['joined_at']
    next_due = data.get('next_due_date') or db_member.next_due_date
    if data.get('status') != 'INACTIVO':
        if next_due:
            now_date = datetime.datetime.utcnow().date()
            due_date = next_due.date() if isinstance(next_due, datetime.datetime) else datetime.date.fromisoformat(str(next_due)[:10])
            days_until_due = (due_date - now_date).days
            if days_until_due <= -10:
                data['status'] = 'INACTIVO'
            elif days_until_due < 0:
                data['status'] = 'DEUDA'
            elif days_until_due <= 7:
                data['status'] = 'POR VENCER'
            else:
                data['status'] = 'ACTIVO'
        elif joined:
            membership_type = (data.get('membership_type') or db_member.membership_type or "").upper()
            validity_days = 30
            if "TRIMESTRAL" in membership_type:
                validity_days = 90
            elif "SEMESTRAL" in membership_type:
                validity_days = 180
            elif "ANUAL" in membership_type:
                validity_days = 365

            days_since = (datetime.datetime.utcnow() - joined).days
            if days_since >= validity_days + 10:
                data['status'] = 'INACTIVO'
            elif days_since >= validity_days:
                data['status'] = 'DEUDA'
            elif days_since >= validity_days - 7:
                data['status'] = 'POR VENCER'
            else:
                data['status'] = 'ACTIVO'
    old_status = db_member.status
    for key, value in data.items():
        if key == 'password':
            if value and not value.startswith('pbkdf2:'):
                setattr(db_member, key, hash_password(value))
        else:
            setattr(db_member, key, value)

    if 'routine' in data:
        flag_modified(db_member, 'routine')
    if 'routine_documents' in data:
        flag_modified(db_member, 'routine_documents')

    if db_member.status != old_status:
        notify_member_status_change(db_member, old_status, db_member.status, db)

    try:
        db.commit()
        db.refresh(db_member)
        m_dict = schemas.MemberSchema.from_orm(db_member).dict()
        m_dict["password"] = ""
        return m_dict
    except IntegrityError as e:
        db.rollback()
        err_msg = str(e).lower()
        if "dni" in err_msg:
            raise HTTPException(status_code=400, detail="El DNI ingresado ya se encuentra registrado para otro socio.")
        elif "email" in err_msg:
            raise HTTPException(status_code=400, detail="El correo ingresado ya se encuentra registrado para otro socio.")
        else:
            raise HTTPException(status_code=400, detail="Error de datos duplicados (el DNI o Correo ya se encuentra registrado en otro socio).")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

def get_whatsapp_status_message(status: str) -> str:
    st = (status or "ACTIVO").upper().strip()
    if st in ["ACTIVO", "AL DIA", "AL DÍA"]:
        return "Hola soy BUNKER BOT de BUNKER GYM, como estas ? como van esos entrenamientos?"
    elif st == "POR VENCER":
        return "Hola soy BUNKER BOT de BUNKER GYM, como estas ? te hablaba para hacerte recordar que tu cuenta del gym esta POR VENCER no te olvides de renovar antes que sea tarde"
    elif st == "DEUDA":
        return "Hola soy BUNKER BOT de BUNKER GYM, tu plan está VENCIDO y figura en DEUDA, necesitamos que reestablezcas el pago, acercate a nuestro personal y comenta tu situacion"
    return "Hola soy BUNKER BOT de BUNKER GYM, como estas ? Te contactamos desde BUNKER GYM."

def dispatch_whatsapp_message(target_phone: str, message: str, sender_phone: str = None, pdf_base64: str = None, filename: str = None) -> bool:
    logger = logging.getLogger("whatsapp_sender")
    clean_digits = re.sub(r"\D", "", target_phone or "")
    if clean_digits.startswith("0"):
        clean_digits = clean_digits[1:]
    if not clean_digits.startswith("54") and len(clean_digits) == 10:
        clean_digits = "549" + clean_digits
    elif clean_digits.startswith("54") and not clean_digits.startswith("549") and len(clean_digits) == 12:
        clean_digits = "549" + clean_digits[2:]

    if not clean_digits:
        logger.warning("[WHATSAPP] Teléfono inválido o vacío para envío.")
        return False

    sender = sender_phone or os.getenv("VITE_WHATSAPP_PHONE") or os.getenv("WHATSAPP_PHONE") or ""
    gateway_url = os.getenv("WHATSAPP_GATEWAY_URL") or "https://caramel-gopher-ounce.ngrok-free.dev/send"
    gateway_token = os.getenv("WHATSAPP_API_TOKEN") or "bunker_wa_secret_2026"
    meta_phone_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID")
    meta_token = os.getenv("WHATSAPP_META_TOKEN") or os.getenv("WHATSAPP_API_TOKEN")

    try:
        if meta_phone_id and meta_token:
            url = f"https://graph.facebook.com/v19.0/{meta_phone_id}/messages"
            payload = json.dumps({
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": clean_digits,
                "type": "text",
                "text": {"preview_url": False, "body": message}
            }).encode("utf-8")
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {meta_token}"
            }
            req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=12) as resp:
                logger.info(f"[WHATSAPP SENT via Meta Cloud API] To: {clean_digits}")
                return True
        elif gateway_url:
            if "ultramsg.com" in gateway_url:
                post_data = urllib.parse.urlencode({
                    "token": gateway_token or "",
                    "to": clean_digits,
                    "body": message
                }).encode("utf-8")
                headers = {"Content-Type": "application/x-www-form-urlencoded"}
            else:
                body_dict = {
                    "sender": sender,
                    "phone": clean_digits,
                    "to": clean_digits,
                    "message": message
                }
                if pdf_base64:
                    body_dict["pdf_base64"] = pdf_base64
                    body_dict["filename"] = filename or "Comprobante_Pago_BunkerGym.pdf"

                post_data = json.dumps(body_dict).encode("utf-8")
                headers = {
                    "Content-Type": "application/json",
                    "User-Agent": "BunkerGym-WhatsApp-Client/1.0",
                    "ngrok-skip-browser-warning": "true"
                }
                if gateway_token:
                    headers["Authorization"] = f"Bearer {gateway_token}"

            req = urllib.request.Request(gateway_url, data=post_data, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=14) as resp:
                logger.info(f"[WHATSAPP SENT via Gateway {resp.status}] To: {clean_digits} (PDF: {bool(pdf_base64)})")
                return True
        else:
            logger.warning("[WHATSAPP] Ni Meta API ni WHATSAPP_GATEWAY_URL configurados.")
            return False
    except Exception as e:
        logger.error(f"[WHATSAPP ERROR] Fallo al enviar a {clean_digits}: {e}")
        return False

def get_email_status_details(status: str, member_name: str):
    st = (status or "ACTIVO").upper().strip()
    if st in ["ACTIVO", "AL DIA", "AL DÍA"]:
        subject = f"¡Tu membresía en BUNKER GYM está AL DÍA! 💪"
        color = "#10b981"
        badge = "AL DÍA"
    elif st == "POR VENCER":
        subject = f"⚠️ Recordatorio: Tu membresía en BUNKER GYM está por vencer"
        color = "#f59e0b"
        badge = "POR VENCER"
    elif st == "DEUDA":
        subject = f"🚨 Aviso Importante: Tu membresía en BUNKER GYM figura en deuda"
        color = "#ef4444"
        badge = "EN DEUDA"
    else:
        subject = f"Aviso de BUNKER GYM para {member_name}"
        color = "#f97316"
        badge = st
    return subject, color, badge

def build_bunker_payment_receipt_email_html(
    member_name: str,
    member_dni: str,
    receipt_data: dict
) -> str:
    amount = receipt_data.get("amount", 0)
    amount_fmt = f"{amount:,.0f}".replace(",", ".")
    plan_desc = receipt_data.get("plan", "Cuota de Gimnasio")
    method_desc = receipt_data.get("method", "Efectivo")
    date_desc = receipt_data.get("date", datetime.datetime.now().strftime("%d/%m/%Y %H:%M"))
    staff_desc = receipt_data.get("staff_name", "Administración")
    dni_desc = member_dni or "No especificado"

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Comprobante de Pago - BUNKER GYM</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #070a0f; margin: 0; padding: 25px 15px; color: #f8fafc; -webkit-font-smoothing: antialiased;">
  <!-- CONTENEDOR HORIZONTAL APAISADO (720px) -->
  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 720px; margin: 0 auto; background: #0f141f; border-radius: 24px; border: 1px solid rgba(249, 115, 22, 0.35); box-shadow: 0 20px 50px rgba(0,0,0,0.7), 0 0 35px rgba(249,115,22,0.15); overflow: hidden;">
    
    <!-- HEADER HORIZONTAL: LOGO Y DATOS A LA IZQUIERDA, ESTADO Y FECHA A LA DERECHA -->
    <tr>
      <td style="background: linear-gradient(90deg, #182233 0%, #101622 100%); padding: 24px 30px; border-bottom: 1px solid rgba(255,255,255,0.07);">
        <table width="100%" border="0" cellpadding="0" cellspacing="0">
          <tr>
            <td valign="middle" style="width: 70px;">
              <img src="cid:bunker_logo" alt="BUNKER GYM" style="height: 58px; max-height: 58px; width: auto; display: block; filter: drop-shadow(0 3px 8px rgba(249,115,22,0.4));" onerror="this.src='https://gymbunker.vercel.app/bunker.png'" />
            </td>
            <td valign="middle" style="padding-left: 18px;">
              <div style="font-size: 22px; font-weight: 900; letter-spacing: 3px; color: #ff7700; text-transform: uppercase; line-height: 1.1;">BUNKER GYM</div>
              <div style="font-size: 11px; font-weight: 800; letter-spacing: 1.5px; color: #94a3b8; text-transform: uppercase; margin-top: 4px;">COMPROBANTE OFICIAL DE PAGO</div>
            </td>
            <td valign="middle" align="right">
              <span style="display: inline-block; padding: 6px 16px; border-radius: 999px; font-size: 10px; font-weight: 900; letter-spacing: 1.5px; text-transform: uppercase; background: rgba(16, 185, 129, 0.12); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.45);">&#10004; PAGO ACREDITADO</span>
              <div style="font-size: 11px; color: #64748b; margin-top: 6px; font-weight: 600;">{date_desc}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- CUERPO HORIZONTAL: DOS COLUMNAS (TARJETA DE MONTO IZQ + DETALLES DER) -->
    <tr>
      <td style="padding: 28px 30px 20px 30px;">
        <table width="100%" border="0" cellpadding="0" cellspacing="0">
          <tr>
            <!-- COLUMNA IZQUIERDA: MONTO Y PLAN -->
            <td valign="top" style="width: 44%; padding-right: 15px;">
              <div style="background: linear-gradient(135deg, rgba(249,115,22,0.18) 0%, rgba(20,26,38,0.95) 100%); border: 1px solid rgba(249,115,22,0.38); border-radius: 18px; padding: 24px 18px; text-align: center; height: 100%; box-sizing: border-box;">
                <div style="font-size: 10px; font-weight: 900; letter-spacing: 2px; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px;">Monto Total Abonado</div>
                <div style="font-size: 42px; font-weight: 900; color: #ff7700; line-height: 1; letter-spacing: 0.5px; margin-bottom: 12px;">${amount_fmt}</div>
                <div style="display: inline-block; font-size: 13px; font-weight: 800; color: #f1f5f9; background: rgba(255,255,255,0.08); padding: 5px 14px; border-radius: 999px;">{plan_desc}</div>
                <div style="margin-top: 18px; font-size: 11px; color: #10b981; font-weight: 800;">ESTADO: ACREDITADO</div>
              </div>
            </td>

            <!-- COLUMNA DERECHA: TABLA HORIZONTAL DE DATOS -->
            <td valign="top" style="width: 56%; padding-left: 15px;">
              <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background: #141b27; border: 1px solid rgba(255,255,255,0.07); border-radius: 18px; overflow: hidden; font-size: 13px;">
                <tr>
                  <td style="padding: 11px 16px; color: #94a3b8; font-weight: 600; border-bottom: 1px solid rgba(255,255,255,0.05);">Titular / Socio:</td>
                  <td style="padding: 11px 16px; color: #ffffff; font-weight: 800; text-align: right; border-bottom: 1px solid rgba(255,255,255,0.05);">{member_name}</td>
                </tr>
                <tr>
                  <td style="padding: 11px 16px; color: #94a3b8; font-weight: 600; border-bottom: 1px solid rgba(255,255,255,0.05);">DNI:</td>
                  <td style="padding: 11px 16px; color: #ffffff; font-weight: 800; text-align: right; border-bottom: 1px solid rgba(255,255,255,0.05);">{dni_desc}</td>
                </tr>
                <tr>
                  <td style="padding: 11px 16px; color: #94a3b8; font-weight: 600; border-bottom: 1px solid rgba(255,255,255,0.05);">Medio de Pago:</td>
                  <td style="padding: 11px 16px; color: #ffffff; font-weight: 800; text-align: right; border-bottom: 1px solid rgba(255,255,255,0.05);">{method_desc}</td>
                </tr>
                <tr>
                  <td style="padding: 11px 16px; color: #94a3b8; font-weight: 600; border-bottom: 1px solid rgba(255,255,255,0.05);">Fecha y Hora:</td>
                  <td style="padding: 11px 16px; color: #ffffff; font-weight: 800; text-align: right; border-bottom: 1px solid rgba(255,255,255,0.05);">{date_desc}</td>
                </tr>
                <tr>
                  <td style="padding: 11px 16px; color: #94a3b8; font-weight: 600;">Atendido por:</td>
                  <td style="padding: 11px 16px; color: #ffffff; font-weight: 800; text-align: right;">{staff_desc}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- BANNER HORIZONTAL DE PDF ADJUNTO -->
        <div style="background: linear-gradient(90deg, rgba(16,185,129,0.12) 0%, rgba(15,23,42,0.65) 100%); border: 1px dashed rgba(16, 185, 129, 0.45); border-radius: 14px; padding: 14px 20px; margin-top: 22px; font-size: 13px; color: #a7f3d0; text-align: center;">
          &#128206; <strong>Comprobante Oficial Adjunto en PDF:</strong> Descarg&aacute; el archivo adjunto a este correo para conservar tu constancia oficial de pago con sello institucional.
        </div>
      </td>
    </tr>

    <!-- FOOTER HORIZONTAL -->
    <tr>
      <td style="background: #090d14; padding: 20px 30px; border-top: 1px solid rgba(255,255,255,0.06);">
        <table width="100%" border="0" cellpadding="0" cellspacing="0">
          <tr>
            <td valign="middle">
              <div style="font-size: 12px; font-weight: 800; color: #e2e8f0; letter-spacing: 1px;">BUNKER GYM C&Oacute;RDOBA</div>
              <div style="font-size: 11px; color: #64748b; margin-top: 3px;">Lun a Vie 07:00 a 23:00 hs &bull; S&aacute;b 09:00 a 14:00 hs</div>
            </td>
            <td valign="middle" align="right">
              <div style="font-size: 10px; color: #475569; letter-spacing: 1px;">&copy; 2026 BUNKER GYM &bull; TODOS LOS DERECHOS RESERVADOS</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

def build_bunker_notification_email_html(
    member_name: str,
    status: str,
    message: str,
    badge_text: str,
    color_badge: str
) -> str:
    clean_message = message.strip()

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aviso - BUNKER GYM</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #070a0f; margin: 0; padding: 25px 15px; color: #f8fafc; -webkit-font-smoothing: antialiased;">
  <!-- CONTENEDOR HORIZONTAL APAISADO (700px) -->
  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 700px; margin: 0 auto; background: #0f141f; border-radius: 24px; border: 1px solid rgba(249, 115, 22, 0.3); box-shadow: 0 20px 50px rgba(0,0,0,0.7), 0 0 35px rgba(249,115,22,0.15); overflow: hidden;">
    
    <!-- HEADER HORIZONTAL CON LOGO, TITULO Y BADGE EN LA MISMA LINEA -->
    <tr>
      <td style="background: linear-gradient(90deg, #182233 0%, #101622 100%); padding: 22px 28px; border-bottom: 1px solid rgba(255,255,255,0.07);">
        <table width="100%" border="0" cellpadding="0" cellspacing="0">
          <tr>
            <td valign="middle" style="width: 60px;">
              <img src="cid:bunker_logo" alt="BUNKER GYM" style="height: 52px; max-height: 52px; width: auto; display: block; filter: drop-shadow(0 3px 8px rgba(249,115,22,0.4));" onerror="this.src='https://gymbunker.vercel.app/bunker.png'" />
            </td>
            <td valign="middle" style="padding-left: 16px;">
              <div style="font-size: 20px; font-weight: 900; letter-spacing: 3px; color: #ff7700; text-transform: uppercase;">BUNKER GYM</div>
              <div style="font-size: 10px; font-weight: 800; letter-spacing: 1.5px; color: #94a3b8; text-transform: uppercase; margin-top: 3px;">CENTRO DE ENTRENAMIENTO &bull; C&Oacute;RDOBA</div>
            </td>
            <td valign="middle" align="right">
              <span style="display: inline-block; padding: 6px 18px; border-radius: 999px; font-size: 11px; font-weight: 900; letter-spacing: 1.5px; text-transform: uppercase; background: {color_badge}1a; color: {color_badge}; border: 1px solid {color_badge}66;">&bull; {badge_text}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- CONTENIDO HORIZONTAL: DOS COLUMNAS O CARD HORIZONTAL ANCHA -->
    <tr>
      <td style="padding: 26px 28px;">
        <table width="100%" border="0" cellpadding="0" cellspacing="0">
          <tr>
            <td valign="top" style="width: 32%; padding-right: 18px; border-right: 1px solid rgba(255,255,255,0.06);">
              <div style="font-size: 18px; font-weight: 900; color: #ffffff; margin-bottom: 8px;">&iexcl;Hola, {member_name}! &#128075;</div>
              <div style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin-bottom: 14px;">
                Te contactamos autom&aacute;ticamente desde la administraci&oacute;n de Bunker Gym.
              </div>
              <div style="background: rgba(249,115,22,0.1); border: 1px solid rgba(249,115,22,0.3); border-radius: 12px; padding: 10px 14px; font-size: 11px; color: #ff7700; font-weight: 800; text-align: center;">
                &#129302; BUNKER BOT
              </div>
            </td>

            <td valign="top" style="width: 68%; padding-left: 20px;">
              <div style="background: linear-gradient(135deg, #151c28 0%, #101622 100%); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 20px 22px; color: #f8fafc; font-size: 15px; line-height: 1.65; box-shadow: 0 8px 20px rgba(0,0,0,0.25);">
                {clean_message}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- FOOTER HORIZONTAL CON HORARIOS Y SEDE -->
    <tr>
      <td style="background: #090d14; padding: 18px 28px; border-top: 1px solid rgba(255,255,255,0.06);">
        <table width="100%" border="0" cellpadding="0" cellspacing="0">
          <tr>
            <td valign="middle">
              <div style="font-size: 12px; font-weight: 800; color: #e2e8f0; letter-spacing: 1px;">BUNKER GYM C&Oacute;RDOBA</div>
              <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Lun a Vie 07:00 a 23:00 hs &bull; S&aacute;b 09:00 a 14:00 hs</div>
            </td>
            <td valign="middle" align="right">
              <div style="font-size: 10px; color: #475569;">&copy; 2026 BUNKER GYM &bull; TODOS LOS DERECHOS RESERVADOS</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

def get_bunker_logo_bytes() -> bytes:
    logo_candidates = [
        os.path.join(os.path.dirname(__file__), "bunker.png"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "bunker.png"),
        os.path.join(os.getcwd(), "backend", "bunker.png"),
        os.path.join(os.getcwd(), "frontend", "public", "bunker.png"),
        os.path.join(os.getcwd(), "frontend", "api", "bunker.png"),
    ]
    for candidate in logo_candidates:
        if os.path.exists(candidate):
            try:
                with open(candidate, "rb") as lf:
                    data = lf.read()
                if data:
                    return data
            except Exception:
                pass
    return None

def dispatch_payment_receipt_email(
    target_email: str,
    member_name: str,
    member_dni: str,
    receipt_data: dict,
    pdf_base64: str = None
) -> bool:
    logger = logging.getLogger("email_sender")
    clean_email = (target_email or "").strip()
    if not clean_email or "@" not in clean_email or "." not in clean_email:
        logger.warning(f"[EMAIL] Dirección de correo inválida: '{clean_email}'")
        return False

    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "bunkergymcordoba@gmail.com")
    smtp_pass = os.getenv("SMTP_PASSWORD", "yozjutkccjecbybv").replace(" ", "")
    from_name = os.getenv("SMTP_FROM_NAME", "BUNKER GYM")
    from_email = os.getenv("SMTP_FROM_EMAIL", smtp_user)

    if not smtp_user or not smtp_pass:
        logger.warning("[EMAIL] Credenciales SMTP no configuradas.")
        return False

    amount = receipt_data.get("amount", 0)
    plan = receipt_data.get("plan", "Cuota de Gimnasio")
    subject = f"🧾 Comprobante de Pago Oficial - BUNKER GYM (${amount:,.0f})".replace(",", ".")

    html_content = build_bunker_payment_receipt_email_html(
        member_name=member_name,
        member_dni=member_dni,
        receipt_data=receipt_data
    )

    plain_content = (
        f"BUNKER GYM - COMPROBANTE OFICIAL DE PAGO\n\n"
        f"Hola {member_name},\n\n"
        f"Tu pago de ${amount:,.0f} correspondiente a {plan} ha sido registrado con éxito.\n"
        f"Adjunto encontrarás tu comprobante oficial en formato PDF.\n\n"
        f"BUNKER GYM CÓRDOBA"
    ).replace(",", ".")

    try:
        msg = MIMEMultipart("related")
        msg["Subject"] = subject
        msg["From"] = f"{from_name} <{from_email}>"
        msg["To"] = clean_email

        msg_alt = MIMEMultipart("alternative")
        msg_alt.attach(MIMEText(plain_content, "plain", "utf-8"))
        msg_alt.attach(MIMEText(html_content, "html", "utf-8"))
        msg.attach(msg_alt)

        # Logo inline
        logo_data = get_bunker_logo_bytes()
        if logo_data:
            try:
                img_part = MIMEImage(logo_data, name="bunker.png")
                img_part.add_header("Content-ID", "<bunker_logo>")
                img_part.add_header("Content-Disposition", "inline", filename="bunker.png")
                msg.attach(img_part)
            except Exception as e:
                logger.warning(f"[EMAIL LOGO ATTACH ERROR]: {e}")

        # Comprobante PDF adjunto
        if pdf_base64:
            try:
                raw_b64 = str(pdf_base64).strip()
                if "," in raw_b64:
                    raw_b64 = raw_b64.split(",", 1)[1]
                pdf_bytes = base64.b64decode(raw_b64)
                pdf_part = MIMEApplication(pdf_bytes, _subtype="pdf")
                clean_name = re.sub(r"[^\w\s-]", "", member_name).strip().replace(" ", "_")
                pdf_filename = f"Comprobante_Pago_{clean_name}.pdf"
                pdf_part.add_header("Content-Disposition", "attachment", filename=pdf_filename)
                msg.attach(pdf_part)
                logger.info(f"[EMAIL RECEIPT PDF ATTACHED] Filename: {pdf_filename} ({len(pdf_bytes)} bytes)")
            except Exception as e:
                logger.error(f"[EMAIL RECEIPT PDF ATTACH ERROR]: {e}")

        if smtp_port == 465:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=12) as server:
                server.login(smtp_user, smtp_pass)
                server.sendmail(from_email, [clean_email], msg.as_string())
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=12) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.sendmail(from_email, [clean_email], msg.as_string())

        logger.info(f"[EMAIL RECEIPT SENT] To: {clean_email} ({member_name}) | Subject: {subject}")
        return True
    except Exception as e:
        logger.error(f"[EMAIL RECEIPT ERROR] Fallo al enviar a {clean_email}: {e}")
        return False

def dispatch_email_message(
    target_email: str,
    member_name: str,
    status: str,
    message: str
) -> bool:
    logger = logging.getLogger("email_sender")
    clean_email = (target_email or "").strip()
    if not clean_email or "@" not in clean_email or "." not in clean_email:
        logger.warning(f"[EMAIL] Dirección de correo inválida: '{clean_email}'")
        return False

    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "bunkergymcordoba@gmail.com")
    smtp_pass = os.getenv("SMTP_PASSWORD", "yozjutkccjecbybv").replace(" ", "")
    from_name = os.getenv("SMTP_FROM_NAME", "BUNKER GYM")
    from_email = os.getenv("SMTP_FROM_EMAIL", smtp_user)

    if not smtp_user or not smtp_pass:
        logger.warning("[EMAIL] Credenciales SMTP no configuradas.")
        return False

    subject, color_badge, badge_text = get_email_status_details(status, member_name)

    html_content = build_bunker_notification_email_html(
        member_name=member_name,
        status=status,
        message=message,
        badge_text=badge_text,
        color_badge=color_badge
    )

    clean_plain_message = re.sub(r"<[^>]+>", "", message)
    plain_content = f"BUNKER GYM - CÓRDOBA\n\nHola {member_name},\n\nEstado: {badge_text}\n\n{clean_plain_message}\n\nBUNKER GYM CÓRDOBA"

    try:
        msg = MIMEMultipart("related")
        msg["Subject"] = subject
        msg["From"] = f"{from_name} <{from_email}>"
        msg["To"] = clean_email

        msg_alt = MIMEMultipart("alternative")
        msg_alt.attach(MIMEText(plain_content, "plain", "utf-8"))
        msg_alt.attach(MIMEText(html_content, "html", "utf-8"))
        msg.attach(msg_alt)

        # Logo inline
        logo_data = get_bunker_logo_bytes()
        if logo_data:
            try:
                img_part = MIMEImage(logo_data, name="bunker.png")
                img_part.add_header("Content-ID", "<bunker_logo>")
                img_part.add_header("Content-Disposition", "inline", filename="bunker.png")
                msg.attach(img_part)
            except Exception as e:
                logger.warning(f"[EMAIL LOGO ATTACH ERROR]: {e}")

        if smtp_port == 465:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=12) as server:
                server.login(smtp_user, smtp_pass)
                server.sendmail(from_email, [clean_email], msg.as_string())
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=12) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.sendmail(from_email, [clean_email], msg.as_string())

        logger.info(f"[EMAIL NOTIFICATION SENT] To: {clean_email} ({member_name}) | Subject: {subject}")
        return True
    except Exception as e:
        logger.error(f"[EMAIL ERROR] Fallo al enviar a {clean_email}: {e}")
        return False

def notify_member_status_change(member: models.Member, old_status: str, new_status: str, db: Session, force: bool = False) -> bool:
    st = (new_status or "ACTIVO").upper().strip()
    if st not in ["ACTIVO", "AL DIA", "AL DÍA", "POR VENCER", "DEUDA"]:
        return False

    wellness = dict(member.wellness_data or {})
    last_notified = wellness.get("last_wa_notified_status")
    last_notified_at_str = wellness.get("last_wa_notified_at")

    if not force and last_notified == st:
        return False

    # Anti-duplicados: Cooldown de 30 segundos para evitar envíos concurrentes o dobles
    if last_notified_at_str and last_notified == st:
        try:
            last_dt = datetime.datetime.fromisoformat(last_notified_at_str)
            if (datetime.datetime.utcnow() - last_dt).total_seconds() < 30:
                return False
        except Exception:
            pass

    if not force and st in ["ACTIVO", "AL DIA", "AL DÍA"] and old_status not in ["DEUDA", "POR VENCER"]:
        return False

    wellness["last_wa_notified_status"] = st
    wellness["last_wa_notified_at"] = datetime.datetime.utcnow().isoformat()
    member.wellness_data = wellness
    flag_modified(member, "wellness_data")

    message = get_whatsapp_status_message(st)
    target_phone = (member.phone or os.getenv("VITE_WHATSAPP_PHONE") or os.getenv("WHATSAPP_PHONE") or "").strip()
    target_email = (member.email or "").strip()
    member_name = member.name or "Socio"

    # 1. Enviar WhatsApp en segundo plano
    if target_phone:
        threading.Thread(
            target=dispatch_whatsapp_message,
            args=(target_phone, message),
            daemon=True
        ).start()

    # 2. Enviar Correo en segundo plano si tiene email
    if target_email:
        threading.Thread(
            target=dispatch_email_message,
            args=(target_email, member_name, st, message),
            daemon=True
        ).start()

    return bool(target_phone or target_email)

@router.get("/members/{member_id}/whatsapp")
def get_member_whatsapp_message(member_id: int, db: Session = Depends(get_db)):
    member = db.query(models.Member).get(member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Socio no encontrado")

    status = (member.status or "ACTIVO").upper().strip()
    message = get_whatsapp_status_message(status)

    env_phone = (os.getenv("VITE_WHATSAPP_PHONE") or os.getenv("WHATSAPP_PHONE") or "").strip()
    target_phone = (member.phone or env_phone).strip()
    if not target_phone:
        raise HTTPException(
            status_code=400,
            detail="Variable de entorno VITE_WHATSAPP_PHONE o WHATSAPP_PHONE no configurada y el socio no tiene teléfono registrado."
        )
    clean_digits = re.sub(r"\D", "", target_phone)
    if clean_digits.startswith("0"):
        clean_digits = clean_digits[1:]
    if not clean_digits.startswith("54") and len(clean_digits) == 10:
        clean_digits = "549" + clean_digits
    elif clean_digits.startswith("54") and not clean_digits.startswith("549") and len(clean_digits) == 12:
        clean_digits = "549" + clean_digits[2:]

    encoded_text = urllib.parse.quote(message)
    wa_url = f"https://api.whatsapp.com/send?phone={clean_digits}&text={encoded_text}"

    return {
        "member_id": member.id,
        "name": member.name,
        "status": member.status,
        "phone": target_phone,
        "clean_phone": clean_digits,
        "email": member.email,
        "message": message,
        "url": wa_url
    }

@router.post("/members/{member_id}/send_whatsapp")
def send_member_whatsapp(member_id: int, payload: dict = Body(default={}), db: Session = Depends(get_db)):
    member = db.query(models.Member).get(member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Socio no encontrado")

    status = (member.status or "ACTIVO").upper().strip()
    message = get_whatsapp_status_message(status)

    sender_phone = ""
    if payload and isinstance(payload, dict):
        sender_phone = (payload.get("sender_phone") or "").strip()
    if not sender_phone:
        sender_phone = (os.getenv("VITE_WHATSAPP_PHONE") or os.getenv("WHATSAPP_PHONE") or "").strip()

    target_phone = (member.phone or sender_phone).strip()
    target_email = (member.email or "").strip()
    member_name = member.name or "Socio"

    if not target_phone and not target_email:
        raise HTTPException(
            status_code=400,
            detail="El socio no tiene ni teléfono ni correo electrónico registrado."
        )

    clean_digits = ""
    ws_success = False
    if target_phone:
        clean_digits = re.sub(r"\D", "", target_phone)
        if clean_digits.startswith("0"):
            clean_digits = clean_digits[1:]
        if not clean_digits.startswith("54") and len(clean_digits) == 10:
            clean_digits = "549" + clean_digits
        elif clean_digits.startswith("54") and not clean_digits.startswith("549") and len(clean_digits) == 12:
            clean_digits = "549" + clean_digits[2:]
        ws_success = dispatch_whatsapp_message(target_phone, message, sender_phone)

    email_success = False
    if target_email:
        email_success = dispatch_email_message(target_email, member_name, status, message)

    if not ws_success and not email_success:
        if target_phone and not os.getenv("WHATSAPP_GATEWAY_URL") and not (os.getenv("WHATSAPP_PHONE_NUMBER_ID") and os.getenv("WHATSAPP_API_TOKEN")):
            raise HTTPException(
                status_code=503,
                detail="Pasarela de WhatsApp no conectada y no se pudo enviar correo. Verifique la configuración."
            )
        raise HTTPException(status_code=502, detail="Error al enviar notificación por WhatsApp o Correo.")

    # Guardar en wellness_data para registrar que fue notificado (SIN re-disparar notificación duplicate)
    wellness = dict(member.wellness_data or {})
    wellness["last_wa_notified_status"] = status
    wellness["last_wa_notified_at"] = datetime.datetime.utcnow().isoformat()
    member.wellness_data = wellness
    flag_modified(member, "wellness_data")
    db.commit()

    return {
        "status": "sent",
        "success": True,
        "member_id": member.id,
        "name": member.name,
        "member_status": member.status,
        "from": sender_phone,
        "clean_phone": clean_digits or None,
        "whatsapp_sent": bool(ws_success),
        "email": target_email or None,
        "email_sent": bool(email_success),
        "message": message,
        "dispatched_at": datetime.datetime.utcnow().isoformat()
    }

@router.post("/members/{member_id}/send_payment_receipt")
def send_payment_receipt(member_id: int, payload: dict = Body(default={}), db: Session = Depends(get_db)):
    member = db.query(models.Member).get(member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Socio no encontrado")

    amount = float(payload.get("amount", 0))
    method = (payload.get("method") or "Efectivo").strip()
    staff_name = (payload.get("staff_name") or "Administración").strip()
    plan = (payload.get("plan") or member.membership_type or "Cuota de Gimnasio").strip()
    date_str = (payload.get("date") or datetime.datetime.now().strftime("%d/%m/%Y %H:%M")).strip()
    pdf_base64 = payload.get("pdf_base64")

    target_phone = (member.phone or "").strip()
    target_email = (member.email or "").strip()
    member_name = member.name or "Socio"
    member_dni = member.dni or ""

    amount_fmt = f"{amount:,.0f}".replace(",", ".")
    clean_digits = re.sub(r"\D", "", target_phone)
    receipt_filename = f"Comprobante_BunkerGym_{clean_digits or member_dni or member_id}.pdf"

    # Mensaje de WhatsApp institucional adjuntando comprobante oficial
    ws_message = (
        f"Hola soy BUNKER BOT de BUNKER GYM, como estas ? "
        f"Te adjuntamos tu comprobante oficial de pago por ${amount_fmt} (Plan: {plan}). "
        f"¡Muchas gracias por entrenar con nosotros! 💪🏋️"
    )

    # 1. Despachar WhatsApp con el comprobante PDF adjunto
    ws_success = False
    if target_phone:
        try:
            ws_success = dispatch_whatsapp_message(
                target_phone=target_phone,
                message=ws_message,
                pdf_base64=pdf_base64,
                filename=receipt_filename
            )
        except Exception as e:
            logging.getLogger("whatsapp_sender").error(f"[RECEIPT WHATSAPP ERROR]: {e}")

    # 3. Despachar Correo con COMPROBANTE OFICIAL DE PAGO y PDF adjunto
    email_success = False
    if target_email:
        receipt_data = {
            "amount": amount,
            "method": method,
            "staff_name": staff_name,
            "plan": plan,
            "date": date_str,
            "has_pdf": bool(pdf_base64)
        }
        try:
            email_success = dispatch_payment_receipt_email(
                target_email=target_email,
                member_name=member_name,
                member_dni=member_dni,
                receipt_data=receipt_data,
                pdf_base64=pdf_base64
            )
        except Exception as e:
            logging.getLogger("email_sender").error(f"[RECEIPT EMAIL ERROR]: {e}")

    return {
        "status": "sent",
        "member_id": member.id,
        "name": member_name,
        "amount": amount,
        "whatsapp_sent": bool(ws_success),
        "email_sent": bool(email_success),
        "target_email": target_email or None,
        "target_phone": target_phone or None
    }

@router.post("/members/{member_id}/simulate_transition")
def simulate_member_transition(member_id: int, payload: dict = Body(default={}), db: Session = Depends(get_db)):
    member = db.query(models.Member).get(member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Socio no encontrado")

    target_status = (payload.get("to_status") or payload.get("status") or "ACTIVO").upper().strip()
    valid_statuses = ["ACTIVO", "POR VENCER", "DEUDA"]
    if target_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Estado inválido. Debe ser uno de: {valid_statuses}")

    old_status = member.status
    now = datetime.datetime.utcnow()

    membership_type = (member.membership_type or "").upper()
    total_days = 30
    if "TRIMESTRAL" in membership_type:
        total_days = 90
    elif "SEMESTRAL" in membership_type:
        total_days = 180
    elif "ANUAL" in membership_type:
        total_days = 365

    if target_status == "ACTIVO":
        member.joined_at = now
    elif target_status == "POR VENCER":
        member.joined_at = now - datetime.timedelta(days=max(0, total_days - 3))
    elif target_status == "DEUDA":
        member.joined_at = now - datetime.timedelta(days=total_days + 5)

    member.status = target_status
    # Force notification for test simulation
    sent = notify_member_status_change(member, old_status, target_status, db, force=True)
    db.commit()

    return {
        "success": True,
        "member_id": member.id,
        "name": member.name,
        "phone": member.phone,
        "email": member.email,
        "old_status": old_status,
        "new_status": target_status,
        "notification_dispatched": sent,
        "message": get_whatsapp_status_message(target_status)
    }

@router.get("/members/{member_id}/checkins")
def get_member_checkins(member_id: int, db: Session = Depends(get_db)):
    member = db.query(models.Member).filter(models.Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    today = datetime.datetime.utcnow()
    cycle_start = member.joined_at if member.joined_at else (today - datetime.timedelta(days=30))

    # Plan Principal Stats (Totem Checkins)
    plan_principal = db.query(models.Plan).filter(models.Plan.name == member.membership_type, models.Plan.is_active == True).first()
    main_days = plan_principal.days_per_week if plan_principal else 3
    main_total = main_days * 4

    sessions_used_totem = db.query(models.Checkin).filter(
        models.Checkin.member_id == member_id,
        models.Checkin.checkin_at >= cycle_start
    ).count()

    main_remaining = max(0, main_total - sessions_used_totem)

    # Planes Adicionales Stats (Attended Bookings / Totem Adicional)
    sessions_used_bookings = db.query(models.Booking).filter(
        models.Booking.member_id == member_id,
        models.Booking.status == "attended",
        models.Booking.start_time >= cycle_start
    ).count()

    plans_breakdown = [
        {
            "name": member.membership_type or "Plan Principal",
            "type": "Principal",
            "total": main_total,
            "used": sessions_used_totem,
            "remaining": main_remaining
        }
    ]

    add_plans = member.additional_plans or []
    for add_name in add_plans:
        p_obj = db.query(models.Plan).filter(models.Plan.name == add_name, models.Plan.is_active == True).first()
        add_days = p_obj.days_per_week if p_obj else 2
        add_total = add_days * 4
        add_remaining = max(0, add_total - sessions_used_bookings)
        plans_breakdown.append({
            "name": add_name,
            "type": "Adicional",
            "total": add_total,
            "used": sessions_used_bookings,
            "remaining": add_remaining
        })

    # Combined checkins & bookings list
    checkins = db.query(models.Checkin).filter(models.Checkin.member_id == member_id).all()
    checkin_list = [{"id": f"c_{c.id}", "checkin_at": (c.checkin_at or today).isoformat() + "Z", "type": ""} for c in checkins]

    bookings = db.query(models.Booking).filter(
        models.Booking.member_id == member_id,
        models.Booking.status.in_(["attended", "reserved"])
    ).all()
    booking_list = [{"id": f"b_{b.id}", "checkin_at": (b.attended_at or b.start_time or today).isoformat() + "Z", "type": f'Adicional "{b.class_name}"' if b.class_name else "Adicional"} for b in bookings]

    all_attendance = sorted(checkin_list + booking_list, key=lambda x: x["checkin_at"], reverse=True)

    return {
        "total_sessions": main_total,
        "sessions_used": sessions_used_totem,
        "sessions_remaining": main_remaining,
        "checkins": all_attendance,
        "plans_breakdown": plans_breakdown
    }

@router.put("/members/{member_id}/status")
def update_member_status(member_id: int, status: str, db: Session = Depends(get_db)):
    member = db.query(models.Member).get(member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    member.status = status
    db.commit()
    return {"status": "updated", "new_status": status}

@router.post("/payments")
def record_payment(
    member_id: int,
    amount: float = 0,
    method: str = "card",
    processed_by: str = "",
    billing_date: str = None,
    next_due_date: str = None,
    keep_billing_day: bool = False,
    fixed_billing_day: int = None,
    db: Session = Depends(get_db)
):
    member = db.query(models.Member).get(member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    now = datetime.datetime.utcnow()

    billing_dt = now
    if billing_date:
        try:
            billing_dt = datetime.datetime.fromisoformat(billing_date.replace("Z", ""))
        except Exception:
            billing_dt = now

    next_due_dt = None
    if next_due_date:
        try:
            next_due_dt = datetime.datetime.fromisoformat(next_due_date.replace("Z", ""))
        except Exception:
            pass

    membership_type = (member.membership_type or "").upper()
    validity_days = 30
    if "TRIMESTRAL" in membership_type:
        validity_days = 90
    elif "SEMESTRAL" in membership_type:
        validity_days = 180
    elif "ANUAL" in membership_type:
        validity_days = 365

    if not next_due_dt:
        if keep_billing_day and fixed_billing_day:
            import calendar
            y = billing_dt.year
            m = billing_dt.month + (validity_days // 30)
            while m > 12:
                m -= 12
                y += 1
            max_d = calendar.monthrange(y, m)[1]
            day_to_use = min(int(fixed_billing_day), max_d)
            next_due_dt = datetime.datetime(y, m, day_to_use, 23, 59, 59)
        else:
            next_due_dt = billing_dt + datetime.timedelta(days=validity_days)

    f_day = fixed_billing_day
    if keep_billing_day and not f_day:
        f_day = next_due_dt.day if next_due_dt else billing_dt.day

    # Calculate itemized breakdown and total amount if amount is not specified
    plan_principal = db.query(models.Plan).filter(models.Plan.name == member.membership_type, models.Plan.is_active == True).first()
    plan_details = []
    calculated_amount = 0
    if plan_principal:
        plan_details.append({"name": plan_principal.name, "price": plan_principal.price})
        calculated_amount += plan_principal.price

    add_plans = member.additional_plans or []
    for add_p_name in add_plans:
        p_obj = db.query(models.Plan).filter(models.Plan.name == add_p_name, models.Plan.is_active == True).first()
        if p_obj:
            plan_details.append({"name": p_obj.name, "price": p_obj.price})
            calculated_amount += p_obj.price

    final_amount = amount if amount > 0 else calculated_amount

    payment = models.Payment(
        member_id=member_id,
        amount=final_amount,
        status="paid",
        method=method,
        stripe_id=processed_by or None,
        plan_details=plan_details,
        billing_date=billing_dt,
        next_due_date=next_due_dt,
        created_at=billing_dt
    )
    db.add(payment)
    member.status = "ACTIVO"
    member.joined_at = billing_dt
    member.next_due_date = next_due_dt
    member.keep_billing_day = bool(keep_billing_day)
    member.fixed_billing_day = f_day

    # Mirror to wellness_data
    wdata = dict(member.wellness_data or {})
    wdata["keep_billing_day"] = bool(keep_billing_day)
    wdata["fixed_billing_day"] = f_day
    wdata["next_due_date"] = next_due_dt.isoformat() if next_due_dt else None
    member.wellness_data = wdata
    flag_modified(member, "wellness_data")

    db.commit()
    return {
        "status": "payment recorded",
        "amount": final_amount,
        "details": plan_details,
        "next_due_date": next_due_dt.isoformat() if next_due_dt else None,
        "keep_billing_day": member.keep_billing_day,
        "fixed_billing_day": member.fixed_billing_day
    }

@router.delete("/payments/{payment_id}")
def delete_payment(payment_id: int, db: Session = Depends(get_db)):
    payment = db.query(models.Payment).filter(models.Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    db.delete(payment)
    db.commit()
    return {"status": "deleted"}

@router.get("/pricing/dynamic")
def calculate_dynamic_price(db: Session = Depends(get_db)):
    active_count = db.query(models.Member).filter(models.Member.status == "ACTIVO").count()
    base_price = 49.99
    demand_factor = 1.0 + (max(0, active_count - 20) * 0.015)
    return {"calculated_price": round(base_price * demand_factor, 2), "demand_factor": round(demand_factor, 2)}

@router.delete("/members/{member_id}")
def delete_member(member_id: int, permanent: bool = False, db: Session = Depends(get_db)):
    member = db.query(models.Member).get(member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    if permanent:
        db.delete(member)
        db.commit()
        return {"status": "deleted"}
    else:
        member.status = "INACTIVO"
        db.commit()
        return {"status": "inactivo"}

@router.get("/finance/summary")
def get_finance_summary(db: Session = Depends(get_db)):
    # Group payments by month for chart
    payments = db.query(models.Payment).all()
    
    monthly_revenue = {}
    for p in payments:
        month_key = p.created_at.strftime("%b %Y")
        monthly_revenue[month_key] = monthly_revenue.get(month_key, 0) + p.amount
        
    chart_data = [{"month": k, "revenue": round(v, 2)} for k, v in monthly_revenue.items()]
    # Sort chronologically by converting back to date, but here we just reverse since they were seeded backwards
    chart_data.reverse()
    
    recent_transactions = [
        {"id": p.id, "member_id": p.member_id, "amount": p.amount, "date": p.created_at.strftime("%Y-%m-%d")} 
        for p in sorted(payments, key=lambda x: x.created_at, reverse=True)[:10]
    ]
    
    return {
        "chart_data": chart_data,
        "recent_payments": recent_transactions,
        "total_revenue": sum(p.amount for p in payments)
    }

@router.get("/staff", response_model=List[schemas.StaffSchema])
def get_all_staff(db: Session = Depends(get_db)):
    staff = db.query(models.Staff).all()
    result = []
    for s in staff:
        s_dict = schemas.StaffSchema.from_orm(s).dict()
        s_dict["password"] = ""
        result.append(s_dict)
    return result

@router.post("/staff", response_model=schemas.StaffSchema)
def create_staff(staff: schemas.StaffCreate, db: Session = Depends(get_db)):
    data = staff.dict()
    if data.get("password"):
        if not data["password"].startswith("pbkdf2:"):
            data["password"] = hash_password(data["password"])
    else:
        data["password"] = hash_password("1234")
    db_staff = models.Staff(**data)
    db.add(db_staff)
    db.commit()
    db.refresh(db_staff)
    s_dict = schemas.StaffSchema.from_orm(db_staff).dict()
    s_dict["password"] = ""
    return s_dict

@router.put("/staff/{staff_id}", response_model=schemas.StaffSchema)
def update_staff(staff_id: int, staff_data: schemas.StaffCreate, db: Session = Depends(get_db)):
    db_staff = db.query(models.Staff).filter(models.Staff.id == staff_id).first()
    if not db_staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    for key, value in staff_data.dict().items():
        if key == "password":
            if value and not value.startswith("pbkdf2:"):
                setattr(db_staff, key, hash_password(value))
        else:
            setattr(db_staff, key, value)
    
    db.commit()
    db.refresh(db_staff)
    s_dict = schemas.StaffSchema.from_orm(db_staff).dict()
    s_dict["password"] = ""
    return s_dict

@router.delete("/staff/{staff_id}")
def delete_staff(staff_id: int, db: Session = Depends(get_db)):
    staff = db.query(models.Staff).get(staff_id)
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    db.delete(staff)
    db.commit()
    return {"status": "deleted"}

@router.get("/plans", response_model=List[schemas.PlanSchema])
def get_plans(db: Session = Depends(get_db)):
    return db.query(models.Plan).filter(models.Plan.is_active == True).all()

@router.post("/plans", response_model=schemas.PlanSchema)
def create_plan(plan: schemas.PlanCreate, db: Session = Depends(get_db)):
    db_plan = models.Plan(**plan.dict())
    db.add(db_plan)
    db.commit()
    db.refresh(db_plan)
    return db_plan

@router.put("/plans/{plan_id}", response_model=schemas.PlanSchema)
def update_plan(plan_id: int, plan: schemas.PlanCreate, db: Session = Depends(get_db)):
    db_plan = db.query(models.Plan).filter(models.Plan.id == plan_id).first()
    if not db_plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    for key, value in plan.dict().items():
        setattr(db_plan, key, value)
    db.commit()
    db.refresh(db_plan)
    return db_plan

@router.delete("/plans/{plan_id}")
def delete_plan(plan_id: int, db: Session = Depends(get_db)):
    db_plan = db.query(models.Plan).filter(models.Plan.id == plan_id).first()
    if not db_plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    db_plan.is_active = False
    db.commit()
    return {"status": "deleted"}

@router.get("/analytics/ai")
def get_ai_analytics(db: Session = Depends(get_db)):
    # Mock data for AI Analytics Charts
    attendance_heatmap = [
        {"day": "Mon", "morning": 40, "afternoon": 25, "evening": 85},
        {"day": "Tue", "morning": 45, "afternoon": 20, "evening": 90},
        {"day": "Wed", "morning": 35, "afternoon": 30, "evening": 80},
        {"day": "Thu", "morning": 50, "afternoon": 25, "evening": 95},
        {"day": "Fri", "morning": 30, "afternoon": 40, "evening": 60},
        {"day": "Sat", "morning": 70, "afternoon": 50, "evening": 20},
        {"day": "Sun", "morning": 80, "afternoon": 30, "evening": 10},
    ]
    
    churn_factors = [
        {"factor": "Low Attendance", "impact": 45},
        {"factor": "Price Sensitivity", "impact": 25},
        {"factor": "No Trainer Engagement", "impact": 20},
        {"factor": "Facility Location", "impact": 10},
    ]
    
    return {
        "attendance_heatmap": attendance_heatmap,
        "churn_factors": churn_factors
    }

# --- CLASS SCHEDULES & HOLIDAYS CRUD & ATTENDANCE ---

@router.get("/class_schedules", response_model=List[schemas.ClassScheduleSchema])
def get_class_schedules(db: Session = Depends(get_db)):
    return db.query(models.ClassSchedule).all()

@router.post("/class_schedules", response_model=schemas.ClassScheduleSchema)
def create_class_schedule(schedule: schemas.ClassScheduleCreate, db: Session = Depends(get_db)):
    db_schedule = models.ClassSchedule(**schedule.dict())
    db.add(db_schedule)
    db.commit()
    db.refresh(db_schedule)
    return db_schedule

@router.put("/class_schedules/{schedule_id}", response_model=schemas.ClassScheduleSchema)
def update_class_schedule(schedule_id: int, schedule_data: schemas.ClassScheduleCreate, db: Session = Depends(get_db)):
    db_schedule = db.query(models.ClassSchedule).filter(models.ClassSchedule.id == schedule_id).first()
    if not db_schedule:
        raise HTTPException(status_code=404, detail="Horario de clase no encontrado")
    for key, value in schedule_data.dict().items():
        setattr(db_schedule, key, value)
    db.commit()
    db.refresh(db_schedule)
    return db_schedule

@router.delete("/class_schedules/{schedule_id}")
def delete_class_schedule(schedule_id: int, db: Session = Depends(get_db)):
    db_schedule = db.query(models.ClassSchedule).filter(models.ClassSchedule.id == schedule_id).first()
    if not db_schedule:
        raise HTTPException(status_code=404, detail="Horario de clase no encontrado")
    db.query(models.Booking).filter(models.Booking.class_schedule_id == schedule_id).delete()
    db.delete(db_schedule)
    db.commit()
    return {"status": "deleted"}

@router.get("/holidays", response_model=List[schemas.HolidaySchema])
def get_holidays(db: Session = Depends(get_db)):
    return db.query(models.Holiday).order_by(models.Holiday.date).all()

@router.post("/holidays", response_model=schemas.HolidaySchema)
def create_holiday(holiday: schemas.HolidayCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Holiday).filter(models.Holiday.date == holiday.date).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un feriado en esta fecha")
    db_holiday = models.Holiday(**holiday.dict())
    db.add(db_holiday)
    db.commit()
    db.refresh(db_holiday)
    return db_holiday

@router.delete("/holidays/{holiday_id}")
def delete_holiday(holiday_id: int, db: Session = Depends(get_db)):
    db_holiday = db.query(models.Holiday).filter(models.Holiday.id == holiday_id).first()
    if not db_holiday:
        raise HTTPException(status_code=404, detail="Feriado no encontrado")
    db.delete(db_holiday)
    db.commit()
    return {"status": "deleted"}

@router.get("/class_schedules/{schedule_id}/bookings")
def get_class_bookings(schedule_id: int, date: str, db: Session = Depends(get_db)):
    try:
        query_date = datetime.datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido. Usar YYYY-MM-DD")
    
    start_of_day = datetime.datetime.combine(query_date, datetime.time.min)
    end_of_day = datetime.datetime.combine(query_date, datetime.time.max)
    bookings = db.query(models.Booking).filter(
        models.Booking.class_schedule_id == schedule_id,
        models.Booking.start_time >= start_of_day,
        models.Booking.start_time <= end_of_day,
        models.Booking.status != "cancelled"
    ).all()
    
    result = []
    for b in bookings:
        result.append({
            "id": b.id,
            "status": b.status,
            "exercises_done": b.exercises_done,
            "member": {
                "id": b.member.id,
                "dni": b.member.dni,
                "name": b.member.name,
                "status": b.member.status
            }
        })
    return result

@router.put("/bookings/{booking_id}/status")
def update_booking_status(booking_id: int, payload: dict, db: Session = Depends(get_db)):
    booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    
    new_status = payload.get("status")
    if new_status not in ["reserved", "attended", "cancelled"]:
        raise HTTPException(status_code=400, detail="Estado inválido")
    
    booking.status = new_status
    if new_status == "attended":
        booking.attended_at = datetime.datetime.utcnow()
    else:
        booking.attended_at = None
        
    db.commit()
    return {"status": "updated", "booking_id": booking_id, "new_status": new_status}

@router.delete("/bookings/{booking_id}")
def delete_booking(booking_id: int, db: Session = Depends(get_db)):
    booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    
    booking.status = "cancelled"
    db.commit()
    return {"status": "success", "message": "Reserva eliminada"}

@router.post("/bookings/walk-in")
def create_walk_in_booking(payload: dict, db: Session = Depends(get_db)):
    member_dni = payload.get("dni")
    schedule_id = payload.get("class_schedule_id")
    date_str = payload.get("date")
    
    member = db.query(models.Member).filter(models.Member.dni == member_dni).first()
    if not member:
        raise HTTPException(status_code=404, detail="Socio no encontrado")
        
    schedule = db.query(models.ClassSchedule).filter(models.ClassSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Clase no encontrada")
        
    try:
        class_date = datetime.datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido")
        
    holiday = db.query(models.Holiday).filter(models.Holiday.date == date_str).first()
    if holiday:
        raise HTTPException(status_code=400, detail=f"No se puede registrar asistencia en un día no laborable: {holiday.description}")
        
    start_of_day = datetime.datetime.combine(class_date, datetime.time.min)
    end_of_day = datetime.datetime.combine(class_date, datetime.time.max)
    bookings_count = db.query(models.Booking).filter(
        models.Booking.class_schedule_id == schedule_id,
        models.Booking.start_time >= start_of_day,
        models.Booking.start_time <= end_of_day,
        models.Booking.status != "cancelled"
    ).count()
    
    if bookings_count >= schedule.capacity:
        raise HTTPException(status_code=400, detail="La clase está completa para este día")
        
    existing = db.query(models.Booking).filter(
        models.Booking.member_id == member.id,
        models.Booking.class_schedule_id == schedule_id,
        func.date(models.Booking.start_time) == class_date
    ).first()
    
    if existing:
        existing.status = "attended"
        db.commit()
        return {"status": "success", "booking_id": existing.id, "message": "Reserva existente marcada como asistida"}
        
    time_parts = schedule.start_time.split(":")
    start_dt = datetime.datetime.combine(class_date, datetime.time(int(time_parts[0]), int(time_parts[1])))
    
    new_booking = models.Booking(
        member_id=member.id,
        class_schedule_id=schedule.id,
        class_name=schedule.name,
        start_time=start_dt,
        attended_at=datetime.datetime.utcnow(),
        status="attended"
    )
    db.add(new_booking)
    db.commit()
    db.refresh(new_booking)
    return {"status": "success", "booking_id": new_booking.id}

@router.get("/exercises", response_model=List[schemas.ExerciseSchema])
def get_exercises(db: Session = Depends(get_db)):
    return db.query(models.Exercise).all()

@router.post("/exercises", response_model=schemas.ExerciseSchema)
def create_exercise(ex: schemas.ExerciseSchema, db: Session = Depends(get_db)):
    db_ex = models.Exercise(**ex.model_dump(exclude_unset=True))
    db.add(db_ex)
    db.commit()
    db.refresh(db_ex)
    return db_ex

@router.delete("/exercises/{ex_id}")
def delete_exercise(ex_id: int, db: Session = Depends(get_db)):
    ex = db.query(models.Exercise).filter(models.Exercise.id == ex_id).first()
    if not ex:
        raise HTTPException(status_code=404, detail="Exercise not found")
    db.delete(ex)
    db.commit()
    return {"status": "success"}

# -------------------- TRAINING PLANS (PAQUETES DE ENTRENAMIENTO) --------------------

@router.get("/training_plans")
def get_training_plans(db: Session = Depends(get_db)):
    plans = db.query(models.TrainingPlan).order_by(models.TrainingPlan.created_at.desc()).all()
    return [{
        "id": p.id,
        "name": p.name,
        "description": p.description or "",
        "category": p.category or "General",
        "days": p.days or [],
        "documents": p.documents or [],
        "created_at": p.created_at.isoformat() if p.created_at else None
    } for p in plans]

@router.post("/training_plans")
def create_training_plan(payload: dict = Body(...), db: Session = Depends(get_db)):
    name = (payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="El nombre del plan es obligatorio")
    
    plan = models.TrainingPlan(
        name=name,
        description=payload.get("description", ""),
        category=payload.get("category", "General"),
        days=payload.get("days", []),
        documents=payload.get("documents", [])
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return {
        "id": plan.id,
        "name": plan.name,
        "description": plan.description,
        "category": plan.category,
        "days": plan.days,
        "documents": plan.documents,
        "created_at": plan.created_at.isoformat() if plan.created_at else None
    }

@router.put("/training_plans/{plan_id}")
def update_training_plan(plan_id: int, payload: dict = Body(...), db: Session = Depends(get_db)):
    from sqlalchemy.orm.attributes import flag_modified
    plan = db.query(models.TrainingPlan).filter(models.TrainingPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan de entrenamiento no encontrado")
    
    if "name" in payload:
        plan.name = payload["name"]
    if "description" in payload:
        plan.description = payload["description"]
    if "category" in payload:
        plan.category = payload["category"]
    if "days" in payload:
        plan.days = payload["days"]
        flag_modified(plan, "days")
    if "documents" in payload:
        plan.documents = payload["documents"]
        flag_modified(plan, "documents")

    # Auto-sync members that have this plan assigned
    members_with_plan = db.query(models.Member).filter(models.Member.training_plan_id == plan_id).all()
    for m in members_with_plan:
        if "days" in payload:
            m.routine = payload["days"]
            flag_modified(m, "routine")
        if "documents" in payload:
            m.routine_documents = payload["documents"]
            flag_modified(m, "routine_documents")
        
    db.commit()
    db.refresh(plan)
    return {
        "id": plan.id,
        "name": plan.name,
        "description": plan.description,
        "category": plan.category,
        "days": plan.days,
        "documents": plan.documents
    }

@router.post("/training_plans/{plan_id}/assign")
def assign_training_plan(plan_id: int, payload: dict = Body(...), db: Session = Depends(get_db)):
    from sqlalchemy.orm.attributes import flag_modified
    plan = db.query(models.TrainingPlan).filter(models.TrainingPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan de entrenamiento no encontrado")

    member_ids = payload.get("member_ids", [])
    if not member_ids:
        raise HTTPException(status_code=400, detail="Debes seleccionar al menos un socio")

    updated_count = 0
    members = db.query(models.Member).filter(models.Member.id.in_(member_ids)).all()
    for m in members:
        m.training_plan_id = plan.id
        m.routine = plan.days or []
        m.routine_documents = plan.documents or []
        flag_modified(m, "routine")
        flag_modified(m, "routine_documents")
        updated_count += 1

    db.commit()
    return {"status": "success", "updated_members": updated_count}

@router.delete("/training_plans/{plan_id}")
def delete_training_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = db.query(models.TrainingPlan).filter(models.TrainingPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan de entrenamiento no encontrado")
    db.delete(plan)
    db.commit()
    return {"status": "success"}

@router.post("/upload_document")
def upload_document(payload: dict = Body(...)):
    import os
    import re
    import json
    import base64
    import urllib.request
    import logging

    logger = logging.getLogger("document_uploader")

    filename = payload.get("filename", "documento.pdf")
    base64_data = payload.get("content_base64", "")
    content_type = payload.get("content_type", "application/pdf")

    blob_token = os.getenv("BLOB_READ_WRITE_TOKEN") or os.getenv("VERCEL_BLOB_READ_WRITE_TOKEN")
    
    if blob_token and base64_data:
        try:
            raw_base64 = base64_data.split(",")[-1] if "," in base64_data else base64_data
            raw_bytes = base64.b64decode(raw_base64)
            clean_name = re.sub(r'[^a-zA-Z0-9_.-]', '_', filename)
            url = f"https://blob.vercel-storage.com/plans/{clean_name}"
            
            req = urllib.request.Request(
                url,
                data=raw_bytes,
                headers={
                    "Authorization": f"Bearer {blob_token}",
                    "x-api-version": "7",
                    "x-add-random-suffix": "true",
                    "Content-Type": content_type
                },
                method="PUT"
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                resp_json = json.loads(resp.read().decode("utf-8"))
                return {
                    "url": resp_json.get("url"),
                    "name": filename,
                    "storage": "vercel_blob",
                    "size": len(raw_bytes)
                }
        except Exception as e:
            logger.error(f"Error uploading to Vercel Blob: {e}")
            
    # Fallback to data URI
    data_uri = base64_data if base64_data.startswith("data:") else f"data:{content_type};base64,{base64_data}"
    return {
        "url": data_uri,
        "name": filename,
        "storage": "inline_data"
    }

@router.post("/class_schedules/mass")
def create_mass_class_schedules(payload: schemas.MassClassScheduleSchema, db: Session = Depends(get_db)):
    created_schedules = []
    
    for config in payload.configs:
        try:
            start_h, start_m = map(int, config.start_time.split(':'))
            end_h, end_m = map(int, config.end_time.split(':'))
        except ValueError:
            continue
            
        current_minutes = start_h * 60 + start_m
        end_minutes = end_h * 60 + end_m
        
        while current_minutes < end_minutes:
            start_time_str = f"{current_minutes // 60:02d}:{current_minutes % 60:02d}"
            next_minutes = current_minutes + config.interval_minutes
            if next_minutes > end_minutes:
                next_minutes = end_minutes
            end_time_str = f"{next_minutes // 60:02d}:{next_minutes % 60:02d}"
            
            existing = db.query(models.ClassSchedule).filter(
                models.ClassSchedule.day_of_week == config.day,
                models.ClassSchedule.start_time == start_time_str
            ).first()
            
            if not existing:
                new_schedule = models.ClassSchedule(
                    name=payload.name,
                    code=payload.code,
                    day_of_week=config.day,
                    start_time=start_time_str,
                    end_time=end_time_str,
                    color=payload.color,
                    capacity=payload.capacity
                )
                db.add(new_schedule)
                created_schedules.append(new_schedule)
                
            current_minutes += config.interval_minutes
            
    db.commit()
    return {"message": f"Created {len(created_schedules)} classes."}


@router.get("/activities")
def get_activities(db: Session = Depends(get_db)):
    activities = db.query(models.Activity).all()
    return activities

@router.post("/activities")
def create_activity(activity: schemas.ActivitySchema, db: Session = Depends(get_db)):
    new_act = models.Activity(name=activity.name, code=activity.code, color=activity.color)
    db.add(new_act)
    db.commit()
    db.refresh(new_act)
    return new_act

@router.put("/activities/{activity_id}")
def update_activity(activity_id: int, activity_data: schemas.ActivitySchema, db: Session = Depends(get_db)):
    act = db.query(models.Activity).filter(models.Activity.id == activity_id).first()
    if not act:
        raise HTTPException(status_code=404, detail="Actividad no encontrada")
    
    old_name = act.name
    old_code = act.code
    
    act.name = activity_data.name
    act.code = activity_data.code
    act.color = activity_data.color
    
    # Update ClassSchedules
    from sqlalchemy import or_
    schedules = db.query(models.ClassSchedule).filter(
        or_(models.ClassSchedule.name == old_name, models.ClassSchedule.code == old_code)
    ).all()
    for s in schedules:
        s.name = activity_data.name
        s.code = activity_data.code
        s.color = activity_data.color
        
    # Update Bookings
    bookings = db.query(models.Booking).filter(
        models.Booking.class_name == old_name
    ).all()
    for b in bookings:
        b.class_name = activity_data.name
        
    db.commit()
    db.refresh(act)
    return act

@router.delete("/activities/{activity_id}")
def delete_activity(activity_id: int, db: Session = Depends(get_db)):
    act = db.query(models.Activity).filter(models.Activity.id == activity_id).first()
    if act:
        db.delete(act)
        db.commit()
    return {"ok": True}


@router.get("/configs/{key}")
def get_config(key: str, db: Session = Depends(get_db)):
    config = db.query(models.SystemConfig).filter(models.SystemConfig.key == key).first()
    if config:
        return {"status": "success", "value": config.value}
    return {"status": "success", "value": {}}

@router.post("/configs/{key}")
def set_config(key: str, payload: dict, db: Session = Depends(get_db)):
    config = db.query(models.SystemConfig).filter(models.SystemConfig.key == key).first()
    if config:
        config.value = payload.get("value", {})
    else:
        config = models.SystemConfig(key=key, value=payload.get("value", {}))
        db.add(config)
    db.commit()
    return {"status": "success"}
