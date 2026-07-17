import asyncio
import sys
from pathlib import Path
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from passlib.context import CryptContext

# Add app to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import async_engine
from app.models.user import User
from app.services.user_service import async_get_user_by_plain_email

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def seed_research_users():
    """Seed the database with users required for research evaluation."""
    print("Seeding research users...")
    
    async_session = async_sessionmaker(async_engine, expire_on_commit=False)
    
    async with async_session() as session:
        # 1. Evaluation User (for RQ1 & RQ2) - Made ADMIN for access to assessment APIs
        eval_user_email = "evaluation_user@example.com"
        eval_user = await async_get_user_by_plain_email(session, eval_user_email)
        
        password_hash = pwd_context.hash("research_password_123")
        
        if not eval_user:
            print(f"Creating user: {eval_user_email}")
            eval_user = User(
                email=eval_user_email,
                name="Evaluation User",
                role="admin", # Changed to admin
                is_active=True,
                email_verified=True,
                password_hash=password_hash
            )
            session.add(eval_user)
            await session.commit()
            await session.refresh(eval_user)
            print(f"Created Evaluation User with ID: {eval_user.id}")
        else:
            # Update to admin and set password if exists
            eval_user.role = "admin"
            eval_user.password_hash = password_hash
            session.add(eval_user)
            await session.commit()
            print(f"Updated Evaluation User (ID: {eval_user.id}) to ADMIN and reset password.")

        # 2. Privacy Test User (for RQ3 & RQ4)
        privacy_user_email = "privacy_test_user@example.com"
        privacy_user = await async_get_user_by_plain_email(session, privacy_user_email)
        
        if not privacy_user:
            print(f"Creating user: {privacy_user_email}")
            privacy_user = User(
                email=privacy_user_email,
                name="Privacy Test User",
                role="user",
                is_active=True,
                email_verified=True,
                password_hash=password_hash
            )
            session.add(privacy_user)
            await session.commit()
            await session.refresh(privacy_user)
            print(f"Created Privacy Test User with ID: {privacy_user.id}")
        else:
            privacy_user.password_hash = password_hash
            session.add(privacy_user)
            await session.commit()
            print(f"Privacy Test User already exists with ID: {privacy_user.id}. Password reset.")

if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(seed_research_users())
