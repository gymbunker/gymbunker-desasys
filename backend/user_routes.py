from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from database import get_db
import models
import schemas
import datetime
try:
    from .security import hash_password, verify_password
except ImportError:
    from security import hash_password, verify_password

router = APIRouter(prefix="/user", tags=["User"])

def calculate_member_streak_and_message(member_id: int, db: Session) -> tuple[int, str]:
    checkins = db.query(models.Checkin).filter(models.Checkin.member_id == member_id).all()
    checkin_dates = {c.checkin_at.date() for c in checkins}
    
    bookings = db.query(models.Booking).filter(
        models.Booking.member_id == member_id,
        models.Booking.status == "attended"
    ).all()
    booking_dates = {b.start_time.date() for b in bookings}
    
    all_dates = sorted(list(checkin_dates.union(booking_dates)), reverse=True)
    if not all_dates:
        return 0, "¡Vamos por un nuevo comienzo con todo! ⚡"
        
    today = datetime.date.today()
    last_attendance = all_dates[0]
    days_since_last = (today - last_attendance).days
    
    if days_since_last >= 3:
        streak = 0
        message = "¡Vamos por un nuevo comienzo con todo! ⚡"
    else:
        streak = 1
        current_date = last_attendance
        for next_date in all_dates[1:]:
            if (current_date - next_date).days == 1:
                streak += 1
                current_date = next_date
            elif (current_date - next_date).days == 0:
                continue
            else:
                break
        
        if days_since_last == 0:
            message = "¡Vas muy bien en racha, sigue así! 🔥"
        elif days_since_last == 1:
            message = "Tranqui, un descanso lo toma cualquiera. ¡Volvé pronto! 💪"
        elif days_since_last == 2:
            message = "¡Cuidado! Estamos por perder la racha. ¡Te extrañamos! ⚠️"
        else:
            message = "¡Vamos por un nuevo comienzo con todo! ⚡"
            
    return streak, message

@router.post("/login")
def login(credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    member = db.query(models.Member).filter(models.Member.dni == credentials.dni).first()
    if not member:
        raise HTTPException(status_code=404, detail="Socio no encontrado")
    
    if not verify_password(credentials.password, member.password):
        raise HTTPException(status_code=401, detail="Contraseña incorrecta")

    # If unhashed legacy password, upgrade to PBKDF2 hash on successful login
    if member.password and not member.password.startswith("pbkdf2:"):
        member.password = hash_password(credentials.password)
        db.commit()
    
    if member.joined_at and member.status != 'INACTIVO':
        membership_type = (member.membership_type or "").upper()
        validity_days = 30
        if "TRIMESTRAL" in membership_type:
            validity_days = 90
        elif "SEMESTRAL" in membership_type:
            validity_days = 180
        elif "ANUAL" in membership_type:
            validity_days = 365

        days_since = (datetime.datetime.utcnow() - member.joined_at).days
        if days_since >= validity_days:
            member.status = 'DEUDA'
        elif days_since >= validity_days - 7:
            member.status = 'POR VENCER'
        else:
            member.status = 'ACTIVO'
        db.commit()
        
    streak_count, streak_msg = calculate_member_streak_and_message(member.id, db)
    return {
        "status": "success",
        "member": {
            "id": member.id,
            "name": member.name,
            "dni": member.dni,
            "phone": member.phone,
            "email": member.email,
            "membership_type": member.membership_type,
            "status": member.status,
            "routine": member.routine,
            "streak": streak_count,
            "streak_message": streak_msg
        }
    }

@router.put("/{dni}/password")
def change_password(dni: str, data: schemas.PasswordChange, db: Session = Depends(get_db)):
    member = db.query(models.Member).filter(models.Member.dni == dni).first()
    if not member:
        raise HTTPException(status_code=404, detail="Socio no encontrado")
    
    member.password = hash_password(data.new_password)
    db.commit()
    return {"status": "success", "message": "Contraseña actualizada correctamente"}

@router.get("/{dni}/full_info")
def get_user_full_info(dni: str, db: Session = Depends(get_db)):
    member = db.query(models.Member).filter(models.Member.dni == dni).first()
    if not member:
        raise HTTPException(status_code=404, detail="Socio no encontrado")

    today = datetime.datetime.utcnow()
    cycle_start = member.joined_at if member.joined_at else (today - datetime.timedelta(days=30))

    # Plan Principal Stats (Totem Checkins)
    plan_principal = db.query(models.Plan).filter(models.Plan.name == member.membership_type, models.Plan.is_active == True).first()
    main_days = plan_principal.days_per_week if plan_principal else 3
    main_total = main_days * 4

    sessions_used_totem = db.query(models.Checkin).filter(
        models.Checkin.member_id == member.id,
        models.Checkin.checkin_at >= cycle_start
    ).count()
    main_remaining = max(0, main_total - sessions_used_totem)

    # Planes Adicionales Stats (Attended Bookings / Totem Adicional)
    sessions_used_bookings = db.query(models.Booking).filter(
        models.Booking.member_id == member.id,
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

    # Checkins & Bookings
    checkins = db.query(models.Checkin).filter(models.Checkin.member_id == member.id).all()
    checkin_list = [{
        "id": f"c_{c.id}",
        "checkin_at": (c.checkin_at or today).isoformat() + "Z",
        "type": "Tótem Principal"
    } for c in checkins]

    bookings = db.query(models.Booking).filter(
        models.Booking.member_id == member.id,
        models.Booking.status.in_(["attended", "reserved"])
    ).all()
    booking_list = [{
        "id": f"b_{b.id}",
        "checkin_at": (b.start_time or today).isoformat() + "Z",
        "type": b.class_name or "Clase Adicional"
    } for b in bookings]

    all_attendance = sorted(checkin_list + booking_list, key=lambda x: x["checkin_at"], reverse=True)

    payments_raw = member.payments or []
    billing_history = []
    for p in payments_raw:
        dt = p.created_at or today
        # Extract contracted plans list from payment details or fallback to member plans
        p_details = p.plan_details if p.plan_details else [{"name": member.membership_type or "Plan Principal", "price": p.amount or 0}]
        billing_history.append({
            "id": p.id,
            "date": dt.strftime("%Y-%m-%d"),
            "amount": p.amount or 0,
            "plan": member.membership_type or "Musculación",
            "additional_plans": add_plans,
            "plan_details": p_details,
            "method": p.method or "Efectivo",
            "processed_by": p.stripe_id or "—",
            "status": "PAGADO"
        })
    billing_history.sort(key=lambda x: x["date"], reverse=True)

    streak_count, streak_msg = calculate_member_streak_and_message(member.id, db)

    return {
        "status": "success",
        "member": {
            "id": member.id,
            "name": member.name,
            "dni": member.dni,
            "phone": member.phone,
            "email": member.email,
            "membership_type": member.membership_type,
            "additional_plans": add_plans,
            "status": member.status,
            "routine": member.routine,
            "streak": streak_count,
            "streak_message": streak_msg
        },
        "checkin_stats": {
            "total": main_total,
            "used": sessions_used_totem,
            "remaining": main_remaining
        },
        "plans_breakdown": plans_breakdown,
        "attendance_history": all_attendance,
        "billing_history": billing_history
    }

@router.get("/class_schedules")
def get_user_class_schedules(date: str, db: Session = Depends(get_db)):
    try:
        query_date = datetime.datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido")
        
    weekday = query_date.weekday()
    schedules = db.query(models.ClassSchedule).filter(
        or_(
            models.ClassSchedule.day_of_week == weekday,
            models.ClassSchedule.specific_date == date
        )
    ).all()
    
    result = []
    for s in schedules:
        start_of_day = datetime.datetime.combine(query_date, datetime.time.min)
        end_of_day = datetime.datetime.combine(query_date, datetime.time.max)
        bookings_count = db.query(models.Booking).filter(
            models.Booking.class_schedule_id == s.id,
            models.Booking.start_time >= start_of_day,
            models.Booking.start_time <= end_of_day,
            models.Booking.status != "cancelled"
        ).count()
        
        result.append({
            "id": s.id,
            "name": s.name,
            "code": s.code,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "color": s.color,
            "capacity": s.capacity,
            "bookings_count": bookings_count
        })
    return result

@router.get("/holidays")
def get_user_holidays(db: Session = Depends(get_db)):
    return db.query(models.Holiday).order_by(models.Holiday.date).all()

@router.get("/{dni}/bookings")
def get_user_bookings(dni: str, db: Session = Depends(get_db)):
    member = db.query(models.Member).filter(models.Member.dni == dni).first()
    if not member:
        raise HTTPException(status_code=404, detail="Socio no encontrado")
        
    bookings = db.query(models.Booking).filter(
        models.Booking.member_id == member.id
    ).order_by(models.Booking.start_time.desc()).all()
    
    result = []
    for b in bookings:
        result.append({
            "id": b.id,
            "class_schedule_id": b.class_schedule_id,
            "class_name": b.class_name,
            "start_time": b.start_time.isoformat() + "Z",
            "status": b.status,
            "exercises_done": b.exercises_done
        })
    return result

@router.post("/{dni}/book")
def book_class(dni: str, payload: dict, db: Session = Depends(get_db)):
    schedule_id = payload.get("class_schedule_id")
    date_str = payload.get("date")
    
    member = db.query(models.Member).filter(models.Member.dni == dni).first()
    if not member:
        raise HTTPException(status_code=404, detail="Socio no encontrado")
        
    schedule = db.query(models.ClassSchedule).filter(models.ClassSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Horario de clase no encontrado")
        
    try:
        class_date = datetime.datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido")
        
    if class_date < datetime.date.today():
        raise HTTPException(status_code=400, detail="No se puede reservar en una fecha pasada")
        
    holiday = db.query(models.Holiday).filter(models.Holiday.date == date_str).first()
    if holiday:
        raise HTTPException(status_code=400, detail=f"No se puede reservar en un día no laborable: {holiday.description}")
        
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
        models.Booking.start_time >= start_of_day,
        models.Booking.start_time <= end_of_day
    ).first()
    
    if existing:
        if existing.status == "cancelled":
            existing.status = "reserved"
            db.commit()
            return {"status": "success", "booking_id": existing.id, "message": "Reserva reactivada"}
        else:
            raise HTTPException(status_code=400, detail="Ya tenés una reserva para esta clase en este día")

    plan = db.query(models.Plan).filter(models.Plan.name == member.membership_type, models.Plan.is_active == True).first()
    max_days = plan.days_per_week if plan else 3
    
    start_of_week = class_date - datetime.timedelta(days=class_date.weekday())
    end_of_week = start_of_week + datetime.timedelta(days=6)
    
    start_of_week_dt = datetime.datetime.combine(start_of_week, datetime.time.min)
    end_of_week_dt = datetime.datetime.combine(end_of_week, datetime.time.max)
    weekly_bookings = db.query(models.Booking).filter(
        models.Booking.member_id == member.id,
        models.Booking.start_time >= start_of_week_dt,
        models.Booking.start_time <= end_of_week_dt,
        models.Booking.status != "cancelled"
    ).count()
    
    if weekly_bookings >= max_days:
        raise HTTPException(
            status_code=400, 
            detail=f"Límite semanal de reservas alcanzado ({max_days} días por semana según tu plan)"
        )
        
    time_parts = schedule.start_time.split(":")
    start_dt = datetime.datetime.combine(class_date, datetime.time(int(time_parts[0]), int(time_parts[1])))
    
    new_booking = models.Booking(
        member_id=member.id,
        class_schedule_id=schedule.id,
        class_name=schedule.name,
        start_time=start_dt,
        status="reserved"
    )
    db.add(new_booking)
    db.commit()
    db.refresh(new_booking)
    return {"status": "success", "booking_id": new_booking.id}

@router.delete("/{dni}/bookings/{booking_id}")
def cancel_booking(dni: str, booking_id: int, db: Session = Depends(get_db)):
    member = db.query(models.Member).filter(models.Member.dni == dni).first()
    if not member:
        raise HTTPException(status_code=404, detail="Socio no encontrado")
        
    booking = db.query(models.Booking).filter(
        models.Booking.id == booking_id,
        models.Booking.member_id == member.id
    ).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
        
    booking.status = "cancelled"
    db.commit()
    return {"status": "success", "message": "Reserva cancelada"}

@router.put("/bookings/{booking_id}/workout")
def save_workout_history(booking_id: int, payload: dict, db: Session = Depends(get_db)):
    booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
        
    booking.exercises_done = payload.get("exercises")
    db.commit()
    return {"status": "success", "message": "Entrenamiento guardado"}

@router.put("/{dni}/routine")
def update_routine(dni: str, payload: dict, db: Session = Depends(get_db)):
    member = db.query(models.Member).filter(models.Member.dni == dni).first()
    if not member:
        raise HTTPException(status_code=404, detail="Socio no encontrado")
        
    member.routine = payload.get("routine", [])
    db.commit()
    return {"status": "success", "message": "Rutina actualizada"}

@router.get("/{dni}/progress")
def get_user_progress(dni: str, db: Session = Depends(get_db)):
    member = db.query(models.Member).filter(models.Member.dni == dni).first()
    if not member:
        raise HTTPException(status_code=404, detail="Socio no encontrado")
        
    bookings = db.query(models.Booking).filter(
        models.Booking.member_id == member.id,
        models.Booking.status == 'attended',
        models.Booking.exercises_done != None
    ).order_by(models.Booking.start_time.asc()).all()
    
    progress_data_map = {}
    uncompleted_history = []
    
    for b in bookings:
        month_key = b.start_time.strftime("%b %Y")
        if month_key not in progress_data_map:
            progress_data_map[month_key] = {"date": month_key}
            
        routine = b.exercises_done
        if isinstance(routine, list):
            for day in routine:
                if 'exercises' in day:
                    for ex in day['exercises']:
                        if ex.get('completed') == False or ex.get('uncompleted_reason'):
                            uncompleted_history.append({
                                "date": b.start_time.isoformat() + "Z",
                                "exercise": ex.get('name'),
                                "reason": ex.get('uncompleted_reason', 'No especificado')
                            })
                        else:
                            kg = ex.get('kg', 0)
                            name = ex.get('name')
                            if kg > 0 and name:
                                current_max = progress_data_map[month_key].get(name, 0)
                                if kg > current_max:
                                    progress_data_map[month_key][name] = kg

    progress_chart_data = list(progress_data_map.values())
    
    return {
        "status": "success",
        "chart_data": progress_chart_data,
        "uncompleted_history": sorted(uncompleted_history, key=lambda x: x["date"], reverse=True)
    }

