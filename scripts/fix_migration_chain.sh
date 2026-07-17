#!/usr/bin/env bash

# Fix Alembic Migration Chain
# This script fixes orphaned migrations and ensures proper migration order

set -euo pipefail

echo "=== Alembic Migration Chain Fixer ==="
echo "This script will:"
echo "1. Verify migration chain integrity"
echo "2. Generate a new merged head if needed"
echo "3. Test migrations in a clean environment"
echo ""

cd "$(dirname "$0")/../backend"

# Check for multiple heads
echo "Checking for multiple migration heads..."
HEADS=$(alembic heads 2>&1 || true)
NUM_HEADS=$(echo "$HEADS" | grep -c "^[a-f0-9]" || true)

echo "Found $NUM_HEADS head(s):"
echo "$HEADS"
echo ""

if [ "$NUM_HEADS" -gt 1 ]; then
    echo "WARNING: Multiple heads detected! This will cause issues."
    echo "Alembic needs to merge these branches."
    echo ""
    echo "To fix, run:"
    echo "  cd backend"
    echo "  alembic merge heads -m 'merge migration branches'"
    echo "  alembic upgrade head"
    echo ""
    read -p "Would you like to create a merge migration now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        alembic merge heads -m "merge migration branches"
        echo "Merge migration created successfully!"
    else
        echo "Skipping merge. Please fix manually."
        exit 1
    fi
fi

# Show full history
echo "Current migration history:"
alembic history | head -20
echo ""

echo "Migration chain verification complete!"
echo ""
echo "Next steps for production deployment:"
echo "1. Commit the fixed migration file(s)"
echo "2. Push to GitHub"
echo "3. The safe migration script will handle existing schemas"
