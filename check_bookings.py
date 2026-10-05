import os
from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://neondb_owner:npg_x2MYst8Ibckd@ep-dry-term-b5hg2ejm-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
engine = create_engine(DATABASE_URL)

try:
    with engine.connect() as conn:
        # Get member id for 00000
        res = conn.execute(text("SELECT id FROM members WHERE dni = '00000'")).fetchone()
        if res:
            member_id = res[0]
            # Check bookings
            bookings = conn.execute(text("SELECT id, start_time, status FROM bookings WHERE member_id = :mid"), {"mid": member_id}).fetchall()
            print(f"Bookings for member 00000:")
            for b in bookings:
                print(f" - ID: {b[0]}, start_time: {b[1]}, status: {b[2]}")
        else:
            print("Member 00000 not found")
except Exception as e:
    print(f"Error: {e}")
