# Pulsegrid

Pulsegrid is a full-stack emergency coordination platform for real-time disaster response. It features explainable backend decision logic for SOS triage, safe routing, responder assignment, volunteer matching, supply planning, and operational visibility.

---

## Table of Contents
- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Running Locally](#running-locally)
- [Seeding Demo Data](#seeding-demo-data)
- [Scripts](#scripts)
- [API Endpoints](#api-endpoints)
- [Testing](#testing)
- [Deployment & CI](#deployment--ci)
- [Best Practices](#best-practices)
- [License](#license)

---

## Features
- SOS submission workflow (victim, responder, coordinator)
- Priority scoring and severity inference
- Safe route and backup route planning
- Responder and volunteer assignment
- Incident resolution tracking
- Real-time dashboard and map views
- Deterministic demo data seeding for hackathons

---

## Architecture
- **Backend:** FastAPI (Python)
- **Frontend:** React (Vite)
- **Database:** PostgreSQL (incidents, users, results)
- **Graph:** Neo4j (zones, roads, facilities)
- **Other:** Docker, Node.js, Python scripts

---

## Prerequisites
- Python 3.11+
- Node.js 18+
- Docker
- PostgreSQL (local or via Docker)
- Neo4j 5+ (local or via Docker)

---

## Environment Setup
1. **Clone the repository:**
	```bash
	git clone <your-repo-url>
	cd Pulsegrid
	```
2. **Copy and edit environment files:**
	```bash
	cp .env.example .env
	cp PulsegridAI/frontend/.env.example PulsegridAI/frontend/.env
	```
	Edit `.env` and `frontend/.env` with your local credentials and API keys.
3. **Start databases (if using Docker):**
	```bash
	docker compose up -d
	```

---

## Running Locally
1. **Backend:**
	```bash
	cd PulsegridAI
	python3 -m venv venv
	source venv/bin/activate
	pip install -r requirements.txt
	python -m uvicorn backend.app.main:app --reload
	```
2. **Frontend:**
	```bash
	cd PulsegridAI/frontend
	npm install
	npm run dev
	```

---

## Seeding Demo Data
1. **Reset and seed demo data:**
	```bash
	bash reset_and_seed.sh
	```
	- This clears old data and loads `mock_data.json` and responder/zone seeds.
2. **(Optional) Custom seed:**
	- Edit `PulsegridAI/mock_data.json` and `data/seed/responders_seed.json` as needed.

---

## Scripts
- `reset_and_seed.sh` — Resets and seeds demo data for a clean demo state.
- `scripts/seed_demo_data.py` — Loads mock SOS/victim data into PostgreSQL.
- `scripts/generate_seed_files.py` — Generates deterministic demo data.
- `scripts/seed_postgres.py` — Bulk seeds operational tables.
- `scripts/seed_neo4j.py` — Bulk seeds Neo4j nodes and relationships.
- `validation/check_seed_integrity.py` — Verifies seed counts and sample logic.

---

## API Endpoints
- **Backend docs:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Frontend:** [http://127.0.0.1:5173](http://127.0.0.1:5173)

**Key endpoints:**
- `POST /api/sos` — Submits an SOS and runs the full decision pipeline.
- `GET /api/incidents/{sos_id}/replay` — Returns stored case results for replay/audit.

---

## Testing
Run backend tests:
```bash
python -m pytest backend/tests/
```
Check seed/demo data integrity:
```bash
python validation/check_seed_integrity.py
```

---

## Deployment & CI
- GitHub Actions workflow in `.github/workflows/ci.yml` runs backend tests and frontend build on every push.
- Do **not** commit `.env` or `frontend/.env` files.
- Default config values are safe for local/demo use.

---

## Best Practices
- Always reset and seed demo data before a live demo for predictable results.
- Never commit real credentials or secrets.
- Use the provided scripts for setup, seeding, and validation.
- For hackathons, keep only your demo cases in the database for clarity.

---

## License
MIT License (or your chosen license)

---

**For questions or contributions, open an issue or pull request on GitHub.**

