from datetime import datetime

from backend.app.assignment.responder_assignment import ResponderAssignment
from backend.app.assignment.volunteer_matching import VolunteerMatching
from backend.app.logistics.supply_distribution import SupplyDistribution
from backend.app.routing.dijkstra_router import DijkstraRouter
from backend.app.routing.yen_router import YenRouter
from backend.app.triage.bayesian_severity import BayesianSeverityInference
from backend.app.triage.priority_queue import PriorityQueue


def test_priority_queue_uses_finalized_score_formula():
    queue = PriorityQueue()
    incident = {
        "id": "sos-1",
        "severity": "critical",
        "needs_oxygen": True,
        "people_count": 10,
        "created_at": datetime(2026, 1, 1, 10, 0, 0),
    }

    score = queue.calculate_priority(incident)

    assert score == -0.6


def test_dijkstra_excludes_unsafe_and_non_oxygen_edges():
    router = DijkstraRouter()
    details = router.find_route_details(
        "zone_a",
        "zone_c",
        incident={"needs_oxygen": True, "required_skill": "Oxygen Administration"},
        responder={"has_equipment": True},
    )

    assert details["route"] == ["zone_a", "zone_c"]
    assert any(edge["reason"] == "oxygen support required but road.has_oxygen = false" for edge in details["excluded_edges"])


def test_yen_router_returns_three_ranked_paths():
    router = YenRouter(k=3)
    routes = router.find_backup_routes("zone_a", "zone_e", incident={"needs_oxygen": False}, responder={"has_equipment": True})

    assert len(routes) == 3
    assert routes[0]["precomputed_rank"] == 1
    assert routes[1]["precomputed_rank"] == 2
    assert routes[2]["precomputed_rank"] == 3


def test_same_zone_hospital_route_adds_last_mile_cost():
    router = DijkstraRouter()
    details = router.find_route_details(
        "zone_b",
        "hospital",
        incident={"latitude": 40.7580, "longitude": -73.9870, "needs_oxygen": False},
        responder={"has_equipment": True},
    )

    assert details["route_cost"] > 0
    assert details["route"][-1] == "hospital_2"
    assert any(edge.get("facility_leg") for edge in details["route_edges"])


def test_hungarian_assignment_applies_penalties():
    assignment = ResponderAssignment(
        responders=[
            {
                "id": "responder_good",
                "name": "Good",
                "type": "Paramedic",
                "skills": ["Oxygen Administration"],
                "has_equipment": True,
                "available": True,
                "latitude": 40.7128,
                "longitude": -74.0060,
            },
            {
                "id": "responder_bad",
                "name": "Bad",
                "type": "Paramedic",
                "skills": ["Basic First Aid"],
                "has_equipment": False,
                "available": True,
                "latitude": 40.7128,
                "longitude": -74.0060,
            },
        ]
    )
    result = assignment.assign_responder(
        {
            "id": "sos-1",
            "latitude": 40.7130,
            "longitude": -74.0062,
            "required_skill": "Oxygen Administration",
            "needs_oxygen": True,
        }
    )

    assert result["responder_id"] == "responder_good"
    assert "+9999" not in result["explanation"]


def test_gale_shapley_matches_best_available_volunteer():
    matcher = VolunteerMatching(
        volunteers=[
            {"id": "v1", "name": "One", "skills": ["Supply Distribution"], "languages": ["English"], "available": True, "latitude": 40.7128, "longitude": -74.0060, "current_latitude": 40.7130, "current_longitude": -74.0061, "current_zone_id": "zone_a"},
            {"id": "v2", "name": "Two", "skills": ["Basic First Aid"], "languages": ["English"], "available": False, "latitude": 40.7129, "longitude": -74.0061},
        ],
        tasks=[{"id": "t1", "required_skill": "Supply Distribution", "required_language": "English", "latitude": 40.7130, "longitude": -74.0062}],
    )

    matches = matcher.match_volunteers()

    assert len(matches) == 1
    assert matches[0]["volunteer_id"] == "v1"
    assert matches[0]["current_location"]["zone_id"] == "zone_a"


def test_gale_shapley_respects_zone_coverage_radius_and_victim_preferences():
    matcher = VolunteerMatching(
        volunteers=[
            {
                "id": "v1",
                "name": "Aligned",
                "skills": ["Supply Distribution"],
                "languages": ["English"],
                "available": True,
                "latitude": 40.7128,
                "longitude": -74.0060,
                "current_latitude": 40.7130,
                "current_longitude": -74.0061,
                "current_zone_id": "zone_a",
                "coverage_zones": ["zone_a", "zone_c"],
                "max_travel_radius_km": 5,
            },
            {
                "id": "v2",
                "name": "Wrong Zone",
                "skills": ["Supply Distribution"],
                "languages": ["English"],
                "available": True,
                "latitude": 40.7131,
                "longitude": -74.0062,
                "current_latitude": 40.7131,
                "current_longitude": -74.0062,
                "current_zone_id": "zone_b",
                "coverage_zones": ["zone_b"],
                "max_travel_radius_km": 5,
                "outside_zone_allowed": False,
            },
            {
                "id": "v3",
                "name": "Too Far",
                "skills": ["Supply Distribution"],
                "languages": ["English"],
                "available": True,
                "latitude": 40.7800,
                "longitude": -73.9600,
                "current_latitude": 40.7800,
                "current_longitude": -73.9600,
                "current_zone_id": "zone_a",
                "coverage_zones": ["zone_a"],
                "max_travel_radius_km": 1,
            },
        ]
    )

    matches = matcher.match_volunteers(
        {
            "id": "sos-eligible",
            "zone": "zone_a",
            "latitude": 40.7130,
            "longitude": -74.0062,
            "required_skill": "Supply Distribution",
            "contact": {"language": "English"},
            "registered_victim_profile": {
                "home_zone": "zone_a",
                "frequent_zones": ["zone_c"],
            },
        }
    )

    assert len(matches) == 1
    assert matches[0]["volunteer_id"] == "v1"
    assert "zone alignment" in matches[0]["rationale"]


def test_hungarian_assignment_respects_dispatch_type_filter():
    assignment = ResponderAssignment(
        responders=[
            {
                "id": "responder_fire",
                "name": "Fire",
                "type": "Firefighter",
                "skills": ["Fire Suppression"],
                "has_equipment": True,
                "available": True,
                "latitude": 40.7128,
                "longitude": -74.0060,
            },
            {
                "id": "responder_als",
                "name": "ALS",
                "type": "Advanced Life Support",
                "skills": ["Oxygen Administration", "Advanced Life Support"],
                "has_equipment": True,
                "available": True,
                "latitude": 40.7129,
                "longitude": -74.0061,
            },
            {
                "id": "responder_bls",
                "name": "BLS",
                "type": "Basic Life Support",
                "skills": ["Oxygen Administration", "Basic First Aid"],
                "has_equipment": True,
                "available": True,
                "latitude": 40.71285,
                "longitude": -74.00605,
            },
        ]
    )

    result = assignment.assign_responder(
        {
            "id": "sos-2",
            "latitude": 40.7130,
            "longitude": -74.0062,
            "required_skill": "Oxygen Administration",
            "needs_oxygen": True,
        },
        dispatch_mode={"responder_type": "advanced_life_support"},
    )

    assert result["responder_id"] == "responder_als"
    assert result["dispatch_match_applied"] is True


def test_assignment_is_blocked_when_no_safe_route_exists():
    assignment = ResponderAssignment(
        responders=[
            {
                "id": "responder_als",
                "name": "ALS",
                "type": "Advanced Life Support",
                "skills": ["Oxygen Administration", "Advanced Life Support"],
                "has_equipment": True,
                "available": True,
                "latitude": 40.7129,
                "longitude": -74.0061,
            },
        ]
    )

    result = assignment.assign_responder(
        {
            "id": "sos-4",
            "zone": "zone_d",
            "required_skill": "Oxygen Administration",
            "needs_oxygen": True,
        },
        dispatch_mode={"responder_type": "advanced_life_support"},
        route_details={"route_cost": float("inf"), "eta": "No safe route available", "route": [], "destination": {"id": "hospital_1"}},
    )

    assert result["assigned"] is False
    assert result["status"] == "blocked_access"


def test_hungarian_assignment_prefers_route_eta_when_available():
    assignment = ResponderAssignment(
        responders=[
            {
                "id": "responder_als",
                "name": "ALS",
                "type": "Advanced Life Support",
                "skills": ["Oxygen Administration", "Advanced Life Support"],
                "has_equipment": True,
                "available": True,
                "latitude": 40.7129,
                "longitude": -74.0061,
            },
        ]
    )

    result = assignment.assign_responder(
        {
            "id": "sos-3",
            "latitude": 40.7130,
            "longitude": -74.0062,
            "required_skill": "Oxygen Administration",
            "needs_oxygen": True,
        },
        dispatch_mode={"responder_type": "advanced_life_support"},
        route_details={"eta": "6 minutes", "route": ["zone_b", "hospital_2"], "destination": {"id": "hospital_2"}},
    )

    assert result["eta"] == "6 minutes"
    assert result["eta_minutes"] == 6
    assert result["route"] == ["zone_b", "hospital_2"]


def test_hungarian_assignment_uses_zone_centroid_when_incident_coordinates_missing():
    assignment = ResponderAssignment(
        responders=[
            {
                "id": "responder_zone",
                "name": "Zone ALS",
                "type": "Advanced Life Support",
                "skills": ["Oxygen Administration", "Advanced Life Support"],
                "has_equipment": True,
                "available": True,
                "latitude": 40.7589,
                "longitude": -73.9851,
            },
        ]
    )

    result = assignment.assign_responder(
        {
            "id": "sos-zone",
            "zone": "zone_b",
            "required_skill": "Oxygen Administration",
            "needs_oxygen": True,
        },
        dispatch_mode={"responder_type": "advanced_life_support"},
    )

    assert result["cost_score"] < 10000
    assert "zone centroid zone_b" in result["explanation"]


def test_min_cost_max_flow_produces_shipments():
    distribution = SupplyDistribution().distribute_supplies()

    assert distribution["flow_plan"]
    assert distribution["total_cost"] >= 0
    assert any(shipment["distance_km"] > 0 for shipment in distribution["flow_plan"])


def test_bayesian_inference_returns_posterior_distribution():
    inference = BayesianSeverityInference()
    result = inference.infer_with_explanation(
        {"zone": "zone_b", "disaster_type": "flood", "is_elderly": True, "people_count": 4}
    )

    assert result["inferred_severity"] in {"critical", "high", "medium", "low"}
    assert abs(sum(result["posterior"].values()) - 1.0) < 1e-6
