"""Batwa Analytics — a self-contained data-engineering pipeline.

Ingest Batwa's operational data (a printed-QR-card payment simulation) into a
DuckDB warehouse, model it bronze/silver/gold, gate it with data-quality
checks, and publish KPI artifacts. See analytics/README.md.
"""

__version__ = "0.1.0"
