from __future__ import annotations

from sqlalchemy import JSON
from sqlalchemy.dialects.postgresql import JSONB as PostgresJSONB

# Provide a JSONB-compatible type that gracefully degrades to the generic
# SQLAlchemy JSON type when running against SQLite (used in tests).
JSONBCompat = PostgresJSONB().with_variant(JSON(), "sqlite")
