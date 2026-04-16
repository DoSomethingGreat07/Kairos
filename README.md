# PulseGrid — Real-Time Graph-Based Disaster Response Optimization System

A graph-powered, algorithm-driven platform that prioritizes SOS alerts, assigns responders, computes safe routes, and coordinates emergency resources in real time.

---

## 1. Overview

Disaster response systems often fail at the exact moment they need to perform best.
In high-pressure scenarios such as floods, fires, earthquakes, and urban emergencies, decision-makers must reason across incidents, responders, roads, hospitals, shelters, supplies, and constantly changing constraints.
Traditional coordination systems usually split these decisions across disconnected dashboards, spreadsheets, radio workflows, or static GIS tools.
That fragmentation creates delay, confusion, duplicated effort, and unsafe dispatch decisions.

PulseGrid is designed to solve that coordination gap.
It models emergency response as a connected graph problem and applies optimization algorithms across the operational state of the system.
Instead of treating an SOS request as an isolated form submission, the platform evaluates it as part of a live emergency network:
which responder is best suited,
which route is safest,
which hospital or shelter is still viable,
which volunteer can support,
and how all of that changes when roads fail or capacity shifts.

Graph-based reasoning is especially useful in disaster operations because relationships matter more than isolated records.
An incident is not just a data row.
It is connected to a zone, to roads, to facilities, to responder capability constraints, to volunteer availability, and to downstream capacity decisions.
PulseGrid uses that connected structure to make faster and more explainable coordination decisions.

The result is a system that improves operational clarity, shortens response cycles, supports fallback planning, and makes backend intelligence visible to both emergency users and technical reviewers.

---

## 2. Key Features

- **SOS Alert Intake and Prioritization**  
  Collects incident details from victims and converts them into structured triage-ready cases with priority scoring.

- **Real-Time Responder Assignment**  
  Matches incidents to the most suitable responder based on role, capability, availability, distance, and operational constraints.

- **Safe Route Computation with Backup Routes**  
  Generates a primary route and fallback alternatives so dispatch can adapt when the road graph changes.

- **Volunteer and Shelter Coordination**  
  Identifies supporting volunteer matches and viable shelter options for overflow, evacuation, or relief cases.

- **Hospital Capability Matching**  
  Selects destinations based on available beds, intake readiness, and graph reachability instead of static proximity alone.

- **ETA Calculation and Tracking**  
  Computes estimated arrival times and updates them as route choice and incident state evolve.

- **Real-Time Dashboard Updates**  
  Pushes live incident and operations changes to dashboards using WebSockets.

- **Decision Explainability Panel**  
  Surfaces why a responder, route, or destination was selected and what alternatives were rejected.

- **Failure Simulation Mode**  
  Demonstrates dynamic re-optimization when roads are blocked, responders go offline, or facilities reach capacity.

- **Real-Time Map Tracking**  
  Displays incidents, responders, zones, routes, blocked paths, and selected destinations on a live operational map.

- **Supply Distribution Optimization**  
  Supports resource planning using cost-aware network flow logic across depots, shelters, and demand points.

---

## 3. System Architecture

PulseGrid is organized as a layered real-time coordination system.

### Frontend Layer

The frontend provides the operational interface used by victims, responders, and organizations.
It includes:

- SOS submission workflows
- responder dashboards
- organization and coordinator consoles
- map-based operational views
- explainability and timeline panels
- simulation controls for demo scenarios

### Backend Services

The backend is built on FastAPI and exposes API endpoints for:

- authentication and profile retrieval
- SOS intake
- incident replay and tracking
- registration workflows
- dashboard metrics
- responder and organization scoped views
- voice-triggered SOS support

### Neo4j Graph Database

Neo4j stores the connected operational graph:

- zones
- roads
- responders
- hospitals
- shelters
- supplies
- incident-resource relationships

This supports relationship-aware routing, graph seeding, and visual graph reasoning.

### PostgreSQL Operational Store

PostgreSQL is used as the persistent operational and application state store for:

- authentication
- profile data
- registration drafts
- incident snapshots
- case execution logs
- algorithm outputs
- replay payloads

### WebSocket Event System

A WebSocket broadcaster distributes live updates such as:

- incident updates
- dashboard refresh events
- assignment changes
- timeline state changes

This keeps the operational UI synchronized without requiring full page reloads.

### Algorithm Modules

The backend decision pipeline is modular.
Each optimization or inference stage runs independently and persists its output for replay and explainability.

### LLM Messaging Layer

PulseGrid also includes a messaging layer for human-readable guidance and response communication.
This allows system decisions to be translated into understandable user-facing instructions and operational summaries.

### Architecture Diagram Image

![System Architecture](assets/architecture.png)

---

## 4. Core Algorithms Used

### Priority Queue

Used to rank incoming SOS cases so high-risk incidents can be surfaced first for triage and dispatch.
This prevents urgent emergencies from being buried in first-in-first-out processing.

### Bayesian Inference

Used to estimate incident severity from incomplete or uncertain inputs.
This helps the system reason probabilistically when user-provided details are partial, noisy, or inconsistent.

### Dijkstra with Constraints

Used to compute the safest feasible route through the road graph.
Unlike basic shortest-path routing, this version incorporates blocked roads, safety filters, and path viability constraints.

### Yen’s K-Shortest Paths

Used to generate backup routes beyond the primary path.
This enables live fallback planning when the first route becomes unavailable or operationally unsafe.

### Hungarian Algorithm

Used to optimize responder assignment across competing incident demands.
This makes assignment decisions more globally efficient than greedy nearest-unit matching.

### Gale-Shapley Algorithm

Used to match volunteers to tasks or support needs in a stable way.
It is useful where multiple volunteers and needs exist and pairings should avoid unstable allocation.

### Min-Cost Max-Flow

Used for supply distribution and resource movement across the network.
This helps route supplies to demand points while minimizing transport cost and respecting network capacity.

---

## 5. Technology Stack

### Backend

- Python
- FastAPI
- Pydantic
- Psycopg / PostgreSQL client

### Frontend

- React
- Vite
- Tailwind / utility-first styling patterns

### Database

- PostgreSQL
- Neo4j

### Real-Time Communication

- WebSockets

### Algorithms

- Graph optimization algorithms
- Assignment algorithms
- Probabilistic inference logic
- Network flow optimization

### Visualization

- Interactive dashboard UI
- Map visualization components
- Timeline and explainability panels

### AI Layer

- RocketRide AI / LLM-backed messaging layer for guidance and explanation flows

### DevOps / Tooling

- Docker
- GitHub Actions
- Python test tooling
- Vite frontend build pipeline
- Deterministic seed generation and validation scripts
- CI-ready backend/frontend build checks

---

## 6. Data Model (Graph Schema)

The system models emergency operations as a connected graph.

### Key Node Types

- **Incident**  
  A live SOS case that moves through triage, assignment, routing, and resolution.

- **Responder**  
  A trained operational unit with role, capability, coverage, and availability constraints.

- **Volunteer**  
  A support participant used when augmentation is needed.

- **Shelter**  
  A destination node with occupancy, capacity, and support characteristics.

- **Hospital**  
  A medical facility node with capability and bed availability constraints.

- **Zone**  
  A geographic or logical response area used for location reasoning and graph routing.

- **Road**  
  A graph edge entity representing connectivity, travel cost, safety, and passability between zones.

### Key Relationships

- **LOCATED_IN**  
  Connects incidents, facilities, or responders to zones.

- **CONNECTED_TO**  
  Connects zones or roads to represent traversable network structure.

- **ASSIGNED_TO**  
  Connects incidents to responders after assignment.

- **ROUTED_TO**  
  Connects incidents or responder plans to destinations.

- **AVAILABLE_AT**  
  Represents responder or resource availability within a specific zone or facility.

- **SERVES**  
  Represents facility or organization service relationships across the response network.

### Graph Schema Diagram

![Graph Schema](assets/schema.png)

---

## 7. Example Workflow (Step-by-Step)

Below is a representative end-to-end workflow for a flood response scenario.

1. A flood incident occurs in a vulnerable urban zone.
2. A victim submits an SOS through the CrisisMap AI intake interface.
3. The system validates and structures the incident payload.
4. A priority score is assigned using queue-based triage logic.
5. Bayesian severity inference estimates the likely urgency level from the incident context.
6. Dispatch mode is selected based on the case requirements.
7. Candidate responders are evaluated by skill fit, availability, coverage, and route feasibility.
8. The Hungarian assignment stage selects the best responder.
9. Dijkstra routing computes the safest current path.
10. Yen’s algorithm generates backup paths in case the primary route fails.
11. ETA is computed from the selected route and operational constraints.
12. Hospital or shelter selection logic checks destination viability.
13. Volunteer matching is triggered if support augmentation is needed.
14. The incident is surfaced in live dashboards and map views.
15. If a road is blocked or a facility becomes unavailable, simulation or live updates can trigger re-routing.
16. The responder arrives on scene.
17. If transport is required, destination routing continues to hospital or shelter.
18. The incident progresses through arrival, transport, and resolution stages.
19. The full decision history remains available through replay and explainability panels.

This workflow is useful in demos because it shows that the system is not only storing emergency data, but actively reasoning over operational constraints in real time.

---

## 8. Demo Screenshots

### SOS Form Interface

![SOS Form](assets/sos-form.png)

### Live Map Tracking

![Live Map Tracking](assets/live-map.png)

### Route Visualization

![Route Visualization](assets/route-visualization.png)

### Decision Trace Panel

![Decision Trace Panel](assets/decision-trace.png)

### Resource Assignment Dashboard

![Dashboard View](assets/dashboard.png)

---

## 9. Performance Metrics

The following figures describe the intended capability and demonstration scale of the system:

- **60+ graph nodes** modeled across zones, facilities, responders, and resources
- **150+ relationship edges** in the connected operational graph
- **10–15 concurrent incident simulations** supported in demo-mode workflows
- **3 route variants per incident** including primary and backup options
- **<100 ms WebSocket update latency** in local/demo conditions
- **<1 second ETA refresh cycles** for active incident views
- **Real-time replay visibility** for priority, severity, assignment, and routing decisions
- **Scoped dashboards** for victims, responders, and organizations

These metrics are intended to demonstrate not just UI responsiveness, but the operational usefulness of the connected decision pipeline.

---

## 10. Installation Instructions

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd CrisisMap
```

### 2. Move into the application directory

```bash
cd CrisisMapAI
```

### 3. Copy environment files

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```

Update the copied files with your local values.

Typical backend values include:

- `POSTGRES_URL`
- `NEO4J_URI`
- `NEO4J_USER`
- `NEO4J_PASSWORD`
- `OPENAI_API_KEY` if using the LLM layer
- `ELEVENLABS_API_KEY` if using voice SOS transcription

### 4. Start PostgreSQL

```bash
docker compose up -d
```

### 5. Start Neo4j

Run Neo4j locally or through your preferred container setup.
Make sure the values in `.env` match the running Neo4j instance.

### 6. Create a Python environment

```bash
python3 -m venv venv
source venv/bin/activate
```

### 7. Install backend dependencies

```bash
pip install -r requirements.txt
```

### 8. Install frontend dependencies

```bash
cd frontend
npm ci
cd ..
```

### 9. Load sample graph and operational data

You can use the seed scripts to initialize demo data:

```bash
python scripts/generate_seed_files.py
python scripts/seed_postgres.py --reset
python scripts/seed_neo4j.py --reset
```

### 10. Validate the seeded environment

```bash
python validation/check_seed_integrity.py
```

---

## 11. Running the System

### Start the backend API server

```bash
cd CrisisMapAI
DEBUG=true python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

### Start the frontend dashboard

In a new terminal:

```bash
cd CrisisMapAI/frontend
npm run dev
```

### Open the application

- Backend docs: `http://127.0.0.1:8000/docs`
- Frontend: `http://127.0.0.1:5173`

### Load sample incidents

You can either:

- use the seeded demo data already loaded into PostgreSQL and Neo4j
- create new SOS incidents through the victim UI
- post directly to `POST /api/sos` from Swagger or a REST client

### Trigger simulation events

Simulation controls are available in the coordinator view and can be used to demonstrate:

- road block events
- responder unavailability
- hospital overload
- shelter exhaustion

---

## 12. Failure Simulation Instructions

CrisisMap AI includes a demo-oriented failure simulation mode for resilience testing and explainability.

You can use the simulation controls to:

### Block roads

Trigger a road failure scenario to simulate a blocked corridor.
The route layer should promote a backup path and explain why the original route was rejected.

### Disable responders

Mark the assigned responder unavailable.
The system should refresh assignment logic and show why another responder becomes the next best fit.

### Modify hospital capacity

Trigger a hospital-full scenario.
The destination logic should redirect to a viable alternative and update the operational snapshot.

### Exhaust shelter capacity

Trigger a shelter-full condition.
The destination recommendation should switch to a safer fallback option when possible.

### What happens after simulation

After a disruption is triggered:

- the dashboard reflects the change
- route posture updates
- ETA changes may be recalculated
- decision trace entries explain the override or fallback
- the coordinator view becomes a live demonstration of re-optimization behavior

This is especially useful for technical demos because it shows the system responding dynamically, not just rendering static outputs.

---

## 13. Future Enhancements

Potential next steps for PulseGrid include:

- **Predictive resource placement**  
  Pre-position responders and supplies using historical risk patterns.

- **AI-based disaster forecasting**  
  Integrate forecasting models for surge prediction and pre-alerting.

- **Multi-city scaling**  
  Extend the graph and routing model across multiple operational regions.

- **IoT sensor integration**  
  Pull live flood, smoke, weather, or infrastructure signals into the decision graph.

- **Mobile responder interface**  
  Add a field-optimized app experience for responder and volunteer execution.

- **Digital twin simulation**  
  Expand simulation from single disruption scenarios to full cascading incident modeling.

- **Policy-aware dispatching**  
  Add configurable dispatch rules for region-specific emergency governance.

---

## 14. Project Structure

```text
CrisisMap/
├── .github/
│   └── workflows/
│       └── ci.yml
├── CrisisMapAI/
│   ├── backend/
│   │   └── app/
│   │       ├── api/
│   │       ├── assignment/
│   │       ├── auth/
│   │       ├── db/
│   │       ├── graph/
│   │       ├── operations/
│   │       ├── routing/
│   │       └── main.py
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── api/
│   │   │   ├── components/
│   │   │   └── utils/
│   │   ├── package.json
│   │   └── .env.example
│   ├── data/
│   │   └── seed/
│   ├── docs/
│   ├── scripts/
│   ├── sql/
│   │   └── init/
│   ├── validation/
│   ├── .env.example
│   ├── docker-compose.yml
│   ├── README.md
│   └── requirements.txt
├── reset_and_seed.sh
└── README.md
```

---

## 15. License

MIT License

If you plan to open-source the project publicly, add the corresponding `LICENSE` file at the repository root.

---

## 16. Author

**Name**  
Nikhil Juluri

**LinkedIn**  
https://www.linkedin.com/in/<your-linkedin-profile>

**GitHub**  
https://github.com/<your-github-username>

---

## 17. Notes for Reviewers

If you are viewing this project as a recruiter, judge, or technical reviewer, the most important thing to notice is that CrisisMap AI is not just a dashboard.
It is a connected decision system.

The main value of the project is in how it combines:

- graph modeling
- optimization algorithms
- real-time state updates
- operational explainability
- role-scoped interfaces

into a coherent disaster response platform.

The strongest demo path is:

1. log in as a victim and submit an SOS
2. observe the responder assignment and route selection
3. open the coordinator dashboard
4. trigger a simulation failure
5. watch reassignment, rerouting, ETA changes, and decision explanations update live

That flow demonstrates the core systems thinking behind PulseGrid.
