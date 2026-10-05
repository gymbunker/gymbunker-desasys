import os
from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://neondb_owner:npg_x2MYst8Ibckd@ep-dry-term-b5hg2ejm-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
engine = create_engine(DATABASE_URL)

try:
    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE bookings ADD COLUMN class_schedule_id INTEGER"))
            print("Column 'class_schedule_id' added successfully to bookings.")
        except Exception as e:
            print("Skipped class_schedule_id:", e)
            
        try:
            conn.execute(text("ALTER TABLE bookings ADD COLUMN exercises_done JSON"))
            print("Column 'exercises_done' added successfully to bookings.")
        except Exception as e:
            print("Skipped exercises_done:", e)

except Exception as e:
    print("Error:", e)
