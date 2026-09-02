"""Data-quality gate over the gold layer.

Every file in ``pipeline/checks/`` is one named check: a SQL query that
returns the *offending* rows. A check passes when it returns zero rows.
Runner output is written to ``meta.check_run`` and surfaced in the CLI so a
failed check fails the pipeline run loudly (exit code != 0).

Why this shape: checks are declarative, greppable, versioned SQL next to the
models they protect, and new checks are added by dropping in a file.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from . import config

MAX_VIOLATIONS_SHOWN = 5  # rows printed per failing check in the summary


@dataclass
class CheckResult:
    name: str
    title: str
    sql: str
    status: str          # PASS | FAIL
    violations: int = 0
    sample: list[tuple] = None  # type: ignore[assignment]

    @property
    def ok(self) -> bool:
        return self.status == "PASS"


def _title_of(sql: str, fallback: str) -> str:
    for line in sql.splitlines():
        stripped = line.strip()
        if stripped.startswith("--"):
            candidate = stripped.lstrip("- ").strip()
            if candidate and not candidate.lower().startswith(("check:", "desc")):
                return candidate
    return fallback


def list_checks(checks_dir=config.CHECKS_DIR) -> list[Path]:
    checks_dir = Path(checks_dir)
    return sorted(checks_dir.glob("*.sql"))


def run(con, checks_dir=config.CHECKS_DIR) -> list[CheckResult]:
    """Execute every check; returns PASS/FAIL results per check."""
    results: list[CheckResult] = []
    for path in list_checks(checks_dir):
        sql = path.read_text(encoding="utf-8").strip()
        if not sql:
            continue
        name = path.stem
        title = _title_of(sql, name)
        rows = con.execute(sql).fetchall()
        status = "PASS" if len(rows) == 0 else "FAIL"
        results.append(CheckResult(
            name=name,
            title=title,
            sql=sql,
            status=status,
            violations=len(rows),
            sample=rows[:MAX_VIOLATIONS_SHOWN],
        ))
        con.execute(
            """INSERT INTO meta.check_run (check_name, status, violations, ran_at)
               VALUES (?, ?, ?, current_timestamp)""",
            (name, status, len(rows)),
        )
    return results


def all_pass(results: list[CheckResult]) -> bool:
    return all(r.ok for r in results)


def format_summary(results: list[CheckResult]) -> str:
    width = max(len(r.name) for r in results) + 2
    lines = ["data-quality checks:"]
    for r in results:
        mark = "ok " if r.ok else "FAIL"
        extra = "" if r.ok else f"  ({r.violations} violating row(s))"
        lines.append(f"  [{mark}] {r.name:<{width}}{r.title}{extra}")
    return "\n".join(lines)


def format_violations(results: list[CheckResult]) -> str:
    parts = []
    for r in results:
        if r.ok:
            continue
        head = f"{r.name}: {r.title} ({r.violations} violating row(s))"
        parts.append(head)
        if r.sample:
            parts.append("  example rows: " + ", ".join(str(row) for row in r.sample))
        if r.violations > len(r.sample):
            parts.append(f"  … and {r.violations - len(r.sample)} more")
    return "\n".join(parts)
