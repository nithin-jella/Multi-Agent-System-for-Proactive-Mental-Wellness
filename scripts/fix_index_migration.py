#!/usr/bin/env python3
"""
Fix database index conflicts during migration.
This script handles cases where indices already exist but migration tries to create them.
"""

import asyncio
import sys
import os
from pathlib import Path

# Add backend to Python path
backend_dir = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

async def check_and_fix_indices():
    """Check for existing indices and fix conflicts."""
    try:
        from app.database import async_engine
        from sqlalchemy import text
        
        print("[index-fix] Connecting to database...")
        
        async with async_engine.begin() as conn:
            # Check current alembic version
            result = await conn.execute(text("SELECT version_num FROM alembic_version"))
            current_version = result.scalar()
            print(f"[index-fix] Current migration version: {current_version}")
            
            # Check if problematic indices exist
            indices_to_check = [
                'ix_agent_messages_id',
                'ix_agent_runs_id'
            ]
            
            existing_indices = []
            for index_name in indices_to_check:
                result = await conn.execute(text("""
                    SELECT indexname 
                    FROM pg_indexes 
                    WHERE indexname = :index_name
                """), {"index_name": index_name})
                
                if result.scalar():
                    existing_indices.append(index_name)
                    print(f"[index-fix] ✅ Index {index_name} already exists")
                else:
                    print(f"[index-fix] ❌ Index {index_name} does not exist")
            
            # Handle different migration version scenarios
            if existing_indices:
                if current_version == 'c613d13854de':
                    print(f"[index-fix] Indices already exist, marking migration 756c4fde7a1b as complete...")
                    # Update alembic version to skip the problematic migration
                    await conn.execute(text("""
                        UPDATE alembic_version 
                        SET version_num = '756c4fde7a1b'
                    """))
                    print("[index-fix] ✅ Migration marked as complete")
                    return True
                elif current_version == '9a5f9ae2bf74':
                    print(f"[index-fix] Already at newer version, setting correct version to 756c4fde7a1b...")
                    # Update to the correct intermediate version
                    await conn.execute(text("""
                        UPDATE alembic_version 
                        SET version_num = '756c4fde7a1b'
                    """))
                    print("[index-fix] ✅ Migration version corrected")
                    return True
                else:
                    print(f"[index-fix] At version {current_version}, indices exist - no action needed")
                    return True
            
            # Check if we need to add the category column to surveys
            result = await conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'surveys' AND column_name = 'category'
            """))
            
            if not result.scalar():
                print("[index-fix] Adding missing category column to surveys...")
                await conn.execute(text("""
                    ALTER TABLE surveys ADD COLUMN category VARCHAR(100)
                """))
                print("[index-fix] ✅ Category column added")
            else:
                print("[index-fix] ✅ Category column already exists")
            
            print("[index-fix] ✅ Database state verified and fixed")
            return True
            
    except Exception as e:
        print(f"[index-fix] ❌ Error: {e}")
        return False

async def main():
    """Main function."""
    print("[index-fix] Starting index migration fix...")
    
    if await check_and_fix_indices():
        print("[index-fix] ✅ Index migration fix completed successfully")
        return 0
    else:
        print("[index-fix] ❌ Index migration fix failed")
        return 1

if __name__ == "__main__":
    exit(asyncio.run(main()))