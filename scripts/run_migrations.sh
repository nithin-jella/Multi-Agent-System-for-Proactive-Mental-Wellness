#!/usr/bin/env bash

set -euo pipefail

# Migration script for UGM-AICare
# Loads configuration from project root .env file
# Usage: ./run_migrations.sh [--help] [--debug] [--fix-enums]

if [[ "${1:-}" == "--help" ]]; then
    echo "UGM-AICare Database Migration Script"
    echo "Usage: $0 [--help] [--debug] [--fix-enums]"
    echo ""
    echo "This script:"
    echo "  1. Loads environment variables from project root .env file"
    echo "  2. Dumps current database schema (if pg_dump available)"
    echo "  3. Runs Alembic database migrations"
    echo "  4. Executes data backfill scripts"
    echo "  5. Verifies row counts in key tables"
    echo ""
    echo "Environment variables loaded from .env:"
    echo "  - DATABASE_URL (required)"
    echo "  - BACKEND_DIR (optional, defaults to ROOT_DIR/backend)"
    echo "  - ARTIFACTS_DIR (optional, defaults to ROOT_DIR/artifacts)"
    echo ""
    echo "Options:"
    echo "  --help       Show this help message"
    echo "  --debug      Enable debug mode for troubleshooting"
    echo "  --fix-enums  Fix enum duplication issues before running migrations"
    echo ""
    exit 0
fi

# Handle command line arguments
FIX_ENUMS=false
for arg in "$@"; do
    case $arg in
        --debug)
            export DEBUG=1
            ;;
        --fix-enums)
            FIX_ENUMS=true
            ;;
    esac
done

# Function to load environment variables from .env file
load_env() {
    local env_file="$1"
    if [[ -f "$env_file" ]]; then
        echo "[migrations] Loading environment from $env_file"
        # Export variables from .env file, ignoring comments and empty lines
        # Remove leading/trailing whitespace and normalize equals signs
        set -a
        source <(grep -E '^[^#]*=' "$env_file" | sed -E 's/^[[:space:]]*//; s/[[:space:]]*$//; s/[[:space:]]*=[[:space:]]*/=/' | sed 's/^/export /')
        set +a
    else
        echo "[migrations] Warning: .env file not found at $env_file"
        return 1
    fi
}

# Function to validate required directories
validate_directories() {
    if [[ ! -d "$BACKEND_DIR" ]]; then
        echo "$LOG_PREFIX ERROR: Backend directory not found: $BACKEND_DIR" >&2
        exit 1
    fi
    
    if [[ ! -f "$ALEMBIC_INI" ]]; then
        echo "$LOG_PREFIX ERROR: Alembic configuration not found: $ALEMBIC_INI" >&2
        exit 1
    fi
}

# Determine project root and load environment
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

# Load environment variables from project root .env
if ! load_env "$ENV_FILE"; then
    echo "[migrations] ERROR: Failed to load environment from $ENV_FILE" >&2
    echo "[migrations] Please ensure the .env file exists in the project root" >&2
    exit 1
fi

# Set directory paths (with .env fallbacks)
BACKEND_DIR="${BACKEND_DIR:-$ROOT_DIR/backend}"
ARTIFACTS_DIR="${ARTIFACTS_DIR:-$ROOT_DIR/artifacts}"
ALEMBIC_INI="$BACKEND_DIR/alembic.ini"
REPORT_FILE="$ARTIFACTS_DIR/migration_report.md"
SCHEMA_DUMP="$ARTIFACTS_DIR/pre_migration_schema.sql"
LOG_PREFIX="[migrations]"

# Create artifacts directory and validate setup
mkdir -p "$ARTIFACTS_DIR"
validate_directories

echo "$LOG_PREFIX Starting migration routine" | tee "$REPORT_FILE"
echo "$LOG_PREFIX Using ROOT_DIR: $ROOT_DIR" | tee -a "$REPORT_FILE"
echo "$LOG_PREFIX Using BACKEND_DIR: $BACKEND_DIR" | tee -a "$REPORT_FILE"
echo "$LOG_PREFIX Using ARTIFACTS_DIR: $ARTIFACTS_DIR" | tee -a "$REPORT_FILE"

# Debug mode: show additional environment info if DEBUG is set
if [[ "${DEBUG:-}" == "1" ]]; then
    echo "$LOG_PREFIX Debug mode enabled" | tee -a "$REPORT_FILE"
    echo "$LOG_PREFIX ENV_FILE: $ENV_FILE" | tee -a "$REPORT_FILE"
    echo "$LOG_PREFIX ALEMBIC_INI: $ALEMBIC_INI" | tee -a "$REPORT_FILE"
    echo "$LOG_PREFIX APP_ENV: ${APP_ENV:-not set}" | tee -a "$REPORT_FILE"
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "$LOG_PREFIX ERROR: DATABASE_URL environment variable is required" | tee -a "$REPORT_FILE"
  echo "$LOG_PREFIX Please ensure DATABASE_URL is set in $ENV_FILE" | tee -a "$REPORT_FILE"
  exit 1
fi

echo "$LOG_PREFIX Using DATABASE_URL: ${DATABASE_URL%@*}@***" | tee -a "$REPORT_FILE" # Hide password in logs

# Function to fix enum duplication issues
fix_enum_duplications() {
    echo "$LOG_PREFIX Checking for existing enum types..." | tee -a "$REPORT_FILE"
    
    # Create SQL to check and potentially drop existing enums
    cat > "$ARTIFACTS_DIR/check_enums.sql" << 'EOF'
-- Check existing enum types
SELECT 
    t.typname,
    array_agg(e.enumlabel ORDER BY e.enumsortorder) as enum_values,
    COUNT(*) as value_count
FROM pg_type t
LEFT JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname IN ('agent_name_enum', 'message_role_enum', 'consent_scope_enum', 'case_status_enum', 'case_severity_enum', 'agent_role_enum')
GROUP BY t.typname
ORDER BY t.typname;
EOF

    echo "$LOG_PREFIX Current enum types in database:" | tee -a "$REPORT_FILE"
    if command -v psql >/dev/null 2>&1; then
        psql "$DATABASE_URL" -f "$ARTIFACTS_DIR/check_enums.sql" 2>&1 | tee -a "$REPORT_FILE"
        
        # Create a more aggressive fix script
        cat > "$ARTIFACTS_DIR/fix_enum_conflicts.sql" << 'EOF'
-- Drop existing enum types if they exist (this will only work if no tables are using them)
DO $$ 
BEGIN
    -- Try to drop each enum type, ignore errors if they don't exist or are in use
    BEGIN
        DROP TYPE IF EXISTS agent_name_enum CASCADE;
        RAISE NOTICE 'Dropped agent_name_enum';
    EXCEPTION 
        WHEN dependent_objects_still_exist THEN
            RAISE NOTICE 'agent_name_enum is in use, cannot drop';
        WHEN OTHERS THEN
            RAISE NOTICE 'Could not drop agent_name_enum: %', SQLERRM;
    END;
    
    BEGIN
        DROP TYPE IF EXISTS message_role_enum CASCADE;
        RAISE NOTICE 'Dropped message_role_enum';
    EXCEPTION 
        WHEN dependent_objects_still_exist THEN
            RAISE NOTICE 'message_role_enum is in use, cannot drop';
        WHEN OTHERS THEN
            RAISE NOTICE 'Could not drop message_role_enum: %', SQLERRM;
    END;
    
    -- Add other enum types as needed
    BEGIN
        DROP TYPE IF EXISTS consent_scope_enum CASCADE;
        RAISE NOTICE 'Dropped consent_scope_enum';
    EXCEPTION 
        WHEN dependent_objects_still_exist THEN
            RAISE NOTICE 'consent_scope_enum is in use, cannot drop';
        WHEN OTHERS THEN
            RAISE NOTICE 'Could not drop consent_scope_enum: %', SQLERRM;
    END;
    
    BEGIN
        DROP TYPE IF EXISTS case_status_enum CASCADE;
        RAISE NOTICE 'Dropped case_status_enum';
    EXCEPTION 
        WHEN dependent_objects_still_exist THEN
            RAISE NOTICE 'case_status_enum is in use, cannot drop';
        WHEN OTHERS THEN
            RAISE NOTICE 'Could not drop case_status_enum: %', SQLERRM;
    END;
    
    BEGIN
        DROP TYPE IF EXISTS case_severity_enum CASCADE;
        RAISE NOTICE 'Dropped case_severity_enum';
    EXCEPTION 
        WHEN dependent_objects_still_exist THEN
            RAISE NOTICE 'case_severity_enum is in use, cannot drop';
        WHEN OTHERS THEN
            RAISE NOTICE 'Could not drop case_severity_enum: %', SQLERRM;
    END;
    
    BEGIN
        DROP TYPE IF EXISTS agent_role_enum CASCADE;
        RAISE NOTICE 'Dropped agent_role_enum';
    EXCEPTION 
        WHEN dependent_objects_still_exist THEN
            RAISE NOTICE 'agent_role_enum is in use, cannot drop';
        WHEN OTHERS THEN
            RAISE NOTICE 'Could not drop agent_role_enum: %', SQLERRM;
    END;
END $$;
EOF
        
        echo "$LOG_PREFIX Attempting to fix enum conflicts..." | tee -a "$REPORT_FILE"
        psql "$DATABASE_URL" -f "$ARTIFACTS_DIR/fix_enum_conflicts.sql" 2>&1 | tee -a "$REPORT_FILE"
        
    else
        echo "$LOG_PREFIX psql not available, cannot check enum status" | tee -a "$REPORT_FILE"
    fi
}

# Fix enum issues if requested
if [[ "$FIX_ENUMS" == true ]]; then
    fix_enum_duplications
fi

if command -v pg_dump >/dev/null 2>&1; then
  echo "$LOG_PREFIX Dumping current schema" | tee -a "$REPORT_FILE"
  pg_dump --schema-only "$DATABASE_URL" >"$SCHEMA_DUMP"
else
  echo "$LOG_PREFIX pg_dump not available, skipping schema dump" | tee -a "$REPORT_FILE"
fi

echo "$LOG_PREFIX Running alembic upgrade" | tee -a "$REPORT_FILE"

# Function to handle migration errors
handle_migration_error() {
    local exit_code=$1
    local error_log="$ARTIFACTS_DIR/migration_error.log"
    
    if [[ $exit_code -ne 0 ]]; then
        echo "$LOG_PREFIX Migration failed with exit code $exit_code" | tee -a "$REPORT_FILE"
        
        # Check if it's any duplication error (index, column, enum)
        if grep -q "already exists" "$error_log" 2>/dev/null; then
            echo "$LOG_PREFIX Detected duplication error - attempting comprehensive fix" | tee -a "$REPORT_FILE"
            
            if [[ -f "$ROOT_DIR/scripts/fix_migration_comprehensive.py" ]]; then
                echo "$LOG_PREFIX Running comprehensive migration fix..." | tee -a "$REPORT_FILE"
                cd "$ROOT_DIR"
                if python "scripts/fix_migration_comprehensive.py" 2>&1 | tee -a "$REPORT_FILE"; then
                    echo "$LOG_PREFIX ✅ Comprehensive fix completed successfully" | tee -a "$REPORT_FILE"
                    return 0
                else
                    echo "$LOG_PREFIX ❌ Comprehensive fix failed" | tee -a "$REPORT_FILE"
                    return 1
                fi
            else
                echo "$LOG_PREFIX ❌ Comprehensive fix script not found" | tee -a "$REPORT_FILE"
                return 1
            fi
            
        # Check if it's a duplicate enum error (fallback)
        elif grep -q "agent_name_enum.*already exists" "$error_log" 2>/dev/null; then
            echo "$LOG_PREFIX Detected duplicate enum error - attempting recovery" | tee -a "$REPORT_FILE"
            
            if [[ -f "$ROOT_DIR/scripts/fix_enum_migration.py" ]]; then
                echo "$LOG_PREFIX Running enum migration fix..." | tee -a "$REPORT_FILE"
                cd "$ROOT_DIR"
                if python "scripts/fix_enum_migration.py" 2>&1 | tee -a "$REPORT_FILE"; then
                    echo "$LOG_PREFIX ✅ Enum fix completed successfully" | tee -a "$REPORT_FILE"
                    return 0
                else
                    echo "$LOG_PREFIX ❌ Enum fix failed" | tee -a "$REPORT_FILE"
                    return 1
                fi
            else
                echo "$LOG_PREFIX ❌ Enum fix script not found" | tee -a "$REPORT_FILE"
                return 1
            fi
        else
            echo "$LOG_PREFIX Unknown migration error occurred" | tee -a "$REPORT_FILE"
            return 1
        fi
    fi
    return 0
}

# Run the migration and capture errors
if ! (cd "$BACKEND_DIR" && alembic upgrade head 2>&1 | tee "$ARTIFACTS_DIR/migration_error.log"); then
    handle_migration_error $? || exit 1
fi

echo "$LOG_PREFIX Checking if backfill script can run..." | tee -a "$REPORT_FILE"

# Check if cases table exists before running backfill
cd "$BACKEND_DIR"
TABLE_CHECK_RESULT=$(python -c "
import asyncio
import sys
sys.path.append('.')

async def check_tables():
    try:
        from app.database import async_engine
        from sqlalchemy import text
        async with async_engine.begin() as conn:
            result = await conn.execute(text(\"\"\"
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_name = 'cases' AND table_schema = 'public'
            \"\"\"))
            return 'FOUND' if result.scalar() else 'MISSING'
    except Exception as e:
        return 'ERROR'

print(asyncio.run(check_tables()))
" 2>/dev/null)

if [[ "$TABLE_CHECK_RESULT" == "FOUND" ]]; then
    echo "$LOG_PREFIX Executing backfill script..." | tee -a "$REPORT_FILE"
    python "scripts/backfill_agent_data.py" | tee -a "$REPORT_FILE"
else
    echo "$LOG_PREFIX Skipping backfill script - cases table not available (status: $TABLE_CHECK_RESULT)" | tee -a "$REPORT_FILE"
fi

echo "$LOG_PREFIX Migration routine completed successfully" | tee -a "$REPORT_FILE"

# Verify final database state and generate summary
echo "$LOG_PREFIX Verifying row counts" | tee -a "$REPORT_FILE"
cd "$BACKEND_DIR" && python - <<'PY' | tee -a "$REPORT_FILE"
import asyncio
import sys
sys.path.append('.')

async def verify_db():
    try:
        from app.database import async_engine
        from sqlalchemy import text
        async with async_engine.begin() as conn:
            # Check alembic version
            result = await conn.execute(text('SELECT version_num FROM alembic_version'))
            version = result.scalar()
            print(f'[migrations] Current database version: {version}')
            
            # Check if key tables exist
            result = await conn.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_type = 'BASE TABLE'
                ORDER BY table_name
            """))
            tables = [row[0] for row in result.fetchall()]
            print(f'[migrations] Tables in database: {len(tables)}')
            for table in sorted(tables):
                print(f'[migrations]   - {table}')
                
    except Exception as e:
        print(f'[migrations] ❌ Database verification failed: {e}')
        return False
    return True

if not asyncio.run(verify_db()):
    exit(1)
PY

echo "$LOG_PREFIX ✅ Migration routine completed successfully" | tee -a "$REPORT_FILE"
exit 0

echo "$LOG_PREFIX Verifying row counts" | tee -a "$REPORT_FILE"
python - <<'PY' | tee -a "$REPORT_FILE"
import asyncio
from sqlalchemy import select, func
from app.database import AsyncSessionLocal
from app.models import Event, Message, Case, Consent

async def main():
    async with AsyncSessionLocal() as session:
        totals = {}
        for model in (Event, Message, Case, Consent):
            name = model.__tablename__
            result = await session.execute(select(func.count()).select_from(model))
            totals[name] = result.scalar_one()
        for table, count in totals.items():
            print(f"{table}: {count}")

asyncio.run(main())
PY

echo "$LOG_PREFIX Migration routine complete" | tee -a "$REPORT_FILE"
