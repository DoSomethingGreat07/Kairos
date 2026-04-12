"""
Database seeding for CrisisMap AI demo.
Creates initial graph data for zones, responders, hospitals, shelters, and volunteers.
"""

from .graph.neo4j_client import Neo4jClient
from .config import settings
import json
import os

class DataSeeder:
    """
    Seeds the Neo4j database with demo data for CrisisMap AI.
    """

    def __init__(self):
        self.client = Neo4jClient()

    async def seed_all_data(self) -> bool:
        """
        Seed all demo data into the database.
        Returns True if successful, False otherwise.
        """
        try:
            print("Starting database seeding...")

            # Seed zones and connectivity
            await self._seed_zones()

            # Seed hospitals
            await self._seed_hospitals()

            # Seed shelters
            await self._seed_shelters()

            # Seed responders
            await self._seed_responders()

            # Seed volunteers
            await self._seed_volunteers()

            # Seed supplies
            await self._seed_supplies()

            print("Database seeding completed successfully!")
            return True

        except Exception as e:
            print(f"Error seeding database: {e}")
            return False

    async def _seed_zones(self):
        """Seed zone nodes and their connectivity."""
        zones_data = [
            {"id": "zone_a", "name": "Downtown", "lat": 40.7128, "lon": -74.0060, "population": 50000, "risk_level": "medium"},
            {"id": "zone_b", "name": "Midtown", "lat": 40.7589, "lon": -73.9851, "population": 75000, "risk_level": "high"},
            {"id": "zone_c", "name": "Brooklyn", "lat": 40.6782, "lon": -73.9442, "population": 60000, "risk_level": "low"},
            {"id": "zone_d", "name": "Queens", "lat": 40.7282, "lon": -73.7949, "population": 45000, "risk_level": "medium"},
            {"id": "zone_e", "name": "Bronx", "lat": 40.8448, "lon": -73.8648, "population": 35000, "risk_level": "high"},
            {"id": "zone_f", "name": "Staten Island", "lat": 40.5795, "lon": -74.1502, "population": 25000, "risk_level": "low"}
        ]

        # Create zone nodes
        for zone in zones_data:
            await self.client.create_node("Zone", zone)

        # Create connectivity relationships (simplified road network)
        connections = [
            ("zone_a", "zone_b", 15),  # Downtown to Midtown: 15 min
            ("zone_b", "zone_c", 20),  # Midtown to Brooklyn: 20 min
            ("zone_b", "zone_d", 25),  # Midtown to Queens: 25 min
            ("zone_b", "zone_e", 30),  # Midtown to Bronx: 30 min
            ("zone_c", "zone_f", 35),  # Brooklyn to Staten Island: 35 min
            ("zone_d", "zone_e", 20),  # Queens to Bronx: 20 min
            ("zone_a", "zone_c", 25),  # Downtown to Brooklyn: 25 min
            ("zone_a", "zone_d", 30),  # Downtown to Queens: 30 min
        ]

        for from_zone, to_zone, travel_time in connections:
            await self.client.create_relationship(
                "Zone", {"id": from_zone},
                "Zone", {"id": to_zone},
                "CONNECTED_TO",
                {"travel_time": travel_time, "distance_km": travel_time * 0.5}  # Rough estimate
            )

    async def _seed_hospitals(self):
        """Seed hospital nodes."""
        hospitals_data = [
            {
                "id": "hospital_1",
                "name": "City General Hospital",
                "zone": "zone_a",
                "lat": 40.7128,
                "lon": -74.0060,
                "capacity": 500,
                "specialties": ["emergency", "trauma", "cardiology"],
                "oxygen_units": 50,
                "available_beds": 200
            },
            {
                "id": "hospital_2",
                "name": "Metropolitan Medical Center",
                "zone": "zone_b",
                "lat": 40.7589,
                "lon": -73.9851,
                "capacity": 750,
                "specialties": ["emergency", "pediatrics", "surgery"],
                "oxygen_units": 75,
                "available_beds": 300
            },
            {
                "id": "hospital_3",
                "name": "Brooklyn Regional Hospital",
                "zone": "zone_c",
                "lat": 40.6782,
                "lon": -73.9442,
                "capacity": 400,
                "specialties": ["emergency", "orthopedics"],
                "oxygen_units": 30,
                "available_beds": 150
            }
        ]

        for hospital in hospitals_data:
            await self.client.create_node("Hospital", hospital)

            # Connect hospital to its zone
            await self.client.create_relationship(
                "Hospital", {"id": hospital["id"]},
                "Zone", {"id": hospital["zone"]},
                "LOCATED_IN",
                {}
            )

    async def _seed_shelters(self):
        """Seed shelter nodes."""
        shelters_data = [
            {
                "id": "shelter_1",
                "name": "Downtown Community Center",
                "zone": "zone_a",
                "lat": 40.7128,
                "lon": -74.0060,
                "capacity": 200,
                "facilities": ["food", "water", "medical"],
                "available_space": 150
            },
            {
                "id": "shelter_2",
                "name": "Midtown High School",
                "zone": "zone_b",
                "lat": 40.7589,
                "lon": -73.9851,
                "capacity": 300,
                "facilities": ["food", "water", "blankets"],
                "available_space": 250
            },
            {
                "id": "shelter_3",
                "name": "Brooklyn Civic Center",
                "zone": "zone_c",
                "lat": 40.6782,
                "lon": -73.9442,
                "capacity": 150,
                "facilities": ["food", "water"],
                "available_space": 120
            }
        ]

        for shelter in shelters_data:
            await self.client.create_node("Shelter", shelter)

            # Connect shelter to its zone
            await self.client.create_relationship(
                "Shelter", {"id": shelter["id"]},
                "Zone", {"id": shelter["zone"]},
                "LOCATED_IN",
                {}
            )

    async def _seed_responders(self):
        """Seed responder (ambulance) nodes."""
        responders_data = [
            {
                "id": "responder_1",
                "name": "Ambulance ALS-1",
                "type": "Advanced Life Support",
                "zone": "zone_a",
                "lat": 40.7128,
                "lon": -74.0060,
                "status": "available",
                "capabilities": ["oxygen", "defibrillator", "advanced_meds"],
                "capacity": 2,
                "fuel_level": 85
            },
            {
                "id": "responder_2",
                "name": "Ambulance BLS-1",
                "type": "Basic Life Support",
                "zone": "zone_b",
                "lat": 40.7589,
                "lon": -73.9851,
                "status": "available",
                "capabilities": ["oxygen", "bandages"],
                "capacity": 2,
                "fuel_level": 92
            },
            {
                "id": "responder_3",
                "name": "Ambulance ALS-2",
                "type": "Advanced Life Support",
                "zone": "zone_c",
                "lat": 40.6782,
                "lon": -73.9442,
                "status": "available",
                "capabilities": ["oxygen", "defibrillator", "surgery_kit"],
                "capacity": 3,
                "fuel_level": 78
            },
            {
                "id": "responder_4",
                "name": "Rapid Response Unit",
                "type": "Rapid Response",
                "zone": "zone_d",
                "lat": 40.7282,
                "lon": -73.7949,
                "status": "available",
                "capabilities": ["oxygen", "triage"],
                "capacity": 1,
                "fuel_level": 95
            }
        ]

        for responder in responders_data:
            await self.client.create_node("Responder", responder)

            # Connect responder to its zone
            await self.client.create_relationship(
                "Responder", {"id": responder["id"]},
                "Zone", {"id": responder["zone"]},
                "BASED_IN",
                {}
            )

    async def _seed_volunteers(self):
        """Seed volunteer nodes."""
        volunteers_data = [
            {
                "id": "volunteer_1",
                "name": "John Smith",
                "skills": ["first_aid", "driving"],
                "zone": "zone_a",
                "lat": 40.7128,
                "lon": -74.0060,
                "status": "available",
                "languages": ["english", "spanish"],
                "experience_years": 5
            },
            {
                "id": "volunteer_2",
                "name": "Maria Garcia",
                "skills": ["medical", "translation"],
                "zone": "zone_b",
                "lat": 40.7589,
                "lon": -73.9851,
                "status": "available",
                "languages": ["english", "spanish", "french"],
                "experience_years": 8
            },
            {
                "id": "volunteer_3",
                "name": "David Chen",
                "skills": ["logistics", "driving"],
                "zone": "zone_c",
                "lat": 40.6782,
                "lon": -73.9442,
                "status": "available",
                "languages": ["english", "chinese"],
                "experience_years": 3
            },
            {
                "id": "volunteer_4",
                "name": "Sarah Johnson",
                "skills": ["child_care", "first_aid"],
                "zone": "zone_d",
                "lat": 40.7282,
                "lon": -73.7949,
                "status": "available",
                "languages": ["english"],
                "experience_years": 2
            }
        ]

        for volunteer in volunteers_data:
            await self.client.create_node("Volunteer", volunteer)

            # Connect volunteer to their zone
            await self.client.create_relationship(
                "Volunteer", {"id": volunteer["id"]},
                "Zone", {"id": volunteer["zone"]},
                "LOCATED_IN",
                {}
            )

    async def _seed_supplies(self):
        """Seed supply nodes."""
        supplies_data = [
            {
                "id": "supply_oxygen_1",
                "type": "oxygen_tank",
                "quantity": 25,
                "zone": "zone_a",
                "lat": 40.7128,
                "lon": -74.0060,
                "status": "available"
            },
            {
                "id": "supply_meds_1",
                "type": "medical_supplies",
                "quantity": 100,
                "zone": "zone_b",
                "lat": 40.7589,
                "lon": -73.9851,
                "status": "available"
            },
            {
                "id": "supply_water_1",
                "type": "water",
                "quantity": 500,
                "zone": "zone_c",
                "lat": 40.6782,
                "lon": -73.9442,
                "status": "available"
            },
            {
                "id": "supply_food_1",
                "type": "food",
                "quantity": 200,
                "zone": "zone_a",
                "lat": 40.7128,
                "lon": -74.0060,
                "status": "available"
            }
        ]

        for supply in supplies_data:
            await self.client.create_node("Supply", supply)

            # Connect supply to its zone
            await self.client.create_relationship(
                "Supply", {"id": supply["id"]},
                "Zone", {"id": supply["zone"]},
                "STORED_IN",
                {}
            )

    async def clear_all_data(self) -> bool:
        """
        Clear all demo data from the database.
        Use with caution!
        """
        try:
            print("Clearing all demo data...")

            # Delete all nodes and relationships
            await self.client.run_query("""
                MATCH (n)
                DETACH DELETE n
            """)

            print("All data cleared successfully!")
            return True

        except Exception as e:
            print(f"Error clearing data: {e}")
            return False

    async def get_database_stats(self) -> dict:
        """
        Get statistics about the seeded database.
        """
        try:
            stats = {}

            # Count nodes by type
            node_counts = await self.client.run_query("""
                MATCH (n)
                RETURN labels(n)[0] as label, count(*) as count
                ORDER BY count DESC
            """)

            stats["nodes"] = {record["label"]: record["count"] for record in node_counts}

            # Count relationships
            rel_count = await self.client.run_query("""
                MATCH ()-[r]->()
                RETURN count(r) as count
            """)

            stats["relationships"] = rel_count[0]["count"] if rel_count else 0

            return stats

        except Exception as e:
            print(f"Error getting database stats: {e}")
            return {}