"""Deprecated — CodeCleanupService has moved to app.utils.code_cleanup.

This shim exists only for backward compatibility.  Update any imports to:

    from app.utils.code_cleanup import CodeCleanupService
"""
# Re-export so existing code that still imports from the old path continues to work.
from app.utils.code_cleanup import CodeCleanupService  # noqa: F401

__all__ = ["CodeCleanupService"]

# --- everything below is superseded; kept only as a historical reference ---
# fmt: off
"""

import os
import re
import shutil
import asyncio
from datetime import datetime
from typing import Dict, List, Any, Tuple
import aiofiles

# Allowed file extensions to consider for scanning/cleanup
_ALLOWED_EXTS = {'.py', '.js', '.ts', '.tsx', '.jsx'}

# Define patterns for each cleanup category. Each entry maps to (regex, replacement, description).
_CATEGORIES = {
    'console_debug': {
        'pattern': re.compile(r'^\s*(?:console\.log|console\.debug|print\()(?P<rest>.*)$', re.MULTILINE),
        'replacement': '',  # remove debug prints entirely
        'description': 'Remove debug print/console statements'
    },
    'temp_code': {
        'pattern': re.compile(r'#\s*TODO:.*|//\s*TODO:.*|/\*\s*TODO:.*\*/', re.IGNORECASE),
        'replacement': '',  # remove inline TODO comments (conservative)
        'description': 'Remove inline TODO comments marked as temporary'
    },
    'empty_blocks': {
        'pattern': re.compile(r'(?P<open>\{\s*\n?\s*\}|\:\s*pass\b)', re.MULTILINE),
        'replacement': '',  # remove empty blocks or pass statements
        'description': 'Remove trivial empty blocks or pass statements'
    },
}

# Small helper to ensure a path is inside project root to avoid accidental edits outside repo
def _is_within_root(project_root: str, path: str) -> bool:
    try:
        project_root = os.path.abspath(project_root)
        path = os.path.abspath(path)
        return os.path.commonpath([project_root]) == os.path.commonpath([project_root, path])
    except Exception:
        return False

class CodeCleanupService:
    """Async service to analyze and optionally clean a codebase."""

    def __init__(self, project_root: str):
        if not project_root:
            raise ValueError("project_root is required")
        self.project_root = os.path.abspath(project_root)
        if not os.path.isdir(self.project_root):
            raise ValueError("project_root must be a valid directory")
        # Use a timestamp for backups to avoid collisions
        self._backup_suffix = datetime.utcnow().strftime("%Y%m%d%H%M%S")

    async def generate_cleanup_report(self) -> Dict[str, Any]:
        """
        Scan files and return a report of findings per category.
        This function performs blocking filesystem traversal in a thread to avoid blocking the event loop.
        """
        return await asyncio.to_thread(self._scan_files_sync)

    def _scan_files_sync(self) -> Dict[str, Any]:
        findings: Dict[str, List[Dict[str, Any]]] = {k: [] for k in _CATEGORIES.keys()}
        total_files = 0
        for root, _, files in os.walk(self.project_root):
            for fname in files:
                _, ext = os.path.splitext(fname)
                if ext.lower() not in _ALLOWED_EXTS:
                    continue
                fpath = os.path.join(root, fname)
                if not _is_within_root(self.project_root, fpath):
                    continue
                try:
                    with open(fpath, 'r', encoding='utf-8', errors='ignore') as fh:
                        content = fh.read()
                    total_files += 1
                    for cat, meta in _CATEGORIES.items():
                        for m in meta['pattern'].finditer(content):
                            # Record a small context for each match
                            start = max(0, m.start() - 40)
                            end = min(len(content), m.end() + 40)
                            context = content[start:end].replace('\n', '\\n')
                            findings[cat].append({
                                'file': os.path.relpath(fpath, self.project_root),
                                'match': (m.group(0)[:200] + '...') if len(m.group(0)) > 200 else m.group(0),
                                'context': context
                            })
                except Exception:
                    # Skip problematic files but continue scanning
                    continue
        return {
            'project_root': self.project_root,
            'total_files_scanned': total_files,
            'findings': findings
        }

    async def auto_cleanup(self, categories: List[str], dry_run: bool = True) -> Dict[str, Any]:
        """
        For the given categories, either return planned edits (dry_run=True) or apply them.
        Returns a structured result with per-file edits.
        """
        if not categories:
            raise ValueError("At least one category must be provided")
        invalid = [c for c in categories if c not in _CATEGORIES]
        if invalid:
            raise ValueError(f"Unknown categories: {invalid}")

        # Run a scan (sync in thread) to gather matches
        scan_results = await asyncio.to_thread(self._scan_files_sync)
        planned_changes: Dict[str, List[Dict[str, Any]]] = {}

        # Build planned changes
        for cat in categories:
            entries = scan_results['findings'].get(cat, [])
            for e in entries:
                relpath = e['file']
                planned_changes.setdefault(relpath, []).append({
                    'category': cat,
                    'match_preview': e['match'],
                    'context': e['context']
                })

        if dry_run:
            return {
                'dry_run': True,
                'planned_changes_count': sum(len(v) for v in planned_changes.values()),
                'planned_changes': planned_changes
            }

        # Apply changes: create backups and write modified content.
        applied: Dict[str, Any] = {}
        for relpath, changes in planned_changes.items():
            abs_path = os.path.join(self.project_root, relpath)
            if not os.path.exists(abs_path) or not _is_within_root(self.project_root, abs_path):
                applied[relpath] = {'status': 'skipped', 'reason': 'file missing or outside project root'}
                continue
            try:
                # Read file content (async)
                async with aiofiles.open(abs_path, mode='r', encoding='utf-8', errors='ignore') as f:
                    content = await f.read()

                original = content
                modified = content
                for change in changes:
                    cat = change['category']
                    pattern = _CATEGORIES[cat]['pattern']
                    replacement = _CATEGORIES[cat]['replacement']
                    # conservative substitution: replace all occurrences
                    modified = pattern.sub(replacement, modified)

                if modified == original:
                    applied[relpath] = {'status': 'no_change'}
                    continue

                # Backup original file
                backup_path = f"{abs_path}.backup.{self._backup_suffix}"
                await asyncio.to_thread(shutil.copy2, abs_path, backup_path)

                # Write modified file (async)
                async with aiofiles.open(abs_path, mode='w', encoding='utf-8') as f:
                    await f.write(modified)

                applied[relpath] = {'status': 'modified', 'backup': os.path.relpath(backup_path, self.project_root)}
            except Exception as exc:
                applied[relpath] = {'status': 'error', 'error': str(exc)}

        return {
            'dry_run': False,
            'applied_count': len([v for v in applied.values() if v.get('status') == 'modified']),
            'applied': applied,
        }
