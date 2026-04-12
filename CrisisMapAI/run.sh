#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

PYTHON=python3
VENV="$ROOT_DIR/venv"
FRONTEND_DIR="$ROOT_DIR/frontend"

function ensure_venv() {
  if [ ! -d "$VENV" ]; then
    echo "Creating Python virtual environment..."
    $PYTHON -m venv "$VENV"
  fi
  echo "Activating virtual environment..."
  # shellcheck source=/dev/null
  source "$VENV/bin/activate"
}

function install_backend_deps() {
  echo "Installing Python dependencies..."
  pip install --upgrade pip
  pip install -r requirements.txt
}

function install_frontend_deps() {
  echo "Installing frontend dependencies..."
  cd "$FRONTEND_DIR"
  npm install
  cd "$ROOT_DIR"
}

function seed_data() {
  echo "Generating deterministic seed data..."
  ./venv/bin/python scripts/generate_seed_files.py
  echo "Seeding PostgreSQL..."
  ./venv/bin/python scripts/seed_postgres.py --reset
  echo "Seeding Neo4j..."
  ./venv/bin/python scripts/seed_neo4j.py --reset
}

function validate_seed() {
  echo "Validating seeded data and algorithm readiness..."
  ./venv/bin/python validation/check_seed_integrity.py
}

function show_help() {
  cat <<EOF
Usage: ./run.sh [command]
Commands:
  setup        Create venv and install backend/frontend dependencies
  seed         Generate and bulk-seed PostgreSQL + Neo4j demo data
  validate     Run seed integrity and algorithm validation checks
  backend      Start the backend server
  frontend     Start the frontend dev server
  streamlit    Start the Streamlit emergency SOS app
  all          Run setup, seed, validate, and start backend + frontend
  help         Show this message
EOF
}

case "$1" in
  setup)
    ensure_venv
    install_backend_deps
    install_frontend_deps
    ;;
  seed)
    ensure_venv
    seed_data
    ;;
  validate)
    ensure_venv
    validate_seed
    ;;
  backend)
    ensure_venv
    echo "Starting backend..."
    ./venv/bin/python -m uvicorn backend.app.main:app --reload
    ;;
  frontend)
    echo "Starting frontend..."
    cd "$FRONTEND_DIR"
    npm run dev
    ;;
  streamlit)
    ensure_venv
    echo "Starting Streamlit SOS app..."
    ./venv/bin/python -m streamlit run streamlit_sos_app.py
    ;;
  all)
    ensure_venv
    install_backend_deps
    install_frontend_deps
    seed_data
    validate_seed
    echo "Starting backend in background..."
    ./venv/bin/python -m uvicorn backend.app.main:app --reload &
    sleep 2
    echo "Starting frontend..."
    cd "$FRONTEND_DIR"
    npm run dev
    ;;
  help|--help|-h)
    show_help
    ;;
  *)
    echo "Unknown command: $1"
    show_help
    exit 1
    ;;
esac
