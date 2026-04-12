# CrisisMap AI Demo Scenarios

## Overview

CrisisMap AI includes pre-configured demo scenarios to showcase the complete 12-step coordination pipeline. These scenarios demonstrate realistic emergency situations with seeded data and expected outcomes.

## Demo Setup

### Database Seeding

Run the seeding script to populate the database:

```bash
cd backend
python -m app.seed_data
```

This creates:
- 6 zones with connectivity
- 3 hospitals with specialties
- 3 shelters with facilities
- 4 responders with different capabilities
- 4 volunteers with various skills
- Supply inventories

### Mock Data Fallback

If Neo4j is not available, the system automatically falls back to `mock_data.json` for all operations.

## Demo Scenarios

### Scenario 1: Downtown Flood Emergency

**Description:** Major flooding in downtown area affecting multiple buildings with trapped residents requiring oxygen support.

**Input Data:**
```json
{
  "disaster_type": "flood",
  "zone": "zone_a",
  "severity": "high",
  "people_count": 25,
  "oxygen_required": true,
  "injury": true,
  "elderly": true,
  "note": "Multiple buildings flooded, people trapped on upper floors"
}
```

**Expected Pipeline Execution:**

1. **Priority Queue**: Score = 92 (high severity + multiple people + oxygen + elderly)
2. **Bayesian Severity**: Inferred = "critical" (flood + injuries + oxygen needs)
3. **Rule Engine**: Dispatch ALS ambulance to hospital, request volunteers, supplies
4. **Dijkstra Routing**: Route via zone_a → zone_b (15 min ETA)
5. **Yen Backup Routes**: 3 alternative routes (18-25 min ETAs)
6. **Responder Assignment**: Ambulance ALS-1 (oxygen capable, closest available)
7. **Volunteer Matching**: 2 volunteers (medical skills, Spanish/English speakers)
8. **Supply Distribution**: 5 oxygen tanks, medical supplies from zone_a storage
9. **Graph Write**: Complete incident node with all relationships
10. **Real-Time Broadcast**: Updates to all connected clients
11. **LLM Messages**: Victim reassurance, responder instructions, coordinator summary

**Expected Outcome:**
- Responder: Ambulance ALS-1 (12 min ETA)
- Volunteers: Maria Garcia (medical/translation), John Smith (first aid)
- Supplies: 5 oxygen tanks distributed
- Messages generated in English + Spanish

### Scenario 2: Midtown Medical Emergency

**Description:** Elderly patient experiencing cardiac symptoms requiring immediate ALS response.

**Input Data:**
```json
{
  "disaster_type": "medical",
  "zone": "zone_b",
  "severity": "critical",
  "people_count": 1,
  "oxygen_required": true,
  "injury": true,
  "elderly": true,
  "note": "Elderly patient with chest pain, possible cardiac event"
}
```

**Expected Pipeline Execution:**

1. **Priority Queue**: Score = 95 (critical severity + oxygen + elderly + cardiac)
2. **Bayesian Severity**: Inferred = "critical" (cardiac symptoms + elderly)
3. **Rule Engine**: Immediate ALS dispatch to cardiac-capable hospital
4. **Dijkstra Routing**: Direct route to Metropolitan Medical Center (8 min ETA)
5. **Yen Backup Routes**: Hospital alternatives if cardiac unit busy
6. **Responder Assignment**: Ambulance ALS-2 (cardiac trained, defibrillator equipped)
7. **Volunteer Matching**: 1 volunteer (medical skills for support)
8. **Supply Distribution**: Portable defibrillator, cardiac meds
9. **Graph Write**: Incident with cardiac specialty routing
10. **Real-Time Broadcast**: Critical incident alerts
11. **LLM Messages**: Urgent victim reassurance, detailed responder instructions

**Expected Outcome:**
- Responder: Ambulance ALS-2 (8 min ETA to cardiac center)
- Volunteers: Maria Garcia (experienced medical volunteer)
- Supplies: Cardiac response kit
- Priority routing to specialized facility

### Scenario 3: Multi-Vehicle Accident

**Description:** Chain reaction accident involving multiple vehicles with multiple injuries.

**Input Data:**
```json
{
  "disaster_type": "accident",
  "zone": "zone_c",
  "severity": "high",
  "people_count": 8,
  "oxygen_required": false,
  "injury": true,
  "elderly": false,
  "note": "Multiple injuries, possible spinal injuries, traffic blocked"
}
```

**Expected Pipeline Execution:**

1. **Priority Queue**: Score = 88 (high severity + 8 people + multiple injuries)
2. **Bayesian Severity**: Inferred = "high" (multi-vehicle + multiple casualties)
3. **Rule Engine**: Multiple responder dispatch, trauma center routing
4. **Dijkstra Routing**: Route accounting for traffic blockage
5. **Yen Backup Routes**: Alternative routes avoiding accident scene
6. **Responder Assignment**: Ambulance ALS-1 + BLS backup (trauma capabilities)
7. **Volunteer Matching**: 3 volunteers (first aid, traffic control, translation)
8. **Supply Distribution**: Trauma kits, spinal boards, multiple ambulances
9. **Graph Write**: Complex incident with multiple responder assignments
10. **Real-Time Broadcast**: Multi-unit coordination updates
11. **LLM Messages**: Coordinated response instructions for all units

**Expected Outcome:**
- Responders: ALS-1 primary, BLS-1 backup (15 min ETA)
- Volunteers: John Smith, David Chen, Sarah Johnson
- Supplies: Multiple trauma kits distributed
- Coordinated multi-unit response

### Scenario 4: Residential Building Fire

**Description:** Structure fire in apartment building with smoke inhalation and elderly residents.

**Input Data:**
```json
{
  "disaster_type": "fire",
  "zone": "zone_d",
  "severity": "high",
  "people_count": 12,
  "oxygen_required": true,
  "injury": true,
  "elderly": true,
  "note": "Smoke inhalation cases, elderly residents need assistance"
}
```

**Expected Pipeline Execution:**

1. **Priority Queue**: Score = 90 (high severity + 12 people + oxygen + elderly + fire)
2. **Bayesian Severity**: Inferred = "critical" (fire + smoke inhalation + elderly)
3. **Rule Engine**: Fire department + EMS response, shelter evacuation
4. **Dijkstra Routing**: Safe routes avoiding fire area
5. **Yen Backup Routes**: Evacuation route alternatives
6. **Responder Assignment**: Ambulance ALS-2 (oxygen + elderly experience)
7. **Volunteer Matching**: 4 volunteers (evacuation assistance, medical support)
8. **Supply Distribution**: Oxygen, smoke inhalation treatment, evacuation supplies
9. **Graph Write**: Incident with shelter assignment for displaced residents
10. **Real-Time Broadcast**: Multi-agency coordination
11. **LLM Messages**: Evacuation instructions, medical triage guidance

**Expected Outcome:**
- Responder: Ambulance ALS-2 (18 min ETA)
- Volunteers: All 4 volunteers for evacuation support
- Supplies: Oxygen and medical supplies to shelter
- Shelter assignment for displaced residents

## Testing the Demo

### Automated Testing

Run the complete pipeline test:

```python
from app.api.sos import router
from app.models.schemas import SOSRequest

# Test each scenario
scenarios = [
    # Scenario data here
]

for scenario in scenarios:
    request = SOSRequest(**scenario)
    response = await router.submit_sos(request)
    print(f"Scenario {scenario['id']}: {response}")
```

### Manual Testing

1. **Start the backend:**
   ```bash
   cd backend
   uvicorn app.main:app --reload
   ```

2. **Start the frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Submit test incidents** via the SOS form or API calls

4. **Monitor real-time updates** in dashboard and WebSocket connections

### Performance Benchmarks

Expected performance metrics:

- **SOS Processing**: < 2 seconds end-to-end
- **Priority Queue**: < 10ms
- **Bayesian Inference**: < 50ms
- **Dijkstra Routing**: < 100ms
- **Responder Assignment**: < 200ms (Hungarian algorithm)
- **Graph Write**: < 500ms
- **LLM Generation**: < 3 seconds

### Load Testing

Simulate multiple concurrent incidents:

```python
import asyncio
from app.api.sos import router

async def load_test():
    tasks = []
    for i in range(10):  # 10 concurrent incidents
        scenario = scenarios[i % len(scenarios)]
        request = SOSRequest(**scenario)
        tasks.append(router.submit_sos(request))

    results = await asyncio.gather(*tasks)
    print(f"Processed {len(results)} incidents concurrently")
```

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - System falls back to mock data automatically
   - Check Neo4j connection settings in `.env`

2. **LLM Messages Not Generated**
   - Check OpenAI API key in `.env`
   - Falls back to template messages

3. **WebSocket Connection Issues**
   - Check CORS settings
   - Verify Socket.IO client configuration

4. **Slow Response Times**
   - Check database performance
   - Verify algorithm implementations
   - Monitor system resources

### Debug Mode

Enable debug logging:

```bash
export CRISISMAP_DEBUG=true
cd backend
uvicorn app.main:app --reload --log-level debug
```

### Reset Demo Data

Clear and reseed database:

```python
from app.seed_data import DataSeeder

seeder = DataSeeder()
await seeder.clear_all_data()
await seeder.seed_all_data()
```

## Demo Presentation Script

### 1. System Overview (2 minutes)
- Show architecture diagram
- Explain 12-step pipeline
- Demonstrate deterministic vs AI components

### 2. Live Demo (5 minutes)
- Submit Scenario 1 (flood emergency)
- Show real-time dashboard updates
- Demonstrate WebSocket live updates
- Show generated messages

### 3. Algorithm Deep Dive (3 minutes)
- Explain optimization algorithms used
- Show assignment logic
- Demonstrate routing calculations

### 4. Multi-Stakeholder Views (2 minutes)
- Victim: Simple status updates
- Responder: Detailed instructions and routes
- Coordinator: Full dashboard with analytics

### 5. Scalability & Reliability (2 minutes)
- Show fallback to mock data
- Demonstrate error handling
- Explain containerized deployment

This demo showcases CrisisMap AI as a production-ready emergency coordination system with explainable AI, real-time capabilities, and robust fallback mechanisms.