"""Admin/developer codebase cleanup utility.

This module is intentionally placed in ``app/utils/`` rather than
``app/services/`` to signal that it is a developer tool, not a domain
service.  It is only accessible through admin-protected API endpoints
defined in ``app/routes/admin/system.py``.

IMPORTANT: The ``auto_cleanup`` method rewrites source files on the
server filesystem.  The calling route must:
  1. Be protected by ``get_admin_user`` (already done).
  2. Never be enabled in an environment where the codebase is read-only
     or mounted as a container image layer.
"""
from __future__ import annotations

import asyncio
import os
import re
import shutil
from datetime import datetime
from typing import Any, Dict, List

import aiofiles

# File extensions scanned/modified.
_ALLOWED_EXTS: frozenset[str] = frozenset({".py", ".js", ".ts", ".tsx", ".jsx"})

# Each category maps to a compiled pattern and its safe replacement string.
_CATEGORIES: Dict[str, Dict[str, Any]] = {
    "console_debug": {
        "pattern": re.compile(
            r"^\s*(?:console\.log|console\.debug|print\()(?P<rest>.*)$",
            re.MULTILINE,
        ),
        "replacement": "",
        "description": "Remove debug print/console statements",
    },
    "temp_code": {
        "pattern": re.compile(
            r"#\s*TODO:.*|//\s*TODO:.*|/\*\s*TODO:.*\*/",
            re.IGNORECASE,
        ),
        "replacement": "",
        "description": "Remove inline TODO comments marked as temporary",
    },
    "empty_blocks": {
        "pattern": re.compile(
            r"(?P<open>\{\s*\n?\s*\}|\:\s*pass\b)",
            re.MULTILINE,
        ),
        "replacement": "",
        "description": "Remove trivial empty blocks or pass statements",
    },
}


def _is_within_root(project_root: str, path: str) -> bool:
    """Return True only when path is a descendant of project_root."""
    try:
        root = os.path.abspath(project_root)
        target = os.path.abspath(path)
        return os.path.commonpath([root]) == os.path.commonpath([root, target])
    except Exception:
        return False


class CodeCleanupService:
    """Async utility to analyse and optionally clean a codebase.

    Instantiate with the absolute path to the project root.  Call
    ``generate_cleanup_report()`` for a dry scan, or ``auto_cleanup()``
    to apply (or preview) targeted replacements.
    """

    def __init__(self, project_root: str) -> None:
        if not project_root:
            raise ValueError("project_root is required")
        self.project_root = os.path.abspath(project_root)
        if not os.path.isdir(self.project_root):
            raise ValueError("project_root must be a valid directory")
        # Timestamp suffix avoids backup collisions when called multiple times.
        self._backup_suffix = datetime.utcnow().strftime("%Y%m%d%H%M%S")

    async def generate_cleanup_report(self) -> Dict[str, Any]:
        """Scan and return a findings report without touching any files."""
        return await asyncio.to_thread(self._scan_files_sync)

    def _scan_files_sync(self) -> Dict[str, Any]:
        findings: Dict[str, List[Dict[str, Any]]] = {k: [] for k in _CATEGORIES}
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
                    with open(fpath, encoding="utf-8", errors="ignore") as fh:
                        content = fh.read()
                    total_files += 1
                    for cat, meta in _CATEGORIES.items():
                        for m in meta["pattern"].finditer(content):
                            start = max(0, m.start() - 40)
                            end = min(len(content), m.end() + 40)
                            context = content[start:end].replace("\n", "\\n")
                            findings[cat].append(
                                {
                                    "file": os.path.relpath(fpath, self.project_root),
                                    "match": (
                                        (m.group(0)[:200] + "...")
                                        if len(m.group(0)) > 200
                                        else m.group(0)
                                    ),
                                    "context": context,
                                }
                            )
                except Exception:
                    continue  # skip unreadable files

        return {
            "project_root": self.project_root,
            "total_files_scanned": total_files,
            "findings": findings,
        }

    async def auto_cleanup(
        self, categories: List[str], dry_run: bool = True
    ) -> Dict[str, Any]:
        """Preview or apply pattern-based cleanups for the given categories.

        Args:
            categories: List of category keys (see _CATEGORIES).
            dry_run: When True, return planned changes without writing files.

        Returns:
            Dict summarising planned or applied changes.
        """
        if not categories:
            raise ValueError("At least one category must be provided.")
        invalid = [c for c in categories if c not in _CATEGORIES]
        if invalid:
            raise ValueError(f"Unknown categories: {invalid}")

        scan_results = await asyncio.to_thread(self._scan_files_sync)
        planned_changes: Dict[str, List[Dict[str, Any]]] = {}

        for cat in categories:
            for entry in scan_results["findings"].get(cat, []):
                planned_changes.setdefault(entry["file"], []).append(
                    {
                        "category": cat,
                        "match_preview": entry["match"],
                        "context": entry["context"],
                    }
                )

        if dry_run:
            return {
                "dry_run": True,
                "planned_changes_count": sum(len(v) for v in planned_changes.values()),
                "planned_changes": planned_changes,
            }

        # Apply changes with backup.
        applied: Dict[str, Any] = {}
        for relpath, changes in planned_changes.items():
            abs_path = os.path.join(self.project_root, relpath)
            if not os.path.exists(abs_path) or not _is_within_root(
                self.project_root, abs_path
            ):
                applied[relpath] = {
                    "status": "skipped",
                    "reason": "file missing or outside project root",
                }
                continue
            try:
                async with aiofiles.open(abs_path, encoding="utf-8", errors="ignore") as f:
                    content = await f.read()

                modified = content
                for change in changes:
                    cat = change["category"]
                    modified = _CATEGORIES[cat]["pattern"].sub(
                        _CATEGORIES[cat]["replacement"], modified
                    )

                if modified == content:
                    applied[relpath] = {"status": "no_change"}
                    continue

                backup_path = f"{abs_path}.backup.{self._backup_suffix}"
                await asyncio.to_thread(shutil.copy2, abs_path, backup_path)

                async with aiofiles.open(abs_path, mode="w", encoding="utf-8") as f:
                    await f.write(modified)

                applied[relpath] = {
                    "status": "modified",
                    "backup": os.path.relpath(backup_path, self.project_root),
                }
            except Exception as exc:
                applied[relpath] = {"status": "error", "error": str(exc)}

        return {
            "dry_run": False,
            "applied_count": sum(
                1 for v in applied.values() if v.get("status") == "modified"
            ),
            "applied": applied,
        }
