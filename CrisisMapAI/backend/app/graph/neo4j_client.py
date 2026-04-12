from neo4j import GraphDatabase
from typing import Dict, Any, List, Optional
from ..config import settings

class Neo4jClient:
    """
    Neo4j client for graph database operations.
    Handles connection, queries, and data persistence.
    """

    def __init__(self):
        self.driver = None
        self._connect()

    def _connect(self):
        """Establish connection to Neo4j database."""
        try:
            self.driver = GraphDatabase.driver(
                settings.neo4j_uri,
                auth=(settings.neo4j_user, settings.neo4j_password),
                max_connection_lifetime=30 * 60,  # 30 minutes
                max_connection_pool_size=50,
                connection_acquisition_timeout=2.0
            )
            print("Connected to Neo4j database")
        except Exception as e:
            print(f"Failed to connect to Neo4j: {e}")
            # For demo purposes, continue without database
            self.driver = None

    async def close(self):
        """Close database connection."""
        if self.driver:
            self.driver.close()

    def execute_query(self, query: str, parameters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Execute a Cypher query synchronously."""
        if not self.driver:
            print("No database connection - returning empty results")
            return []

        with self.driver.session() as session:
            result = session.run(query, parameters or {})
            return [record.data() for record in result]

    async def execute_query_async(self, query: str, parameters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Execute a Cypher query asynchronously."""
        if not self.driver:
            print("No database connection - returning empty results")
            return []

        async with self.driver.session() as session:
            result = await session.run(query, parameters or {})
            records = []
            async for record in result:
                records.append(dict(record))
            return records

    def create_unique_constraint(self, label: str, property_key: str) -> None:
        """Create a unique constraint for a node label property."""
        query = f"""
        CREATE CONSTRAINT IF NOT EXISTS FOR (n:{label}) REQUIRE n.{property_key} IS UNIQUE
        """
        self.execute_query(query)

    def create_index(self, label: str, property_key: str) -> None:
        """Create an index for a node label property."""
        query = f"""
        CREATE INDEX IF NOT EXISTS FOR (n:{label}) ON (n.{property_key})
        """
        self.execute_query(query)

    def create_node(self, label: str, properties: Dict[str, Any], merge: bool = False) -> Optional[str]:
        """Create or merge a node by id property."""
        if merge and "id" in properties:
            query = f"""
            MERGE (n:{label} {{id: $id}})
            SET n += $props
            RETURN n.id as id
            """
            params = {"id": properties["id"], "props": properties}
        else:
            query = f"""
            CREATE (n:{label} $props)
            RETURN n.id as id
            """
            params = {"props": properties}

        result = self.execute_query(query, params)
        return result[0]["id"] if result else None

    def create_relationship(
        self,
        from_label: str,
        from_id: Any,
        to_label: str,
        to_id: Any,
        rel_type: str,
        rel_props: Optional[Dict[str, Any]] = None,
        merge: bool = False
    ) -> Optional[str]:
        """Create or merge a relationship between nodes by id."""
        rel_props = rel_props or {}
        if merge:
            query = f"""
            MATCH (a:{from_label} {{id: $from_id}}), (b:{to_label} {{id: $to_id}})
            MERGE (a)-[r:{rel_type}]->(b)
            SET r += $rel_props
            RETURN id(r) as id
            """
        else:
            query = f"""
            MATCH (a:{from_label} {{id: $from_id}}), (b:{to_label} {{id: $to_id}})
            CREATE (a)-[r:{rel_type} $rel_props]->(b)
            RETURN id(r) as id
            """

        result = self.execute_query(query, {
            "from_id": from_id,
            "to_id": to_id,
            "rel_props": rel_props
        })
        return result[0]["id"] if result else None

    def create_zone(self, zone_data: Dict[str, Any]) -> str:
        """Create a Zone node."""
        query = """
        CREATE (z:Zone {
            id: $id,
            name: $name,
            risk_level: $risk_level,
            latitude: $latitude,
            longitude: $longitude,
            created_at: datetime()
        })
        RETURN z.id as id
        """

        result = self.execute_query(query, zone_data)
        return result[0]["id"] if result else None

    def create_road(self, road_data: Dict[str, Any]) -> str:
        """Create a Road relationship between zones."""
        query = """
        MATCH (a:Zone {id: $from_zone}), (b:Zone {id: $to_zone})
        CREATE (a)-[r:ROAD {
            id: $id,
            distance: $distance,
            blocked: $blocked,
            created_at: datetime()
        }]->(b)
        RETURN r.id as id
        """

        result = self.execute_query(query, road_data)
        return result[0]["id"] if result else None

    def create_responder(self, responder_data: Dict[str, Any]) -> str:
        """Create a Responder node."""
        query = """
        MATCH (z:Zone {id: $zone_id})
        CREATE (r:Responder {
            id: $id,
            name: $name,
            type: $type,
            capabilities: $capabilities,
            available: $available,
            latitude: $latitude,
            longitude: $longitude,
            created_at: datetime()
        })-[:LOCATED_IN]->(z)
        RETURN r.id as id
        """

        result = self.execute_query(query, responder_data)
        return result[0]["id"] if result else None

    def create_hospital(self, hospital_data: Dict[str, Any]) -> str:
        """Create a Hospital node."""
        query = """
        MATCH (z:Zone {id: $zone_id})
        CREATE (h:Hospital {
            id: $id,
            name: $name,
            available_beds: $available_beds,
            total_beds: $total_beds,
            latitude: $latitude,
            longitude: $longitude,
            created_at: datetime()
        })-[:SERVES]->(z)
        RETURN h.id as id
        """

        result = self.execute_query(query, hospital_data)
        return result[0]["id"] if result else None

    def create_shelter(self, shelter_data: Dict[str, Any]) -> str:
        """Create a Shelter node."""
        query = """
        MATCH (z:Zone {id: $zone_id})
        CREATE (s:Shelter {
            id: $id,
            name: $name,
            capacity: $capacity,
            occupancy: $occupancy,
            latitude: $latitude,
            longitude: $longitude,
            created_at: datetime()
        })-[:NEAR]->(z)
        RETURN s.id as id
        """

        result = self.execute_query(query, shelter_data)
        return result[0]["id"] if result else None

    def create_sos_incident(self, sos_data: Dict[str, Any]) -> str:
        """Create an SOS incident node."""
        query = """
        MATCH (z:Zone {id: $zone})
        CREATE (s:SOS {
            id: $id,
            sos_id: $sos_id,
            disaster_type: $disaster_type,
            severity: $severity,
            people_count: $people_count,
            needs_oxygen: $needs_oxygen,
            oxygen_required: $oxygen_required,
            injury: $injury,
            elderly: $elderly,
            is_elderly: $is_elderly,
            required_skill: $required_skill,
            custom_zone: $custom_zone,
            area_type: $area_type,
            note: $note,
            landmark: $landmark,
            place_name: $place_name,
            street_access: $street_access,
            latitude: $latitude,
            longitude: $longitude,
            gps: $gps,
            access_difficulty: $access_difficulty,
            floor_level: $floor_level,
            nearby_safe_spot: $nearby_safe_spot,
            injured_count: $injured_count,
            injury_severity: $injury_severity,
            oxygen_count: $oxygen_count,
            elderly_count: $elderly_count,
            children: $children,
            children_count: $children_count,
            disabled: $disabled,
            disabled_count: $disabled_count,
            trapped: $trapped,
            road_status: $road_status,
            safe_exit: $safe_exit,
            building_type: $building_type,
            contact_name: $contact_name,
            contact_phone: $contact_phone,
            preferred_language: $preferred_language,
            photo_filename: $photo_filename,
            critical_needs: $critical_needs,
            mass_casualty: $mass_casualty,
            status: $status,
            priority_score: $priority_score,
            timestamp: datetime($timestamp),
            created_at: datetime()
        })-[:LOCATED_IN]->(z)
        RETURN s.id as id
        """

        result = self.execute_query(query, sos_data)
        return result[0]["id"] if result else None

    def assign_responder_to_incident(self, incident_id: str, responder_id: str, assignment_data: Dict[str, Any]):
        """Create assignment relationship between responder and incident."""
        query = """
        MATCH (s:SOS {id: $incident_id}), (r:Responder {id: $responder_id})
        CREATE (s)-[a:ASSIGNED_TO {
            eta: $eta,
            route: $route,
            assignment_time: datetime(),
            explanation: $explanation
        }]->(r)
        SET r.available = false
        RETURN a
        """

        self.execute_query(query, {
            "incident_id": incident_id,
            "responder_id": responder_id,
            **assignment_data
        })

    def direct_to_destination(self, incident_id: str, destination_type: str, destination_id: str):
        """Create direction relationship to hospital or shelter."""
        if destination_type.lower() == "hospital":
            query = """
            MATCH (s:SOS {id: $incident_id}), (h:Hospital {id: $destination_id})
            CREATE (s)-[d:DIRECTED_TO {direction_time: datetime()}]->(h)
            SET h.available_beds = h.available_beds - 1
            RETURN d
            """
        elif destination_type.lower() == "shelter":
            query = """
            MATCH (s:SOS {id: $incident_id}), (sh:Shelter {id: $destination_id})
            CREATE (s)-[d:DIRECTED_TO {direction_time: datetime()}]->(sh)
            SET sh.occupancy = sh.occupancy + $people_count
            RETURN d
            """
        else:
            return

        people_count = 1  # Default, should be passed in
        self.execute_query(query, {
            "incident_id": incident_id,
            "destination_id": destination_id,
            "people_count": people_count
        })

    def get_zone_risk(self, zone_id: str) -> str:
        """Get risk level for a zone."""
        query = """
        MATCH (z:Zone {id: $zone_id})
        RETURN z.risk_level as risk_level
        """

        result = self.execute_query(query, {"zone_id": zone_id})
        return result[0]["risk_level"] if result else "medium"

    def get_available_responders(self, zone_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get available responders, optionally filtered by zone."""
        if zone_id:
            query = """
            MATCH (r:Responder {available: true})-[:LOCATED_IN]->(z:Zone {id: $zone_id})
            RETURN r, z.name as zone_name
            """
            params = {"zone_id": zone_id}
        else:
            query = """
            MATCH (r:Responder {available: true})-[:LOCATED_IN]->(z:Zone)
            RETURN r, z.name as zone_name
            """
            params = {}

        results = self.execute_query(query, params)
        responders = []
        for record in results:
            responder = dict(record["r"])
            responder["zone"] = record["zone_name"]
            responders.append(responder)

        return responders

    def get_hospital_capacity(self, zone_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get hospital capacity information."""
        if zone_id:
            query = """
            MATCH (h:Hospital)-[:SERVES]->(z:Zone {id: $zone_id})
            RETURN h, z.name as zone_name
            """
            params = {"zone_id": zone_id}
        else:
            query = """
            MATCH (h:Hospital)-[:SERVES]->(z:Zone)
            RETURN h, z.name as zone_name
            """
            params = {}

        results = self.execute_query(query, params)
        hospitals = []
        for record in results:
            hospital = dict(record["h"])
            hospital["zone"] = record["zone_name"]
            hospitals.append(hospital)

        return hospitals

    def get_active_incidents(self) -> List[Dict[str, Any]]:
        """Get all active (non-resolved) incidents."""
        query = """
        MATCH (s:SOS)
        WHERE s.status <> 'resolved'
        OPTIONAL MATCH (s)-[:ASSIGNED_TO]->(r:Responder)
        OPTIONAL MATCH (s)-[:DIRECTED_TO]->(dest)
        RETURN s, r, dest
        ORDER BY s.priority_score DESC
        """

        results = self.execute_query(query)
        incidents = []
        for record in results:
            incident = dict(record["s"])
            if record["r"]:
                incident["assigned_responder"] = dict(record["r"])
            if record["dest"]:
                dest_node = dict(record["dest"])
                incident["destination"] = {
                    "id": dest_node.get("id"),
                    "name": dest_node.get("name"),
                    "type": dest_node.get("type", "unknown")
                }
            incidents.append(incident)

        return incidents

    def update_incident_status(self, incident_id: str, status: str, additional_data: Optional[Dict[str, Any]] = None):
        """Update incident status and metadata."""
        query = """
        MATCH (s:SOS {id: $incident_id})
        SET s.status = $status, s.updated_at = datetime()
        """

        if additional_data:
            for key, value in additional_data.items():
                if key not in ["id", "status"]:  # Don't overwrite these
                    query += f", s.{key} = ${key}"

        self.execute_query(query, {"incident_id": incident_id, "status": status, **(additional_data or {})})

    def get_shortest_path(self, from_zone: str, to_zone: str) -> List[str]:
        """Find shortest path between zones."""
        query = """
        MATCH path = shortestPath(
            (a:Zone {id: $from_zone})-[r:ROAD*]-(b:Zone {id: $to_zone})
        )
        WHERE ALL(rel IN relationships(path) WHERE rel.blocked = false)
        RETURN [node IN nodes(path) | node.id] as path
        """

        result = self.execute_query(query, {"from_zone": from_zone, "to_zone": to_zone})
        return result[0]["path"] if result else []

    def get_zone_connectivity(self) -> Dict[str, Any]:
        """Get zone connectivity information."""
        query = """
        MATCH (z:Zone)
        OPTIONAL MATCH (z)-[r:ROAD]-(connected:Zone)
        WHERE r.blocked = false
        RETURN z.id as zone_id, count(connected) as connections
        """

        results = self.execute_query(query)
        connectivity = {record["zone_id"]: record["connections"] for record in results}

        return {
            "zone_connectivity": connectivity,
            "total_zones": len(connectivity),
            "average_connections": sum(connectivity.values()) / len(connectivity) if connectivity else 0
        }
