#!/usr/bin/env bash

# Test the fixed migration chain
set -euo pipefail

echo "=== Testing Migration Chain Fix ==="
echo ""

cd "$(dirname "$0")/../backend"

# 1. Verify single head
echo "1. Checking for single migration head..."
HEADS_OUTPUT=$(alembic heads 2>&1)
NUM_HEADS=$(echo "$HEADS_OUTPUT" | grep -c "^[a-f0-9]" || true)

if [ "$NUM_HEADS" -eq 1 ]; then
    echo "   ✅ PASS: Single head found"
    echo "   Current head: $HEADS_OUTPUT"
else
    echo "   ❌ FAIL: Multiple heads found ($NUM_HEADS)"
    echo "$HEADS_OUTPUT"
    exit 1
fi
echo ""

# 2. Verify only ONE orphaned migration (the root)
echo "2. Checking for orphaned migrations (down_revision = None)..."
ORPHANED_COUNT=$(grep -l "down_revision = None" alembic/versions/*.py | wc -l)

if [ "$ORPHANED_COUNT" -eq 1 ]; then
    ROOT_FILE=$(grep -l "down_revision = None" alembic/versions/*.py)
    echo "   ✅ PASS: Only one root migration found"
    echo "   Root migration: $(basename $ROOT_FILE)"
elif [ "$ORPHANED_COUNT" -eq 0 ]; then
    echo "   ❌ FAIL: No root migration found (need at least one)"
    exit 1
else
    echo "   ❌ FAIL: Multiple orphaned migrations found ($ORPHANED_COUNT)"
    echo "   Files:"
    grep -l "down_revision = None" alembic/versions/*.py
    exit 1
fi
echo ""

# 3. Verify migration chain integrity
echo "3. Verifying migration chain integrity..."
if alembic history > /dev/null 2>&1; then
    echo "   ✅ PASS: Migration chain is valid"
else
    echo "   ❌ FAIL: Migration chain has errors"
    exit 1
fi
echo ""

# 4. Show migration tree
echo "4. Migration tree (last 10):"
alembic history | head -10
echo ""

echo "=== All Tests Passed! ✅ ==="
echo ""
echo "Migration chain is fixed and ready for deployment."
echo ""
echo "Next steps:"
echo "  1. Commit changes: git add -A && git commit -m 'fix: resolve migration chain'"
echo "  2. Push to GitHub: git push origin main"
echo "  3. Deploy will use migrate-safe.sh automatically"
