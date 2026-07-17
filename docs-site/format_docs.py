from __future__ import annotations

from pathlib import Path
import re


DOCS_ROOT = Path(__file__).resolve().parent / "docs"

# Reduce visual noise while preserving meaning.
EMOJI_REPLACEMENTS: dict[str, str] = {
    "✅": "[Done]",
    "⚠️": "[Warning]",
    "⚠": "[Warning]",
    "❌": "[Missing]",
    "🟡": "[Optional]",
    "🚀": "[Start]",
    "🔧": "[Setup]",
    "📝": "[Note]",
    "📍": "[Address]",
    "✨": "",
    "🔥": "",
    "🤖": "AIKA",
    "🧠": "TCA",
    "📊": "IA",
    "🎓": "Student",
}


def _normalize_text(content: str) -> str:
    content = content.replace("—", " - ")

    # Collapse extra spaces from replacement pass.
    content = re.sub(r" {2,}", " ", content)

    for emoji, replacement in EMOJI_REPLACEMENTS.items():
        content = content.replace(emoji, replacement)

    # Tidy spaces before punctuation introduced by replacements.
    content = re.sub(r"\s+([,.;:!?])", r"\1", content)
    # Tidy duplicated brackets from repeated replacements.
    content = re.sub(r"\[(Done|Warning|Missing|Optional)\]\s+\[(Done|Warning|Missing|Optional)\]", r"[\1] [\2]", content)

    return content


def format_docs() -> int:
    files = sorted(DOCS_ROOT.rglob("*.md")) + sorted(DOCS_ROOT.rglob("*.mdx"))
    changed = 0

    for path in files:
        original = path.read_text(encoding="utf-8")
        updated = _normalize_text(original)
        if updated != original:
            path.write_text(updated, encoding="utf-8")
            changed += 1

    return changed


if __name__ == "__main__":
    changed_files = format_docs()
    print(f"Formatting complete. Updated {changed_files} file(s).")
