import os
from sqlalchemy import create_engine, text

import os, sys; from dotenv import load_dotenv; load_dotenv(os.path.join(os.path.dirname(__file__), "backend", ".env")); DATABASE_URL = os.getenv("DATABASE_URL")
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
