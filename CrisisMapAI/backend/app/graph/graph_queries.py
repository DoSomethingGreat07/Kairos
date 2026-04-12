from typing import Dict, Any, List, Optional
from .neo4j_client import Neo4jClient

class GraphQueries:
    """
    Handles complex graph queries for operational intelligence.
    Provides insights for coordination and decision making.
    """

    def __init__(self):
        self.client = Neo4jClient()

    def get_zone_status(self, zone_id: str) -> Dict[str, Any]:
        """Get comprehensive status for a zone."""
        query = """
        MATCH (z:Zone {id: $zone_id})

        // Active incidents in zone
        OPTIONAL MATCH (z)<-[:LOCATED_IN]-(s:SOS)
        WHERE s.status IN ['received', 'assigned', 'en_route']

        // Available responders in zone
        OPTIONAL MATCH (z)<-[:LOCATED_IN]-(r:Responder {available: true})

        // Nearby hospitals and shelters
        OPTIONAL MATCH (z)<-[:SERVES]-(h:Hospital)
        OPTIONAL MATCH (z)<-[:NEAR]-(sh:Shelter)

        // Connected zones
        OPTIONAL MATCH (z)-[road:ROAD]-(connected:Zone)
        WHERE road.blocked = false

        RETURN
            z,
            count(DISTINCT s) as active_incidents,
            count(DISTINCT r) as available_responders,
            collect(DISTINCT h) as hospitals,
            collect(DISTINCT sh) as shelters,
            collect(DISTINCT {zone: connected, distance: road.distance}) as connections
        """

        result = self.client.execute_query(query, {"zone_id": zone_id})
        if not result:
            return {}

        record = result[0]
        return {
            "zone": dict(record["z"]),
            "active_incidents": record["active_incidents"],
            "available_responders": record["available_responders"],
            "hospitals": [dict(h) for h in record["hospitals"] if h],
            "shelters": [dict(s) for s in record["shelters"] if s],
            "connections": record["connections"]
        }

    def get_responder_workload(self) -> List[Dict[str, Any]]:
        """Get responder workload and availability status."""
        query = """
        MATCH (r:Responder)
        OPTIONAL MATCH (r)<-[:ASSIGNED_TO]-(s:SOS)
        WHERE s.status IN ['assigned', 'en_route']

        // Get zone info
        OPTIONAL MATCH (r)-[:LOCATED_IN]->(z:Zone)

        RETURN
            r,
            z.name as zone,
            count(s) as active_assignments,
            r.available as is_available
        ORDER BY active_assignments DESC, r.available DESC
        """

        results = self.client.execute_query(query)
        return [
            {
                "responder": dict(record["r"]),
                "zone": record["zone"],
                "active_assignments": record["active_assignments"],
                "is_available": record["is_available"],
                "workload_status": self._calculate_workload_status(record["active_assignments"], record["is_available"])
            }
            for record in results
        ]

    def _calculate_workload_status(self, active_assignments: int, is_available: bool) -> str:
        """Calculate workload status based on assignments."""
        if not is_available:
            return "busy"
        elif active_assignments == 0:
            return "available"
        elif active_assignments == 1:
            return "light"
        elif active_assignments == 2:
            return "moderate"
        else:
            return "overloaded"

    def get_resource_utilization(self) -> Dict[str, Any]:
        """Get resource utilization across the system."""
        # Hospital utilization
        hospital_query = """
        MATCH (h:Hospital)
        RETURN
            sum(h.available_beds) as total_available_beds,
            sum(h.total_beds) as total_beds,
            count(h) as hospital_count
        """

        # Shelter utilization
        shelter_query = """
        MATCH (s:Shelter)
        RETURN
            sum(s.occupancy) as total_occupancy,
            sum(s.capacity) as total_capacity,
            count(s) as shelter_count
        """

        # Responder utilization
        responder_query = """
        MATCH (r:Responder)
        OPTIONAL MATCH (r)<-[:ASSIGNED_TO]-(s:SOS)
        WHERE s.status IN ['assigned', 'en_route']
        RETURN
            count(r) as total_responders,
            sum(CASE WHEN r.available THEN 1 ELSE 0 END) as available_responders,
            count(s) as total_assignments
        """

        hospital_result = self.client.execute_query(hospital_query)
        shelter_result = self.client.execute_query(shelter_query)
        responder_result = self.client.execute_query(responder_query)

        hospital_data = hospital_result[0] if hospital_result else {}
        shelter_data = shelter_result[0] if shelter_result else {}
        responder_data = responder_result[0] if responder_result else {}

        return {
            "hospitals": {
                "count": hospital_data.get("hospital_count", 0),
                "available_beds": hospital_data.get("total_available_beds", 0),
                "total_beds": hospital_data.get("total_beds", 0),
                "utilization_rate": self._calculate_utilization(
                    hospital_data.get("total_beds", 0) - hospital_data.get("total_available_beds", 0),
                    hospital_data.get("total_beds", 0)
                )
            },
            "shelters": {
                "count": shelter_data.get("shelter_count", 0),
                "occupancy": shelter_data.get("total_occupancy", 0),
                "total_capacity": shelter_data.get("total_capacity", 0),
                "utilization_rate": self._calculate_utilization(
                    shelter_data.get("total_occupancy", 0),
                    shelter_data.get("total_capacity", 0)
                )
            },
            "responders": {
                "count": responder_data.get("total_responders", 0),
                "available": responder_data.get("available_responders", 0),
                "active_assignments": responder_data.get("total_assignments", 0),
                "utilization_rate": self._calculate_utilization(
                    responder_data.get("total_assignments", 0),
                    responder_data.get("total_responders", 0)
                )
            }
        }

    def _calculate_utilization(self, used: int, total: int) -> float:
        """Calculate utilization rate as percentage."""
        if total == 0:
            return 0.0
        return round((used / total) * 100, 1)

    def get_incident_clusters(self) -> List[Dict[str, Any]]:
        """Identify clusters of incidents for coordinated response."""
        query = """
        MATCH (s:SOS)
        WHERE s.status IN ['received', 'assigned', 'en_route']
        MATCH (s)-[:LOCATED_IN]->(z:Zone)

        // Group by zone and count incidents
        RETURN
            z.id as zone_id,
            z.name as zone_name,
            z.risk_level as risk_level,
            count(s) as incident_count,
            collect(s.disaster_type) as disaster_types,
            collect(s.severity) as severities
        ORDER BY incident_count DESC
        """

        results = self.client.execute_query(query)
        clusters = []

        for record in results:
            if record["incident_count"] > 0:
                clusters.append({
                    "zone_id": record["zone_id"],
                    "zone_name": record["zone_name"],
                    "risk_level": record["risk_level"],
                    "incident_count": record["incident_count"],
                    "disaster_types": list(set(record["disaster_types"])),
                    "severities": list(set(record["severities"])),
                    "cluster_severity": self._assess_cluster_severity(record["severities"], record["incident_count"])
                })

        return clusters

    def _assess_cluster_severity(self, severities: List[str], count: int) -> str:
        """Assess overall severity of an incident cluster."""
        severity_weights = {"low": 1, "medium": 2, "high": 3, "critical": 4}

        # Calculate weighted severity score
        total_weight = 0
        for severity in severities:
            total_weight += severity_weights.get(severity, 2)

        avg_severity = total_weight / len(severities) if severities else 2

        # Scale by incident count
        scaled_severity = avg_severity * min(count, 5) / 2  # Cap scaling at 5 incidents

        if scaled_severity >= 3.5:
            return "critical"
        elif scaled_severity >= 2.5:
            return "high"
        elif scaled_severity >= 1.5:
            return "medium"
        else:
            return "low"

    def get_response_effectiveness(self, time_window_hours: int = 24) -> Dict[str, Any]:
        """Analyze response effectiveness over time."""
        query = """
        MATCH (s:SOS)
        WHERE s.timestamp >= datetime() - duration('PT' + $hours + 'H')

        // Count by status
        OPTIONAL MATCH (s)-[a:ASSIGNED_TO]->(r:Responder)
        WHERE a.assignment_time IS NOT NULL

        RETURN
            s.status as status,
            count(s) as count,
            avg(duration.between(s.timestamp, coalesce(a.assignment_time, datetime())).minutes) as avg_response_time_minutes
        """

        results = self.client.execute_query(query, {"hours": time_window_hours})

        status_counts = {}
        total_incidents = 0
        avg_response_times = []

        for record in results:
            status = record["status"]
            count = record["count"]
            status_counts[status] = count
            total_incidents += count

            if record["avg_response_time_minutes"] and not math.isnan(record["avg_response_time_minutes"]):
                avg_response_times.append(record["avg_response_time_minutes"])

        overall_avg_response = sum(avg_response_times) / len(avg_response_times) if avg_response_times else 0

        return {
            "time_window_hours": time_window_hours,
            "total_incidents": total_incidents,
            "status_breakdown": status_counts,
            "average_response_time_minutes": round(overall_avg_response, 1),
            "resolved_percentage": round((status_counts.get("resolved", 0) / total_incidents * 100), 1) if total_incidents > 0 else 0
        }

    def get_optimal_resource_allocation(self) -> Dict[str, Any]:
        """Suggest optimal resource allocation based on current patterns."""
        # Get current utilization
        utilization = self.get_resource_utilization()

        # Get incident clusters
        clusters = self.get_incident_clusters()

        recommendations = []

        # Hospital recommendations
        hospital_util = utilization["hospitals"]["utilization_rate"]
        if hospital_util > 80:
            recommendations.append({
                "type": "hospital",
                "priority": "high",
                "message": f"Hospital capacity at {hospital_util}%. Consider activating backup facilities.",
                "action": "increase_capacity"
            })
        elif hospital_util < 30:
            recommendations.append({
                "type": "hospital",
                "priority": "low",
                "message": f"Hospital utilization at {hospital_util}%. Consider consolidating resources.",
                "action": "optimize_usage"
            })

        # Responder recommendations
        responder_util = utilization["responders"]["utilization_rate"]
        if responder_util > 85:
            recommendations.append({
                "type": "responder",
                "priority": "high",
                "message": f"Responder utilization at {responder_util}%. Risk of response delays.",
                "action": "activate_reserves"
            })

        # Cluster-based recommendations
        for cluster in clusters:
            if cluster["cluster_severity"] == "critical" and cluster["incident_count"] > 2:
                recommendations.append({
                    "type": "coordination",
                    "priority": "critical",
                    "message": f"Critical incident cluster in {cluster['zone_name']} with {cluster['incident_count']} incidents.",
                    "action": "deploy_coordinator"
                })

        return {
            "current_utilization": utilization,
            "incident_clusters": clusters,
            "recommendations": recommendations,
            "overall_status": self._assess_overall_status(utilization, clusters)
        }

    def _assess_overall_status(self, utilization: Dict[str, Any], clusters: List[Dict[str, Any]]) -> str:
        """Assess overall system status."""
        # Check for critical conditions
        if utilization["hospitals"]["utilization_rate"] > 90:
            return "critical"
        if utilization["responders"]["utilization_rate"] > 90:
            return "critical"

        # Check for high-severity clusters
        critical_clusters = [c for c in clusters if c["cluster_severity"] == "critical"]
        if len(critical_clusters) > 0:
            return "high_alert"

        # Check for moderate stress
        if (utilization["hospitals"]["utilization_rate"] > 70 or
            utilization["responders"]["utilization_rate"] > 70):
            return "elevated"

        return "normal"

    def get_route_optimization_suggestions(self) -> List[Dict[str, Any]]:
        """Suggest route optimizations based on current conditions."""
        query = """
        MATCH (s:SOS)-[:ASSIGNED_TO]->(r:Responder)
        WHERE s.status = 'assigned'
        MATCH (s)-[:LOCATED_IN]->(sz:Zone)
        MATCH (r)-[:LOCATED_IN]->(rz:Zone)

        // Find if there are multiple responders going to same area
        MATCH (s2:SOS)-[:ASSIGNED_TO]->(r2:Responder)
        WHERE s2 <> s AND s2.status = 'assigned'
        MATCH (s2)-[:LOCATED_IN]->(sz2:Zone)
        WHERE sz = sz2 AND r <> r2

        RETURN
            sz.name as zone,
            count(DISTINCT r) as responder_count,
            count(DISTINCT s) as incident_count
        ORDER BY responder_count DESC
        """

        results = self.client.execute_query(query)
        suggestions = []

        for record in results:
            zone = record["zone"]
            responders = record["responder_count"]
            incidents = record["incident_count"]

            if responders > 1:
                suggestions.append({
                    "zone": zone,
                    "type": "coordinated_response",
                    "message": f"{responders} responders heading to {zone} for {incidents} incidents. Consider coordinated arrival.",
                    "potential_savings": f"Estimated {5 * (responders - 1)} minutes coordination time"
                })

        return suggestions