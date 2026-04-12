from fastapi import APIRouter, HTTPException
from typing import Dict, Any

router = APIRouter()

@router.get("/dashboard")
async def get_dashboard_data() -> Dict[str, Any]:
    """
    Get dashboard data for coordinators.
    """
    try:
        # This would query the graph database for real metrics
        # For now, return mock data
        return {
            "activeIncidents": 3,
            "availableResponders": 8,
            "availableBeds": 45,
            "availableShelterCapacity": 120,
            "hospitalCapacity": 65,  # percentage
            "shelterOccupancy": 30,  # percentage
            "recentIncidents": [
                {
                    "id": "sos-001",
                    "disaster_type": "flood",
                    "zone": "Zone A",
                    "severity": "high",
                    "people_count": 4,
                    "status": "assigned",
                    "created_at": "2024-01-15T10:30:00Z"
                },
                {
                    "id": "sos-002",
                    "disaster_type": "fire",
                    "zone": "Zone C",
                    "severity": "critical",
                    "people_count": 2,
                    "status": "en_route",
                    "created_at": "2024-01-15T10:45:00Z"
                }
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching dashboard data: {str(e)}")

@router.get("/stats")
async def get_system_stats() -> Dict[str, Any]:
    """
    Get system-wide statistics.
    """
    try:
        return {
            "totalIncidents": 156,
            "resolvedIncidents": 142,
            "averageResponseTime": "18 minutes",
            "responderUtilization": 78,  # percentage
            "systemUptime": "99.9%"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching stats: {str(e)}")