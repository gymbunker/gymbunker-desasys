import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.models import Base, Exercise
import sys
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), 'backend', '.env'))
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("Error: DATABASE_URL no configurado en backend/.env")
    sys.exit(1)

if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def seed_exercises():
    db = SessionLocal()
    try:
        # Check if already seeded
        if db.query(Exercise).count() > 0:
            print("Exercises already seeded.")
            return

        exercises = [
            # Tren superior -> Pecho
            {"name": "Press de Banca Plano", "segment": "Tren superior", "zone": "Pecho", "muscle_group": "Pectoral mayor"},
            {"name": "Press de Banca Inclinado", "segment": "Tren superior", "zone": "Pecho", "muscle_group": "Pectoral mayor (Haz clavicular)"},
            {"name": "Aperturas con Mancuernas", "segment": "Tren superior", "zone": "Pecho", "muscle_group": "Pectoral mayor"},
            
            # Tren superior -> Espalda
            {"name": "Dominadas", "segment": "Tren superior", "zone": "Espalda", "muscle_group": "Dorsal Ancho"},
            {"name": "Remo con Barra", "segment": "Tren superior", "zone": "Espalda", "muscle_group": "Dorsal Ancho / Romboides"},
            {"name": "Jalón al Pecho", "segment": "Tren superior", "zone": "Espalda", "muscle_group": "Dorsal Ancho"},

            # Tren superior -> Hombros
            {"name": "Press Militar", "segment": "Tren superior", "zone": "Hombros", "muscle_group": "Deltoides (Anterior y Medio)"},
            {"name": "Vuelos Laterales", "segment": "Tren superior", "zone": "Hombros", "muscle_group": "Deltoides (Medio)"},
            {"name": "Vuelos Frontales", "segment": "Tren superior", "zone": "Hombros", "muscle_group": "Deltoides (Anterior)"},

            # Tren superior -> Brazos
            {"name": "Curl de Bíceps con Barra", "segment": "Tren superior", "zone": "Brazos", "muscle_group": "Bíceps braquial"},
            {"name": "Extensión de Tríceps en Polea", "segment": "Tren superior", "zone": "Brazos", "muscle_group": "Tríceps braquial"},
            {"name": "Fondos de Tríceps", "segment": "Tren superior", "zone": "Brazos", "muscle_group": "Tríceps braquial"},

            # Tren medio / core -> Abdomen
            {"name": "Crunch Abdominal", "segment": "Tren medio / core", "zone": "Abdomen", "muscle_group": "Recto abdominal"},
            {"name": "Plancha Isométrica", "segment": "Tren medio / core", "zone": "Abdomen", "muscle_group": "Core / Transverso"},
            {"name": "Elevación de Piernas Colgado", "segment": "Tren medio / core", "zone": "Abdomen", "muscle_group": "Recto abdominal (Porción inferior)"},

            # Tren inferior -> Cuádriceps
            {"name": "Sentadilla Libre", "segment": "Tren inferior", "zone": "Cuádriceps", "muscle_group": "Cuádriceps / Glúteos"},
            {"name": "Prensa de Piernas", "segment": "Tren inferior", "zone": "Cuádriceps", "muscle_group": "Cuádriceps"},
            {"name": "Extensiones de Cuádriceps", "segment": "Tren inferior", "zone": "Cuádriceps", "muscle_group": "Cuádriceps"},

            # Tren inferior -> Isquiotibiales
            {"name": "Peso Muerto Rumano", "segment": "Tren inferior", "zone": "Isquiotibiales", "muscle_group": "Isquiotibiales / Glúteos"},
            {"name": "Curl de Isquiotibiales Tumbado", "segment": "Tren inferior", "zone": "Isquiotibiales", "muscle_group": "Isquiotibiales"},

            # Tren inferior -> Glúteos
            {"name": "Hip Thrust", "segment": "Tren inferior", "zone": "Glúteos", "muscle_group": "Glúteo Mayor"},
            {"name": "Estocadas / Zancadas", "segment": "Tren inferior", "zone": "Glúteos", "muscle_group": "Glúteo Mayor / Cuádriceps"},

            # Tren inferior -> Pantorrilla
            {"name": "Elevación de Talones de Pie", "segment": "Tren inferior", "zone": "Pantorrilla y pierna inferior", "muscle_group": "Gemelos"},
            {"name": "Elevación de Talones Sentado", "segment": "Tren inferior", "zone": "Pantorrilla y pierna inferior", "muscle_group": "Sóleo"}
        ]

        for ex_data in exercises:
            ex = Exercise(**ex_data)
            db.add(ex)
        
        db.commit()
        print(f"Seeded {len(exercises)} exercises.")

    except Exception as e:
        print("Error seeding exercises:", e)
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_exercises()
