from typing import Dict, Any, List
from .neo4j_client import Neo4jClient

class Neo4jSchemaBuilder:
    """Create and enforce Neo4j schema constraints and indexes."""

    def __init__(self, client: Neo4jClient):
        self.client = client

    def ensure_schema(self) -> None:
        """Create all required constraints and indexes in Neo4j."""
        primary_key_constraints = [
            ("Zone", "id"),
            ("Responder", "id"),
            ("Hospital", "id"),
            ("Shelter", "id"),
            ("Volunteer", "id"),
            ("Task", "id"),
            ("Depot", "id"),
            ("SeverityPrior", "id"),
            ("Supply", "id"),
            ("SOS", "id")
        ]

        property_indexes = [
            ("Zone", "risk_level"),
            ("Responder", "available"),
            ("Responder", "current_zone"),
            ("Hospital", "available_beds"),
            ("Shelter", "occupancy"),
            ("Shelter", "demand"),
            ("Volunteer", "available"),
            ("Task", "required_skill"),
            ("Depot", "supply"),
            ("SeverityPrior", "disaster_type"),
            ("SOS", "status")
        ]

        for label, property_key in primary_key_constraints:
            self.client.create_unique_constraint(label, property_key)

        for label, property_key in property_indexes:
            self.client.create_index(label, property_key)

    def create_node_schema(self, label: str, property_key: str) -> None:
        """Create a node constraint if it does not already exist."""
        self.client.create_unique_constraint(label, property_key)

    def create_property_index(self, label: str, property_key: str) -> None:
        """Create an index for a property if it does not already exist."""
        self.client.create_index(label, property_key)
