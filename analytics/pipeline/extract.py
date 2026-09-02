"""Extraction entry point — resolves a source and pulls its operational rows.

Kept intentionally thin: policy (which source, demo seed/days, API credentials)
lives in ``source.resolve`` + ``config``. Run via ``run.py extract``.
"""

from __future__ import annotations

from . import config
from . import source as source_mod


def run(name: str = config.DEFAULT_SOURCE, **kwargs):
    """Resolve ``name`` (auto|demo|local|api) and fetch all tables.

    Returns ``(source, tables)`` where ``tables`` maps table name -> row dicts.
    Raises ``source_mod.SourceError`` on any unreachable source.
    """
    src = source_mod.resolve(name, **kwargs)
    return src, src.fetch()
