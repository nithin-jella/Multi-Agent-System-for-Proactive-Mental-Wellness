#!/usr/bin/env bash

# Comprehensive Migration Audit Script
# This script checks for all potential migration issues

set -euo pipefail

echo "╔════════════════════════════════════════════════════════════╗"
echo "║       Alembic Migration Audit - Comprehensive Check       ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

cd "$(dirname "$0")/../backend"

AUDIT_PASSED=true

# Check 1: Single Head
echo "📋 Check 1: Verifying single migration head..."
HEADS_OUTPUT=$(alembic heads 2>&1)
NUM_HEADS=$(echo "$HEADS_OUTPUT" | grep -c "^[a-f0-9]" || true)

if [ "$NUM_HEADS" -eq 1 ]; then
    echo "   ✅ PASS: Single head found"
    echo "   Current head: $HEADS_OUTPUT"
else
    echo "   ❌ FAIL: Multiple heads found ($NUM_HEADS)"
    echo "$HEADS_OUTPUT"
    AUDIT_PASSED=false
fi
echo ""

# Check 2: Root Migrations
echo "📋 Check 2: Verifying single root migration..."
ROOT_COUNT=$(grep -l "down_revision = None" alembic/versions/*.py 2>/dev/null | wc -l)

if [ "$ROOT_COUNT" -eq 1 ]; then
    ROOT_FILE=$(grep -l "down_revision = None" alembic/versions/*.py)
    echo "   ✅ PASS: Single root migration found"
    echo "   Root: $(basename "$ROOT_FILE")"
elif [ "$ROOT_COUNT" -eq 0 ]; then
    echo "   ❌ FAIL: No root migration found"
    AUDIT_PASSED=false
else
    echo "   ❌ FAIL: Multiple root migrations found ($ROOT_COUNT)"
    grep -l "down_revision = None" alembic/versions/*.py | while read -r file; do
        echo "      - $(basename "$file")"
    done
    AUDIT_PASSED=false
fi
echo ""

# Check 3: Duplicate Table Creations
echo "📋 Check 3: Checking for duplicate table creations..."
python3 << 'PYEOF'
import os
import re
from collections import defaultdict

migrations_dir = "alembic/versions"
table_creations = defaultdict(list)
table_drops = defaultdict(list)

for filename in sorted(os.listdir(migrations_dir)):
    if filename.endswith('.py'):
        filepath = os.path.join(migrations_dir, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
            # Find all create_table statements
            matches = re.findall(r"op\.create_table\(['\"]([^'\"]+)['\"]", content)
            for table_name in matches:
                table_creations[table_name].append(filename)
            
            # Find all drop_table statements
            matches = re.findall(r"op\.drop_table\(['\"]([^'\"]+)['\"]", content)
            for table_name in matches:
                table_drops[table_name].append(filename)

# Check for problematic duplicates
has_issues = False
for table, files in sorted(table_creations.items()):
    if len(files) > 1:
        # Check if table is dropped between creations
        drop_files = table_drops.get(table, [])
        if drop_files:
            print(f"   ⚠️  Table '{table}' created multiple times (with drops):")
            for f in files:
                print(f"      CREATE: {f}")
            for f in drop_files:
                print(f"      DROP:   {f}")
            print(f"      This is OK if drop happens before second create")
        else:
            print(f"   ❌ Table '{table}' created in multiple migrations WITHOUT drops:")
            for f in files:
                print(f"      - {f}")
            has_issues = True

if not has_issues:
    print("   ✅ PASS: No duplicate table creations without proper drops")
else:
    exit(1)
PYEOF

if [ $? -ne 0 ]; then
    AUDIT_PASSED=false
fi
echo ""

# Check 4: Migration Chain Integrity
echo "📋 Check 4: Verifying migration chain integrity..."
if alembic history > /dev/null 2>&1; then
    echo "   ✅ PASS: Migration chain is valid"
else
    echo "   ❌ FAIL: Migration chain has errors"
    AUDIT_PASSED=false
fi
echo ""

# Check 5: Down Revisions Reference Valid Migrations
echo "📋 Check 5: Checking down_revision references..."
python3 << 'PYEOF'
import os
import re

migrations_dir = "alembic/versions"
all_revisions = set()
all_down_revisions = {}

# First pass: collect all revisions
for filename in os.listdir(migrations_dir):
    if filename.endswith('.py'):
        filepath = os.path.join(migrations_dir, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            # Find revision (handle both with and without type hints)
            match = re.search(r"^revision\s*:?\s*\w*\s*=\s*['\"]([^'\"]+)['\"]", content, re.MULTILINE)
            if match:
                all_revisions.add(match.group(1))

# Second pass: check down_revisions
has_issues = False
for filename in os.listdir(migrations_dir):
    if filename.endswith('.py'):
        filepath = os.path.join(migrations_dir, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
            # Find revision (handle both with and without type hints)
            rev_match = re.search(r"^revision\s*:?\s*\w*\s*=\s*['\"]([^'\"]+)['\"]", content, re.MULTILINE)
            if not rev_match:
                continue
            
            revision = rev_match.group(1)
            
            # Find down_revision (handle both with and without type hints)
            down_match = re.search(r"^down_revision\s*:?\s*\w*\s*=\s*['\"]([^'\"]+)['\"]", content, re.MULTILINE)
            if down_match:
                down_rev = down_match.group(1)
                if down_rev not in all_revisions:
                    print(f"   ❌ {filename}:")
                    print(f"      down_revision '{down_rev}' not found in any migration")
                    has_issues = True

if not has_issues:
    print("   ✅ PASS: All down_revision references are valid")
else:
    exit(1)
PYEOF

if [ $? -ne 0 ]; then
    AUDIT_PASSED=false
fi
echo ""

# Check 6: Show Migration Tree
echo "📋 Check 6: Migration tree (last 15 entries)..."
alembic history | head -15 | while read -r line; do
    echo "   $line"
done
echo ""

# Final Summary
echo "╔════════════════════════════════════════════════════════════╗"
if [ "$AUDIT_PASSED" = true ]; then
    echo "║                  ✅ ALL CHECKS PASSED                      ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    echo "🎉 Migration chain is healthy and ready for deployment!"
    exit 0
else
    echo "║                  ❌ AUDIT FAILED                           ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    echo "⚠️  Please fix the issues above before deploying."
    exit 1
fi
