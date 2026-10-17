import os
from sqlalchemy import create_engine, text

import os, sys; from dotenv import load_dotenv; load_dotenv(os.path.join(os.path.dirname(__file__), "backend", ".env")); DATABASE_URL = os.getenv("DATABASE_URL")

try:
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        member_count = conn.execute(text("SELECT count(*) FROM members")).scalar()
        payment_count = conn.execute(text("SELECT count(*) FROM payments")).scalar()
        print(f"DATABASE_STATUS: OK")
        print(f"MEMBERS_COUNT: {member_count}")
        print(f"PAYMENTS_COUNT: {payment_count}")
        
        # Also check if there are other tables like plans or classes
        # (Looking at models.py might be better)
except Exception as e:
    print(f"DATABASE_ERROR: {e}")
