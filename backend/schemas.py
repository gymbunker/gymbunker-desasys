from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime

class PaymentBase(BaseModel):
    amount: float
    method: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class MemberPaymentSchema(BaseModel):
    date: str = Field(alias="created_at")
    amount: float
    plan: str = "Premium" # Placeholder or derived
    method: str
    status: str = "PAGADO"

    @classmethod
    def from_orm(cls, obj):
        # Custom mapping for the frontend format
        return {
            "date": obj.created_at.strftime("%Y-%m-%d"),
            "amount": obj.amount,
            "plan": "Premium", # In a real app, you'd store the plan name in the payment
            "method": obj.method,
            "status": "PAGADO" if obj.status == "paid" else obj.status
        }

class MemberBase(BaseModel):
    dni: str
    name: str
    email: Optional[str] = None
    status: str = "ACTIVO"
    photo_url: Optional[str] = None
    phone: Optional[str] = None
    password: Optional[str] = "123"
    membership_type: Optional[str] = None
    additional_plans: Optional[List[str]] = []
    wellness_data: Optional[Dict] = None
    routine: Optional[List[Dict]] = None
    routine_documents: Optional[List[Dict]] = []
    training_plan_id: Optional[int] = None

class MemberCreate(BaseModel):
    dni: str
    name: str
    email: Optional[str] = None
    status: str = "ACTIVO"
    photo_url: Optional[str] = None
    phone: Optional[str] = None
    password: Optional[str] = "123"
    membership_type: Optional[str] = None
    additional_plans: Optional[List[str]] = []
    joined_at: Optional[datetime] = None
    routine: Optional[List[Dict]] = None
    routine_documents: Optional[List[Dict]] = []
    training_plan_id: Optional[int] = None

class MemberSchema(MemberBase):
    id: int
    joined_at: datetime
    last_checkin: Optional[datetime] = None
    billing_history: List[Dict] = [] # We'll populate this manually in the route for now
    routine_documents: Optional[List[Dict]] = []
    training_plan_id: Optional[int] = None

    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    dni: str
    password: str

class StaffLogin(BaseModel):
    username: str
    password: str

class PasswordChange(BaseModel):
    new_password: str

class PaymentSchema(BaseModel):
    id: int
    amount: float
    currency: str
    status: str
    method: str
    created_at: datetime

    class Config:
        from_attributes = True

class BookingSchema(BaseModel):
    id: int
    class_name: str
    start_time: datetime
    status: str
    class_schedule_id: Optional[int] = None
    exercises_done: Optional[List[Dict]] = None

    class Config:
        from_attributes = True

class BookingCreate(BaseModel):
    class_schedule_id: int
    date: str  # YYYY-MM-DD

class ClassScheduleBase(BaseModel):
    name: str
    code: str
    day_of_week: Optional[int] = None
    specific_date: Optional[str] = None
    start_time: str
    end_time: str
    color: Optional[str] = "#3b82f6"
    capacity: Optional[int] = 20

class ClassScheduleCreate(ClassScheduleBase):
    pass

class ClassScheduleSchema(ClassScheduleBase):
    id: int
    class Config:
        from_attributes = True

class HolidayBase(BaseModel):
    date: str  # YYYY-MM-DD
    description: str

class HolidayCreate(HolidayBase):
    pass

class HolidaySchema(HolidayBase):
    id: int
    class Config:
        from_attributes = True

class PlanBase(BaseModel):
    name: str
    price: float
    days_per_week: int = 3
    classes: List = []
    is_active: bool = True
    allow_unification: Optional[bool] = False

class PlanCreate(PlanBase):
    pass

class PlanSchema(PlanBase):
    id: int
    class Config:
        from_attributes = True

class ExerciseSchema(BaseModel):
    id: Optional[int] = None
    name: str
    segment: Optional[str] = None
    zone: Optional[str] = None
    muscle_group: Optional[str] = None

    class Config:
        from_attributes = True

class CheckinSchema(BaseModel):
    id: int
    member_id: int
    checkin_at: datetime
    class Config:
        from_attributes = True

class StaffBase(BaseModel):
    name: str
    username: Optional[str] = None
    role: str
    shift: Optional[str] = "Mañana"
    password: Optional[str] = "1234"

class StaffCreate(StaffBase):
    pass

class StaffSchema(StaffBase):
    id: int

    class Config:
        from_attributes = True

class DailyMassConfig(BaseModel):
    day: int
    start_time: str
    end_time: str
    interval_minutes: int

class MassClassScheduleSchema(BaseModel):
    configs: List[DailyMassConfig]
    capacity: int
    name: str
    code: str
    color: str


class ActivitySchema(BaseModel):
    id: Optional[int] = None
    name: str
    code: str
    color: str

class TrainingPlanSchema(BaseModel):
    id: Optional[int] = None
    name: str
    description: Optional[str] = ""
    category: Optional[str] = "General"
    days: Optional[List[Dict]] = []
    documents: Optional[List[Dict]] = []
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
