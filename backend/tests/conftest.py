from __future__ import annotations

import sys
from pathlib import Path


def pytest_configure() -> None:
    """Ensure the backend root is on sys.path for `import app`.

    Pytest collection/import behavior can vary depending on working directory and
    import mode. Adding the backend root explicitly keeps tests deterministic.
    """

    backend_root = Path(__file__).resolve().parents[1]
    backend_root_str = str(backend_root)
    if backend_root_str not in sys.path:
        sys.path.insert(0, backend_root_str)
