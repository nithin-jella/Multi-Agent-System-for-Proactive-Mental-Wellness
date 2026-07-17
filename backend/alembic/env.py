from __future__ import annotations

import os
import sys
from logging.config import fileConfig
from pathlib import Path
from typing import Final

from dotenv import load_dotenv, find_dotenv
from sqlalchemy import create_engine
from alembic import context # type: ignore

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
BASE_DIR: Final[str] = str(Path(__file__).resolve().parents[1])

# Ensure application package is importable for metadata discovery
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

# Use the alembic context imported above
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
config_file = config.config_file_name
# config.config_file_name may be None (e.g., when Alembic is invoked programmatically).
# Only call fileConfig when a config file path/name is present to satisfy type-checkers
# and avoid passing None to fileConfig.
if config_file:
    fileConfig(config_file)
else:
    # No config file provided; skip configuring logging from file.
    # Logging can still be configured programmatically elsewhere if needed.
    pass

# Load environment configuration before resolving connection info
load_dotenv(find_dotenv())

def _database_url() -> str:
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL environment variable is not set")
    return url


def _sync_database_url(url: str) -> str:
    """Alembic uses sync drivers; coerce async URLs to sync equivalents."""
    if url.startswith("postgresql+asyncpg"):
        return url.replace("postgresql+asyncpg", "postgresql+psycopg")
    if url.startswith("postgresql+psycopg_async"):
        return url.replace("postgresql+psycopg_async", "postgresql+psycopg")
    if url.startswith("postgresql://"):
        # Avoid implicit psycopg2 fallback by being explicit about the driver.
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


DATABASE_URL: Final[str] = _database_url()
config.set_main_option("sqlalchemy.url", _sync_database_url(DATABASE_URL))

# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata
from app.database import Base
# Import all models to ensure they're registered with Base
import app.models
target_metadata = Base.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = create_engine(_sync_database_url(DATABASE_URL))

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()