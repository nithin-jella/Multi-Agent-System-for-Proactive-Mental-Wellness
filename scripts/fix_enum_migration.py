#!/usr/bin/env python3
"""
Python-based enum migration fixer for UGM-AICare
This script resolves the agent_name_enum duplication error
"""

import asyncio
import os
import sys
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

try:
    from sqlalchemy import text
    from app.database import async_engine, AsyncSessionLocal
except ImportError as e:
    print(f"ERROR: Could not import required modules: {e}")
    print("Make sure you're running this from the project root and the backend dependencies are installed")
    sys.exit(1)


async def check_enum_usage():
    """Check which tables are using the problematic enums"""
    print("Checking enum usage in database...")
    
    async with async_engine.begin() as conn:
        # Check existing enum types
        result = await conn.execute(text("""
            SELECT 
                t.typname,
                array_agg(e.enumlabel ORDER BY e.enumsortorder) as enum_values
            FROM pg_type t
            LEFT JOIN pg_enum e ON t.oid = e.enumtypid
            WHERE t.typname LIKE '%enum'
            GROUP BY t.typname
            ORDER BY t.typname;
        """))
        
        print("\nExisting enum types:")
        for row in result:
            print(f"  {row.typname}: {row.enum_values}")
    
        # Check table usage
        result = await conn.execute(text("""
            SELECT 
                c.table_name,
                c.column_name,
                c.udt_name
            FROM information_schema.columns c
            WHERE c.udt_name LIKE '%enum'
            ORDER BY c.udt_name, c.table_name;
        """))
        
        print("\nTables using enum types:")
        for row in result:
            print(f"  {row.table_name}.{row.column_name} -> {row.udt_name}")


async def fix_enum_duplications():
    """Attempt to fix enum duplication issues"""
    print("\nAttempting to fix enum duplications...")
    
    enums_to_check = [
        'agent_name_enum',
        'message_role_enum', 
        'consent_scope_enum',
        'case_status_enum',
        'case_severity_enum',
        'agent_role_enum'
    ]
    
    async with async_engine.begin() as conn:
        for enum_name in enums_to_check:
            try:
                # Check if enum exists
                result = await conn.execute(text(
                    "SELECT 1 FROM pg_type WHERE typname = :enum_name"
                ), {"enum_name": enum_name})
                
                if result.fetchone():
                    # Check if it's being used
                    result = await conn.execute(text("""
                        SELECT COUNT(*) as usage_count
                        FROM information_schema.columns 
                        WHERE udt_name = :enum_name
                    """), {"enum_name": enum_name})
                    
                    usage_count = result.scalar()
                    
                    if usage_count == 0:
                        # Safe to drop
                        await conn.execute(text(f"DROP TYPE IF EXISTS {enum_name} CASCADE"))
                        print(f"✅ Dropped unused enum: {enum_name}")
                    else:
                        print(f"⚠️  Enum {enum_name} is in use by {usage_count} columns, keeping it")
                else:
                    print(f"ℹ️  Enum {enum_name} does not exist")
                    
            except Exception as e:
                print(f"❌ Error processing {enum_name}: {e}")


async def check_alembic_status():
    """Check current Alembic migration status"""
    print("\nChecking Alembic migration status...")
    
    # Check if alembic_version table exists and what the current revision is
    async with async_engine.begin() as conn:
        try:
            # Check current revision
            result = await conn.execute(text(
                "SELECT version_num FROM alembic_version LIMIT 1"
            ))
            current_revision = result.scalar()
            print(f"Current revision: {current_revision}")
            
            # Check if the problematic revision is the target
            target_revision = "9a5f9ae2bf74"
            if current_revision == target_revision:
                print("✅ Already at target revision!")
                return True
            else:
                print(f"Need to migrate from {current_revision} to {target_revision}")
                return False
                
        except Exception as e:
            print(f"Error checking Alembic status: {e}")
            return False


async def mark_migration_complete():
    """Mark the problematic migration as complete if schema is correct"""
    print("\nMarking migration as complete...")
    
    async with async_engine.begin() as conn:
        try:
            # Update the alembic version to the target
            await conn.execute(text(
                "UPDATE alembic_version SET version_num = :version"
            ), {"version": "9a5f9ae2bf74"})
            print("✅ Marked migration 9a5f9ae2bf74 as complete")
            return True
        except Exception as e:
            print(f"❌ Error marking migration complete: {e}")
            return False


async def main():
    """Main execution function"""
    print("🔧 UGM-AICare Enum Migration Fixer")
    print("=" * 50)
    
    try:
        # Step 1: Check current state
        await check_enum_usage()
        
        # Step 2: Check if we're already at the target revision
        if await check_alembic_status():
            print("✅ Migration already complete!")
            return
        
        # Step 3: Attempt to fix enum duplications
        await fix_enum_duplications()
        
        # Step 4: Ask user if they want to mark migration as complete
        print("\n" + "=" * 50)
        response = input("Do you want to mark the migration as complete? (y/N): ")
        
        if response.lower() in ['y', 'yes']:
            if await mark_migration_complete():
                print("✅ Migration marked as complete!")
                print("\nYou can now run the normal migration script:")
                print("  ./run_migrations.sh")
            else:
                print("❌ Failed to mark migration as complete")
        else:
            print("Migration not marked as complete.")
            print("\nTo manually run the migration, try:")
            print("  cd backend && alembic upgrade head")
            print("\nOr to force mark it complete:")
            print("  cd backend && alembic stamp 9a5f9ae2bf74")
    
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return 1
    
    return 0


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)