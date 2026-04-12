from fastapi import APIRouter, HTTPException
from datetime import datetime
import uuid

from ..models.schemas import SOSRequest, SOSResponse
from ..triage.priority_queue import PriorityQueue
from ..triage.bayesian_severity import BayesianSeverityInference
from ..triage.rule_engine import RuleEngine
from ..routing.dijkstra_router import DijkstraRouter
from ..routing.yen_router import YenRouter
from ..assignment.responder_assignment import ResponderAssignment
from ..assignment.volunteer_matching import VolunteerMatching
from ..logistics.supply_distribution import SupplyDistribution
from ..graph.graph_writer import GraphWriter
from ..realtime.broadcaster import broadcaster
from ..messaging.llm_messenger import LLMMessenger
from ..db.postgres import RegistrationRepository
from ..db.operational_store import OperationalRepository

router = APIRouter()

# Initialize components
priority_queue = PriorityQueue()
severity_inference = BayesianSeverityInference()
rule_engine = RuleEngine()
dijkstra_router = DijkstraRouter()
yen_router = YenRouter()
responder_assignment = ResponderAssignment()
volunteer_matching = VolunteerMatching()
supply_distribution = SupplyDistribution()
graph_writer = GraphWriter()
llm_messenger = LLMMessenger()
registration_repository = RegistrationRepository()
operational_repository = OperationalRepository()


def apply_victim_profile_defaults(sos_payload: dict) -> dict:
    contact_phone = ((sos_payload.get("contact") or {}).get("phone") or "").strip()
    if not contact_phone:
        return sos_payload

    try:
        victim_profile = registration_repository.get_victim_profile_by_phone(contact_phone)
    except Exception:
        return sos_payload

    if not victim_profile:
        return sos_payload

    profile_data = victim_profile.get("profile_data") or {}
    medical_profile = profile_data.get("medical_profile") or {}
    household_profile = profile_data.get("household_profile") or {}
    consent_preferences = profile_data.get("consent_preferences") or {}
    emergency_contacts = profile_data.get("emergency_contacts") or {}
    identity = profile_data.get("identity") or {}

    enriched = dict(sos_payload)
    enriched.setdefault("contact", {})
    enriched.setdefault("medical", {})
    enriched.setdefault("location", {})
    enriched["contact"]["language"] = enriched["contact"].get("language") or identity.get("preferred_language") or victim_profile.get("preferred_language")

    if (not enriched.get("people_count") or enriched.get("people_count") == 1) and household_profile.get("household_size", 0) > 1:
        enriched["people_count"] = household_profile.get("household_size") or 1

    enriched["medical"]["elderly"] = enriched["medical"].get("elderly") or household_profile.get("elderly_members", 0) > 0
    if household_profile.get("elderly_members", 0) > 0:
        enriched["medical"]["elderly_count"] = enriched["medical"].get("elderly_count") or household_profile.get("elderly_members")

    if household_profile.get("children_under_12", 0) > 0:
        enriched["medical"]["children"] = enriched["medical"].get("children") or True
        enriched["medical"]["children_count"] = enriched["medical"].get("children_count") or household_profile.get("children_under_12")

    if household_profile.get("mobility_limited_members", 0) > 0:
        enriched["medical"]["disabled"] = enriched["medical"].get("disabled") or True
        enriched["medical"]["disabled_count"] = enriched["medical"].get("disabled_count") or household_profile.get("mobility_limited_members")

    oxygen_dependency = medical_profile.get("conditions", {}).get("requires_oxygen_or_respiratory_support") or medical_profile.get("home_oxygen_device")
    if oxygen_dependency:
        enriched["medical"]["oxygen_required"] = True
        enriched["medical"]["oxygen_count"] = enriched["medical"].get("oxygen_count") or 1

    equipment = set(household_profile.get("home_medical_equipment") or [])
    if equipment.intersection({"Oxygen concentrator", "Dialysis machine", "Home ventilator"}):
        notes = enriched.get("notes") or ""
        priority_note = "Profile priority boost: household depends on power-sensitive medical equipment."
        if priority_note not in notes:
            enriched["notes"] = f"{notes} {priority_note}".strip()

    enriched["registered_victim_profile"] = {
        "victim_profile_id": victim_profile.get("id"),
        "preferred_language": enriched["contact"].get("language"),
        "share_location_with_responders": consent_preferences.get("share_location_with_responders"),
        "emergency_contacts": emergency_contacts,
    }
    return enriched

@router.post("/sos", response_model=SOSResponse)
async def submit_sos(sos_data: SOSRequest):
    """
    Submit an SOS alert and trigger the complete coordination pipeline.
    """
    try:
        sos_id = str(uuid.uuid4())
        timestamp = datetime.utcnow()
        enriched_payload = apply_victim_profile_defaults(sos_data.model_dump(mode="json"))
        enriched_request = SOSRequest.model_validate(enriched_payload)
        incident = enriched_request.to_incident(sos_id=sos_id, timestamp=timestamp)
        persist_case_event(sos_id, "SOS_CREATED", {"zone": incident.get("zone"), "disaster_type": incident.get("disaster_type")})
        persist_incident_snapshot(incident)

        # Step 1: Priority Queue
        priority_score = priority_queue.calculate_priority(incident)
        incident["priority_score"] = priority_score
        incident.setdefault("explainability", {})
        incident["explainability"]["priority_queue"] = priority_queue.build_explanation(incident, priority_score)
        persist_priority_result(sos_id, incident, priority_score)
        persist_case_event(sos_id, "PRIORITY_ASSIGNED", {"priority_score": priority_score})
        persist_incident_snapshot(incident)

        # Step 2: Bayesian Severity Inference
        severity_result = severity_inference.infer_with_explanation(incident)
        incident["inferred_severity"] = severity_result["inferred_severity"]
        incident["severity_posterior"] = severity_result["posterior"]
        incident["explainability"]["bayesian_severity"] = severity_result["explanation"]
        persist_bayesian_result(sos_id, incident, severity_result)
        persist_case_event(sos_id, "SEVERITY_INFERRED", {"inferred_severity": severity_result["inferred_severity"]})
        persist_incident_snapshot(incident)

        # Step 3: Rule Engine
        dispatch_mode = rule_engine.determine_dispatch_mode(incident)
        incident["dispatch_mode"] = dispatch_mode
        incident["required_skill"] = incident.get("required_skill") or infer_required_skill_from_dispatch(dispatch_mode, incident)

        # Step 4: Dijkstra Safe Routing
        route_details = dijkstra_router.find_route_details(incident["zone"], dispatch_mode["destination"], incident=incident)
        incident["route"] = route_details["route"]
        incident["distance"] = route_details["route_cost"]
        incident["eta"] = route_details["eta"]
        incident["route_details"] = route_details
        incident["explainability"]["dijkstra"] = route_details["explanation"]
        persist_dijkstra_result(sos_id, incident["zone"], route_details.get("destination", {}).get("id") or dispatch_mode["destination"], route_details)
        persist_case_event(sos_id, "ROUTE_GENERATED", {"eta": incident["eta"], "route_cost": incident["distance"]})
        persist_incident_snapshot(incident)

        # Step 5: Yen K-Shortest Backup Routes
        backup_routes = yen_router.find_backup_routes(incident["zone"], dispatch_mode["destination"], incident=incident)
        incident["backup_routes"] = backup_routes
        persist_yen_result(sos_id, incident["zone"], route_details.get("destination", {}).get("id") or dispatch_mode["destination"], backup_routes)

        # Step 6: Responder Assignment
        assignment = responder_assignment.assign_responder(incident, dispatch_mode, route_details=route_details)
        incident["assignment"] = assignment
        incident["eta"] = assignment.get("eta", incident.get("eta"))
        incident["explainability"]["hungarian_assignment"] = assignment.get("explanation")
        persist_assignment_result(sos_id, assignment)
        persist_case_event(sos_id, "RESPONDER_MATCHED", {"responder_id": assignment.get("responder_id"), "cost": assignment.get("cost", assignment.get("final_cost"))})
        persist_incident_snapshot(incident)
        if not assignment.get("assigned"):
            messages = await llm_messenger.generate_messages(incident)
            incident["messages"] = messages
            incident["status"] = assignment.get("status", "blocked_access")
            return SOSResponse(
                sos_id=sos_id,
                status=incident["status"],
                priority_score=priority_score,
                eta=incident["eta"],
                responder=None,
                destination=dispatch_mode.get("destination"),
                message=messages.get("victim_confirmation", "No safe route is available right now."),
                algorithm_results={
                    "priority_queue": {
                        "score": priority_score,
                        "explanation": incident.get("explainability", {}).get("priority_queue"),
                    },
                    "bayesian_severity": {
                        "inferred_severity": incident.get("inferred_severity"),
                        "posterior": incident.get("severity_posterior"),
                        "explanation": incident.get("explainability", {}).get("bayesian_severity"),
                    },
                    "dispatch_mode": dispatch_mode,
                    "dijkstra": {
                        "route": route_details.get("route"),
                        "route_cost": route_details.get("route_cost"),
                        "eta": route_details.get("eta"),
                        "destination": route_details.get("destination"),
                        "excluded_edges": route_details.get("excluded_edges"),
                        "route_edges": route_details.get("route_edges"),
                        "explanation": route_details.get("explanation"),
                    },
                    "yen_routes": backup_routes,
                    "hungarian_assignment": assignment,
                    "gale_shapley": [],
                    "min_cost_flow": incident.get("supply_plan"),
                    "messages": messages,
                    "case_trace": {
                        "status": incident.get("status"),
                        "critical_needs": incident.get("critical_needs"),
                    },
                },
            )

        # Step 7: Volunteer Matching (if needed)
        if dispatch_mode.get("needs_volunteers"):
            volunteers = volunteer_matching.match_volunteers(incident)
            incident["volunteers"] = volunteers
            incident["explainability"]["gale_shapley"] = [volunteer.get("rationale") for volunteer in volunteers]
            persist_gale_shapley_result(sos_id, volunteers)
            persist_case_event(sos_id, "VOLUNTEER_ASSIGNED", {"volunteer_count": len(volunteers)})
            persist_incident_snapshot(incident)

        # Step 8: Supply Distribution (if needed)
        if dispatch_mode.get("needs_supplies"):
            supply_plan = supply_distribution.distribute_supplies(incident)
            incident["supply_plan"] = supply_plan
            incident["explainability"]["min_cost_max_flow"] = supply_plan.get("explanation")
            persist_supply_result(sos_id, supply_plan)
            persist_case_event(sos_id, "SUPPLY_ALLOCATED", {"total_cost": supply_plan.get("total_cost")})
            persist_incident_snapshot(incident)

        # Step 9: Graph Write-back
        await graph_writer.write_incident(incident)

        # Step 10: Real-time Broadcast
        await broadcaster.broadcast_incident_update(incident)

        # Step 11: LLM Message Generation
        messages = await llm_messenger.generate_messages(incident)
        incident["messages"] = messages

        # Update status
        incident["status"] = "assigned"

        return SOSResponse(
            sos_id=sos_id,
            status="processed",
            priority_score=priority_score,
            eta=incident["eta"],
            responder=assignment.get("responder_name"),
            destination=dispatch_mode.get("destination"),
            message=messages.get("victim_confirmation", "Help is on the way."),
            algorithm_results={
                "priority_queue": {
                    "score": priority_score,
                    "explanation": incident.get("explainability", {}).get("priority_queue"),
                },
                "bayesian_severity": {
                    "inferred_severity": incident.get("inferred_severity"),
                    "posterior": incident.get("severity_posterior"),
                    "explanation": incident.get("explainability", {}).get("bayesian_severity"),
                },
                "dispatch_mode": dispatch_mode,
                "dijkstra": {
                    "route": route_details.get("route"),
                    "route_cost": route_details.get("route_cost"),
                    "eta": route_details.get("eta"),
                    "destination": route_details.get("destination"),
                    "excluded_edges": route_details.get("excluded_edges"),
                    "route_edges": route_details.get("route_edges"),
                    "explanation": route_details.get("explanation"),
                },
                "yen_routes": backup_routes,
                "hungarian_assignment": assignment,
                "gale_shapley": incident.get("volunteers", []),
                "min_cost_flow": incident.get("supply_plan"),
                "messages": messages,
                "case_trace": {
                    "status": incident.get("status"),
                    "critical_needs": incident.get("critical_needs"),
                },
            }
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing SOS: {str(e)}")


def infer_required_skill_from_dispatch(dispatch_mode: dict, incident: dict) -> str | None:
    if incident.get("needs_oxygen", incident.get("oxygen_required", False)):
        return "Oxygen Administration"
    responder_type = str(dispatch_mode.get("responder_type", "")).lower()
    if "fire" in responder_type:
        return "Fire Suppression"
    if "rescue" in responder_type:
        return "Debris Search"
    if "advanced" in responder_type:
        return "Advanced Life Support"
    if incident.get("injury"):
        return "Trauma Support"
    return None


def persist_incident_snapshot(incident: dict) -> None:
    try:
        operational_repository.save_incident(incident)
    except Exception:
        pass


def persist_case_event(sos_id: str, stage_name: str, metadata: dict) -> None:
    try:
        operational_repository.log_case_stage(sos_id, stage_name, "completed", metadata)
    except Exception:
        pass


def persist_priority_result(sos_id: str, incident: dict, score: float) -> None:
    try:
        operational_repository.save_priority_result(
            sos_id,
            incident,
            score,
            incident.get("explainability", {}).get("priority_queue", ""),
        )
    except Exception:
        pass


def persist_bayesian_result(sos_id: str, incident: dict, result: dict) -> None:
    try:
        operational_repository.save_bayesian_result(sos_id, incident, result)
    except Exception:
        pass


def persist_dijkstra_result(sos_id: str, origin_zone: str, destination_zone: str, route_result: dict) -> None:
    try:
        operational_repository.save_dijkstra_result(sos_id, origin_zone, destination_zone, route_result)
    except Exception:
        pass


def persist_yen_result(sos_id: str, origin_zone: str, destination_zone: str, routes: list[dict]) -> None:
    try:
        operational_repository.save_yen_result(sos_id, origin_zone, destination_zone, routes)
    except Exception:
        pass


def persist_assignment_result(sos_id: str, assignment: dict) -> None:
    try:
        operational_repository.save_hungarian_result(sos_id, assignment)
    except Exception:
        pass


def persist_gale_shapley_result(sos_id: str, volunteers: list[dict]) -> None:
    try:
        operational_repository.save_gale_shapley_result(sos_id, volunteers)
    except Exception:
        pass


def persist_supply_result(sos_id: str, result: dict) -> None:
    try:
        operational_repository.save_min_cost_flow_result(sos_id, result)
    except Exception:
        pass

@router.get("/incidents")
async def get_incidents():
    """
    Get all active incidents.
    """
    try:
        # This would query the graph database
        # For now, return mock data
        return [
            {
                "id": "mock-1",
                "disaster_type": "flood",
                "zone": "Zone A",
                "severity": "high",
                "people_count": 4,
                "status": "assigned",
                "responder": {"name": "Ambulance 1"},
                "eta": "15 minutes"
            }
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching incidents: {str(e)}")

@router.get("/incidents/{sos_id}")
async def get_incident(sos_id: str):
    """
    Get details for a specific incident.
    """
    try:
        # This would query the graph database
        # For now, return mock data
        return {
            "id": sos_id,
            "status": "assigned",
            "priority_score": 85,
            "eta": "12 minutes",
            "assignment": {
                "responder": {"name": "Ambulance 1", "type": "Advanced Life Support"},
                "eta": "12 minutes",
                "route": ["Zone A", "Main St", "Hospital"],
                "destination": {"name": "City Hospital", "type": "hospital"},
                "explanation": "Responder selected because it matched oxygen capability, had the lowest safe ETA, and was currently available."
            },
            "latest_message": "Help is on the way. An ambulance with oxygen support is 12 minutes away."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching incident: {str(e)}")


@router.get("/incidents/{sos_id}/replay")
async def get_incident_replay(sos_id: str):
    """Replay stored operational decisions without recomputing the pipeline."""
    try:
        replay = operational_repository.get_case_replay(sos_id)
        if not replay.get("incident"):
            raise HTTPException(status_code=404, detail="No stored case replay found for this SOS id.")
        return replay
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching incident replay: {str(e)}")
