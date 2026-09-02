@echo off
REM Batwa Analytics — one-time setup for Windows.
cd /d "%~dp0"

if not exist .venv (
  python -m venv .venv
)

call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt

python -c "import duckdb; print('[ok] duckdb', duckdb.__version__)"
