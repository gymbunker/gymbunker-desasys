import os
from sqlalchemy import create_engine
from backend.models import Base, Exercise

import os, sys; from dotenv import load_dotenv; load_dotenv(os.path.join(os.path.dirname(__file__), "backend", ".env")); DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

try:
    print("Creando tabla exercises...")
    Base.metadata.create_all(bind=engine, tables=[Exercise.__table__])
    print("Tabla exercises creada.")
except Exception as e:
    print("Error:", e)
