from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship
try:
    from .database import Base
except ImportError:
    from database import Base
import datetime

class Member(Base):
    __tablename__ = "members"

    id = Column(Integer, primary_key=True, index=True)
    dni = Column(String, unique=True, index=True)
    name = Column(String)
    email = Column(String, unique=True, index=True)
    status = Column(String, default="ACTIVO") # ACTIVO, DEUDA, POR VENCER, INACTIVO
    photo_url = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    password = Column(String, default="123")
    membership_type = Column(String) # Basic, Premium, Elite (Plan Principal)
    additional_plans = Column(JSON, default=[]) # Planes Adicionales
    joined_at = Column(DateTime, default=datetime.datetime.utcnow)
    fixed_billing_day = Column(Integer, nullable=True) # e.g. 23 (Día fijo de cobro)
    keep_billing_day = Column(Boolean, default=False)  # Mantener día de cobro para siempre
    next_due_date = Column(DateTime, nullable=True)    # Fecha del próximo cobro/vencimiento
    last_checkin = Column(DateTime, nullable=True)
    
    # Wellness metrics (JSON for flexibility in prototyping)
    wellness_data = Column(JSON, nullable=True) # {hrv: 65, sleep_quality: 0.8, etc}
    routine = Column(JSON, nullable=True)
    routine_documents = Column(JSON, default=[])
    training_plan_id = Column(Integer, ForeignKey("training_plans.id"), nullable=True)
    is_new = Column(Boolean, default=False)
    
    payments = relationship("Payment", back_populates="member")
    bookings = relationship("Booking", back_populates="member")
    checkins = relationship("Checkin", back_populates="member")

class Payment(Base):
    __tablename__ = "payments"
    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id"))
    amount = Column(Float)
    currency = Column(String, default="USD")
    status = Column(String) # paid, pending, failed
    method = Column(String, default="Efectivo") # Efectivo, Tarjeta, etc
    stripe_id = Column(String, nullable=True)
    plan_details = Column(JSON, nullable=True) # Desglose de planes contratados
    billing_date = Column(DateTime, nullable=True)
    next_due_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    member = relationship("Member", back_populates="payments")

class Booking(Base):
    __tablename__ = "bookings"
    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id"))
    class_schedule_id = Column(Integer, ForeignKey("class_schedules.id"), nullable=True)
    class_name = Column(String)
    start_time = Column(DateTime)
    attended_at = Column(DateTime, nullable=True)
    status = Column(String, default="reserved") # reserved, attended, cancelled
    exercises_done = Column(JSON, nullable=True)

    member = relationship("Member", back_populates="bookings")
    class_schedule = relationship("ClassSchedule")

class ClassSchedule(Base):
    __tablename__ = "class_schedules"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    code = Column(String)
    day_of_week = Column(Integer, nullable=True)  # 0=Lunes, 1=Martes...
    specific_date = Column(String, nullable=True) # "YYYY-MM-DD" para clases de un solo dia
    start_time = Column(String)  # "08:30"
    end_time = Column(String)  # "09:30"
    color = Column(String, default="#3b82f6")
    capacity = Column(Integer, default=20)

class Holiday(Base):
    __tablename__ = "holidays"
    id = Column(Integer, primary_key=True, index=True)
    date = Column(String, unique=True, index=True)  # YYYY-MM-DD
    description = Column(String)

class Staff(Base):
    __tablename__ = "staff"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    username = Column(String, unique=True, index=True, nullable=True)
    role = Column(String) # Trainer, Reception, Manager
    password = Column(String, default="1234")
    shift = Column(String, default="Mañana")

class Checkin(Base):
    __tablename__ = "checkins"
    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id"))
    checkin_at = Column(DateTime, default=datetime.datetime.utcnow)
    member = relationship("Member", back_populates="checkins")

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    price = Column(Float)
    stock = Column(Integer)
    category = Column(String) # Supplements, Drinks, Merch

class Plan(Base):
    __tablename__ = "plans"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    price = Column(Float)
    days_per_week = Column(Integer, default=3)
    classes = Column(JSON, default=[])
    is_active = Column(Boolean, default=True)
    allow_unification = Column(Boolean, default=False)
    enable_custom_payment_methods = Column(Boolean, default=False)
    price_cash = Column(Float, nullable=True)
    price_transfer = Column(Float, nullable=True)

class Exercise(Base):
    __tablename__ = "exercises"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    segment = Column(String)       # Ej: Tren superior
    zone = Column(String)          # Ej: Pecho
    muscle_group = Column(String)  # Ej: Pectoral mayor



class Activity(Base):
    __tablename__ = "activities"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    code = Column(String)
    color = Column(String)

class TrainingPlan(Base):
    __tablename__ = "training_plans"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(String, nullable=True)
    category = Column(String, default="General")
    days = Column(JSON, default=[])
    documents = Column(JSON, default=[])
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class SystemConfig(Base):
    __tablename__ = "system_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True)
    value = Column(JSON, default=dict)
