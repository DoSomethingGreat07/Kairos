from typing import Dict, Any, List
import asyncio
from .neo4j_client import Neo4jClient

class GraphWriter:
    """
    Handles writing incident data and assignments to the graph database.
    Manages the operational state updates.
    """

    def __init__(self):
        self.client = Neo4jClient()

    async def write_incident(self, incident: Dict[str, Any]) -> str:
        """
        Write complete incident data to graph database.

        Creates SOS node and all related assignments, routes, and state updates.
        """
        try:
            # Create SOS incident node
            incident_id = self._create_incident_node(incident)

            # Create assignment relationships
            if incident.get("assignment"):
                await self._create_assignment_relationships(incident_id, incident["assignment"])

            # Create volunteer assignments
            if incident.get("volunteers"):
                await self._create_volunteer_relationships(incident_id, incident["volunteers"])

            # Create supply distribution relationships
            if incident.get("supply_plan"):
                await self._create_supply_relationships(incident_id, incident["supply_plan"])

            # Update operational state
            await self._update_operational_state(incident)

            return incident_id

        except Exception as e:
            print(f"Error writing incident to graph: {e}")
            return None

    def _create_incident_node(self, incident: Dict[str, Any]) -> str:
        """Create SOS incident node in graph."""
        # Ensure zone exists
        zone_id = incident.get("zone", "Zone A")
        self._ensure_zone_exists(zone_id)

        # Prepare incident data for Neo4j
        sos_data = {
            "id": incident["id"],
            "sos_id": incident.get("sos_id", incident.get("id")),
            "zone": zone_id,
            "disaster_type": incident.get("disaster_type", "unknown"),
            "severity": incident.get("severity", "medium"),
            "people_count": incident.get("people_count", 1),
            "needs_oxygen": incident.get("needs_oxygen", incident.get("oxygen_required", False)),
            "oxygen_required": incident.get("oxygen_required", False),
            "injury": incident.get("injury", False),
            "elderly": incident.get("elderly", False),
            "is_elderly": incident.get("is_elderly", incident.get("elderly", False)),
            "required_skill": incident.get("required_skill"),
            "custom_zone": incident.get("location", {}).get("custom_zone"),
            "area_type": incident.get("location", {}).get("area_type"),
            "note": incident.get("note", ""),
            "landmark": incident.get("location", {}).get("landmark"),
            "place_name": incident.get("location", {}).get("place_name"),
            "street_access": incident.get("location", {}).get("street_access"),
            "latitude": incident.get("location", {}).get("latitude"),
            "longitude": incident.get("location", {}).get("longitude"),
            "gps": incident.get("location", {}).get("gps"),
            "access_difficulty": incident.get("location", {}).get("access_difficulty"),
            "floor_level": incident.get("location", {}).get("floor_level"),
            "nearby_safe_spot": incident.get("location", {}).get("nearby_safe_spot"),
            "injured_count": incident.get("medical", {}).get("injured_count"),
            "injury_severity": incident.get("medical", {}).get("injury_severity"),
            "oxygen_count": incident.get("medical", {}).get("oxygen_count"),
            "elderly_count": incident.get("medical", {}).get("elderly_count"),
            "children": incident.get("medical", {}).get("children", False),
            "children_count": incident.get("medical", {}).get("children_count"),
            "disabled": incident.get("medical", {}).get("disabled", False),
            "disabled_count": incident.get("medical", {}).get("disabled_count"),
            "trapped": incident.get("access", {}).get("trapped", False),
            "road_status": incident.get("access", {}).get("road_status", "unknown"),
            "safe_exit": incident.get("access", {}).get("safe_exit", True),
            "building_type": incident.get("access", {}).get("building_type", "house"),
            "contact_name": incident.get("contact", {}).get("name"),
            "contact_phone": incident.get("contact", {}).get("phone"),
            "preferred_language": incident.get("contact", {}).get("language", "English"),
            "photo_filename": incident.get("photo_filename"),
            "critical_needs": incident.get("critical_needs", []),
            "mass_casualty": incident.get("mass_casualty", False),
            "status": incident.get("status", "received"),
            "priority_score": incident.get("priority_score", 0),
            "timestamp": incident.get("timestamp", "").isoformat() if hasattr(incident.get("timestamp"), "isoformat") else str(incident.get("timestamp", ""))
        }

        return self.client.create_sos_incident(sos_data)

    async def _create_assignment_relationships(self, incident_id: str, assignment: Dict[str, Any]):
        """Create responder assignment relationships."""
        responder_id = assignment.get("responder_id")
        if responder_id:
            assignment_data = {
                "eta": assignment.get("eta", "unknown"),
                "route": assignment.get("route", []),
                "explanation": assignment.get("explanation", "")
            }

            self.client.assign_responder_to_incident(incident_id, responder_id, assignment_data)

            # Update destination if specified
            destination = assignment.get("destination")
            if destination:
                dest_type = destination.get("type", "hospital")
                dest_id = destination.get("id")
                if dest_id:
                    self.client.direct_to_destination(incident_id, dest_type, dest_id)

    async def _create_volunteer_relationships(self, incident_id: str, volunteers: List[Dict[str, Any]]):
        """Create volunteer assignment relationships."""
        for volunteer in volunteers:
            volunteer_id = volunteer.get("volunteer_id")
            task_type = volunteer.get("task_type", "support")

            # Create volunteer assignment relationship
            query = """
            MATCH (s:SOS {id: $incident_id}), (v:Volunteer {id: $volunteer_id})
            CREATE (s)-[va:VOLUNTEER_ASSIGNED {
                task_type: $task_type,
                match_score: $match_score,
                estimated_arrival: $estimated_arrival,
                assignment_time: datetime()
            }]->(v)
            SET v.available = false
            RETURN va
            """

            self.client.execute_query(query, {
                "incident_id": incident_id,
                "volunteer_id": volunteer_id,
                "task_type": task_type,
                "match_score": volunteer.get("match_score", 0),
                "estimated_arrival": volunteer.get("estimated_arrival", "unknown")
            })

    async def _create_supply_relationships(self, incident_id: str, supply_plan: Dict[str, Any]):
        """Create supply distribution relationships."""
        distributions = supply_plan.get("distributions", {})
        if not distributions and supply_plan.get("route_shipments"):
            distributions = {"default": {"routes": supply_plan.get("route_shipments", [])}}

        for supply_type, distribution in distributions.items():
            routes = distribution.get("routes", [])

            for route in routes:
                depot_id = route.get("from")
                shelter_id = route.get("to")
                amount = route.get("amount", 0)

                # Create supply distribution relationship
                query = """
                MATCH (s:SOS {id: $incident_id}), (d:Depot {id: $depot_id}), (sh:Shelter {id: $shelter_id})
                CREATE (s)-[sd:SUPPLY_DISTRIBUTED {
                    supply_type: $supply_type,
                    amount: $amount,
                    cost: $cost,
                    distribution_time: datetime()
                }]->(d)
                CREATE (d)-[st:SUPPLIES_TO {
                    supply_type: $supply_type,
                    amount: $amount,
                    transport_time: datetime()
                }]->(sh)
                SET d.supplies[$supply_type] = d.supplies[$supply_type] - $amount
                SET sh.occupancy = sh.occupancy + $amount
                RETURN sd, st
                """

                self.client.execute_query(query, {
                    "incident_id": incident_id,
                    "depot_id": depot_id,
                    "shelter_id": shelter_id,
                    "supply_type": supply_type,
                    "amount": amount,
                    "cost": route.get("cost", 0)
                })

    async def _update_operational_state(self, incident: Dict[str, Any]):
        """Update overall operational state after incident processing."""
        # Update zone risk based on incident
        zone_id = incident.get("zone")
        if zone_id:
            await self._update_zone_risk(zone_id, incident)

        # Update responder availability
        assignment = incident.get("assignment", {})
        if assignment.get("responder_id"):
            await self._update_responder_status(assignment["responder_id"], False)

        # Update destination capacity
        destination = assignment.get("destination", {})
        if destination.get("id"):
            await self._update_destination_capacity(destination["id"], destination.get("type", "hospital"))

    async def _update_zone_risk(self, zone_id: str, incident: Dict[str, Any]):
        """Update zone risk level based on incident patterns."""
        severity = incident.get("severity", "low")
        disaster_type = incident.get("disaster_type", "accident")

        # Risk escalation logic
        risk_escalation = {
            "low": {"accident": "low", "flood": "medium", "fire": "medium", "earthquake": "high"},
            "medium": {"accident": "medium", "flood": "high", "fire": "high", "earthquake": "critical"},
            "high": {"accident": "high", "flood": "high", "fire": "critical", "earthquake": "critical"},
            "critical": {"accident": "critical", "flood": "critical", "fire": "critical", "earthquake": "critical"}
        }

        current_risk = self.client.get_zone_risk(zone_id)
        new_risk = risk_escalation.get(current_risk, {}).get(disaster_type, current_risk)

        if new_risk != current_risk:
            query = """
            MATCH (z:Zone {id: $zone_id})
            SET z.risk_level = $new_risk, z.last_incident = datetime(), z.incident_count = z.incident_count + 1
            """
            self.client.execute_query(query, {"zone_id": zone_id, "new_risk": new_risk})

    async def _update_responder_status(self, responder_id: str, available: bool):
        """Update responder availability status."""
        query = """
        MATCH (r:Responder {id: $responder_id})
        SET r.available = $available, r.last_assignment = datetime()
        """
        self.client.execute_query(query, {"responder_id": responder_id, "available": available})

    async def _update_destination_capacity(self, destination_id: str, dest_type: str):
        """Update destination capacity after assignment."""
        if dest_type == "hospital":
            query = """
            MATCH (h:Hospital {id: $destination_id})
            WHERE h.available_beds > 0
            SET h.available_beds = h.available_beds - 1, h.last_admission = datetime()
            """
        elif dest_type == "shelter":
            query = """
            MATCH (s:Shelter {id: $destination_id})
            WHERE s.occupancy < s.capacity
            SET s.occupancy = s.occupancy + 1, s.last_admission = datetime()
            """
        else:
            return

        self.client.execute_query(query, {"destination_id": destination_id})

    def _ensure_zone_exists(self, zone_id: str):
        """Ensure zone exists in graph, create if not."""
        query = """
        MERGE (z:Zone {id: $zone_id})
        ON CREATE SET z.name = $zone_id, z.risk_level = "medium", z.created_at = datetime()
        ON MATCH SET z.last_accessed = datetime()
        """

        self.client.execute_query(query, {"zone_id": zone_id})

    async def create_operational_snapshot(self, incident_id: str) -> Dict[str, Any]:
        """Create a snapshot of operational state for the incident."""
        query = """
        MATCH (s:SOS {id: $incident_id})
        OPTIONAL MATCH (s)-[:ASSIGNED_TO]->(r:Responder)
        OPTIONAL MATCH (s)-[:DIRECTED_TO]->(dest)
        OPTIONAL MATCH (s)-[:LOCATED_IN]->(z:Zone)
        RETURN s, r, dest, z
        """

        result = self.client.execute_query(query, {"incident_id": incident_id})
        if not result:
            return {}

        record = result[0]
        snapshot = {
            "incident": dict(record["s"]) if record["s"] else {},
            "responder": dict(record["r"]) if record["r"] else {},
            "destination": dict(record["dest"]) if record["dest"] else {},
            "zone": dict(record["z"]) if record["z"] else {},
            "timestamp": "now"
        }

        return snapshot

    async def get_operational_metrics(self) -> Dict[str, Any]:
        """Get current operational metrics from graph."""
        # Active incidents
        active_query = """
        MATCH (s:SOS)
        WHERE s.status IN ['received', 'assigned', 'en_route']
        RETURN count(s) as active_incidents
        """
        active_result = self.client.execute_query(active_query)
        active_incidents = active_result[0]["active_incidents"] if active_result else 0

        # Available responders
        responder_query = """
        MATCH (r:Responder {available: true})
        RETURN count(r) as available_responders
        """
        responder_result = self.client.execute_query(responder_query)
        available_responders = responder_result[0]["available_responders"] if responder_result else 0

        # Hospital capacity
        hospital_query = """
        MATCH (h:Hospital)
        RETURN sum(h.available_beds) as total_beds, sum(h.total_beds) as total_capacity
        """
        hospital_result = self.client.execute_query(hospital_query)
        hospital_data = hospital_result[0] if hospital_result else {"total_beds": 0, "total_capacity": 0}

        # Shelter occupancy
        shelter_query = """
        MATCH (s:Shelter)
        RETURN sum(s.occupancy) as total_occupancy, sum(s.capacity) as total_capacity
        """
        shelter_result = self.client.execute_query(shelter_query)
        shelter_data = shelter_result[0] if shelter_result else {"total_occupancy": 0, "total_capacity": 0}

        return {
            "active_incidents": active_incidents,
            "available_responders": available_responders,
            "hospital_beds_available": hospital_data["total_beds"],
            "hospital_capacity_total": hospital_data["total_capacity"],
            "shelter_occupancy": shelter_data["total_occupancy"],
            "shelter_capacity_total": shelter_data["total_capacity"],
            "timestamp": "now"
        }
