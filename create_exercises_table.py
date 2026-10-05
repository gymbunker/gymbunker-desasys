import os
from sqlalchemy import create_engine
from backend.models import Base, Exercise

DATABASE_URL = "postgresql://neondb_owner:npg_x2MYst8Ibckd@ep-dry-term-b5hg2ejm-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
engine = create_engine(DATABASE_URL)

try:
    print("Creando tabla exercises...")
    Base.metadata.create_all(bind=engine, tables=[Exercise.__table__])
    print("Tabla exercises creada.")
except Exception as e:
    print("Error:", e)
