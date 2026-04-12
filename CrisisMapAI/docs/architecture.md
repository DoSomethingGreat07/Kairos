# CrisisMap AI Architecture

## Overview

CrisisMap AI is a comprehensive disaster response coordination system that combines graph-based reasoning, optimization algorithms, and real-time communication to provide deterministic, AI-augmented emergency response coordination.

## System Architecture

### Core Principles

1. **Deterministic Decision Making**: All core decisions (routing, assignment, prioritization) use algorithmic optimization rather than AI prediction
2. **AI-Only for Communication**: LLM used solely for generating human-readable messages from deterministic outputs
3. **Graph-Native Data Model**: All operational data stored as connected graph relationships
4. **Real-Time Coordination**: WebSocket-based live updates for all stakeholders
5. **Multi-Stakeholder Views**: Separate interfaces for victims, responders, and coordinators

### Technology Stack

- **Backend**: Python 3.9+, FastAPI, Neo4j, Redis
- **Frontend**: React 18, Vite, Leaflet.js, Socket.IO
- **Graph Database**: Neo4j with Cypher queries
- **Real-Time**: WebSocket with Socket.IO
- **AI**: OpenAI GPT-3.5/4 for message generation only
- **SMS**: Twilio for fallback notifications

## 12-Step Coordination Pipeline

### 1. SOS Intake & Validation
- **Input**: Victim-submitted emergency data
- **Processing**: Pydantic validation, timestamp assignment
- **Output**: Structured incident data

### 2. Priority Queue (Deterministic)
- **Algorithm**: Binary heap priority queue
- **Factors**: Severity, people affected, special needs, zone risk
- **Output**: Priority score (0-100)

### 3. Bayesian Severity Inference (Probabilistic)
- **Algorithm**: Naive Bayes classifier
- **Training Data**: Historical incident outcomes
- **Output**: Inferred severity level (low/medium/high/critical)

### 4. Rule Engine (Deterministic)
- **Logic**: Expert-defined dispatch rules
- **Factors**: Severity, capabilities needed, resource availability
- **Output**: Dispatch mode (responder type, destination, special requirements)

### 5. Dijkstra Safe Routing (Deterministic)
- **Algorithm**: NetworkX Dijkstra implementation
- **Graph**: Zone connectivity with travel times
- **Constraints**: Road conditions, responder capabilities
- **Output**: Optimal route, ETA, distance

### 6. Yen K-Shortest Backup Routes (Deterministic)
- **Algorithm**: Yen's algorithm for K-shortest paths
- **Purpose**: Alternative routes for contingencies
- **Output**: 3 backup routes with ETAs

### 7. Responder Assignment (Optimization)
- **Algorithm**: Hungarian algorithm for optimal assignment
- **Objective**: Minimize total response time
- **Constraints**: Responder capabilities, availability, location
- **Output**: Assigned responder with explanation

### 8. Volunteer Matching (Optimization)
- **Algorithm**: Gale-Shapley stable marriage algorithm
- **Matching**: Skills, languages, availability
- **Output**: Matched volunteers for support roles

### 9. Supply Distribution (Optimization)
- **Algorithm**: Min-cost flow network optimization
- **Objective**: Minimize transportation costs
- **Constraints**: Supply availability, demand requirements
- **Output**: Distribution plan with quantities and routes

### 10. Graph Write-Back (Persistence)
- **Operation**: Neo4j transaction write
- **Data**: Complete incident state with relationships
- **Indexing**: Optimized for real-time queries

### 11. Real-Time Broadcast (Communication)
- **Protocol**: WebSocket with Socket.IO
- **Channels**: Incident updates, responder locations, status changes
- **Clients**: Dashboard, mobile apps, coordinator displays

### 12. LLM Message Generation (AI-Assisted)
- **Purpose**: Human-readable communication from deterministic outputs
- **Models**: GPT-3.5-turbo for generation, GPT-4 for complex scenarios
- **Outputs**: Victim confirmations, responder instructions, coordinator summaries
- **Languages**: Multi-language support with translation

## Data Model

### Graph Schema

```
(ZONE)-[:CONNECTED_TO {travel_time, distance}]->(ZONE)
(HOSPITAL)-[:LOCATED_IN]->(ZONE)
(SHELTER)-[:LOCATED_IN]->(ZONE)
(RESPONDER)-[:BASED_IN]->(ZONE)
(VOLUNTEER)-[:LOCATED_IN]->(ZONE)
(SUPPLY)-[:STORED_IN]->(ZONE)

(INCIDENT)-[:OCCURRED_IN]->(ZONE)
(INCIDENT)-[:ASSIGNED_TO]->(RESPONDER)
(INCIDENT)-[:SUPPORTED_BY]->(VOLUNTEER)
(INCIDENT)-[:USES_SUPPLY]->(SUPPLY)
(INCIDENT)-[:ROUTED_TO]->(HOSPITAL|SHELTER)
```

### Key Node Types

- **Zone**: Geographic areas with population, risk levels, connectivity
- **Hospital**: Medical facilities with capacity, specialties, resources
- **Shelter**: Evacuation centers with facilities and capacity
- **Responder**: Emergency vehicles/units with capabilities and status
- **Volunteer**: Community helpers with skills and availability
- **Supply**: Resources (oxygen, food, water) with quantities
- **Incident**: Emergency events with complete coordination state

## API Design

### REST Endpoints

```
POST /api/sos - Submit emergency alert
GET /api/incidents - List active incidents
GET /api/incidents/{id} - Get incident details
GET /api/dashboard/metrics - Get coordination metrics
GET /api/zones - Get zone information
```

### WebSocket Events

```
incident:new - New emergency received
incident:assigned - Responder assigned
incident:enroute - Responder en route
incident:arrived - Responder arrived at scene
responder:location - Live location updates
status:update - General status changes
```

## User Interfaces

### Victim View
- Simple SOS form with location detection
- Real-time status updates
- Clear ETAs and responder information
- Multi-language support

### Responder View
- Assignment notifications
- Route visualization with turn-by-turn
- Incident details and requirements
- Status update capabilities

### Coordinator View
- Real-time dashboard with all incidents
- Resource allocation overview
- Performance metrics and analytics
- Historical incident review

## Security & Reliability

### Authentication
- JWT tokens for API access
- Role-based permissions (victim, responder, coordinator)
- API key validation for external integrations

### Data Privacy
- Incident data anonymized where possible
- Location data with user consent
- Secure communication channels

### Reliability
- Database connection pooling
- Circuit breakers for external services
- Graceful degradation (mock data fallbacks)
- Comprehensive error handling and logging

## Deployment Architecture

### Containerized Deployment
- Backend: Python container with uvicorn
- Frontend: Node.js container with nginx
- Database: Neo4j container
- Cache: Redis container
- Reverse proxy: nginx load balancer

### Scalability
- Horizontal scaling for backend services
- Database read replicas
- CDN for static assets
- WebSocket connection scaling

### Monitoring
- Application metrics (response times, error rates)
- System metrics (CPU, memory, disk)
- Business metrics (incident resolution times)
- Alerting for critical failures

## Development & Testing

### Testing Strategy
- Unit tests for all algorithms
- Integration tests for API endpoints
- Graph database tests with test fixtures
- End-to-end tests with mock scenarios
- Performance tests for optimization algorithms

### Demo Scenarios
- Pre-seeded database with realistic data
- Mock incident generators
- Performance benchmarking tools
- Multi-user simulation capabilities

This architecture ensures CrisisMap AI provides reliable, explainable, and efficient emergency coordination while maintaining clear separation between deterministic decision-making and AI-assisted communication.