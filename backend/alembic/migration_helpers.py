"""
Helper utilities for creating idempotent Alembic migrations.

This module provides reusable functions to make migrations safer and more robust.
All functions include existence checks to prevent duplicate operations.
"""

from typing import Any, Optional
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine import Inspector


def get_inspector() -> Inspector:
    """Get SQLAlchemy inspector for the current database connection."""
    bind = op.get_bind()
    return sa.inspect(bind)


def table_exists(table_name: str) -> bool:
    """Check if a table exists in the database."""
    inspector = get_inspector()
    return table_name in inspector.get_table_names()


def column_exists(table_name: str, column_name: str) -> bool:
    """Check if a column exists in a table."""
    if not table_exists(table_name):
        return False
    
    inspector = get_inspector()
    columns = {col['name'] for col in inspector.get_columns(table_name)}
    return column_name in columns


def index_exists(index_name: str, table_name: Optional[str] = None) -> bool:
    """Check if an index exists."""
    inspector = get_inspector()
    
    if table_name:
        if not table_exists(table_name):
            return False
        indexes = inspector.get_indexes(table_name)
        return any(idx['name'] == index_name for idx in indexes)
    
    # Check all tables if no specific table provided
    for tbl in inspector.get_table_names():
        indexes = inspector.get_indexes(tbl)
        if any(idx['name'] == index_name for idx in indexes):
            return True
    return False


def foreign_key_exists(table_name: str, fk_name: str) -> bool:
    """Check if a foreign key constraint exists."""
    if not table_exists(table_name):
        return False
    
    inspector = get_inspector()
    foreign_keys = inspector.get_foreign_keys(table_name)
    return any(fk.get('name') == fk_name for fk in foreign_keys)


def constraint_exists(table_name: str, constraint_name: str) -> bool:
    """Check if a constraint exists (generic check)."""
    if not table_exists(table_name):
        return False
    
    inspector = get_inspector()
    
    # Check unique constraints
    unique_constraints = inspector.get_unique_constraints(table_name)
    if any(uc.get('name') == constraint_name for uc in unique_constraints):
        return True
    
    # Check check constraints
    check_constraints = inspector.get_check_constraints(table_name)
    if any(cc.get('name') == constraint_name for cc in check_constraints):
        return True
    
    # Check foreign keys
    foreign_keys = inspector.get_foreign_keys(table_name)
    if any(fk.get('name') == constraint_name for fk in foreign_keys):
        return True
    
    return False


def create_table_if_not_exists(table_name: str, *columns, **kwargs) -> bool:
    """
    Create a table only if it doesn't exist.
    
    Returns:
        True if table was created, False if it already existed
    """
    if not table_exists(table_name):
        op.create_table(table_name, *columns, **kwargs)
        return True
    return False


def add_column_if_not_exists(table_name: str, column: sa.Column) -> bool:
    """
    Add a column only if it doesn't exist.
    
    Returns:
        True if column was added, False if it already existed
    """
    if not column_exists(table_name, column.name):
        op.add_column(table_name, column)
        return True
    return False


def drop_column_if_exists(table_name: str, column_name: str) -> bool:
    """
    Drop a column only if it exists.
    
    Returns:
        True if column was dropped, False if it didn't exist
    """
    if column_exists(table_name, column_name):
        op.drop_column(table_name, column_name)
        return True
    return False


def create_index_if_not_exists(
    index_name: str,
    table_name: str,
    columns: list[str],
    unique: bool = False,
    **kwargs
) -> bool:
    """
    Create an index only if it doesn't exist.
    
    Returns:
        True if index was created, False if it already existed
    """
    if not index_exists(index_name, table_name):
        op.create_index(index_name, table_name, columns, unique=unique, **kwargs)
        return True
    return False


def drop_index_if_exists(index_name: str, table_name: Optional[str] = None) -> bool:
    """
    Drop an index only if it exists.
    
    Returns:
        True if index was dropped, False if it didn't exist
    """
    if index_exists(index_name, table_name):
        op.drop_index(index_name, table_name=table_name)
        return True
    return False


def drop_table_if_exists(table_name: str) -> bool:
    """
    Drop a table only if it exists.
    
    Returns:
        True if table was dropped, False if it didn't exist
    """
    if table_exists(table_name):
        op.drop_table(table_name)
        return True
    return False


def add_foreign_key_if_not_exists(
    constraint_name: str,
    source_table: str,
    referent_table: str,
    local_cols: list[str],
    remote_cols: list[str],
    **kwargs
) -> bool:
    """
    Add a foreign key constraint only if it doesn't exist.
    
    Returns:
        True if constraint was created, False if it already existed
    """
    if not foreign_key_exists(source_table, constraint_name):
        op.create_foreign_key(
            constraint_name,
            source_table,
            referent_table,
            local_cols,
            remote_cols,
            **kwargs
        )
        return True
    return False


def drop_constraint_if_exists(
    constraint_name: str,
    table_name: str,
    type_: Optional[str] = None
) -> bool:
    """
    Drop a constraint only if it exists.
    
    Args:
        constraint_name: Name of the constraint
        table_name: Name of the table
        type_: Type of constraint ('foreignkey', 'unique', 'check', etc.)
    
    Returns:
        True if constraint was dropped, False if it didn't exist
    """
    if constraint_exists(table_name, constraint_name):
        op.drop_constraint(constraint_name, table_name, type_=type_)
        return True
    return False


def alter_column_type_if_needed(
    table_name: str,
    column_name: str,
    new_type: Any,
    existing_type: Optional[Any] = None,
    **kwargs
) -> bool:
    """
    Alter a column type only if the column exists.
    
    Note: This doesn't check if the type is actually different,
    it only checks if the column exists.
    
    Returns:
        True if column was altered, False if column doesn't exist
    """
    if column_exists(table_name, column_name):
        op.alter_column(
            table_name,
            column_name,
            type_=new_type,
            existing_type=existing_type,
            **kwargs
        )
        return True
    return False


def get_table_columns(table_name: str) -> set[str]:
    """
    Get all column names for a table.
    
    Returns:
        Set of column names, or empty set if table doesn't exist
    """
    if not table_exists(table_name):
        return set()
    
    inspector = get_inspector()
    return {col['name'] for col in inspector.get_columns(table_name)}


def get_existing_tables() -> set[str]:
    """Get all table names in the database."""
    inspector = get_inspector()
    return set(inspector.get_table_names())
