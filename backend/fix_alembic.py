"""
Fix Alembic version table when migrations are stuck.

This script stamps the database to a specific revision without running migrations.
Use this when the alembic_version table is out of sync with the actual database state.
"""
import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def fix_alembic():
    """Reset alembic_version table"""
    
    # Get database URL from environment
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("ERROR: DATABASE_URL environment variable not set")
        return
    
    engine = create_async_engine(db_url)
    
    try:
        async with engine.begin() as conn:
            print("Dropping alembic_version table...")
            await conn.execute(text("DROP TABLE IF EXISTS alembic_version CASCADE;"))
            print("✅ alembic_version table dropped successfully")
            print("\nNow run: alembic upgrade head")
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(fix_alembic())
