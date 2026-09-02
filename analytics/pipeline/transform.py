"""Transform layer — a small, dbt-flavoured model runner.

Models are plain SQL files in ``pipeline/models/``. A model declares its
upstreams with ``{{ ref('model_name') }}`` tokens. This module:

  * maps a model name to its target schema by prefix
        stg_*  -> silver     (cleaned, typed, conformed)
        dim_* / fct_* / kpi_* -> gold   (dimensions, facts, reporting)
  * builds a dependency DAG from the ref tokens and executes models in
    topological order (erroring on unknown refs or cycles)
  * resolves each ``ref()`` to a fully qualified ``schema.table``
  * materialises every model as ``CREATE OR REPLACE TABLE`` (idempotent)
  * writes one row per model to ``meta.model_run`` (per-model observability)

This reproduces the core ideas of dbt (ref + lineage + DAG execution) in ~100
lines with no dependency, which makes a clean interview talking point.
"""

from __future__ import annotations

import re
from collections import defaultdict, deque
from dataclasses import dataclass, field
from pathlib import Path

from . import config

_REF_RE = re.compile(
    r"\{\{\s*ref\(\s*['\"]([A-Za-z_][A-Za-z0-9_]*)['\"]\s*\)\s*\}\}"
)

# name prefix -> warehouse schema (bronze is handled by the load layer).
_PREFIX_SCHEMA = {
    "stg_": "silver",
    "dim_": "gold",
    "fct_": "gold",
    "kpi_": "gold",
}


class TransformError(RuntimeError):
    """Base error for the transform layer."""


class UnknownRefError(TransformError):
    """A model referenced another model that does not exist."""


class CycleError(TransformError):
    """The model dependency graph contains a cycle."""


@dataclass
class Model:
    name: str
    path: Path
    sql: str
    schema: str
    refs: set[str] = field(default_factory=set)

    @property
    def qualified_name(self) -> str:
        return f"{self.schema}.{self.name}"


def _schema_for(name: str) -> str:
    for prefix, schema in _PREFIX_SCHEMA.items():
        if name.startswith(prefix):
            return schema
    raise TransformError(
        f"model {name!r} has no schema prefix; name it stg_*/dim_*/fct_*/kpi_*"
    )


def load_model(path: Path) -> Model:
    sql = path.read_text(encoding="utf-8")
    name = path.stem
    return Model(
        name=name,
        path=path,
        sql=sql,
        schema=_schema_for(name),
        refs={m.group(1) for m in _REF_RE.finditer(sql)},
    )


def discover_models(models_dir=config.MODELS_DIR) -> list[Model]:
    models_dir = Path(models_dir)
    if not models_dir.is_dir():
        raise TransformError(f"models dir not found: {models_dir}")
    return [load_model(p) for p in sorted(models_dir.glob("*.sql"))]


def build_order(models: list[Model]) -> tuple[list[Model], list[tuple[str, str]]]:
    """Topologically sort models (upstream first). Returns (order, edges).

    Edges are ``(upstream, downstream)`` pairs, e.g. ("stg_x", "dim_y").
    Raises UnknownRefError / CycleError.
    """
    by_name = {m.name: m for m in models}
    for m in models:
        for ref in m.refs:
            if ref not in by_name:
                raise UnknownRefError(
                    f"model {m.name!r} references unknown model {ref!r}"
                )

    edges: list[tuple[str, str]] = []
    dependents: dict[str, list[Model]] = defaultdict(list)
    indegree: dict[str, int] = {m.name: 0 for m in models}
    for m in models:
        for ref in m.refs:
            if ref != m.name:
                dependents[ref].append(m)
                indegree[m.name] += 1
                edges.append((ref, m.name))

    queue = deque(sorted(name for name, deg in indegree.items() if deg == 0))
    order: list[Model] = []
    while queue:
        name = queue.popleft()
        model = by_name[name]
        order.append(model)
        for downstream in sorted(dependents[name], key=lambda d: d.name):
            indegree[downstream.name] -= 1
            if indegree[downstream.name] == 0:
                queue.append(downstream.name)

    if len(order) != len(models):
        cyclic = [m.name for m in models if m.name not in {o.name for o in order}]
        raise CycleError(f"dependency cycle detected among models: {cyclic}")
    return order, edges


def _resolve_sql(model: Model, by_name: dict[str, Model]) -> str:
    def replace(match: re.Match) -> str:
        ref = match.group(1)
        target = by_name[ref]
        return f"{target.schema}.{ref}"

    return _REF_RE.sub(replace, model.sql)


def plan(models_dir=config.MODELS_DIR) -> tuple[list[Model], list[tuple[str, str]]]:
    """Convenience: discover + order. Used by lineage and the CLI."""
    return build_order(discover_models(models_dir))


def run(con, models: list[Model] | None = None) -> list[dict]:
    """Execute every model in dependency order against the warehouse.

    Returns one dict per model: {model, schema, rows}.
    """
    if models is None:
        models = discover_models()
    order, _ = build_order(models)
    by_name = {m.name: m for m in order}

    summary: list[dict] = []
    for model in order:
        con.execute(f"CREATE SCHEMA IF NOT EXISTS {model.schema}")
        sql = _resolve_sql(model, by_name)
        con.execute(f"CREATE OR REPLACE TABLE {model.qualified_name} AS {sql}")
        (rows,) = con.execute(
            f"SELECT COUNT(*) FROM {model.qualified_name}"
        ).fetchone()
        con.execute(
            """INSERT INTO meta.model_run (model, schema, status, rows, ran_at)
               VALUES (?, ?, 'ok', ?, current_timestamp)""",
            (model.name, model.schema, rows),
        )
        summary.append({"model": model.name, "schema": model.schema, "rows": rows})
    return summary


def lineage_markdown(models_dir=config.MODELS_DIR) -> str:
    """Human/markdown lineage from the model graph (no warehouse needed)."""
    models, edges = plan(models_dir)
    lines = ["# Model lineage", ""]
    lines.append("Executed in dependency order (upstream first):")
    lines.append("")
    for m in models:
        deps = sorted(m.refs) or ["(none)"]
        lines.append(f"- `{m.schema}.{m.name}`  ←  {', '.join(deps)}")
    lines.append("")
    lines.append("Edges:")
    lines.append("")
    for up, down in sorted(edges):
        lines.append(f"- {up} -> {down}")
    return "\n".join(lines) + "\n"
