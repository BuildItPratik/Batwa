"""Quality gate: clean demo data passes; a planted duplicate is caught."""

from __future__ import annotations

from conftest import transform_all
from pipeline import quality
from pipeline import source as source_mod
from pipeline.load import land


def _kpis_ok(con) -> bool:
    results = quality.run(con)
    return quality.all_pass(results)


def test_demo_data_passes_all_checks(loaded_warehouse):
    transform_all(loaded_warehouse)
    results = quality.run(loaded_warehouse)
    assert quality.all_pass(results), "\n" + quality.format_violations(results)
    assert len(results) == 7  # one check file per named check


def test_duplicate_txn_fails_no_duplicate_check(loaded_warehouse):
    transform_all(loaded_warehouse)
    # Plant a second copy of an existing fact row (same txn_id).
    loaded_warehouse.execute(
        "INSERT INTO gold.fct_transactions SELECT * FROM gold.fct_transactions LIMIT 1"
    )
    results = quality.run(loaded_warehouse)
    by_name = {r.name: r for r in results}
    assert by_name["no_duplicate_txns"].status == "FAIL"
    assert by_name["no_duplicate_txns"].violations >= 1


def test_gate_failure_surfaces_violation_sample(demo_db, warehouse):
    path, _ = demo_db
    tables = source_mod.read_sqlite(path)
    land(warehouse, tables, source_name="test")
    transform_all(warehouse)
    # Corrupt one over-limit payment: mark it SUCCESS so it must be flagged by
    # payment_within_100_limit (and failure_reason_consistency).
    warehouse.execute(
        "UPDATE gold.fct_transactions SET status='SUCCESS' "
        "WHERE txn_id = (SELECT txn_id FROM gold.fct_transactions "
        "                WHERE type='PAYMENT' AND amount > 100 LIMIT 1)"
    )
    results = quality.run(warehouse)
    failures = [r for r in results if not r.ok]
    assert failures
    assert quality.format_violations(results)  # non-empty report
