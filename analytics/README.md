# Batwa Analytics — data-engineering add-on

A self-contained **data-engineering pipeline** over Batwa's operational data.
It is deliberately *not* part of the live demo: it lives entirely in this
`analytics/` folder, runs offline, and does not touch the backend or frontend.

What it demonstrates, end to end:

| Layer | What it does here |
|---|---|
| **Ingest** | One `Source` interface, three backends: a deterministic synthetic DB (`demo`), the app's real SQLite (`local`), and the **live deployed API** (`api`, bearer-auth over HTTP). |
| **Load (bronze)** | Lands operational rows into a DuckDB warehouse (`raw.*`), idempotently — facts append only rows whose natural key is new, dims are snapshotted. |
| **Transform (silver/gold)** | A ~100-line **mini-dbt**: SQL models declare `{{ ref('model') }}`, the runner builds a dependency DAG, resolves refs to `schema.table`, executes topologically, errors on cycles. silver = `stg_*` cleaned; gold = `dim_*` / `fct_*` / `kpi_*`. |
| **Quality** | A data-quality gate: one SQL file per check returns offending rows; the gate fails the run when any check finds violations. |
| **Observability** | Every task, model materialisation and check is written to `meta.*` tables — queryable via `run.py status`. |
| **Publish** | KPI report as Markdown + CSV, curated Parquet exports of gold, and a bronze snapshot under `outputs/raw/`. |
| **Serve** | The admin **Analytics** page (`/admin/analytics`) is served **live** — the backend computes KPIs/tables straight from `batwa.db` per request (`backend/services/analytics_live.py`), so no pipeline run is needed for the UI. This pipeline's CSV/Parquet exports remain the offline artifact/report layer (`backend/services/analytics_reader.py` still reads them read-only for that use). |

The stack is intentionally light: **Python + DuckDB** (single runtime
dependency) + SQL. No pandas, no dbt, no Airflow — but the design maps 1:1
onto those tools, which is the point to make in an interview.

---

## Quick start

```bash
cd analytics

# one-time (Windows: setup.bat)
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt      # (POSIX: .venv/bin/pip)

# full run: extract -> model -> quality -> report
.venv\Scripts\python run.py all
```

`all` defaults to `--source auto`: it uses `backend/batwa.db` when the app DB
exists **and** has transactions, otherwise it generates the synthetic `demo`
source so the run always works out of the box. Outputs land in
`analytics/outputs/` and `analytics/warehouse/batwa.duckdb` (both gitignored).

### Sources

```bash
python run.py all --source demo    # deterministic synthetic history (default fallback)
python run.py all --source local   # real backend/batwa.db (seed + drive the backend first)
python run.py all --source api     # live https://batwa-xrt4.onrender.com
```

Environment overrides (names reuse the backend's conventions):

| Env var | Meaning | Default |
|---|---|---|
| `BATWA_ADMIN_PIN` | Admin PIN for the `api` source auth | `2468` |
| `BATWA_API_BASE` | Live API base URL | `https://batwa-xrt4.onrender.com` |
| `BATWA_API_TIMEOUT` | HTTP timeout (s) | `30` |

## Commands

| Command | Does what |
|---|---|
| `run.py all [--source …]` | Full pipeline; exits **2** if the quality gate fails |
| `run.py extract [--source …]` | Ingest only → bronze |
| `run.py transform` | Run the model layer → silver + gold |
| `run.py test` | Run the data-quality gate only |
| `run.py report` | Regenerate artifacts from an existing warehouse |
| `run.py lineage` | Write `outputs/lineage.md` (no warehouse needed) |
| `run.py status` | Show recent `meta.*` activity |
| `run.py clean --yes` | Delete warehouse, outputs, sampledata |

Seed knobs for the synthetic source: `--seed 20260902 --days 14`.

## Architecture

```
              ┌───────────────────────────────────────────────────────┐
  Operational │ demo  → analytics/sampledata/batwa_demo.db (synthetic)│
  sources     │ local → backend/batwa.db                (real app DB) │
              │ api   → live REST (admin auth → /transactions)        │
              └────────────────────────┬──────────────────────────────┘
                                       │ extract (python sqlite3 / urllib, no requests)
                                       ▼
 bronze   raw.customers · cards · agents · merchants · transactions
          (DuckDB; idempotent landing, natural-key dedupe)
                                       │ transform  (ref() mini-dbt)
                                       ▼
 silver   stg_transactions · stg_customers · stg_cards · stg_agents · stg_merchants
 gold     dim_customer · dim_card · dim_agent · dim_merchant · dim_date
          fct_transactions · kpi_daily_volume
                                       │
                                       ▼
 quality  7 named SQL checks → meta.check_run (gate, fail = exit 2)
 report   outputs/{report.md, *.csv, fct/dim/*.parquet, raw/*.parquet}
 meta     run_log · model_run · check_run · ingest_run   (observability)
```

Lineage (exact, auto-derived from `ref()` tokens):

```
silver.stg_transactions ← raw.transactions
silver.stg_customers    ← raw.customers
silver.stg_cards        ← raw.cards
silver.stg_agents       ← raw.agents
silver.stg_merchants    ← raw.merchants
gold.dim_customer       ← stg_customers, stg_cards
gold.dim_card           ← stg_cards
gold.dim_agent          ← stg_agents
gold.dim_merchant       ← stg_merchants
gold.dim_date           ← stg_transactions
gold.fct_transactions   ← stg_transactions, dim_customer, dim_agent, dim_merchant, dim_date
gold.kpi_daily_volume   ← fct_transactions
```

## Data-quality checks (`pipeline/checks/`)

Each file is one check that returns *offending* rows (pass = zero rows):

| Check | Invariant |
|---|---|
| `no_duplicate_txns` | `txn_id` is unique in the fact table |
| `fk_customer_exists` | every `customer_id` references a known customer (NULL allowed for `CARD_NOT_FOUND`/`LIMIT_EXCEEDED`) |
| `status_in_set` | `status ∈ {SUCCESS, FAILED}` |
| `type_in_set` | `type ∈ {TOPUP, PAYMENT, REISSUE, BLOCK}` |
| `failure_reason_consistency` | SUCCESS rows carry no reason; FAILED rows carry an allowed reason; lifecycle rows carry none; over-limit payments must be `FAILED LIMIT_EXCEEDED` |
| `payment_within_100_limit` | successful payments ≤ ₹100 (backend `PAYMENT_LIMIT`) |
| `amounts_nonnegative` | amounts are never negative (NULL allowed for lifecycle) |

Note the `failure_reason` whitelist includes `AGENT_NOT_FOUND`: the backend
code emits it but the API reference doc omits it — the whitelist follows the
**code**, not the stale doc. That kind of discrepancy is a good thing to be
able to point at.

## Interview talking points

1. **Source abstraction**: one interface, three backends (DB files + a live
   authenticated REST API). Adding a new source is a ~20-line class.
2. **Idempotent, incremental landing**: natural-key anti-join; re-running the
   extract never duplicates facts (prove with `run.py extract` twice and watch
   `new=0`).
3. **The model layer**: models are plain SQL; `ref()` gives you a lineage DAG;
   the runner executes in dependency order and rejects unknown refs / cycles.
   `run.py lineage` emits the graph — no dbt required, but the ideas are dbt's.
4. **Data quality as a gate**: declarative SQL checks that return offending
   rows; CI-style pass/fail with a non-zero exit and a `meta.check_run` trail.
5. **Observability**: `meta.run_log` / `model_run` / `check_run` / `ingest_run`
   make every run inspectable — `run.py status` is the "what happened"
   surface (maps to Airflow/Dagster run metadata).
6. **Synthetic, self-consistent test data**: `demo_data.py` reproduces
   plausible weeks of activity where `customer.balance == Σ topups − Σ
   payments`, so the data itself encodes business invariants and always passes
   the suite. Deterministic per seed.
7. **Honest modeling notes** (know the caveats before an interviewer raises
   them):
   - A single fact spans money-movement (`TOPUP`/`PAYMENT`) and lifecycle
     (`BLOCK`/`REISSUE`) events; a fully conformed design would split
     money-movement facts. The `counterparty_role` column documents the
     intent.
   - Customer/merchant/agent "dimensions" are current-state snapshots (SCD
     type 1). The operational DB keeps no history, so slow-changing dimensions
     would need CDC/log-based capture upstream — out of scope here.
   - `demo` data, like the app itself, is simulation: balances reconcile to
     the ledger because the generator enforces it, not because a bank moved
     money.

## Tests

```bash
cd analytics
.venv\Scripts\python -m pytest tests -q
```

Covers: demo-data determinism + ledger reconciliation, idempotent landing,
DAG ordering/cycle detection, quality gate on clean *and* corrupted data,
report artifact generation. No network and no real backend DB are used.

## Layout

```
analytics/
├── run.py                 CLI (all | extract | transform | test | report | status | lineage | clean)
├── requirements.txt       duckdb + pytest
├── setup.bat / setup.sh   one-time venv bootstrap
├── pipeline/
│   ├── config.py          paths, sources, env overrides, closed value sets
│   ├── source.py           Source interface: demo / local / api + resolver
│   ├── demo_data.py        deterministic synthetic operational history
│   ├── extract.py          extract entry point
│   ├── load.py             bronze landing (DuckDB), idempotent
│   ├── transform.py        ref() mini-dbt: DAG + materialisation + model_run
│   ├── models/             stg_* (silver) · dim_* · fct_* · kpi_* (gold) SQL
│   ├── quality.py          quality gate runner
│   ├── checks/             seven named SQL data-quality checks
│   ├── dag.py              task orchestration + run_log
│   └── report.py           KPI artifacts (md/csv/parquet)
├── tests/                  pytest suite (offline, tmp warehouses)
├── warehouse/              batwa.duckdb        (gitignored)
├── outputs/                reports + exports    (gitignored)
└── sampledata/             generated demo db    (gitignored)
```
