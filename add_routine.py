import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

import os, sys; from dotenv import load_dotenv; load_dotenv(os.path.join(os.path.dirname(__file__), "backend", ".env")); DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE members ADD COLUMN routine JSON"))
        print("Column 'routine' added successfully.")
except Exception as e:
    print("Error:", e)
