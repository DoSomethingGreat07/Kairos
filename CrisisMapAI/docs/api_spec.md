# CrisisMap AI API Specification

## Overview

CrisisMap AI provides REST and WebSocket APIs for emergency coordination. All APIs follow RESTful principles with JSON payloads.

## Authentication

All API requests require authentication via JWT tokens or API keys.

```
Authorization: Bearer <jwt_token>
X-API-Key: <api_key>
```

## REST API Endpoints

### SOS Management

#### POST /api/sos
Submit an emergency alert and trigger the complete coordination pipeline.

**Request Body:**
```json
{
  "disaster_type": "flood|fire|medical|accident|other",
  "zone": "zone_a|zone_b|zone_c|zone_d|zone_e|zone_f",
  "severity": "low|medium|high|critical",
  "people_count": 1,
  "oxygen_required": false,
  "injury": false,
  "elderly": false,
  "note": "Optional additional details"
}
```

**Response:**
```json
{
  "sos_id": "uuid-string",
  "status": "processed",
  "priority_score": 85,
  "eta": "12 minutes",
  "responder": "Ambulance ALS-1",
  "destination": "City General Hospital",
  "message": "Help is on the way. An ambulance with oxygen support is 12 minutes away."
}
```

**Status Codes:**
- 200: Success
- 400: Invalid request data
- 500: Internal server error

#### GET /api/incidents
Get list of active incidents.

**Query Parameters:**
- `status`: Filter by status (received|assigned|enroute|arrived|resolved)
- `zone`: Filter by zone
- `limit`: Maximum results (default: 50)
- `offset`: Pagination offset (default: 0)

**Response:**
```json
[
  {
    "id": "uuid-string",
    "disaster_type": "flood",
    "zone": "zone_a",
    "severity": "high",
    "people_count": 4,
    "status": "assigned",
    "responder": {"name": "Ambulance 1", "type": "ALS"},
    "eta": "15 minutes",
    "timestamp": "2024-01-15T10:30:00Z"
  }
]
```

#### GET /api/incidents/{sos_id}
Get detailed information for a specific incident.

**Response:**
```json
{
  "id": "uuid-string",
  "status": "assigned",
  "priority_score": 85,
  "eta": "12 minutes",
  "assignment": {
    "responder": {
      "name": "Ambulance ALS-1",
      "type": "Advanced Life Support",
      "capabilities": ["oxygen", "defibrillator"]
    },
    "eta": "12 minutes",
    "route": ["Zone A", "Main St", "Hospital"],
    "destination": {
      "name": "City General Hospital",
      "type": "hospital",
      "specialties": ["emergency", "trauma"]
    },
    "explanation": "Responder selected because it matched oxygen capability, had the lowest safe ETA, and was currently available."
  },
  "volunteers": [
    {
      "name": "John Smith",
      "skills": ["first_aid"],
      "eta": "8 minutes"
    }
  ],
  "supply_plan": {
    "oxygen_tanks": 2,
    "medical_kits": 1,
    "total_items_distributed": 3
  },
  "latest_message": "Help is on the way. An ambulance with oxygen support is 12 minutes away."
}
```

### Dashboard & Analytics

#### GET /api/dashboard/metrics
Get real-time coordination metrics for dashboard display.

**Response:**
```json
{
  "active_incidents": 12,
  "responders_available": 8,
  "responders_busy": 4,
  "average_response_time": "14 minutes",
  "incidents_by_zone": {
    "zone_a": 3,
    "zone_b": 5,
    "zone_c": 2,
    "zone_d": 1,
    "zone_e": 1,
    "zone_f": 0
  },
  "incidents_by_type": {
    "medical": 6,
    "accident": 3,
    "flood": 2,
    "fire": 1
  },
  "system_status": "operational",
  "last_updated": "2024-01-15T10:35:00Z"
}
```

#### GET /api/dashboard/incidents/recent
Get recent incidents for timeline display.

**Query Parameters:**
- `hours`: Hours to look back (default: 24)
- `limit`: Maximum results (default: 20)

**Response:**
```json
[
  {
    "id": "uuid-string",
    "timestamp": "2024-01-15T10:30:00Z",
    "disaster_type": "medical",
    "zone": "zone_b",
    "severity": "high",
    "status": "resolved",
    "response_time": "18 minutes",
    "outcome": "patient_transported"
  }
]
```

### Resource Management

#### GET /api/responders
Get all responders with current status.

**Response:**
```json
[
  {
    "id": "responder_1",
    "name": "Ambulance ALS-1",
    "type": "Advanced Life Support",
    "zone": "zone_a",
    "status": "available",
    "capabilities": ["oxygen", "defibrillator", "advanced_meds"],
    "current_location": {"lat": 40.7128, "lon": -74.0060},
    "fuel_level": 85
  }
]
```

#### GET /api/zones
Get zone information and connectivity.

**Response:**
```json
[
  {
    "id": "zone_a",
    "name": "Downtown",
    "population": 50000,
    "risk_level": "medium",
    "coordinates": {"lat": 40.7128, "lon": -74.0060},
    "connected_zones": [
      {"zone": "zone_b", "travel_time": 15, "distance_km": 7.5}
    ]
  }
]
```

#### GET /api/hospitals
Get hospital information and capacity.

**Response:**
```json
[
  {
    "id": "hospital_1",
    "name": "City General Hospital",
    "zone": "zone_a",
    "capacity": 500,
    "available_beds": 200,
    "specialties": ["emergency", "trauma", "cardiology"],
    "oxygen_units": 50
  }
]
```

### Status Updates

#### POST /api/incidents/{sos_id}/status
Update incident status (responder/coordinator only).

**Request Body:**
```json
{
  "status": "enroute|arrived|patient_transported|resolved",
  "note": "Optional status note",
  "location": {"lat": 40.7128, "lon": -74.0060}
}
```

**Response:**
```json
{
  "success": true,
  "updated_at": "2024-01-15T10:40:00Z"
}
```

## WebSocket API

### Connection
Connect to WebSocket endpoint: `ws://localhost:8000/ws`

### Authentication
Send authentication message after connection:
```json
{
  "type": "auth",
  "token": "jwt_token",
  "role": "victim|responder|coordinator"
}
```

### Events

#### Outgoing Events (Server → Client)

**incident:new**
```json
{
  "type": "incident:new",
  "data": {
    "id": "uuid-string",
    "disaster_type": "flood",
    "zone": "zone_a",
    "severity": "high",
    "people_count": 4,
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

**incident:assigned**
```json
{
  "type": "incident:assigned",
  "data": {
    "id": "uuid-string",
    "responder": "Ambulance ALS-1",
    "eta": "12 minutes",
    "route": ["Zone A", "Main St", "Hospital"]
  }
}
```

**incident:status_update**
```json
{
  "type": "incident:status_update",
  "data": {
    "id": "uuid-string",
    "status": "enroute",
    "location": {"lat": 40.7128, "lon": -74.0060},
    "timestamp": "2024-01-15T10:35:00Z"
  }
}
```

**responder:location**
```json
{
  "type": "responder:location",
  "data": {
    "responder_id": "responder_1",
    "location": {"lat": 40.7128, "lon": -74.0060},
    "status": "enroute",
    "incident_id": "uuid-string"
  }
}
```

**dashboard:update**
```json
{
  "type": "dashboard:update",
  "data": {
    "active_incidents": 12,
    "responders_available": 8,
    "system_status": "operational"
  }
}
```

#### Incoming Events (Client → Server)

**subscribe:incident**
```json
{
  "type": "subscribe:incident",
  "incident_id": "uuid-string"
}
```

**subscribe:zone**
```json
{
  "type": "subscribe:zone",
  "zone_id": "zone_a"
}
```

**location:update** (Responder only)
```json
{
  "type": "location:update",
  "location": {"lat": 40.7128, "lon": -74.0060}
}
```

## Error Handling

All API errors return standard HTTP status codes with JSON error details:

```json
{
  "error": "error_code",
  "message": "Human-readable error message",
  "details": "Optional additional details"
}
```

### Common Error Codes
- `invalid_request`: Malformed request data
- `unauthorized`: Authentication required
- `forbidden`: Insufficient permissions
- `not_found`: Resource not found
- `rate_limited`: Too many requests
- `internal_error`: Server error

## Rate Limiting

- REST API: 100 requests per minute per IP
- WebSocket: 1000 messages per minute per connection
- Burst limits: 20 requests/messages per second

## Data Formats

### Timestamps
All timestamps use ISO 8601 format in UTC:
```
2024-01-15T10:30:00Z
```

### Coordinates
Latitude/longitude as decimal degrees:
```json
{
  "lat": 40.7128,
  "lon": -74.0060
}
```

### Enums

**Disaster Types:**
- `flood`, `fire`, `medical`, `accident`, `other`

**Severity Levels:**
- `low`, `medium`, `high`, `critical`

**Incident Status:**
- `received`, `assigned`, `enroute`, `arrived`, `patient_transported`, `resolved`

**Responder Types:**
- `Basic Life Support`, `Advanced Life Support`, `Rapid Response`

## Versioning

API versioning uses URL path versioning:
- Current version: v1
- Base path: `/api/v1/`

Future versions will be available at `/api/v2/`, etc.