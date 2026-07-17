import sys
import os
from sqlalchemy.orm import Session
from sqlalchemy import create_engine

# Add the project root to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.models import Psychologist, AppointmentType
from backend.app.database import Base  # <-- Ensure this is the declarative base

# --- Database Setup ---
DATABASE_URL = "sqlite:///./test.db"  # Use a test database
engine = create_engine(DATABASE_URL)

def seed_data(db: Session):
    # --- Seed Psychologists ---
    psychologists = [
        Psychologist(name="Dr. Budi Santoso", specialization="Clinical Psychology", image_url="https://example.com/budi.jpg", is_available=True),
        Psychologist(name="Dr. Citra Lestari", specialization="Child Psychology", image_url="https://example.com/citra.jpg", is_available=True),
    ]
    db.add_all(psychologists)
    db.commit()

    # --- Seed Appointment Types ---
    appointment_types = [
        AppointmentType(name="Initial Consultation", duration_minutes=50, description="First meeting to discuss your needs."),
        AppointmentType(name="Follow-up Session", duration_minutes=45, description="Regular follow-up session."),
    ]
    db.add_all(appointment_types)
    db.commit()

    print("Seeding completed!")

if __name__ == "__main__":
    # Create tables
    Base.metadata.create_all(bind=engine)

    # Create a new session
    db_session = Session(engine)

    try:
        seed_data(db_session)
    finally:
        db_session.close()