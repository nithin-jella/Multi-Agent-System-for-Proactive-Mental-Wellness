#!/usr/bin/env python3
"""
Validate Alembic migrations for common issues.

This script checks for:
- Non-idempotent operations
- Missing existence checks
- Unnamed constraints
- Mixed schema/data changes
- Unsafe operations
"""

import os
import re
from pathlib import Path
from typing import List, Tuple

# ANSI color codes
RED = '\033[91m'
YELLOW = '\033[93m'
GREEN = '\033[92m'
BLUE = '\033[94m'
RESET = '\033[0m'


def find_migration_files() -> List[Path]:
    """Find all migration files in the versions directory."""
    versions_dir = Path(__file__).parent / "versions"
    if not versions_dir.exists():
        print(f"{RED}Error: versions directory not found at {versions_dir}{RESET}")
        return []
    
    return sorted([
        f for f in versions_dir.glob("*.py")
        if f.name != "__init__.py" and not f.name.startswith(".")
    ])


def check_idempotency(content: str, filename: str) -> List[Tuple[str, str]]:
    """Check for non-idempotent operations."""
    issues = []
    
    # Check for add_column without existence check
    if re.search(r'op\.add_column\([^)]+\)', content):
        if not re.search(r'column_exists|add_column_if_not_exists', content):
            issues.append((
                "WARNING",
                "Found op.add_column() without existence check. May fail if column exists."
            ))
    
    # Check for create_table without existence check
    if re.search(r'op\.create_table\([^)]+\)', content):
        if not re.search(r'table_exists|create_table_if_not_exists', content):
            issues.append((
                "WARNING",
                "Found op.create_table() without existence check. May fail if table exists."
            ))
    
    # Check for create_index without existence check
    if re.search(r'op\.create_index\([^)]+\)', content):
        if not re.search(r'index_exists|create_index_if_not_exists', content):
            issues.append((
                "INFO",
                "Found op.create_index() without existence check. Consider adding."
            ))
    
    # Check for drop operations without existence check
    if re.search(r'op\.drop_column\([^)]+\)', content):
        if not re.search(r'column_exists|drop_column_if_exists', content):
            issues.append((
                "INFO",
                "Found op.drop_column() without existence check."
            ))
    
    return issues


def check_constraint_names(content: str, filename: str) -> List[Tuple[str, str]]:
    """Check for unnamed constraints."""
    issues = []
    
    # Check for foreign keys with None name
    if re.search(r'op\.create_foreign_key\(None,', content):
        issues.append((
            "ERROR",
            "Found foreign key with None name. Always use explicit constraint names."
        ))
    
    # Check for unnamed foreign keys in create_table
    if re.search(r'sa\.ForeignKeyConstraint\([^)]+\)\s*(?!,\s*name=)', content):
        issues.append((
            "WARNING",
            "Found ForeignKeyConstraint without explicit name parameter."
        ))
    
    return issues


def check_mixed_operations(content: str, filename: str) -> List[Tuple[str, str]]:
    """Check for mixed schema and data operations."""
    issues = []
    
    # Look for data operations in schema_upgrade
    if 'def schema_upgrade()' in content or 'def upgrade()' in content:
        # Check for SQL execution in schema functions
        if re.search(r'(execute|INSERT|UPDATE|DELETE)\s*\(', content):
            if 'def data_upgrade()' not in content:
                issues.append((
                    "WARNING",
                    "Found data operations mixed with schema changes. Consider separating into data_upgrade()."
                ))
    
    return issues


def check_imports(content: str, filename: str) -> List[Tuple[str, str]]:
    """Check for required imports."""
    issues = []
    
    # Check if migration_helpers is imported when needed
    has_operations = any([
        'op.add_column' in content,
        'op.create_table' in content,
        'op.create_index' in content,
    ])
    
    if has_operations:
        if 'migration_helpers' not in content and 'inspector' not in content:
            issues.append((
                "INFO",
                "Consider importing migration_helpers for idempotent operations."
            ))
    
    return issues


def check_unsafe_operations(content: str, filename: str) -> List[Tuple[str, str]]:
    """Check for potentially unsafe operations."""
    issues = []
    
    # Check for column type changes without explicit existing_type
    if re.search(r'op\.alter_column\([^)]+type_=', content):
        if not re.search(r'existing_type=', content):
            issues.append((
                "WARNING",
                "Column type change without existing_type parameter. This may cause issues."
            ))
    
    # Check for DROP operations without CASCADE consideration
    if re.search(r'op\.drop_table\([^)]+\)', content):
        issues.append((
            "INFO",
            "Table drop detected. Ensure foreign key constraints are handled."
        ))
    
    return issues


def validate_migration(filepath: Path) -> Tuple[str, List[Tuple[str, str]]]:
    """Validate a single migration file."""
    try:
        content = filepath.read_text()
        
        all_issues = []
        all_issues.extend(check_idempotency(content, filepath.name))
        all_issues.extend(check_constraint_names(content, filepath.name))
        all_issues.extend(check_mixed_operations(content, filepath.name))
        all_issues.extend(check_imports(content, filepath.name))
        all_issues.extend(check_unsafe_operations(content, filepath.name))
        
        return filepath.name, all_issues
    except Exception as e:
        return filepath.name, [("ERROR", f"Failed to read file: {e}")]


def print_results(results: List[Tuple[str, List[Tuple[str, str]]]]):
    """Print validation results."""
    total_files = len(results)
    files_with_issues = sum(1 for _, issues in results if issues)
    
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}Migration Validation Report{RESET}")
    print(f"{BLUE}{'='*80}{RESET}\n")
    
    for filename, issues in results:
        if issues:
            print(f"{YELLOW}📄 {filename}{RESET}")
            for severity, message in issues:
                if severity == "ERROR":
                    print(f"  {RED}❌ ERROR: {message}{RESET}")
                elif severity == "WARNING":
                    print(f"  {YELLOW}⚠️  WARNING: {message}{RESET}")
                else:  # INFO
                    print(f"  {BLUE}ℹ️  INFO: {message}{RESET}")
            print()
    
    # Summary
    print(f"{BLUE}{'='*80}{RESET}")
    print(f"Total migrations checked: {total_files}")
    print(f"Migrations with issues: {files_with_issues}")
    print(f"Clean migrations: {total_files - files_with_issues}")
    
    if files_with_issues == 0:
        print(f"\n{GREEN}✅ All migrations look good!{RESET}")
    else:
        print(f"\n{YELLOW}⚠️  Some migrations need attention. See details above.{RESET}")
    
    print(f"{BLUE}{'='*80}{RESET}\n")


def main():
    """Main validation function."""
    print(f"\n{BLUE}🔍 Scanning migration files...{RESET}\n")
    
    migration_files = find_migration_files()
    if not migration_files:
        print(f"{RED}No migration files found!{RESET}")
        return
    
    print(f"Found {len(migration_files)} migration files\n")
    
    results = [validate_migration(f) for f in migration_files]
    print_results(results)


if __name__ == "__main__":
    main()
