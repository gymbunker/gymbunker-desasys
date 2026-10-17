import os
import sys

# Add frontend/api to path so we can import models
sys.path.append(os.path.join(os.path.dirname(__file__), 'frontend', 'api'))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), 'backend', '.env'))

# Neon DB URL
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("Error: DATABASE_URL not found in backend/.env")
    sys.exit(1)

from sqlalchemy import create_engine, text
from models import Base
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

print("Connecting to Neon database (credentials masked)...")
engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    print("Creating missing tables...")
    Base.metadata.create_all(engine)
    print("Tables created.")

    # Now add missing columns if they don't exist
    columns_to_add = [
        ("plans", "allow_unification", "BOOLEAN DEFAULT FALSE"),
        ("payments", "plan_details", "JSON"),
        ("payments", "method", "VARCHAR DEFAULT 'Efectivo'"),
        ("members", "additional_plans", "JSON DEFAULT '[]'"),
        ("members", "wellness_data", "JSON"),
        ("members", "routine", "JSON"),
        ("staff", "username", "VARCHAR"),
        ("staff", "shift", "VARCHAR DEFAULT 'Mañana'"),
        ("class_schedules", "specific_date", "VARCHAR"),
        ("bookings", "attended_at", "TIMESTAMP"),
    ]

    for table, column, col_type in columns_to_add:
        try:
            # Check if column exists
            query = text(f"""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='{table}' and column_name='{column}'
            """)
            result = conn.execute(query).fetchone()
            
            if not result:
                print(f"Adding column {column} to {table}...")
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"))
                conn.commit()
                print(f"Added {column} to {table}.")
            else:
                print(f"Column {column} already exists in {table}.")
                
        except Exception as e:
            print(f"Error adding {column} to {table}: {e}")
            conn.rollback()

print("Migration completed successfully.")
