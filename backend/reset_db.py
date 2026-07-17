"""Database reset script — for development and CI only.

Production guard: the script aborts unless ALLOW_DB_RESET=true is explicitly
set in the environment.  This prevents accidental data loss when DATABASE_URL
points to a production instance.
"""
import asyncio
import os
import sys

from app.database import Base, async_engine

_DANGER_FLAG = "ALLOW_DB_RESET"
_APP_ENV = os.environ.get("APP_ENV", "development").strip().lower()


def _assert_not_production() -> None:
    """Abort if the environment looks like production and the danger flag is absent."""
    allow = os.environ.get(_DANGER_FLAG, "").strip().lower() in {"1", "true", "yes"}
    if not allow:
        print(
            f"[reset_db] Aborted. Set {_DANGER_FLAG}=true to permit a reset.",
            file=sys.stderr,
        )
        sys.exit(1)

    if _APP_ENV == "production":
        # Require an explicit second confirmation when APP_ENV=production so that
        # a mis-configured CI job cannot silently wipe production data.
        confirm = input(
            "[reset_db] APP_ENV is 'production'. "
            "Type 'yes I am sure' to continue, or anything else to abort: "
        ).strip()
        if confirm != "yes I am sure":
            print("[reset_db] Aborted.", file=sys.stderr)
            sys.exit(1)


async def reset_database() -> None:
    """Drop all tables and dispose the engine connection pool."""
    print("[reset_db] WARNING: dropping all tables...")
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await async_engine.dispose()
    print("[reset_db] Done.")


if __name__ == "__main__":
    _assert_not_production()
    asyncio.run(reset_database())
