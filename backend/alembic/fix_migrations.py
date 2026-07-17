#!/usr/bin/env python3
"""
Auto-fix non-idempotent migrations by adding existence checks.

This script automatically adds idempotency checks to migrations that have
op.add_column() calls without existence checks.
"""

import re
from pathlib import Path
from typing import List, Tuple

def fix_add_column_migration(content: str, filename: str) -> Tuple[str, bool]:
    """
    Fix op.add_column() calls by adding existence checks.
    
    Returns:
        Tuple of (modified_content, was_modified)
    """
    if 'op.add_column' not in content:
        return content, False
    
    # Check if already has existence checks
    if 'column_exists' in content or 'inspector' in content:
        return content, False
    
    lines = content.split('\n')
    modified = False
    new_lines = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        
        # Look for upgrade() or schema_upgrade() function
        if re.match(r'^\s*def (upgrade|schema_upgrade)\(\)', line):
            new_lines.append(line)
            i += 1
            
            # Add inspector setup after function definition
            indent = '    '
            # Find the first non-comment, non-docstring line
            while i < len(lines) and (lines[i].strip().startswith(('#', '"""', "'''")) or not lines[i].strip()):
                new_lines.append(lines[i])
                i += 1
            
            # Add inspector code
            new_lines.append(f'{indent}# Get inspector for idempotent checks')
            new_lines.append(f'{indent}bind = op.get_bind()')
            new_lines.append(f'{indent}inspector = sa.inspect(bind)')
            new_lines.append('')
            modified = True
            continue
        
        # Look for op.add_column() calls
        if 'op.add_column(' in line:
            # Extract table name and column name
            match = re.search(r"op\.add_column\(['\"](\w+)['\"],\s*sa\.Column\(['\"](\w+)['\"]", line)
            if match:
                table_name = match.group(1)
                column_name = match.group(2)
                indent = re.match(r'^(\s*)', line).group(1)
                
                # Get the full statement (might span multiple lines)
                full_statement = line
                paren_count = line.count('(') - line.count(')')
                j = i + 1
                while paren_count > 0 and j < len(lines):
                    full_statement += '\n' + lines[j]
                    paren_count += lines[j].count('(') - lines[j].count(')')
                    j += 1
                
                # Add existence check
                new_lines.append(f'{indent}# Check if column exists before adding')
                new_lines.append(f'{indent}columns = {{col["name"] for col in inspector.get_columns("{table_name}")}}')
                new_lines.append(f'{indent}if "{column_name}" not in columns:')
                new_lines.append(f'{indent}    {full_statement.strip()}')
                
                # Skip the lines we've already processed
                i = j
                modified = True
                continue
        
        new_lines.append(line)
        i += 1
    
    return '\n'.join(new_lines), modified


def main():
    """Fix all problematic migrations."""
    versions_dir = Path(__file__).parent / "versions"
    
    # List of migrations that need fixing (from validator output)
    problematic_files = [
        '1970e622e299_intervention_table.py',
        '229cc89f0375_add_user_profile_enhancements.py',
        '28e1ce4c3187_add_updated_at_to_player_wellness_state.py',
        '612167b98a55_add_topic_exceprts.py',
        '756c4fde7a1b_add_category_field_to_surveys.py',
        '87ae07d03632_add_campaign_tables_phase5.py',
        'add_admin_infra_001_add_admin_infrastructure.py',
        'b669f9bb823a_add_password_reset_token_fields_to_user_.py',
        'fix_cases_table_001_fix_cases_structure.py',
        'link_psych_users_001_link_psychologists_to_users.py',
    ]
    
    fixed_count = 0
    
    for filename in problematic_files:
        filepath = versions_dir / filename
        
        if not filepath.exists():
            print(f"⚠️  Skipping {filename} - file not found")
            continue
        
        try:
            content = filepath.read_text(encoding='utf-8')
            new_content, was_modified = fix_add_column_migration(content, filename)
            
            if was_modified:
                filepath.write_text(new_content, encoding='utf-8')
                print(f"✅ Fixed {filename}")
                fixed_count += 1
            else:
                print(f"ℹ️  Skipped {filename} - already has existence checks or no op.add_column()")
        
        except Exception as e:
            print(f"❌ Error processing {filename}: {e}")
    
    print(f"\n✅ Fixed {fixed_count} migration files")
    print("\n⚠️  NOTE: These are automatic fixes. Please review the changes before committing!")
    print("Run: python alembic/validate_migrations.py")


if __name__ == "__main__":
    main()
