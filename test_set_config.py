import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), 'frontend', 'api'))

import os, sys; from dotenv import load_dotenv; load_dotenv(os.path.join(os.path.dirname(__file__), "backend", ".env")); DATABASE_URL = os.getenv("DATABASE_URL")
os.environ["DATABASE_URL"] = DATABASE_URL

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import models

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

try:
    config = db.query(models.SystemConfig).filter(models.SystemConfig.key == 'system_announcement').first()
    if config:
        config.value = {'title': 'Test', 'message': 'Test', 'show': True, 'type': 'info'}
    else:
        config = models.SystemConfig(key='system_announcement', value={'title': 'Test', 'message': 'Test', 'show': True, 'type': 'info'})
        db.add(config)
    db.commit()
    print("Success")
except Exception as e:
    import traceback
    traceback.print_exc()
