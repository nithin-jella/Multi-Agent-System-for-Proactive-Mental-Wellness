"""
Create admin user script

Usage:
    python scripts/create_admin.py
"""

import asyncio
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db.session import async_session_maker
from app.models import User, UserRole
from app.core.auth import get_password_hash


async def create_admin():
    """Create default admin user"""
    async with async_session_maker() as db:
        # Check if admin exists
        from sqlalchemy import select
        result = await db.execute(select(User).where(User.email == "admin@ugm-aicare.org"))
        existing_admin = result.scalar_one_or_none()
        
        if existing_admin:
            print("❌ Admin user already exists!")
            return
        
        # Create admin
        admin = User(
            email="admin@ugm-aicare.org",
            hashed_password=get_password_hash("admin123"),  # Change in production!
            full_name="Admin User",
            role=UserRole.ADMIN,
            is_active=True
        )
        
        db.add(admin)
        await db.commit()
        
        print("✅ Admin user created successfully!")
        print(f"   Email: admin@ugm-aicare.org")
        print(f"   Password: admin123")
        print(f"   Role: {UserRole.ADMIN}")
        print("\n⚠️  IMPORTANT: Change the admin password immediately in production!")


if __name__ == "__main__":
    print("🔐 Creating admin user...")
    asyncio.run(create_admin())
