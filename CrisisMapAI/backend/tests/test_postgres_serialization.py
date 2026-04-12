import os
from datetime import date
import json

os.environ["DEBUG"] = "true"

from backend.app.db.postgres import PostgresClient, RegistrationRepository


class FakeClient:
    def __init__(self):
        self.params = None

    def dumps_json(self, payload):
        return PostgresClient().dumps_json(payload)

    def fetch_one(self, query, params=None):
        self.params = params or {}
        return {
            "id": self.params.get("draft_id", "draft-1"),
            "role": self.params.get("role", "victim"),
            "current_step": self.params.get("current_step", 1),
            "draft_data": self.params.get("draft_data", "{}"),
            "status": "draft",
            "updated_at": "2026-04-12T00:00:00Z",
        }


def test_postgres_client_dumps_nested_dates_to_iso_strings():
    payload = {
        "identity": {
            "date_of_birth": date(1990, 5, 1),
        },
        "capability_profile": {
            "certifications": [
                {"issue_date": date(2024, 1, 1), "expiry_date": date(2026, 1, 1)},
            ],
        },
    }

    serialized = PostgresClient().dumps_json(payload)
    parsed = json.loads(serialized)

    assert parsed["identity"]["date_of_birth"] == "1990-05-01"
    assert parsed["capability_profile"]["certifications"][0]["issue_date"] == "2024-01-01"
    assert parsed["capability_profile"]["certifications"][0]["expiry_date"] == "2026-01-01"


def test_save_draft_serializes_nested_dates_before_persisting():
    fake_client = FakeClient()
    repository = RegistrationRepository(client=fake_client)

    repository.save_draft(
        role="victim",
        current_step=2,
        draft_data={
            "identity": {"date_of_birth": date(2010, 7, 15)},
            "medical_profile": {"history_updated_at": date(2026, 4, 12)},
        },
        draft_id="draft-123",
    )

    persisted = json.loads(fake_client.params["draft_data"])
    assert persisted["identity"]["date_of_birth"] == "2010-07-15"
    assert persisted["medical_profile"]["history_updated_at"] == "2026-04-12"
