import os

os.environ["DEBUG"] = "true"

from backend.app.api import sos


def test_apply_victim_profile_defaults_enriches_registered_victim_sos(monkeypatch):
    profile = {
        "id": "victim-1",
        "preferred_language": "Spanish",
        "profile_data": {
            "identity": {"preferred_language": "Spanish"},
            "location_profile": {
                "home_zone": "zone_a",
                "work_zone": "zone_b",
                "frequent_zones": ["zone_c"],
            },
            "medical_profile": {
                "conditions": {"requires_oxygen_or_respiratory_support": True},
                "home_oxygen_device": False,
            },
            "household_profile": {
                "household_size": 4,
                "elderly_members": 1,
                "children_under_12": 2,
                "mobility_limited_members": 1,
                "home_medical_equipment": ["Home ventilator"],
            },
            "consent_preferences": {"share_location_with_responders": True},
            "emergency_contacts": {"primary_name": "Ana", "primary_phone": "+14155550123"},
        },
    }

    monkeypatch.setattr(
        sos.registration_repository,
        "get_victim_profile_by_phone",
        lambda phone: profile if phone == "+14155550000" else None,
    )

    enriched = sos.apply_victim_profile_defaults(
        {
            "people_count": 1,
            "medical": {},
            "contact": {"phone": "+14155550000"},
            "notes": "",
        }
    )

    assert enriched["people_count"] == 4
    assert enriched["medical"]["elderly"] is True
    assert enriched["medical"]["elderly_count"] == 1
    assert enriched["medical"]["children"] is True
    assert enriched["medical"]["children_count"] == 2
    assert enriched["medical"]["disabled"] is True
    assert enriched["medical"]["disabled_count"] == 1
    assert enriched["medical"]["oxygen_required"] is True
    assert enriched["medical"]["oxygen_count"] == 1
    assert enriched["contact"]["language"] == "Spanish"
    assert "power-sensitive medical equipment" in enriched["notes"]
    assert enriched["registered_victim_profile"]["victim_profile_id"] == "victim-1"
    assert enriched["registered_victim_profile"]["home_zone"] == "zone_a"
    assert enriched["registered_victim_profile"]["frequent_zones"] == ["zone_c"]


def test_build_incident_tracking_payload_uses_persisted_results():
    replay = {
        "incident": {
            "sos_id": "sos-1",
            "zone_id": "zone_a",
            "severity": "high",
            "priority_score": 0.4,
            "inferred_severity": "critical",
            "incident_data": {
                "sos_id": "sos-1",
                "status": "assigned",
                "eta": "8 minutes",
                "critical_needs": ["oxygen x1"],
                "messages": {"victim_confirmation": "Help is on the way."},
            },
        },
        "stages": [
            {"stage_name": "SOS_CREATED", "status": "completed", "timestamp": "2026-01-01T10:00:00Z", "metadata": {}},
            {"stage_name": "RESPONDER_MATCHED", "status": "completed", "timestamp": "2026-01-01T10:01:00Z", "metadata": {}},
        ],
        "results": {
            "priority_queue": {"priority_score": 0.4, "explanation_text": "priority explanation", "result_payload": {"score": 0.4}},
            "bayesian_severity": {"inferred_severity": "critical", "posterior": {"critical": 0.8}, "explanation_text": "bayes explanation", "result_payload": {"posterior": {"critical": 0.8}}},
            "dijkstra": {"result_payload": {"route": ["zone_a", "hospital_1"], "eta": "8 minutes"}},
            "yen_routes": {"result_payload": {"routes": [{"route": ["zone_a", "hospital_1"]}]}},
            "hungarian_assignment": {"result_payload": {"responder_name": "Ambulance 1", "eta": "8 minutes"}},
            "gale_shapley": {"matches": [{"volunteer_name": "Alex", "estimated_arrival": "10 minutes"}], "result_payload": {"matches": [{"volunteer_name": "Alex"}]}},
            "min_cost_flow": {"result_payload": {"total_cost": 12}},
        },
    }

    payload = sos.build_incident_tracking_payload(replay)

    assert payload["sos_id"] == "sos-1"
    assert payload["algorithm_results"]["hungarian_assignment"]["responder_name"] == "Ambulance 1"
    assert payload["algorithm_results"]["gale_shapley"][0]["volunteer_name"] == "Alex"
    assert len(payload["case_events"]) == 2
