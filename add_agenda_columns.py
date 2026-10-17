import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), 'frontend', 'api'))

import os, sys; from dotenv import load_dotenv; load_dotenv(os.path.join(os.path.dirname(__file__), "backend", ".env")); DATABASE_URL = os.getenv("DATABASE_URL")
os.environ["DATABASE_URL"] = DATABASE_URL

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import models

engine = create_engine(DATABASE_URL)

def main():
    print(f"Connecting to {DATABASE_URL}")
    print("Adding missing columns to bookings...")
    
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE bookings ADD COLUMN class_schedule_id INTEGER REFERENCES class_schedules(id);"))
            print("Added class_schedule_id to bookings.")
        except Exception as e:
            print(f"Column class_schedule_id already exists or error: {e}")
            
        try:
            conn.execute(text("ALTER TABLE bookings ADD COLUMN exercises_done JSON;"))
            print("Added exercises_done to bookings.")
        except Exception as e:
            print(f"Column exercises_done already exists or error: {e}")
            
        conn.commit()
    
    print("Migration completed successfully.")

if __name__ == "__main__":
    main()
