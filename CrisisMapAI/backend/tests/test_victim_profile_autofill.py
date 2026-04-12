import os

os.environ["DEBUG"] = "true"

from backend.app.api import sos


def test_apply_victim_profile_defaults_enriches_registered_victim_sos(monkeypatch):
    profile = {
        "id": "victim-1",
        "preferred_language": "Spanish",
        "profile_data": {
            "identity": {"preferred_language": "Spanish"},
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
