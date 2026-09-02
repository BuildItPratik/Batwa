#!/usr/bin/env python
"""Batwa Analytics — CLI entry point.

Usage examples (run from the repo root with the analytics venv python):

    python analytics/run.py all                    # full ELT on best source
    python analytics/run.py all --source demo      # force synthetic source
    python analytics/run.py all --source api       # ingest live API (BATWA_ADMIN_PIN)
    python analytics/run.py extract --source local
    python analytics/run.py transform
    python analytics/run.py test                   # data-quality gate only
    python analytics/run.py report
    python analytics/run.py status                 # observability: meta tables
    python analytics/run.py lineage                # write outputs/lineage.md
    python analytics/run.py clean --yes

Exit codes: 0 ok; 1 ingest/transform error; 2 quality gate failed.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Make `import pipeline` work however the script is invoked.
sys.path.insert(0, str(Path(__file__).resolve().parent))

# Windows consoles default to a legacy code page (cp1252) that cannot encode
# ₹ / ✓ / … — reconfigure stdout/stderr to UTF-8 so prints never crash mid-run.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        try:
            _stream.reconfigure(encoding="utf-8", errors="replace")
        except (ValueError, OSError):
            pass  # e.g. a redirected or already-detached stream; printing still works

import duckdb  # noqa: E402

from pipeline import config, dag, quality, report as report_mod, transform  # noqa: E402
from pipeline.extract import run as run_extract  # noqa: E402
from pipeline.load import ensure_warehouse, land  # noqa: E402


def _open_warehouse() -> duckdb.DuckDBPyConnection:
    config.ensure_layout()
    con = duckdb.connect(str(config.WAREHOUSE_PATH))
    ensure_warehouse(con)
    return con


# ---------------------------------------------------------------------------
# Sub-commands
# ---------------------------------------------------------------------------

def cmd_all(args) -> int:
    con = _open_warehouse()
    run_id = dag.new_run_id()
    try:
        # 1. extract + land -------------------------------------------------
        print(f"[{run_id}] source={args.source}")
        src, tables = run_extract(args.source, seed=args.seed, days=args.days)
        print(f"[{run_id}] extract: {src.describe()}")
        ingest = land(con, tables, source_name=src.name)
        for table, counts in ingest.items():
            print(f"    {table:<12} loaded={counts['loaded']} new={counts['new']}")
        dag.log_task(con, run_id, "extract", "OK", src.describe())

        # 2. transform ------------------------------------------------------
        print(f"[{run_id}] transform …")
        model_summary = transform.run(con)
        for m in model_summary:
            print(f"    {m['schema'] + '.' + m['model']:<30} rows={m['rows']}")
        dag.log_task(con, run_id, "transform", "OK", f"{len(model_summary)} models")

        # 3. quality gate ---------------------------------------------------
        print(f"[{run_id}] quality …")
        results = quality.run(con)
        print(quality.format_summary(results))
        dag.log_task(con, run_id, "quality",
                     "OK" if quality.all_pass(results) else "FAILED",
                     f"{sum(1 for r in results if r.ok)}/{len(results)} passed")
        if not quality.all_pass(results):
            print(quality.format_violations(results))
            print("[run.py] quality gate FAILED — stopping before report. exit=2")
            return 2

        # 4. report ---------------------------------------------------------
        print(f"[{run_id}] report …")
        out = report_mod.generate(con, run_id=run_id, source=src.name,
                                  quality_results=results)
        kpis = out["kpis"]
        print(f"    cash digitised:  ₹{kpis['cash_digitized']:,.2f}")
        print(f"    payments:        ₹{kpis['payments_received']:,.2f}")
        print(f"    txn: {kpis['success_count']} ok / "
              f"{kpis['failed_count']} failed / {kpis['txn_count']} total")
        print(f"    window: {kpis['first_txn_date']} → {kpis['last_txn_date']}")
        print(f"    artifacts -> {out['output_dir']}")
        dag.log_task(con, run_id, "report", "OK", out["output_dir"])
        print(f"[{run_id}] done.")
        return 0
    finally:
        con.close()


def cmd_extract(args) -> int:
    con = _open_warehouse()
    try:
        src, tables = run_extract(args.source, seed=args.seed, days=args.days)
        print(f"source: {src.describe()}")
        ingest = land(con, tables, source_name=src.name)
        for table, counts in ingest.items():
            print(f"  {table:<12} loaded={counts['loaded']} new={counts['new']}")
        return 0
    finally:
        con.close()


def cmd_transform(_args) -> int:
    con = _open_warehouse()
    try:
        for m in transform.run(con):
            print(f"  {m['schema'] + '.' + m['model']:<30} rows={m['rows']}")
        return 0
    finally:
        con.close()


def cmd_test(_args) -> int:
    con = _open_warehouse()
    try:
        results = quality.run(con)
        print(quality.format_summary(results))
        if not quality.all_pass(results):
            print(quality.format_violations(results))
            return 2
        return 0
    finally:
        con.close()


def cmd_report(_args) -> int:
    con = _open_warehouse()
    try:
        out = report_mod.generate(con)
        print(f"artifacts -> {out['output_dir']}")
        return 0
    finally:
        con.close()


def cmd_status(_args) -> int:
    if not config.WAREHOUSE_PATH.exists():
        print("No warehouse yet — run `python analytics/run.py all` first.")
        return 1
    con = duckdb.connect(str(config.WAREHOUSE_PATH))
    try:
        tables = con.execute(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema='meta' ORDER BY table_name").fetchall()
        if not tables:
            print("Warehouse exists but meta tables are missing.")
            return 1
        print("latest ingest:")
        for (t, source, loaded, new, ran_at) in con.execute(
            "SELECT table_name, source, loaded, new_rows, ran_at FROM meta.ingest_run "
            "ORDER BY ran_at DESC LIMIT 5"
        ).fetchall():
            print(f"  {t:<12} loaded={loaded} new={new}  {ran_at}  [{source}]")
        print("\nlatest model materialisations:")
        for (model, schema, rows, ran_at) in con.execute(
            "SELECT model, schema, rows, ran_at FROM meta.model_run "
            "ORDER BY ran_at DESC LIMIT 12"
        ).fetchall():
            print(f"  {schema}.{model:<26} rows={rows}  {ran_at}")
        print("\nlatest quality checks:")
        for (name, status, violations, ran_at) in con.execute(
            "SELECT check_name, status, violations, ran_at FROM meta.check_run "
            "ORDER BY ran_at DESC LIMIT 8"
        ).fetchall():
            print(f"  {name:<30} {status:<5} violations={violations}  {ran_at}")
        print("\nlatest run log:")
        for (run_id, task, status, ran_at, detail) in con.execute(
            "SELECT run_id, task, status, started_at, detail FROM meta.run_log "
            "ORDER BY started_at DESC LIMIT 10"
        ).fetchall():
            print(f"  {run_id}  {task:<10} {status:<5}  {ran_at}  {detail}")
        return 0
    finally:
        con.close()


def cmd_lineage(args) -> int:
    config.ensure_layout()
    config.OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    md = transform.lineage_markdown()
    target = config.OUTPUTS_DIR / "lineage.md"
    target.write_text(md, encoding="utf-8")
    print(md)
    print(f"lineage written to {target}")
    return 0


def cmd_clean(args) -> int:
    if not args.yes:
        print("This deletes the warehouse and all outputs. Re-run with --yes.")
        return 1
    removed = []
    for path in (config.WAREHOUSE_DIR, config.OUTPUTS_DIR, config.SAMPLE_DIR):
        if path.exists():
            import shutil

            shutil.rmtree(path, ignore_errors=True)
            removed.append(str(path))
    print("removed:\n  " + "\n  ".join(removed) if removed else "nothing to remove")
    return 0


# ---------------------------------------------------------------------------
# Parser
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="analytics/run.py",
        description="Batwa data-engineering pipeline (extract -> model -> quality -> report).",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    def _common_source(p: argparse.ArgumentParser) -> None:
        p.add_argument(
            "--source", default=config.DEFAULT_SOURCE,
            choices=config.SOURCE_CHOICES,
            help="auto | demo | local | api (default: auto → local if populated, else demo)",
        )
        p.add_argument("--seed", type=int, default=config.DEFAULT_SEED,
                       help="deterministic seed for the synthetic demo source")
        p.add_argument("--days", type=int, default=config.DEFAULT_DAYS,
                       help="days of synthetic history for the demo source")

    p_all = sub.add_parser("all", help="extract + transform + quality + report")
    _common_source(p_all)
    p_all.set_defaults(func=cmd_all)

    p_extract = sub.add_parser("extract", help="ingest a source into bronze only")
    _common_source(p_extract)
    p_extract.set_defaults(func=cmd_extract)

    p_transform = sub.add_parser("transform", help="run the SQL model layer")
    p_transform.set_defaults(func=cmd_transform)

    p_test = sub.add_parser("test", help="run the data-quality gate")
    p_test.set_defaults(func=cmd_test)

    p_report = sub.add_parser("report", help="regenerate KPI artifacts")
    p_report.set_defaults(func=cmd_report)

    p_status = sub.add_parser("status", help="show meta tables (run observability)")
    p_status.set_defaults(func=cmd_status)

    p_lineage = sub.add_parser("lineage", help="write model lineage to outputs/")
    p_lineage.set_defaults(func=cmd_lineage)

    p_clean = sub.add_parser("clean", help="delete warehouse + outputs + sampledata")
    p_clean.add_argument("--yes", action="store_true")
    p_clean.set_defaults(func=cmd_clean)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except Exception as exc:  # noqa: BLE001 — CLI should always exit cleanly
        print(f"[run.py] error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
