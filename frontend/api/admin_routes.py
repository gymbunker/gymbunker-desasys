from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .database import get_db
from . import models
from . import schemas
from typing import List
import datetime
from sqlalchemy import func
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
    try:
        members = db.query(models.Member).all()
        now = datetime.datetime.utcnow()
        updated = False
        for m in members:
            if m.status != "INACTIVO" and m.joined_at:
                days_since = (now - m.joined_at).days
                plan = (m.membership_type or "").upper()
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
                
                if m.status != new_status:
                    m.status = new_status
                    updated = True
        if updated:
            db.commit()

        result = []
        for m in members:
            # Convert to dict first to avoid Pydantic mutability constraints
            m_dict = schemas.MemberSchema.from_orm(m).dict()
            m_dict["billing_history"] = [
                {
                    "id": p.id,
                    "date": p.created_at.strftime("%Y-%m-%d") if p.created_at else "",
                    "amount": p.amount,
                    "plan": m.membership_type or "Musculación",
                    "method": p.method,
                    "processed_by": p.stripe_id or "—",
                    "status": "PAGADO"
                } for p in sorted(m.payments, key=lambda x: x.created_at or datetime.datetime.min, reverse=True)
            ]
            result.append(m_dict)
        return result
    except Exception as e:
        import traceback
        error_msg = traceback.format_exc()
        raise HTTPException(status_code=500, detail=error_msg)

@router.post("/members", response_model=schemas.MemberSchema)
def create_member(member: schemas.MemberCreate, db: Session = Depends(get_db)):
    print(f"Creating member: {member.name} with DNI {member.dni}")
    data = member.dict()
    if not data.get('email'):
        data['email'] = None
    if not data.get('phone'):
        data['phone'] = None
    if not data.get('joined_at'):
        data['joined_at'] = datetime.datetime.utcnow()
    if data.get('password'):
        data['password'] = hash_password(data['password'])
    db_member = models.Member(**data)
    db.add(db_member)
    try:
        db.commit()
        db.refresh(db_member)
        print(f"Member created successfully with ID {db_member.id}")
        return db_member
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
    if not data.get('email'):
        data['email'] = None
    if not data.get('phone'):
        data['phone'] = None
    if not data.get('joined_at'):
        data['joined_at'] = db_member.joined_at
    # Recalculate status from joined_at so editing the start date reflects correctly
    joined = data['joined_at']
    if joined and data.get('status') != 'INACTIVO':
        days_since = (datetime.datetime.utcnow() - joined).days
        plan = (data.get('membership_type') or db_member.membership_type or "").upper()
        total_days = 30
        if plan == "TRIMESTRAL":
            total_days = 90
        elif plan == "SEMESTRAL":
            total_days = 180
        elif plan == "ANUAL":
            total_days = 365
            
        if days_since >= total_days:
            data['status'] = 'DEUDA'
        elif days_since >= total_days - 7:
            data['status'] = 'POR VENCER'
        else:
            data['status'] = 'ACTIVO'
    for key, value in data.items():
        if key == 'password':
            if value and not value.startswith('pbkdf2:'):
                setattr(db_member, key, hash_password(value))
        else:
            setattr(db_member, key, value)

    db.commit()
    db.refresh(db_member)
    return db_member

@router.get("/members/{member_id}/checkins")
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
    checkin_list = [{"id": f"c_{c.id}", "checkin_at": (c.checkin_at or today).isoformat() + "Z", "type": "Tótem Principal"} for c in checkins]

    bookings = db.query(models.Booking).filter(
        models.Booking.member_id == member_id,
        models.Booking.status.in_(["attended", "reserved"])
    ).all()
    booking_list = [{"id": f"b_{b.id}", "checkin_at": (b.start_time or today).isoformat() + "Z", "type": b.class_name or "Tótem Adicional"} for b in bookings]

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
def record_payment(member_id: int, amount: float = 0, method: str = "card", processed_by: str = "", db: Session = Depends(get_db)):
    member = db.query(models.Member).get(member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    now = datetime.datetime.utcnow()

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
        created_at=now
    )
    db.add(payment)
    member.status = "ACTIVO"
    member.joined_at = now
    db.commit()
    return {"status": "payment recorded", "amount": final_amount, "details": plan_details}

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
def delete_member(member_id: int, db: Session = Depends(get_db)):
    member = db.query(models.Member).get(member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    db.delete(member)
    db.commit()
    return {"status": "deleted"}

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
    return staff

@router.post("/staff", response_model=schemas.StaffSchema)
def create_staff(staff: schemas.StaffCreate, db: Session = Depends(get_db)):
    data = staff.dict()
    if data.get("password"):
        data["password"] = hash_password(data["password"])
    db_staff = models.Staff(**data)
    db.add(db_staff)
    db.commit()
    db.refresh(db_staff)
    return db_staff

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
    return db_staff

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
        models.Booking.start_time <= end_of_day
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
    db.commit()
    return {"status": "updated", "booking_id": booking_id, "new_status": new_status}

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
    if not activities:
        defaults = [
            {"name": "Entrenamiento Funcional", "code": "EF", "color": "#3b82f6"},
            {"name": "Pilates en Suelo", "code": "PS", "color": "#f97316"},
            {"name": "Entrenamiento Personalizado", "code": "EP", "color": "#ec4899"},
            {"name": "Salsa y Bachata", "code": "SB", "color": "#eab308"},
            {"name": "Zumba", "code": "ZB", "color": "#ef4444"},
            {"name": "Reguetón Juvenil", "code": "RJ", "color": "#06b6d4"}
        ]
        for d in defaults:
            db.add(models.Activity(name=d["name"], code=d["code"], color=d["color"]))
        db.commit()
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


@router.get('/force_migrate')
def force_migrate():
    from .migrate_db import migrate
    migrate()
    return {'status': 'migrated'}


@router.get('/debug_migrate')
def debug_migrate():
    from .database import engine
    from sqlalchemy import text
    try:
        with engine.connect() as conn:
            conn.execute(text('CREATE TABLE IF NOT EXISTS system_configs (id SERIAL PRIMARY KEY, key VARCHAR UNIQUE, value JSON)'))
            conn.commit()
            return {'status': 'table created manually'}
    except Exception as e:
        return {'error': str(e)}


@router.get('/debug_err')
def debug_err(db: Session = Depends(get_db)):
    try:
        return {'status': 'ok', 'val': db.query(models.SystemConfig).first().key if db.query(models.SystemConfig).first() else 'none'}
    except Exception as e:
        return {'error': str(e)}


@router.get('/debug_drop')
def debug_drop(db: Session = Depends(get_db)):
    try:
        from .database import engine
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text('DROP TABLE IF EXISTS system_configs'))
            conn.execute(text('CREATE TABLE system_configs (id SERIAL PRIMARY KEY, key VARCHAR UNIQUE, value JSON)'))
            conn.commit()
        return {'status': 'dropped and recreated'}
    except Exception as e:
        return {'error': str(e)}
