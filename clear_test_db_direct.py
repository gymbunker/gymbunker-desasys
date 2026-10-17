import os
import sys
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), 'backend', '.env'))
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("Error: DATABASE_URL not set in backend/.env")
    sys.exit(1)

if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

engine = create_engine(DATABASE_URL)

try:
    with engine.connect() as conn:
        # Get member id for 00000
        res = conn.execute(text("SELECT id FROM members WHERE dni = '00000'")).fetchone()
        if res:
            member_id = res[0]
            # Update bookings
            conn.execute(text("UPDATE bookings SET exercises_done = NULL WHERE member_id = :mid"), {"mid": member_id})
            conn.commit()
            print(f"Cleared exercises_done for member_id {member_id} (DNI 00000)")
        else:
            print("Member 00000 not found")
except Exception as e:
    print(f"Error: {e}")
