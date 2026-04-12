from backend.app.operations.seed_factory import build_seed_bundle


def test_seed_bundle_meets_required_minimum_counts():
    bundle = build_seed_bundle()

    assert len(bundle["sos_seed.json"]) >= 20
    assert len(bundle["responders_seed.json"]) >= 25
    assert len(bundle["volunteers_seed.json"]) >= 15
    assert len(bundle["hospitals_seed.json"]) >= 8
    assert len(bundle["shelters_seed.json"]) >= 10
    assert len(bundle["depots_seed.json"]) >= 5
    assert len(bundle["zones_seed.json"]) >= 10
    assert 30 <= len(bundle["roads_seed.json"]) <= 50
    assert len(bundle["tasks_seed.json"]) >= 20
    assert len(bundle["zone_history_seed.json"]) >= 40


def test_seed_bundle_uses_shared_identifier_fields():
    bundle = build_seed_bundle()
    responder = bundle["responders_seed.json"][0]
    shelter = bundle["shelters_seed.json"][0]
    depot = bundle["depots_seed.json"][0]

    assert responder["responder_id"].startswith("RSP-")
    assert shelter["shelter_id"].startswith("SHE-")
    assert depot["depot_id"].startswith("DEP-")
