#!/usr/bin/env python3
"""
Complete automated migration fixer.
Adds idempotency checks to ALL Alembic migrations.
"""

import re
import os
from pathlib import Path
from typing import List, Dict

VERSIONS_DIR = Path(__file__).parent / "versions"
HELPER_IMPORT = "from alembic import op\nimport sqlalchemy as sa\nfrom migration_helpers import (\n    table_exists,\n    column_exists,\n    index_exists,\n    constraint_exists,\n    add_column_if_not_exists,\n    drop_column_if_exists,\n    create_index_if_not_exists,\n    drop_index_if_exists,\n)\n"

def should_skip_migration(filename: str) -> bool:
    """Check if migration should be skipped."""
    skip_patterns = [
        "__pycache__",
        ".pyc",
        "initial_migration",  # Usually safe
    ]
    return any(p in filename for p in skip_patterns)

def get_upgrade_function_content(content: str) -> tuple[str, int, int]:
    """Extract upgrade function content and its position."""
    pattern = r'def upgrade\(\).*?:(.*?)(?=\ndef downgrade|$)'
    match = re.search(pattern, content, re.DOTALL)
    if match:
        return match.group(1), match.start(1), match.end(1)
    return "", 0, 0

def fix_add_column(content: str) -> str:
    """Fix op.add_column() calls."""
    pattern = r"op\.add_column\(\s*['\"](\w+)['\"]\s*,\s*sa\.Column\(\s*['\"](\w+)['\"]\s*,"
    
    def replace_func(match):
        table = match.group(1)
        column = match.group(2)
        full_match = match.group(0)
        
        # Find the complete add_column statement
        start_pos = match.start()
        end_pos = match.end()
        paren_count = 1
        i = end_pos
        while i < len(content) and paren_count > 0:
            if content[i] == '(':
                paren_count += 1
            elif content[i] == ')':
                paren_count -= 1
            i += 1
        
        full_statement = content[start_pos:i]
        indent = len(match.string[match.start():match.start()]) - len(match.string[match.start():match.start()].lstrip())
        
        replacement = f"""if not column_exists('{table}', '{column}'):
        {full_statement}"""
        
        return replacement
    
    return re.sub(pattern, replace_func, content)

def fix_create_table(content: str) -> str:
    """Fix op.create_table() calls."""
    pattern = r"(\s*)op\.create_table\(\s*['\"](\w+)['\"]"
    
    def replace_func(match):
        indent = match.group(1)
        table = match.group(2)
        
        # Find complete create_table statement
        start_pos = match.start()
        end_pos = match.end()
        paren_count = 1
        i = end_pos
        while i < len(content) and paren_count > 0:
            if content[i] == '(':
                paren_count += 1
            elif content[i] == ')':
                paren_count -= 1
            i += 1
        
        full_statement = content[start_pos:i].lstrip()
        
        replacement = f"""{indent}if not table_exists('{table}'):
{indent}    {full_statement}"""
        
        return replacement
    
    return re.sub(pattern, replace_func, content)

def fix_create_index(content: str) -> str:
    """Fix op.create_index() calls."""
    pattern = r"(\s*)op\.create_index\(\s*['\"](\w+)['\"]"
    
    def replace_func(match):
        indent = match.group(1)
        index_name = match.group(2)
        
        # Find complete create_index statement
        start_pos = match.start()
        end_pos = match.end()
        paren_count = 1
        i = end_pos
        while i < len(content) and paren_count > 0:
            if content[i] == '(':
                paren_count += 1
            elif content[i] == ')':
                paren_count -= 1
            i += 1
        
        full_statement = content[start_pos:i].lstrip()
        
        replacement = f"""{indent}if not index_exists('{index_name}'):
{indent}    {full_statement}"""
        
        return replacement
    
    return re.sub(pattern, replace_func, content)

def fix_drop_column(content: str) -> str:
    """Fix op.drop_column() calls."""
    pattern = r"(\s*)op\.drop_column\(\s*['\"](\w+)['\"]\s*,\s*['\"](\w+)['\"]"
    
    def replace_func(match):
        indent = match.group(1)
        table = match.group(2)
        column = match.group(3)
        
        replacement = f"""{indent}if column_exists('{table}', '{column}'):
{indent}    op.drop_column('{table}', '{column}')"""
        
        return replacement
    
    return re.sub(pattern, replace_func, content)

def fix_drop_table(content: str) -> str:
    """Fix op.drop_table() calls."""
    pattern = r"(\s*)op\.drop_table\(\s*['\"](\w+)['\"]"
    
    def replace_func(match):
        indent = match.group(1)
        table = match.group(2)
        
        replacement = f"""{indent}if table_exists('{table}'):
{indent}    op.drop_table('{table}')"""
        
        return replacement
    
    return re.sub(pattern, replace_func, content)

def fix_drop_index(content: str) -> str:
    """Fix op.drop_index() calls."""
    pattern = r"(\s*)op\.drop_index\(\s*['\"](\w+)['\"]"
    
    def replace_func(match):
        indent = match.group(1)
        index_name = match.group(2)
        
        replacement = f"""{indent}if index_exists('{index_name}'):
{indent}    op.drop_index('{index_name}')"""
        
        return replacement
    
    return re.sub(pattern, replace_func, content)

def ensure_helper_import(content: str) -> str:
    """Ensure migration_helpers are imported."""
    if "from migration_helpers import" in content:
        return content
    
    # Find where to insert import
    import_pattern = r"(from alembic import op\nimport sqlalchemy as sa)"
    match = re.search(import_pattern, content)
    
    if match:
        # Replace basic imports with enhanced imports
        return content.replace(match.group(1), HELPER_IMPORT.strip())
    
    return content

def fix_migration_file(filepath: Path) -> Dict[str, any]:
    """Fix a single migration file."""
    result = {
        "file": filepath.name,
        "fixed": False,
        "changes": [],
        "error": None
    }
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            original = f.read()
        
        content = original
        
        # Count operations before
        before_counts = {
            "add_column": len(re.findall(r"op\.add_column", content)),
            "create_table": len(re.findall(r"op\.create_table", content)),
            "create_index": len(re.findall(r"op\.create_index", content)),
            "drop_column": len(re.findall(r"op\.drop_column", content)),
            "drop_table": len(re.findall(r"op\.drop_table", content)),
            "drop_index": len(re.findall(r"op\.drop_index", content)),
        }
        
        # Apply fixes
        content = ensure_helper_import(content)
        content = fix_add_column(content)
        content = fix_create_table(content)
        content = fix_create_index(content)
        content = fix_drop_column(content)
        content = fix_drop_table(content)
        content = fix_drop_index(content)
        
        # Count checks added
        after_counts = {
            "column_exists": len(re.findall(r"if not column_exists", content)),
            "table_exists": len(re.findall(r"if not table_exists", content)),
            "index_exists": len(re.findall(r"if not index_exists", content)),
            "drop_checks": len(re.findall(r"if (column|table|index)_exists.*:\s*op\.drop", content)),
        }
        
        if content != original:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            
            result["fixed"] = True
            result["changes"] = [
                f"Added {after_counts['column_exists']} column existence checks",
                f"Added {after_counts['table_exists']} table existence checks",
                f"Added {after_counts['index_exists']} index existence checks",
                f"Added {after_counts['drop_checks']} drop checks",
            ]
            
    except Exception as e:
        result["error"] = str(e)
    
    return result

def main():
    """Main execution."""
    print("=" * 80)
    print("AUTOMATED MIGRATION FIXER")
    print("=" * 80)
    print()
    
    if not VERSIONS_DIR.exists():
        print(f"❌ Versions directory not found: {VERSIONS_DIR}")
        return
    
    migrations = sorted([
        f for f in VERSIONS_DIR.glob("*.py")
        if not should_skip_migration(f.name)
    ])
    
    print(f"Found {len(migrations)} migration files to check\n")
    
    results = []
    fixed_count = 0
    error_count = 0
    
    for migration in migrations:
        print(f"Processing: {migration.name}...", end=" ")
        result = fix_migration_file(migration)
        results.append(result)
        
        if result["error"]:
            print(f"❌ ERROR: {result['error']}")
            error_count += 1
        elif result["fixed"]:
            print("✅ FIXED")
            fixed_count += 1
            for change in result["changes"]:
                print(f"  - {change}")
        else:
            print("✓ Already OK")
    
    print()
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Total migrations: {len(migrations)}")
    print(f"Fixed: {fixed_count}")
    print(f"Already OK: {len(migrations) - fixed_count - error_count}")
    print(f"Errors: {error_count}")
    print()
    
    if fixed_count > 0:
        print("✅ Migrations have been fixed!")
        print()
        print("NEXT STEPS:")
        print("1. Review the changes in git diff")
        print("2. Run: python alembic/validate_migrations.py")
        print("3. Rebuild containers: ./dev.sh rebuild-clean")
        print("4. Test migrations: alembic upgrade head")
    else:
        print("All migrations are already idempotent!")
    
    if error_count > 0:
        print()
        print("⚠️  Some migrations had errors. Review manually.")

if __name__ == "__main__":
    main()
