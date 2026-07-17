#!/usr/bin/env python3
"""
Initialize Production Admin and Counselor Accounts

This script ensures that admin and counselor accounts are properly created
in the production database with correct password hashing.

Usage:
    python scripts/init_production_accounts.py

Environment Variables Required:
    - ADMIN_EMAIL: Admin account email
    - ADMIN_PASSWORD: Admin account password
    - COUNSELOR_EMAIL: Counselor account email
    - COUNSELOR_PASSWORD: Counselor account password
    - COUNSELOR_NAME: Counselor display name (optional)
    - DATABASE_URL: PostgreSQL connection string
"""

import asyncio
import logging
import os
import sys
from datetime import datetime

from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.models import User

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash."""
    return pwd_context.verify(plain_password, hashed_password)


async def create_or_update_admin(db: AsyncSession) -> User:
    """Create or update admin account."""
    admin_email = os.getenv("ADMIN_EMAIL")
    admin_password = os.getenv("ADMIN_PASSWORD")

    if not admin_email or not admin_password:
        raise ValueError("ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required")

    logger.info(f"Processing admin account for email: {admin_email}")

    # Check if admin already exists (by email)
    stmt = select(User).where(User.email == admin_email)
    result = await db.execute(stmt)
    existing_admin = result.scalar_one_or_none()

    # Also check by role
    stmt_role = select(User).where(User.role == "admin")
    result_role = await db.execute(stmt_role)
    admin_by_role = result_role.scalar_one_or_none()

    password_hash = hash_password(admin_password)

    if existing_admin:
        logger.info("Admin account exists, updating password and ensuring active status...")
        existing_admin.password_hash = password_hash
        existing_admin.is_active = True
        existing_admin.email_verified = True
        existing_admin.role = "admin"
        db.add(existing_admin)
        await db.commit()
        await db.refresh(existing_admin)
        
        # Verify the password works
        if verify_password(admin_password, existing_admin.password_hash):
            logger.info("✅ Admin account updated and password verified!")
        else:
            logger.error("❌ Password verification failed after update!")
            
        return existing_admin

    elif admin_by_role:
        logger.info("Admin exists by role, updating email and password...")
        admin_by_role.email = admin_email
        admin_by_role.password_hash = password_hash
        admin_by_role.is_active = True
        admin_by_role.email_verified = True
        admin_by_role.name = "Administrator"
        db.add(admin_by_role)
        await db.commit()
        await db.refresh(admin_by_role)
        
        # Verify the password works
        if verify_password(admin_password, admin_by_role.password_hash):
            logger.info("✅ Admin account updated and password verified!")
        else:
            logger.error("❌ Password verification failed after update!")
            
        return admin_by_role

    else:
        logger.info("Creating new admin account...")
        admin_user = User(
            email=admin_email,
            password_hash=password_hash,
            role="admin",
            is_active=True,
            email_verified=True,
            name="Administrator",
            created_at=datetime.utcnow(),
            last_login=None,
        )
        db.add(admin_user)
        await db.commit()
        await db.refresh(admin_user)
        
        # Verify the password works
        if verify_password(admin_password, admin_user.password_hash):
            logger.info("✅ Admin account created and password verified!")
        else:
            logger.error("❌ Password verification failed after creation!")
            
        return admin_user


async def create_or_update_counselor(db: AsyncSession) -> User:
    """Create or update counselor account."""
    counselor_email = os.getenv("COUNSELOR_EMAIL")
    counselor_password = os.getenv("COUNSELOR_PASSWORD")
    counselor_name = os.getenv("COUNSELOR_NAME", "Main Counselor")

    if not counselor_email or not counselor_password:
        raise ValueError("COUNSELOR_EMAIL and COUNSELOR_PASSWORD environment variables are required")

    logger.info(f"Processing counselor account for email: {counselor_email}")

    # Check if counselor already exists (by email)
    stmt = select(User).where(User.email == counselor_email)
    result = await db.execute(stmt)
    existing_counselor = result.scalar_one_or_none()

    # Also check by role
    stmt_role = select(User).where(User.role == "counselor")
    result_role = await db.execute(stmt_role)
    counselor_by_role = result_role.scalar_one_or_none()

    password_hash = hash_password(counselor_password)

    if existing_counselor:
        logger.info("Counselor account exists, updating password and ensuring active status...")
        existing_counselor.password_hash = password_hash
        existing_counselor.is_active = True
        existing_counselor.email_verified = True
        existing_counselor.role = "counselor"
        existing_counselor.name = counselor_name
        db.add(existing_counselor)
        await db.commit()
        await db.refresh(existing_counselor)
        
        # Verify the password works
        if verify_password(counselor_password, existing_counselor.password_hash):
            logger.info("✅ Counselor account updated and password verified!")
        else:
            logger.error("❌ Password verification failed after update!")
            
        return existing_counselor

    elif counselor_by_role:
        logger.info("Counselor exists by role, updating email and password...")
        counselor_by_role.email = counselor_email
        counselor_by_role.password_hash = password_hash
        counselor_by_role.is_active = True
        counselor_by_role.email_verified = True
        counselor_by_role.name = counselor_name
        db.add(counselor_by_role)
        await db.commit()
        await db.refresh(counselor_by_role)
        
        # Verify the password works
        if verify_password(counselor_password, counselor_by_role.password_hash):
            logger.info("✅ Counselor account updated and password verified!")
        else:
            logger.error("❌ Password verification failed after update!")
            
        return counselor_by_role

    else:
        logger.info("Creating new counselor account...")
        counselor_user = User(
            email=counselor_email,
            password_hash=password_hash,
            role="counselor",
            is_active=True,
            email_verified=True,
            name=counselor_name,
            created_at=datetime.utcnow(),
            last_login=None,
        )
        db.add(counselor_user)
        await db.commit()
        await db.refresh(counselor_user)
        
        # Verify the password works
        if verify_password(counselor_password, counselor_user.password_hash):
            logger.info("✅ Counselor account created and password verified!")
        else:
            logger.error("❌ Password verification failed after creation!")
            
        return counselor_user


async def verify_accounts(db: AsyncSession):
    """Verify that accounts can be found and logged in."""
    logger.info("\n" + "="*60)
    logger.info("VERIFYING ACCOUNTS")
    logger.info("="*60)
    
    admin_email = os.getenv("ADMIN_EMAIL")
    admin_password = os.getenv("ADMIN_PASSWORD")
    counselor_email = os.getenv("COUNSELOR_EMAIL")
    counselor_password = os.getenv("COUNSELOR_PASSWORD")

    # Verify admin
    if admin_email:
        stmt = select(User).where(User.email == admin_email)
        result = await db.execute(stmt)
        admin = result.scalar_one_or_none()

        if admin:
            logger.info(f"✅ Admin account found in database")
            logger.info(f"   - ID: {admin.id}")
            logger.info(f"   - Role: {admin.role}")
            logger.info(f"   - Active: {admin.is_active}")
            logger.info(f"   - Email verified: {admin.email_verified}")
            logger.info(f"   - Email: {admin.email}")
            
            # Verify password
            if admin.password_hash and verify_password(admin_password, admin.password_hash):
                logger.info(f"   - Password verification: ✅ Working")
            else:
                logger.error(f"   - Password verification: ❌ Failed")
        else:
            logger.error(f"❌ Admin account NOT found in database")

    # Verify counselor
    if counselor_email:
        stmt = select(User).where(User.email == counselor_email)
        result = await db.execute(stmt)
        counselor = result.scalar_one_or_none()

        if counselor:
            logger.info(f"\n✅ Counselor account found in database")
            logger.info(f"   - ID: {counselor.id}")
            logger.info(f"   - Role: {counselor.role}")
            logger.info(f"   - Active: {counselor.is_active}")
            logger.info(f"   - Email verified: {counselor.email_verified}")
            logger.info(f"   - Email: {counselor.email}")
            
            # Verify password
            if counselor.password_hash and verify_password(counselor_password, counselor.password_hash):
                logger.info(f"   - Password verification: ✅ Working")
            else:
                logger.error(f"   - Password verification: ❌ Failed")
        else:
            logger.error(f"❌ Counselor account NOT found in database")

    logger.info("="*60 + "\n")


async def main():
    """Main function to initialize production accounts."""
    logger.info("="*60)
    logger.info("PRODUCTION ACCOUNTS INITIALIZATION")
    logger.info("="*60)

    # Check required environment variables
    required_vars = [
        "DATABASE_URL",
        "ADMIN_EMAIL",
        "ADMIN_PASSWORD",
        "COUNSELOR_EMAIL",
        "COUNSELOR_PASSWORD",
    ]

    missing_vars = [var for var in required_vars if not os.getenv(var)]
    if missing_vars:
        logger.error(f"❌ Missing required environment variables: {', '.join(missing_vars)}")
        logger.error("Please set all required variables in your .env file")
        sys.exit(1)

    # Get database URL
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL environment variable is required")

    # Convert to async URL if needed
    if database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)

    logger.info(f"Connecting to database: {database_url.split('@')[1] if '@' in database_url else 'hidden'}")

    # Create async engine
    engine = create_async_engine(database_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    try:
        async with async_session() as session:
            # Create/update admin account
            logger.info("\n" + "-"*60)
            await create_or_update_admin(session)
            
            # Create/update counselor account
            logger.info("\n" + "-"*60)
            await create_or_update_counselor(session)

            # Verify accounts
            logger.info("\n" + "-"*60)
            await verify_accounts(session)

        logger.info("\n" + "="*60)
        logger.info("✅ PRODUCTION ACCOUNTS INITIALIZATION COMPLETE")
        logger.info("="*60)
        logger.info("\nYou can now login with:")
        logger.info(f"  Admin:     {os.getenv('ADMIN_EMAIL')}")
        logger.info(f"  Counselor: {os.getenv('COUNSELOR_EMAIL')}")
        logger.info("="*60)

    except Exception as e:
        logger.error(f"\n❌ Error initializing accounts: {e}", exc_info=True)
        sys.exit(1)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
