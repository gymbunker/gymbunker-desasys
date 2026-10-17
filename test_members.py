import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), 'frontend', 'api'))

import os, sys; from dotenv import load_dotenv; load_dotenv(os.path.join(os.path.dirname(__file__), "backend", ".env")); DATABASE_URL = os.getenv("DATABASE_URL")
os.environ["DATABASE_URL"] = DATABASE_URL

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import models
import schemas
import datetime

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def test_get_members():
    db = SessionLocal()
    try:
        members = db.query(models.Member).all()
        print(f"Found {len(members)} members")
        now = datetime.datetime.utcnow()
        updated = False
        for m in members:
            if m.status != "INACTIVO" and m.joined_at:
                days_since = (now - m.joined_at).days
                if days_since >= 30:
                    new_status = "DEUDA"
                elif days_since >= 23:
                    new_status = "POR VENCER"
                else:
                    new_status = "ACTIVO"
                
                if m.status != new_status:
                    m.status = new_status
                    updated = True
        
        result = []
        for m in members:
            m_dict = schemas.MemberSchema.from_orm(m).dict()
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
            
        print("Success! Parsed all members.")
    except Exception as e:
        import traceback
        traceback.print_exc()
    finally:
        db.close()

test_get_members()
