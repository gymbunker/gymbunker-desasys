import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

DATABASE_URL = "postgresql://neondb_owner:npg_x2MYst8Ibckd@ep-dry-term-b5hg2ejm-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
engine = create_engine(DATABASE_URL)

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE members ADD COLUMN routine JSON"))
        print("Column 'routine' added successfully.")
except Exception as e:
    print("Error:", e)
