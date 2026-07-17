"""Merge branch heads after agent user alignment."""

from __future__ import annotations

from typing import Sequence, Union

revision: str = "202502010002"
down_revision: Union[str, Sequence[str], None] = ("202502010001", "84b70966366d")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """No-op merge revision."""
    pass


def downgrade() -> None:
    """Downgrade not supported for merge revisions."""
    pass

