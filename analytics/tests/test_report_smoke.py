"""Report step writes parquet/csv/markdown artifacts for a built warehouse."""

from __future__ import annotations

import json

from conftest import transform_all
from pipeline import report


def test_report_artifacts(loaded_warehouse, tmp_path):
    transform_all(loaded_warehouse)
    out_dir = tmp_path / "out"
    out = report.generate(loaded_warehouse, outputs_dir=out_dir)

    assert (out_dir / "report.md").exists()
    assert (out_dir / "kpis_overview.csv").exists()
    assert (out_dir / "failure_by_reason.csv").exists()
    assert (out_dir / "daily_volume.csv").exists()
    assert (out_dir / "top_merchants.csv").exists()
    assert (out_dir / "run_status.json").exists()
    assert (out_dir / "fct_transactions.parquet").exists()
    assert (out_dir / "dim_customer.parquet").exists()
    assert (out_dir / "raw" / "transactions.parquet").exists()

    kpis = out["kpis"]
    assert kpis["txn_count"] > 0
    assert kpis["payments_received"] >= 0
    assert "cash_digitized" in kpis

    md = (out_dir / "report.md").read_text(encoding="utf-8")
    assert "Headline KPIs" in md
    assert "cash digitised" in md.lower() or "Cash digitised" in md


def test_run_status_json(loaded_warehouse, tmp_path):
    from pipeline.quality import CheckResult

    transform_all(loaded_warehouse)
    out_dir = tmp_path / "out"
    results = [
        CheckResult(name="a", title="A", sql="", status="PASS"),
        CheckResult(name="b", title="B", sql="", status="FAIL", violations=3),
    ]
    report.generate(loaded_warehouse, outputs_dir=out_dir,
                    run_id="run_test", source="demo", quality_results=results)

    status = json.loads((out_dir / "run_status.json").read_text(encoding="utf-8"))
    assert status["run_id"] == "run_test"
    assert status["source"] == "demo"
    assert status["ran_at"]
    assert status["quality_checks"] == {"passed": 1, "total": 2, "ok": False}


def test_run_status_json_without_quality(loaded_warehouse, tmp_path):
    transform_all(loaded_warehouse)
    out_dir = tmp_path / "out"
    report.generate(loaded_warehouse, outputs_dir=out_dir)  # standalone report

    status = json.loads((out_dir / "run_status.json").read_text(encoding="utf-8"))
    assert status["run_id"] == "standalone"
    assert status["quality_checks"]["total"] == 0
    assert status["quality_checks"]["ok"] is None


def test_failure_report_categories(loaded_warehouse, tmp_path):
    transform_all(loaded_warehouse)
    failures = report.failure_by_reason(loaded_warehouse)
    # INSUFFICIENT_BALANCE is guaranteed by the demo generator (creation day).
    reasons = {row[0] for row in failures}
    assert "INSUFFICIENT_BALANCE" in reasons
