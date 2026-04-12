import pytest
from backend.app.graph.neo4j_schema import Neo4jSchemaBuilder
from backend.app.graph.seed_pipeline import Neo4jSeedPipeline


class MockNeo4jClient:
    def __init__(self):
        self.calls = []

    def execute_query(self, query, parameters=None):
        self.calls.append(("query", query.strip(), parameters))
        return [{"id": "dummy"}]

    def create_unique_constraint(self, label, property_key):
        self.calls.append(("constraint", label, property_key))

    def create_index(self, label, property_key):
        self.calls.append(("index", label, property_key))

    def create_node(self, label, properties, merge=False):
        self.calls.append(("create_node", label, properties, merge))
        return properties.get("id")

    def create_relationship(self, from_label, from_id, to_label, to_id, rel_type, rel_props=None, merge=False):
        self.calls.append(("create_relationship", from_label, from_id, to_label, to_id, rel_type, rel_props, merge))
        return "relationship_id"


def test_schema_builder_creates_constraints_and_indexes():
    client = MockNeo4jClient()
    builder = Neo4jSchemaBuilder(client)

    builder.ensure_schema()

    assert any(call[0] == "constraint" and call[1] == "Zone" and call[2] == "id" for call in client.calls)
    assert any(call[0] == "index" and call[1] == "SOS" and call[2] == "status" for call in client.calls)
    assert len([call for call in client.calls if call[0] == "constraint"]) >= 10
    assert len([call for call in client.calls if call[0] == "index"]) >= 10


@pytest.mark.asyncio
async def test_seed_pipeline_inserts_all_base_data():
    client = MockNeo4jClient()
    pipeline = Neo4jSeedPipeline(client)

    result = await pipeline.seed_all_data(include_edge_cases=False)

    assert result is True
    create_node_calls = [c for c in client.calls if c[0] == "create_node"]
    create_rel_calls = [c for c in client.calls if c[0] == "create_relationship"]

    assert any(call[1] == "Zone" for call in create_node_calls)
    assert any(call[1] == "Hospital" for call in create_node_calls)
    assert any(call[1] == "Depot" for call in create_node_calls)
    assert any(call[1] == "SeverityPrior" for call in create_node_calls)
    assert any(call[5] == "ROAD" for call in create_rel_calls)
    assert len(create_node_calls) == 34
    assert len(create_rel_calls) == 36


@pytest.mark.asyncio
async def test_seed_pipeline_inserts_edge_case_scenarios():
    client = MockNeo4jClient()
    pipeline = Neo4jSeedPipeline(client)

    result = await pipeline.seed_all_data(include_edge_cases=True)

    assert result is True
    create_node_calls = [c for c in client.calls if c[0] == "create_node"]
    create_rel_calls = [c for c in client.calls if c[0] == "create_relationship"]

    assert any(call[1] == "Zone" and call[2]["id"] == "zone_g" for call in create_node_calls)
    assert any(call[1] == "Responder" and call[2]["id"] == "responder_blocked_1" for call in create_node_calls)
    assert any(call[1] == "Hospital" and call[2]["id"] == "hospital_full" for call in create_node_calls)
    assert any(call[1] == "Supply" and call[2]["id"] == "supply_empty_1" for call in create_node_calls)
    assert len(create_node_calls) == 38
    assert len(create_rel_calls) == 40
