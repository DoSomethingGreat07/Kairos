"""Min-cost max-flow supply distribution."""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional

import networkx as nx

from ..operations.default_data import depot_definitions, road_definitions, shelter_definitions


class SupplyDistribution:
    def __init__(
        self,
        depots: Optional[List[Dict[str, Any]]] = None,
        shelters: Optional[List[Dict[str, Any]]] = None,
        routes: Optional[List[Dict[str, Any]]] = None,
    ) -> None:
        self.depots = depots or depot_definitions()
        self.shelters = shelters or shelter_definitions()
        self.routes = routes or road_definitions()

    def distribute_supplies(self, incident: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        network = self._build_min_cost_network()
        if network is None:
            return {"flow_plan": [], "route_shipments": [], "total_cost": 0, "explanation": "No feasible passable network available."}

        flow_cost, flow_dict = nx.network_simplex(network)
        shipments = []
        for depot in self.depots:
            depot_id = depot["id"]
            for shelter in self.shelters:
                shelter_id = shelter["id"]
                amount = flow_dict.get(depot_id, {}).get(shelter_id, 0)
                if amount:
                    unit_cost = network[depot_id][shelter_id]["weight"]
                    shipments.append({
                        "from": depot_id,
                        "to": shelter_id,
                        "amount": amount,
                        "distance_km": unit_cost,
                        "cost": amount * unit_cost,
                    })

        return {
            "flow_plan": shipments,
            "route_shipments": shipments,
            "total_cost": flow_cost,
            "explanation": "Computed min-cost max-flow over passable arcs while meeting all shelter demand constraints.",
        }

    def _build_min_cost_network(self) -> Optional[nx.DiGraph]:
        graph = nx.DiGraph()
        total_supply = sum(depot["supply"] for depot in self.depots)
        total_demand = sum(shelter["demand"] for shelter in self.shelters)
        if total_supply < total_demand:
            return None

        graph.add_node("source", demand=-total_demand)
        graph.add_node("sink", demand=total_demand)

        for depot in self.depots:
            graph.add_node(depot["id"], demand=0)
            graph.add_edge("source", depot["id"], capacity=depot["supply"], weight=0)

        for shelter in self.shelters:
            graph.add_node(shelter["id"], demand=0)
            graph.add_edge(shelter["id"], "sink", capacity=shelter["demand"], weight=0)

        zone_graph = nx.Graph()
        for route in self.routes:
            if not route.get("passable", True):
                continue
            zone_graph.add_edge(route["source_zone"], route["target_zone"], weight=route["distance_km"], capacity=route["capacity"])

        for depot in self.depots:
            for shelter in self.shelters:
                if depot["zone_id"] == shelter["zone_id"]:
                    local_cost = self._same_zone_delivery_cost(depot, shelter)
                    graph.add_edge(
                        depot["id"],
                        shelter["id"],
                        capacity=min(depot["supply"], shelter["demand"]),
                        weight=local_cost,
                    )
                    continue
                try:
                    distance = nx.shortest_path_length(zone_graph, depot["zone_id"], shelter["zone_id"], weight="weight")
                    path = nx.shortest_path(zone_graph, depot["zone_id"], shelter["zone_id"], weight="weight")
                except (nx.NetworkXNoPath, nx.NodeNotFound):
                    continue
                path_capacities = [
                    zone_graph[start][end]["capacity"]
                    for start, end in zip(path[:-1], path[1:])
                ] or [0]
                graph.add_edge(
                    depot["id"],
                    shelter["id"],
                    capacity=min(min(path_capacities), depot["supply"], shelter["demand"]),
                    weight=int(round(distance)),
                )
        return graph

    def _same_zone_delivery_cost(self, depot: Dict[str, Any], shelter: Dict[str, Any]) -> int:
        depot_latitude = depot.get("latitude")
        depot_longitude = depot.get("longitude")
        shelter_latitude = shelter.get("latitude")
        shelter_longitude = shelter.get("longitude")
        if None in {depot_latitude, depot_longitude, shelter_latitude, shelter_longitude}:
            return 2
        distance_km = self._haversine_km(depot_latitude, depot_longitude, shelter_latitude, shelter_longitude)
        return max(2, int(round(distance_km)))

    @staticmethod
    def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        radius = 6_371.0
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)
        a = math.sin(delta_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
        return 2 * radius * math.atan2(math.sqrt(a), math.sqrt(1 - a))
