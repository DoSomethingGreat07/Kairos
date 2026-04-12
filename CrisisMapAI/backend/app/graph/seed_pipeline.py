from typing import Dict, Any, List, Optional
import asyncio
from .neo4j_client import Neo4jClient
from .neo4j_schema import Neo4jSchemaBuilder
from ..operations.default_data import (
    depot_definitions,
    hospital_definitions,
    responder_definitions,
    road_definitions,
    severity_prior_definitions,
    shelter_definitions,
    task_definitions,
    volunteer_definitions,
    zone_definitions,
)

class Neo4jSeedPipeline:
    """Pipeline to seed Neo4j with required operational graph data."""

    def __init__(self, client: Optional[Neo4jClient] = None):
        self.client = client or Neo4jClient()
        self.schema_builder = Neo4jSchemaBuilder(self.client)

    async def seed_all_data(self, include_edge_cases: bool = False) -> bool:
        """Seed all required base data and optionally edge-case scenarios."""
        try:
            self.schema_builder.ensure_schema()
            self._seed_base_zones()
            self._seed_connectivity()
            self._seed_hospitals()
            self._seed_shelters()
            self._seed_responders()
            self._seed_volunteers()
            self._seed_tasks()
            self._seed_depots()
            self._seed_severity_priors()
            self._seed_supplies()

            if include_edge_cases:
                self._seed_edge_case_scenarios()

            return True
        except Exception as e:
            print(f"Neo4j seed pipeline error: {e}")
            return False

    def _seed_base_zones(self) -> None:
        for zone in zone_definitions():
            self.client.create_node("Zone", zone, merge=True)

    def _seed_connectivity(self) -> None:
        for road in road_definitions():
            self.client.create_relationship(
                "Zone", road["source_zone"],
                "Zone", road["target_zone"],
                "ROAD",
                {
                    "id": road["id"],
                    "road_id": road["road_id"],
                    "source_zone": road["source_zone"],
                    "target_zone": road["target_zone"],
                    "travel_time": road["travel_time"],
                    "safe": road["safe"],
                    "congestion": road["congestion"],
                    "has_oxygen": road["has_oxygen"],
                    "distance_km": road["distance_km"],
                    "capacity": road["capacity"],
                    "passable": road["passable"],
                    "blocked": not road["passable"],
                },
                merge=True
            )

    def _seed_hospitals(self) -> None:
        for hospital in hospital_definitions():
            self.client.create_node("Hospital", hospital, merge=True)
            self.client.create_relationship(
                "Hospital", hospital["id"],
                "Zone", hospital["zone_id"],
                "SERVES",
                merge=True
            )

    def _seed_shelters(self) -> None:
        for shelter in shelter_definitions():
            self.client.create_node("Shelter", shelter, merge=True)
            self.client.create_relationship(
                "Shelter", shelter["id"],
                "Zone", shelter["zone_id"],
                "LOCATED_IN",
                merge=True
            )

    def _seed_responders(self) -> None:
        for responder in responder_definitions():
            self.client.create_node("Responder", responder, merge=True)
            self.client.create_relationship(
                "Responder", responder["id"],
                "Zone", responder["zone_id"],
                "BASED_IN",
                merge=True
            )

    def _seed_volunteers(self) -> None:
        for volunteer in volunteer_definitions():
            self.client.create_node("Volunteer", volunteer, merge=True)
            self.client.create_relationship(
                "Volunteer", volunteer["id"],
                "Zone", volunteer["zone_id"],
                "LOCATED_IN",
                merge=True
            )

    def _seed_tasks(self) -> None:
        for task in task_definitions():
            self.client.create_node("Task", task, merge=True)
            self.client.create_relationship(
                "Task", task["id"],
                "Zone", task["zone_id"],
                "LOCATED_IN",
                merge=True
            )

    def _seed_depots(self) -> None:
        for depot in depot_definitions():
            self.client.create_node("Depot", depot, merge=True)
            self.client.create_relationship(
                "Depot", depot["id"],
                "Zone", depot["zone_id"],
                "STORED_IN",
                merge=True
            )

    def _seed_severity_priors(self) -> None:
        for prior in severity_prior_definitions():
            self.client.create_node("SeverityPrior", prior, merge=True)
            self.client.create_relationship(
                "SeverityPrior", prior["id"],
                "Zone", prior["zone_id"],
                "FOR_ZONE",
                {"disaster_type": prior["disaster_type"]},
                merge=True
            )

    def _seed_supplies(self) -> None:
        for supply in self._supply_definitions():
            self.client.create_node("Supply", supply, merge=True)
            self.client.create_relationship(
                "Supply", supply["id"],
                "Zone", supply["zone_id"],
                "STORED_IN",
                merge=True
            )

    def _seed_edge_case_scenarios(self) -> None:
        """Insert forced edge-case data for schema validation and robustness testing."""
        self.client.create_node("Zone", {
            "id": "zone_g",
            "name": "Harbor Edgecase",
            "risk_level": "critical",
            "latitude": 40.7000,
            "longitude": -74.0200,
            "population": 12000
        }, merge=True)

        self.client.create_relationship(
            "Zone", "zone_g",
            "Zone", "zone_a",
            "ROAD",
            {
                "id": "road_ga",
                "road_id": "road_ga",
                "source_zone": "zone_g",
                "target_zone": "zone_a",
                "travel_time": 18,
                "safe": False,
                "congestion": 1.6,
                "has_oxygen": False,
                "distance_km": 12,
                "capacity": 4,
                "passable": False,
                "blocked": True,
            },
            merge=True
        )

        self.client.create_node("Responder", {
            "id": "responder_blocked_1",
            "name": "Blocked Responder",
            "type": "Advanced Life Support",
            "capabilities": ["Oxygen Administration", "Advanced Life Support"],
            "skills": ["Oxygen Administration", "Advanced Life Support"],
            "has_equipment": False,
            "available": False,
            "latitude": 40.7000,
            "longitude": -74.0200,
            "zone_id": "zone_g",
            "current_zone": "zone_g",
        }, merge=True)

        self.client.create_relationship(
            "Responder", "responder_blocked_1",
            "Zone", "zone_g",
            "BASED_IN",
            merge=True
        )

        self.client.create_node("Hospital", {
            "id": "hospital_full",
            "name": "Full Capacity Hospital",
            "available_beds": 0,
            "total_beds": 100,
            "latitude": 40.7005,
            "longitude": -74.0210,
            "zone_id": "zone_g"
        }, merge=True)

        self.client.create_relationship(
            "Hospital", "hospital_full",
            "Zone", "zone_g",
            "SERVES",
            merge=True
        )

        self.client.create_node("Supply", {
            "id": "supply_empty_1",
            "type": "oxygen_tank",
            "quantity": 0,
            "zone_id": "zone_g",
            "status": "depleted"
        }, merge=True)

        self.client.create_relationship(
            "Supply", "supply_empty_1",
            "Zone", "zone_g",
            "STORED_IN",
            merge=True
        )

    def _supply_definitions(self) -> List[Dict[str, Any]]:
        return [
            {
                "id": "supply_oxygen_1",
                "type": "oxygen_tank",
                "quantity": 25,
                "zone_id": "zone_a",
                "status": "available",
                "latitude": 40.7128,
                "longitude": -74.0060
            },
            {
                "id": "supply_meds_1",
                "type": "medical_supplies",
                "quantity": 100,
                "zone_id": "zone_b",
                "status": "available",
                "latitude": 40.7589,
                "longitude": -73.9851
            },
            {
                "id": "supply_water_1",
                "type": "water",
                "quantity": 500,
                "zone_id": "zone_c",
                "status": "available",
                "latitude": 40.6782,
                "longitude": -73.9442
            },
            {
                "id": "supply_food_1",
                "type": "food",
                "quantity": 200,
                "zone_id": "zone_a",
                "status": "available",
                "latitude": 40.7128,
                "longitude": -74.0060
            }
        ]
