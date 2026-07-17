from __future__ import annotations

import ast
from pathlib import Path

import pytest


def _load_only_user_attrs_from_build_query() -> set[str]:
    dependencies_path = Path(__file__).resolve().parents[1] / "app" / "dependencies.py"
    tree = ast.parse(dependencies_path.read_text(encoding="utf-8"))

    target_fn: ast.FunctionDef | None = None
    for node in tree.body:
        if isinstance(node, ast.FunctionDef) and node.name == "_build_auth_user_query":
            target_fn = node
            break

    if target_fn is None:
        return set()

    attrs: set[str] = set()
    for node in ast.walk(target_fn):
        if not isinstance(node, ast.Call):
            continue

        if not isinstance(node.func, ast.Name) or node.func.id != "load_only":
            continue

        for arg in node.args:
            if isinstance(arg, ast.Attribute) and isinstance(arg.value, ast.Name) and arg.value.id == "User":
                attrs.add(arg.attr)

    return attrs


@pytest.mark.unit
def test_lightweight_auth_query_preloads_display_name_fields() -> None:
    loaded_attrs = _load_only_user_attrs_from_build_query()
    assert {"preferred_name", "first_name", "name"}.issubset(loaded_attrs)
