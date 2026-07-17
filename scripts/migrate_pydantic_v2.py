#!/usr/bin/env python3
"""
Script to migrate Pydantic V1 Config class to V2 ConfigDict across all schema files.
"""
import re
import os
from pathlib import Path

def migrate_schema_file(file_path: Path):
    """Migrate a single schema file from Pydantic V1 to V2."""
    print(f"Processing: {file_path}")
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    
    # Step 1: Add ConfigDict to imports if not present
    if 'from pydantic import' in content and 'ConfigDict' not in content:
        # Find the pydantic import line
        import_pattern = r'from pydantic import ([^\n]+)'
        match = re.search(import_pattern, content)
        if match:
            imports = match.group(1)
            if 'ConfigDict' not in imports:
                new_imports = imports.rstrip() + ', ConfigDict'
                content = content.replace(
                    f'from pydantic import {imports}',
                    f'from pydantic import {new_imports}'
                )
    
    # Step 2: Replace class Config: patterns
    # Pattern to match:
    #     class Config:
    #         from_attributes = True
    # or
    #     class Config:
    #         extra = 'ignore'
    # etc.
    
    config_pattern = r'(\n    )(class Config:\n(?:        [^\n]+\n)+)'
    
    def replace_config(match):
        indent = match.group(1)
        config_block = match.group(2)
        
        # Extract config settings
        settings = []
        for line in config_block.split('\n'):
            if '=' in line:
                # Extract key = value
                key_value = line.strip()
                if key_value and not key_value.startswith('#'):
                    # Convert orm_mode to from_attributes
                    if 'orm_mode' in key_value:
                        key_value = key_value.replace('orm_mode', 'from_attributes')
                    settings.append(key_value)
        
        if not settings:
            return match.group(0)  # Return unchanged if no settings found
        
        # Build new ConfigDict line
        config_dict_line = f"{indent}model_config = ConfigDict({', '.join(settings)})\n"
        return config_dict_line
    
    content = re.sub(config_pattern, replace_config, content)
    
    # Step 3: Write back if changed
    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  ✓ Updated: {file_path}")
        return True
    else:
        print(f"  - No changes needed: {file_path}")
        return False

def main():
    """Main migration function."""
    schema_dir = Path(__file__).parent.parent / 'backend' / 'app' / 'schemas'
    
    if not schema_dir.exists():
        print(f"Error: Schema directory not found: {schema_dir}")
        return
    
    print(f"Migrating Pydantic schemas in: {schema_dir}\n")
    
    # Find all Python files in schemas directory
    schema_files = list(schema_dir.rglob('*.py'))
    
    updated_count = 0
    for schema_file in schema_files:
        if schema_file.name == '__init__.py':
            continue
        
        if migrate_schema_file(schema_file):
            updated_count += 1
    
    print(f"\n✓ Migration complete! Updated {updated_count} files.")

if __name__ == '__main__':
    main()
