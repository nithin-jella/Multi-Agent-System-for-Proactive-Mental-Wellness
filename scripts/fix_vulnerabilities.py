#!/usr/bin/env python3
"""
Security Vulnerability Auto-Fixer
Parses Trivy JSON output and automatically updates requirements.txt
"""

import json
import re
import sys
from pathlib import Path
from typing import Dict, List, Tuple
import subprocess


def parse_trivy_results(trivy_json_path: str) -> Dict:
    """Parse Trivy JSON results and extract vulnerability information."""
    try:
        with open(trivy_json_path, 'r') as f:
            results = json.load(f)
    except FileNotFoundError:
        print(f"❌ Trivy results file not found: {trivy_json_path}")
        return {}
    except json.JSONDecodeError:
        print(f"❌ Invalid JSON in Trivy results file")
        return {}

    vulnerabilities = {}
    
    if 'Results' in results:
        for result in results['Results']:
            if result.get('Type') == 'python-pkg' and 'Vulnerabilities' in result:
                for vuln in result['Vulnerabilities']:
                    pkg_name = vuln.get('PkgName')
                    installed_version = vuln.get('InstalledVersion')
                    fixed_version = vuln.get('FixedVersion')
                    vuln_id = vuln.get('VulnerabilityID')
                    severity = vuln.get('Severity')
                    title = vuln.get('Title', '')
                    
                    if pkg_name and fixed_version and fixed_version != '':
                        if pkg_name not in vulnerabilities:
                            vulnerabilities[pkg_name] = {
                                'current': installed_version,
                                'fixed': fixed_version,
                                'cves': [],
                                'severity': severity,
                                'titles': []
                            }
                        vulnerabilities[pkg_name]['cves'].append(vuln_id)
                        if title:
                            vulnerabilities[pkg_name]['titles'].append(title[:80])
    
    return vulnerabilities


def update_requirements_file(req_file_path: Path, vulnerabilities: Dict) -> Tuple[List[str], List[str]]:
    """Update requirements.txt with fixed versions."""
    if not req_file_path.exists():
        print(f"❌ Requirements file not found: {req_file_path}")
        return [], []

    with open(req_file_path, 'r') as f:
        lines = f.readlines()

    updated_lines = []
    changes_made = []
    packages_updated = []
    
    for line in lines:
        original_line = line
        updated = False
        
        for pkg_name, info in vulnerabilities.items():
            # Match package name (case-insensitive, handle extras like [cryptography])
            # Patterns: package==1.2.3, package>=1.2.3, package[extra]==1.2.3
            pattern = rf'^({re.escape(pkg_name)}(?:\[[\w,]+\])?)\s*([=<>!]=?)\s*([\d\.]+.*?)(\s*#.*)?$'
            match = re.match(pattern, line.strip(), re.IGNORECASE)
            
            if match:
                pkg_with_extras = match.group(1)
                operator = match.group(2)
                current_version = match.group(3)
                existing_comment = match.group(4) or ''
                
                # Build CVE info
                cve_list = ', '.join(info['cves'][:3])  # Limit to 3 CVEs
                if len(info['cves']) > 3:
                    cve_list += f" (+{len(info['cves']) - 3} more)"
                
                # Create new comment
                new_comment = f"  # Updated to fix {cve_list}"
                
                # Update to minimum version requirement (>= ensures we get patches)
                new_line = f"{pkg_with_extras}>={info['fixed']}{new_comment}\n"
                updated_lines.append(new_line)
                
                # Track changes
                change_msg = (
                    f"  - {pkg_name}: {current_version} → >={info['fixed']}\n"
                    f"    CVEs: {cve_list}\n"
                    f"    Severity: {info['severity']}"
                )
                changes_made.append(change_msg)
                packages_updated.append(pkg_name)
                
                updated = True
                break
        
        if not updated:
            updated_lines.append(original_line)

    # Write updated file
    if changes_made:
        with open(req_file_path, 'w') as f:
            f.writelines(updated_lines)

    return changes_made, packages_updated


def verify_updates(packages: List[str]) -> bool:
    """Verify that pip can resolve the updated requirements."""
    print("\n🔍 Verifying updated requirements...")
    try:
        result = subprocess.run(
            ['pip', 'install', '--dry-run', '-r', 'backend/requirements.txt'],
            capture_output=True,
            text=True,
            timeout=60
        )
        if result.returncode == 0:
            print("✅ Requirements can be resolved by pip")
            return True
        else:
            print("⚠️  Warning: pip reported issues:")
            print(result.stderr)
            return False
    except Exception as e:
        print(f"⚠️  Could not verify requirements: {e}")
        return False


def main():
    """Main execution function."""
    if len(sys.argv) < 2:
        print("Usage: python fix_vulnerabilities.py <trivy-results.json>")
        sys.exit(1)

    trivy_json_path = sys.argv[1]
    req_file_path = Path('backend/requirements.txt')

    print("🔒 Security Vulnerability Auto-Fixer")
    print("=" * 50)
    
    # Parse Trivy results
    print(f"\n📋 Parsing Trivy results from: {trivy_json_path}")
    vulnerabilities = parse_trivy_results(trivy_json_path)
    
    if not vulnerabilities:
        print("✅ No fixable vulnerabilities found!")
        sys.exit(0)

    print(f"\n🔍 Found {len(vulnerabilities)} packages with fixable vulnerabilities:")
    for pkg_name, info in vulnerabilities.items():
        print(f"  - {pkg_name}: {info['current']} → {info['fixed']}")
        print(f"    Severity: {info['severity']}, CVEs: {len(info['cves'])}")

    # Update requirements.txt
    print(f"\n📝 Updating {req_file_path}...")
    changes_made, packages_updated = update_requirements_file(req_file_path, vulnerabilities)

    if changes_made:
        print("\n✅ Successfully updated requirements.txt!")
        print("\n📋 Changes made:")
        for change in changes_made:
            print(change)
        
        # Verify updates
        verify_updates(packages_updated)
        
        print("\n⚠️  Next steps:")
        print("  1. Review the changes in requirements.txt")
        print("  2. Test your application with the new versions")
        print("  3. Run: pip install -r backend/requirements.txt --upgrade")
        print("  4. Run your test suite")
        print("  5. Commit the changes if everything works")
        
        # Write summary for CI
        with open('vulnerability_fix_summary.txt', 'w') as f:
            f.write(f"Fixed {len(packages_updated)} vulnerable packages:\n\n")
            for change in changes_made:
                f.write(change + '\n')
    else:
        print("\n⚠️  No changes made to requirements.txt")
        print("This might mean:")
        print("  - The packages are not in requirements.txt")
        print("  - They use a different naming convention")
        print("  - The requirements are already up to date")


if __name__ == '__main__':
    main()
