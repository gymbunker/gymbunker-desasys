import os
from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://neondb_owner:npg_x2MYst8Ibckd@ep-dry-term-b5hg2ejm-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

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
