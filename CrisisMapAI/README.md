# CrisisMap AI

CrisisMap AI is a full-stack emergency coordination platform with explainable backend decision logic for SOS triage, routing, responder assignment, volunteer matching, supply planning, and graph-based operational visibility.

## What This Repo Contains

- FastAPI backend for SOS intake and coordination logic
- React/Vite frontend for emergency operations workflows
- PostgreSQL persistence for registrations, seeded operational data, and algorithm results
- Neo4j graph layer for zones, roads, responders, hospitals, shelters, and depots
- Deterministic seeding + validation scripts for end-to-end demo setup

## Backend Algorithms

- Priority Queue via binary heap
- Bayesian Severity Inference
- Rule-based dispatch mode selection
- Dijkstra safe routing with constraints
- Yen's K-shortest backup routes
- Hungarian responder assignment
- Gale-Shapley volunteer matching
- Min-cost max-flow supply distribution

## Prerequisites

- Python 3.11+
- Node.js 18+
- Docker
- PostgreSQL (via `docker-compose.yml`)
- Neo4j 5+

## Environment Setup

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Update values as needed in `.env`.
Important:
- `POSTGRES_URL`
- `NEO4J_URI`
- `NEO4J_USER`
- `NEO4J_PASSWORD`
- `OPENAI_API_KEY` if you want LLM-generated messages

3. For the frontend, copy the example file locally:
```bash
cp frontend/.env.example frontend/.env
```

## Local Run From Scratch

From the repo root:

```bash
docker compose up -d
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cd frontend && npm install && cd ..
```

Generate and seed demo data:

```bash
python scripts/generate_seed_files.py
python scripts/seed_postgres.py --reset
python scripts/seed_neo4j.py --reset
python validation/check_seed_integrity.py
```

Start the backend:

```bash
python -m uvicorn backend.app.main:app --reload
```

Start the frontend in another terminal:

```bash
cd frontend
npm run dev
```

## Useful Scripts

- `python scripts/generate_seed_files.py`
  Generates deterministic demo data under `data/seed/`
- `python scripts/seed_postgres.py --reset`
  Bulk seeds PostgreSQL operational and result tables
- `python scripts/seed_neo4j.py --reset`
  Bulk seeds Neo4j nodes and relationships with `UNWIND`
- `python scripts/reset_data.py`
  Clears Postgres and Neo4j demo data
- `python validation/check_seed_integrity.py`
  Verifies seed counts and runs sample algorithm checks
- `./run.sh setup`
  Installs backend and frontend dependencies into a local `venv`
- `./run.sh seed`
  Generates and bulk-loads deterministic demo data into PostgreSQL and Neo4j
- `./run.sh validate`
  Runs the end-to-end integrity checks used before demoing or publishing

## API Notes

- `POST /api/sos`
  Runs the full decision pipeline and returns `algorithm_results`
- `GET /api/incidents/{sos_id}/replay`
  Returns stored case results for replay/audit

Backend docs:

- `http://127.0.0.1:8000/docs`

Frontend:

- `http://127.0.0.1:5173`

## Testing

Run focused backend tests:

```bash
python -m pytest backend/tests/test_operational_logic.py backend/tests/test_seed_factory.py backend/tests/test_seed_pipeline.py
```

## GitHub Readiness Notes

- `.env`, `frontend/.env`, `venv/`, `node_modules/`, caches, and logs are ignored
- seed data under `data/seed/` is included intentionally for reproducible demos
- default config values are safe local placeholders, not live credentials
- `run.sh` now matches the current bulk-seed + validation flow

## Before You Push

1. Make sure you do not commit `.env` or `frontend/.env`
2. Confirm Neo4j/Postgres credentials in your local `.env` are not production secrets
3. Run:
```bash
python -m pytest backend/tests/test_operational_logic.py backend/tests/test_seed_factory.py backend/tests/test_seed_pipeline.py
```
4. Run:
```bash
python validation/check_seed_integrity.py
```
5. Initialize git inside `CrisisMapAI` if needed, then add your remote and push
