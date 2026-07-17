#!/usr/bin/env python3
"""
Scan Alembic migrations for non-idempotent operations that could fail in production.

This script identifies migrations that:
1. Add columns without checking if they exist
2. Drop columns without checking if they exist  
3. Create tables without checking if they exist
4. Drop tables without checking if they exist
5. Create indexes without checking if they exist
6. Add foreign keys without checking if they exist
"""

import os
import re
from pathlib import Path
from typing import List, Dict, Tuple

# Patterns to detect non-idempotent operations
PATTERNS = {
    'add_column': r'op\.add_column\([^)]+\)',
    'drop_column': r'op\.drop_column\([^)]+\)',
    'create_table': r'op\.create_table\([^)]+',
    'drop_table': r'op\.drop_table\([^)]+\)',
    'create_index': r'op\.create_index\([^)]+',
    'drop_index': r'op\.drop_index\([^)]+',
    'create_foreign_key': r'op\.create_foreign_key\([^)]+',
    'drop_constraint': r'op\.drop_constraint\([^)]+',
}

# Patterns that indicate idempotent checks
IDEMPOTENT_PATTERNS = [
    r'if_exists\s*=\s*True',
    r'inspector\s*=\s*sa\.inspect',
    r'\.get_columns\(',
    r'\.get_table_names\(',
    r'\.get_indexes\(',
    r'\.get_foreign_keys\(',
    r'if\s+[\'"]?\w+[\'"]?\s+(not\s+)?in\s+',
]

def is_idempotent_check_present(content: str, op_line: str, line_num: int) -> bool:
    """Check if there's an idempotent check near the operation."""
    # Check 10 lines before the operation
    lines = content.split('\n')
    start = max(0, line_num - 10)
    context = '\n'.join(lines[start:line_num])
    
    for pattern in IDEMPOTENT_PATTERNS:
        if re.search(pattern, context, re.IGNORECASE):
            return True
    return False

def scan_migration_file(file_path: Path) -> Dict:
    """Scan a single migration file for non-idempotent operations."""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    issues = []
    lines = content.split('\n')
    
    for pattern_name, pattern in PATTERNS.items():
        matches = re.finditer(pattern, content)
        for match in matches:
            # Find line number
            line_num = content[:match.start()].count('\n')
            op_line = lines[line_num]
            
            # Check if there's an idempotent check
            has_check = is_idempotent_check_present(content, op_line, line_num)
            
            if not has_check:
                issues.append({
                    'operation': pattern_name,
                    'line': line_num + 1,
                    'code': op_line.strip(),
                    'severity': get_severity(pattern_name)
                })
    
    return {
        'file': file_path.name,
        'path': str(file_path),
        'issues': issues
    }

def get_severity(operation: str) -> str:
    """Determine severity of non-idempotent operation."""
    # High severity: operations that will fail on retry
    if operation in ['add_column', 'create_table', 'create_index', 'create_foreign_key']:
        return 'HIGH'
    # Medium severity: operations that might cause data loss
    elif operation in ['drop_column', 'drop_table']:
        return 'MEDIUM'
    # Low severity: operations that are usually safe
    else:
        return 'LOW'

def main():
    migrations_dir = Path('backend/alembic/versions')
    
    if not migrations_dir.exists():
        print(f"❌ Migrations directory not found: {migrations_dir}")
        return
    
    print("🔍 Scanning Alembic migrations for non-idempotent operations...\n")
    
    migration_files = sorted(migrations_dir.glob('*.py'))
    all_results = []
    
    for migration_file in migration_files:
        if migration_file.name == '__init__.py':
            continue
        
        result = scan_migration_file(migration_file)
        if result['issues']:
            all_results.append(result)
    
    # Report results
    if not all_results:
        print("✅ All migrations appear to be idempotent!")
        return
    
    print(f"⚠️  Found {len(all_results)} migrations with potential issues:\n")
    
    high_severity_count = 0
    medium_severity_count = 0
    low_severity_count = 0
    
    for result in all_results:
        high_issues = [i for i in result['issues'] if i['severity'] == 'HIGH']
        medium_issues = [i for i in result['issues'] if i['severity'] == 'MEDIUM']
        low_issues = [i for i in result['issues'] if i['severity'] == 'LOW']
        
        high_severity_count += len(high_issues)
        medium_severity_count += len(medium_issues)
        low_severity_count += len(low_issues)
        
        if high_issues:
            print(f"🔴 HIGH PRIORITY: {result['file']}")
            for issue in high_issues:
                print(f"   Line {issue['line']}: {issue['operation']}")
                print(f"   Code: {issue['code'][:80]}...")
            print()
    
    for result in all_results:
        medium_issues = [i for i in result['issues'] if i['severity'] == 'MEDIUM']
        if medium_issues:
            print(f"🟡 MEDIUM PRIORITY: {result['file']}")
            for issue in medium_issues:
                print(f"   Line {issue['line']}: {issue['operation']}")
            print()
    
    print("\n" + "="*80)
    print(f"📊 SUMMARY:")
    print(f"   🔴 High Severity Issues: {high_severity_count} (will fail on retry)")
    print(f"   🟡 Medium Severity Issues: {medium_severity_count} (potential data loss)")
    print(f"   ⚪ Low Severity Issues: {low_severity_count} (minor risk)")
    print(f"   📁 Total Migrations Affected: {len(all_results)}")
    print("="*80)
    
    print("\n💡 RECOMMENDATION:")
    print("   Make high-priority migrations idempotent by adding existence checks.")
    print("   See: docs/MIGRATION_IDEMPOTENT_FIX.md for examples and best practices.")
    
    # Save detailed report
    report_path = Path('docs/MIGRATION_SCAN_REPORT.md')
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write("# Migration Idempotency Scan Report\n\n")
        f.write(f"**Scan Date:** {os.popen('date').read().strip()}\n\n")
        f.write(f"## Summary\n\n")
        f.write(f"- 🔴 High Severity: {high_severity_count}\n")
        f.write(f"- 🟡 Medium Severity: {medium_severity_count}\n")
        f.write(f"- ⚪ Low Severity: {low_severity_count}\n")
        f.write(f"- 📁 Total Migrations: {len(all_results)}\n\n")
        
        f.write("## High Priority Migrations (Fix Immediately)\n\n")
        for result in all_results:
            high_issues = [i for i in result['issues'] if i['severity'] == 'HIGH']
            if high_issues:
                f.write(f"### `{result['file']}`\n\n")
                for issue in high_issues:
                    f.write(f"- **Line {issue['line']}**: `{issue['operation']}`\n")
                    f.write(f"  ```python\n  {issue['code']}\n  ```\n\n")
        
        f.write("## Medium Priority Migrations\n\n")
        for result in all_results:
            medium_issues = [i for i in result['issues'] if i['severity'] == 'MEDIUM']
            if medium_issues:
                f.write(f"### `{result['file']}`\n\n")
                for issue in medium_issues:
                    f.write(f"- **Line {issue['line']}**: `{issue['operation']}`\n\n")
    
    print(f"\n📄 Detailed report saved to: {report_path}")

if __name__ == '__main__':
    main()
