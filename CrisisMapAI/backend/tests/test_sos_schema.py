from datetime import datetime

import pytest
from pydantic import ValidationError

from backend.app.models.schemas import SOSRequest


def test_sos_request_accepts_nested_payload_and_builds_legacy_fields():
    payload = {
        "incident_id": "SOS_101",
        "disaster_type": "fire",
        "location": {
            "zone": "Zone A",
            "area_type": "Apartment / Building",
            "landmark": "Near School",
            "place_name": "Sunrise Residency",
            "street_access": "Back gate, narrow lane",
            "latitude": 30.2672,
            "longitude": -97.7431,
            "access_difficulty": "Blocked road",
            "floor_level": "2nd floor",
            "nearby_safe_spot": "Terrace",
        },
        "severity": "high",
        "people_count": 52,
        "medical": {
            "injuries": True,
            "injured_count": 2,
            "injury_severity": "severe",
            "oxygen_required": True,
            "oxygen_count": 5,
            "elderly": True,
            "elderly_count": 1,
            "children": True,
            "children_count": 2,
            "disabled": False,
        },
        "access": {
            "trapped": True,
            "road_status": "blocked",
            "safe_exit": False,
            "building_type": "apartment",
        },
        "contact": {
            "name": "John Doe",
            "phone": "+123456789",
            "language": "English",
        },
        "notes": "Heavy smoke inside building.",
    }

    request = SOSRequest.model_validate(payload)
    incident = request.to_incident("generated-id", datetime(2026, 1, 1))

    assert request.zone == "Zone A"
    assert request.oxygen_required is True
    assert request.injury is True
    assert request.elderly is True
    assert request.note == "Heavy smoke inside building."
    assert incident["mass_casualty"] is True
    assert "oxygen x5" in incident["critical_needs"]
    assert "blocked road access" in incident["critical_needs"]


def test_sos_request_accepts_legacy_flat_payload():
    request = SOSRequest.model_validate(
        {
            "disaster_type": "flood",
            "zone": "Zone B",
            "severity": "medium",
            "people_count": 3,
            "oxygen_required": True,
            "injury": False,
            "elderly": True,
            "note": "Water rising fast.",
            "medical": {"oxygen_count": 1, "elderly_count": 1},
        }
    )

    assert request.location is not None
    assert request.location.zone == "Zone B"
    assert request.medical.oxygen_required is True
    assert request.medical.oxygen_count == 1
    assert request.note == "Water rising fast."


def test_sos_request_rejects_invalid_phone_and_missing_conditional_fields():
    with pytest.raises(ValidationError):
        SOSRequest.model_validate(
            {
                "disaster_type": "fire",
                "location": {"zone": "Zone A"},
                "severity": "high",
                "people_count": 2,
                "medical": {"injuries": True},
                "contact": {"phone": "abc"},
            }
        )


def test_sos_request_rejects_vulnerable_counts_exceeding_people_count():
    with pytest.raises(ValidationError):
        SOSRequest.model_validate(
            {
                "disaster_type": "fire",
                "location": {"zone": "Other / Unknown", "custom_zone": "North Ridge"},
                "severity": "medium",
                "people_count": 2,
                "medical": {
                    "children": True,
                    "children_count": 2,
                    "elderly": True,
                    "elderly_count": 1,
                },
            }
        )
