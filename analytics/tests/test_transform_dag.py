"""Transform mini-dbt: ref resolution, dependency ordering, cycle detection."""

from __future__ import annotations

import pytest

from pipeline.transform import (
    CycleError,
    Model,
    UnknownRefError,
    build_order,
    discover_models,
    lineage_markdown,
)


def _m(name: str, refs: list[str]) -> Model:
    schema = "silver" if name.startswith("stg_") else "gold"
    sql = "SELECT 1 AS x " + " ".join(f"{{{{ ref('{r}') }}}}" for r in refs)
    return Model(name=name, path=None, sql=sql, schema=schema, refs=set(refs))  # type: ignore[arg-type]


def test_discover_returns_all_models():
    models = discover_models()
    names = {m.name for m in models}
    assert {"stg_transactions", "fct_transactions", "dim_customer",
            "kpi_daily_volume"} <= names
    assert all(m.schema in ("silver", "gold") for m in models)


def test_order_is_upstream_first():
    order, _ = build_order(discover_models())
    rank = {m.name: i for i, m in enumerate(order)}
    # silver staging builds before its consumers.
    assert rank["stg_transactions"] < rank["dim_date"]
    assert rank["stg_customers"] < rank["dim_customer"]
    # dims build before the fact, and the fact before the KPI aggregate.
    assert rank["dim_customer"] < rank["fct_transactions"]
    assert rank["fct_transactions"] < rank["kpi_daily_volume"]
    # edges reference real upstreams.
    assert len(order) == 12


def test_unknown_ref_is_rejected():
    models = [discover_models()[0], _m("dim_x", ["does_not_exist"])]
    with pytest.raises(UnknownRefError):
        build_order(models)


def test_cycle_is_detected():
    models = [_m("fct_a", ["fct_b"]), _m("fct_b", ["fct_a"])]
    with pytest.raises(CycleError):
        build_order(models)


def test_lineage_markdown_includes_schema_and_edges():
    md = lineage_markdown()
    assert "silver.stg_transactions" in md
    assert "gold.fct_transactions" in md
    assert " -> " in md
