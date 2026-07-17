"""
Initialize database schema from SQLAlchemy models.
Run this ONCE on empty database, then use migrations going forward.

This script creates all tables defined in SQLAlchemy models.
After running this, use `alembic stamp head` to mark database as current.
"""
import asyncio
import sys
from pathlib import Path

# Add app to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import Base, async_engine
import app.models  # Import all models to register them with Base

async def init_db():
    """Create all tables from SQLAlchemy models."""
    print("=" * 80)
    print("DATABASE INITIALIZATION FROM MODELS")
    print("=" * 80)
    print()
    print("This will create all tables defined in your SQLAlchemy models.")
    print(f"Total models registered: {len(Base.metadata.tables)}")
    print()
    
    try:
        async with async_engine.begin() as conn:
            # Create all tables
            print("Creating database schema...")
            await conn.run_sync(Base.metadata.create_all)
        
        print()
        print("=" * 80)
        print("✅ DATABASE SCHEMA CREATED SUCCESSFULLY!")
        print("=" * 80)
        print()
        print(f"📊 Total tables created: {len(Base.metadata.tables)}")
        print()
        print("Tables:")
        for table_name in sorted(Base.metadata.tables.keys()):
            table = Base.metadata.tables[table_name]
            column_count = len(table.columns)
            print(f"  ✓ {table_name:40} ({column_count} columns)")
        
        print()
        print("=" * 80)
        print("NEXT STEPS:")
        print("=" * 80)
        print("1. Mark database as migrated:")
        print("   docker exec ugm_aicare_migrate_dev alembic stamp head")
        print()
        print("2. Create baseline migration:")
        print("   docker exec ugm_aicare_migrate_dev alembic revision \\")
        print("     --autogenerate -m 'initial_schema_baseline'")
        print()
        print("3. Start all services:")
        print("   ./dev.sh up")
        print("=" * 80)
        
    except Exception as e:
        print()
        print("=" * 80)
        print("❌ ERROR CREATING SCHEMA")
        print("=" * 80)
        print(f"Error: {e}")
        print()
        print("This might happen if:")
        print("- Database connection is not configured")
        print("- Tables already exist")
        print("- Database user lacks permissions")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(init_db())
