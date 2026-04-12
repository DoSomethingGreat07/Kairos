"""Constraint-aware Dijkstra routing with facility-aware last-mile travel."""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Tuple

import networkx as nx

from ..operations.default_data import hospital_definitions, road_definitions, shelter_definitions, zone_definitions


class DijkstraRouter:
    """Find cheapest safe routes over the road graph."""

    def __init__(self, roads: Optional[List[Dict[str, Any]]] = None) -> None:
        self.roads = roads or road_definitions()
        self.zones = {zone["id"]: zone for zone in zone_definitions()}

    def build_graph(
        self,
        incident: Optional[Dict[str, Any]] = None,
        responder: Optional[Dict[str, Any]] = None,
        roads: Optional[List[Dict[str, Any]]] = None,
    ) -> Tuple[nx.Graph, List[Dict[str, Any]]]:
        incident = incident or {}
        responder = responder or {}
        road_rows = roads or self.roads
        requires_oxygen_path = bool(incident.get("needs_oxygen", incident.get("oxygen_required", False)))
        requires_equipment = requires_oxygen_path or bool(incident.get("required_skill"))
        has_equipment = bool(responder.get("has_equipment", True))

        graph = nx.Graph()
        excluded: List[Dict[str, Any]] = []

        if requires_equipment and not has_equipment:
            return graph, [{"road_id": "*", "reason": "Responder missing required equipment before traversal begins"}]

        for road in road_rows:
            if not road.get("safe", False):
                excluded.append({"road_id": road["road_id"], "reason": "road.safe = false"})
                continue
            if not road.get("passable", True):
                excluded.append({"road_id": road["road_id"], "reason": "road.passable = false"})
                continue
            weight = float(road["travel_time"]) * float(road["congestion"])
            if requires_oxygen_path and not road.get("has_oxygen", False):
                weight += 8.0
            graph.add_edge(
                road["source_zone"],
                road["target_zone"],
                road_id=road["road_id"],
                weight=weight,
                travel_time=road["travel_time"],
                congestion=road["congestion"],
                distance_km=road["distance_km"],
                oxygen_supported=road.get("has_oxygen", False),
            )

        return graph, excluded

    def find_route_details(
        self,
        origin: str,
        destination: str,
        incident: Optional[Dict[str, Any]] = None,
        responder: Optional[Dict[str, Any]] = None,
        roads: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        graph, excluded_edges = self.build_graph(incident=incident, responder=responder, roads=roads)
        resolved_destination, destination_meta = self._resolve_destination(origin, destination)

        path: List[str]
        route_cost: float
        route_edges: List[Dict[str, Any]]
        if origin == resolved_destination and destination_meta.get("type") in {"hospital", "shelter"}:
            path = [origin]
            route_cost = 0.0
            route_edges = []
        else:
            try:
                path = nx.shortest_path(graph, origin, resolved_destination, weight="weight")
                route_cost = float(nx.shortest_path_length(graph, origin, resolved_destination, weight="weight"))
            except (nx.NetworkXNoPath, nx.NodeNotFound):
                return {
                    "route": [],
                    "route_cost": float("inf"),
                    "eta": "No safe route available",
                    "excluded_edges": excluded_edges,
                    "destination": destination_meta,
                    "explanation": "No route satisfied the safety, oxygen, and equipment constraints.",
                }

            route_edges = []
            for start, end in zip(path[:-1], path[1:]):
                edge = graph[start][end]
                route_edges.append({"road_id": edge["road_id"], "source_zone": start, "target_zone": end, "weight": edge["weight"]})

        path, route_cost, route_edges, facility_explanation = self._append_facility_leg(
            path=path,
            route_cost=route_cost,
            route_edges=route_edges,
            destination_meta=destination_meta,
            incident=incident,
        )
        explanation = f"Selected route minimized road.travel_time × road.congestion across {len(route_edges)} traversable edges."
        if facility_explanation:
            explanation = f"{explanation} {facility_explanation}"
        return {
            "route": path,
            "route_cost": route_cost,
            "eta": self._calculate_eta(route_cost),
            "excluded_edges": excluded_edges,
            "route_edges": route_edges,
            "destination": destination_meta,
            "explanation": explanation,
        }

    def find_safe_route(
        self,
        origin: str,
        destination: str,
        incident: Optional[Dict[str, Any]] = None,
        responder: Optional[Dict[str, Any]] = None,
    ) -> Tuple[List[str], float, str]:
        details = self.find_route_details(origin, destination, incident=incident, responder=responder)
        return details["route"], details["route_cost"], details["eta"]

    @staticmethod
    def _calculate_eta(route_cost: float) -> str:
        if route_cost == float("inf"):
            return "No safe route available"
        minutes = round(route_cost)
        return f"{minutes} minutes"

    def _resolve_destination(self, origin_zone: str, destination: str) -> Tuple[str, Dict[str, Any]]:
        destination_key = str(destination).lower().replace(" ", "_")
        if destination_key == "hospital":
            hospitals = hospital_definitions()
            target = self._nearest_facility(origin_zone, hospitals)
            return target["zone_id"], {
                "id": target["id"],
                "name": target["name"],
                "type": "hospital",
                "zone_id": target["zone_id"],
                "latitude": target.get("latitude"),
                "longitude": target.get("longitude"),
            }
        if destination_key in {"shelter", "safe_zone"}:
            shelters = shelter_definitions()
            target = self._nearest_facility(origin_zone, shelters)
            return target["zone_id"], {
                "id": target["id"],
                "name": target["name"],
                "type": "shelter",
                "zone_id": target["zone_id"],
                "latitude": target.get("latitude"),
                "longitude": target.get("longitude"),
            }
        return destination, {"id": destination, "name": destination, "type": "zone"}

    def _nearest_facility(self, origin_zone: str, facilities: List[Dict[str, Any]]) -> Dict[str, Any]:
        same_zone = [facility for facility in facilities if facility.get("zone_id") == origin_zone]
        if same_zone:
            return same_zone[0]

        origin = self.zones.get(origin_zone) or {}
        origin_latitude = origin.get("latitude")
        origin_longitude = origin.get("longitude")
        if origin_latitude is None or origin_longitude is None:
            return facilities[0]

        return min(
            facilities,
            key=lambda facility: self._haversine_km(
                origin_latitude,
                origin_longitude,
                facility.get("latitude") if facility.get("latitude") is not None else origin_latitude,
                facility.get("longitude") if facility.get("longitude") is not None else origin_longitude,
            ),
        )

    def _append_facility_leg(
        self,
        path: List[str],
        route_cost: float,
        route_edges: List[Dict[str, Any]],
        destination_meta: Dict[str, Any],
        incident: Optional[Dict[str, Any]],
    ) -> Tuple[List[str], float, List[Dict[str, Any]], str]:
        if destination_meta.get("type") not in {"hospital", "shelter"}:
            return path, route_cost, route_edges, ""

        facility_minutes = self._facility_leg_minutes(incident or {}, destination_meta)
        facility_node = destination_meta["id"]
        augmented_path = list(path)
        augmented_edges = list(route_edges)
        if not augmented_path or augmented_path[-1] != facility_node:
            augmented_path.append(facility_node)
            augmented_edges.append({
                "road_id": f"facility_access_{facility_node}",
                "source_zone": path[-1] if path else destination_meta.get("zone_id"),
                "target_zone": facility_node,
                "weight": facility_minutes,
                "facility_leg": True,
            })
        return (
            augmented_path,
            float(route_cost + facility_minutes),
            augmented_edges,
            f"Added {facility_minutes:.1f} minutes of last-mile travel to reach {destination_meta['type']} {facility_node}.",
        )

    def _facility_leg_minutes(self, incident: Dict[str, Any], destination_meta: Dict[str, Any]) -> float:
        incident_lat = incident.get("latitude") or (incident.get("location") or {}).get("latitude")
        incident_lon = incident.get("longitude") or (incident.get("location") or {}).get("longitude")
        destination_lat = destination_meta.get("latitude")
        destination_lon = destination_meta.get("longitude")
        if None in {incident_lat, incident_lon, destination_lat, destination_lon}:
            return 6.0
        distance_km = self._haversine_km(incident_lat, incident_lon, destination_lat, destination_lon)
        return max(4.0, round(distance_km * 3.5, 1))

    @staticmethod
    def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        radius = 6_371.0
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)
        a = math.sin(delta_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
        return 2 * radius * math.atan2(math.sqrt(a), math.sqrt(1 - a))
