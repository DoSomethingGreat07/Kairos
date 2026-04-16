from fastapi import APIRouter, HTTPException
from typing import Any, Dict, Optional

from ..db.postgres import RegistrationRepository
from ..db.operational_store import OperationalRepository


router = APIRouter()
registration_repository = RegistrationRepository()
operational_repository = OperationalRepository()


@router.get("/dashboard")
async def get_dashboard_data(
    organization_id: Optional[str] = None,
    responder_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Get dashboard data for coordinators.
    When organization_id is provided, scope the metrics and incidents to that organization.
    """
    try:
        if responder_id:
            responder_profile = registration_repository.get_profile("responder", responder_id)
            if not responder_profile:
                raise HTTPException(status_code=404, detail="Responder not found.")

            incidents = operational_repository.list_incidents_for_responder(responder_id, limit=10)
            active_incidents = [
                incident for incident in incidents
                if (incident.get("incident_data") or {}).get("status") != "resolved"
            ]
            organization_snapshot = {}
            if responder_profile.get("organization_id"):
                organization_snapshot = registration_repository.get_organization_operational_snapshot(
                    responder_profile["organization_id"]
                )

            return {
                "activeIncidents": len(active_incidents),
                "availableResponders": 1 if responder_profile.get("availability_status") == "available" else 0,
                "availableBeds": organization_snapshot.get("availableBeds", 0),
                "availableShelterCapacity": organization_snapshot.get("availableShelterCapacity", 0),
                "hospitalCapacity": organization_snapshot.get("hospitalCapacity", 0),
                "shelterOccupancy": organization_snapshot.get("shelterOccupancy", 0),
                "medicalBayCapacity": organization_snapshot.get("medicalBayCapacity", 0),
                "ownedShelterCapacity": organization_snapshot.get("ownedShelterCapacity", 0),
                "recentIncidents": [dict(row.get("incident_data") or {}, sos_id=row.get("sos_id")) for row in incidents],
                "scope": "responder",
                "responder_id": responder_id,
            }

        if organization_id:
            snapshot = registration_repository.get_organization_operational_snapshot(organization_id)
            incidents = operational_repository.list_incidents_for_organization(
                organization_id,
                coverage_zone_ids=snapshot.get("coverage_zone_ids") or [],
                limit=10,
            )
            active_incidents = [
                incident for incident in incidents
                if (incident.get("incident_data") or {}).get("status") != "resolved"
            ]
            return {
                "activeIncidents": len(active_incidents),
                "availableResponders": snapshot.get("availableResponders", 0),
                "availableBeds": snapshot.get("availableBeds", 0),
                "availableShelterCapacity": snapshot.get("availableShelterCapacity", 0),
                "hospitalCapacity": snapshot.get("hospitalCapacity", 0),
                "shelterOccupancy": snapshot.get("shelterOccupancy", 0),
                "medicalBayCapacity": snapshot.get("medicalBayCapacity", 0),
                "ownedShelterCapacity": snapshot.get("ownedShelterCapacity", 0),
                "responders": snapshot.get("responders", []),
                "recentIncidents": [dict(row.get("incident_data") or {}, sos_id=row.get("sos_id")) for row in incidents],
                "scope": "organization",
                "organization_id": organization_id,
            }

        incidents = operational_repository.list_incidents(limit=10)
        active_incidents = [
            incident for incident in incidents
            if (incident.get("incident_data") or {}).get("status") != "resolved"
        ]
        return {
            "activeIncidents": len(active_incidents),
            "availableResponders": 0,
            "availableBeds": 0,
            "availableShelterCapacity": 0,
            "hospitalCapacity": 0,
            "shelterOccupancy": 0,
            "recentIncidents": [dict(row.get("incident_data") or {}, sos_id=row.get("sos_id")) for row in incidents],
            "scope": "global",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching dashboard data: {str(e)}")


@router.get("/stats")
async def get_system_stats() -> Dict[str, Any]:
    """
    Get system-wide statistics.
    """
    try:
        incidents = operational_repository.list_incidents(limit=500)
        total_incidents = len(incidents)
        resolved_incidents = sum(
            1 for incident in incidents if (incident.get("incident_data") or {}).get("status") == "resolved"
        )
        return {
            "totalIncidents": total_incidents,
            "resolvedIncidents": resolved_incidents,
            "averageResponseTime": "Operational replay pending",
            "responderUtilization": 0,
            "systemUptime": "Development mode",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching stats: {str(e)}")
