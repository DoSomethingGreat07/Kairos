"""Yen's K-shortest paths using the same constraint-filtered graph as Dijkstra."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import networkx as nx

from .dijkstra_router import DijkstraRouter


class YenRouter:
    def __init__(self, k: int = 3, dijkstra_router: Optional[DijkstraRouter] = None) -> None:
        self.k = k
        self.dijkstra_router = dijkstra_router or DijkstraRouter()

    def find_backup_routes(
        self,
        origin: str,
        destination: str,
        incident: Optional[Dict[str, Any]] = None,
        responder: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        graph, excluded_edges = self.dijkstra_router.build_graph(incident=incident, responder=responder)
        resolved_destination, destination_meta = self.dijkstra_router._resolve_destination(origin, destination)

        routes: List[Dict[str, Any]] = []
        if origin == resolved_destination and destination_meta.get("type") in {"hospital", "shelter"}:
            path, total_time, route_edges, _ = self.dijkstra_router._append_facility_leg(
                path=[origin],
                route_cost=0.0,
                route_edges=[],
                destination_meta=destination_meta,
                incident=incident,
            )
            return [{
                "precomputed_rank": 1,
                "path": path,
                "total_time": total_time,
                "blocked_edges": [edge["road_id"] for edge in excluded_edges if edge.get("road_id") != "*"],
                "route_edges": route_edges,
                "eta": self.dijkstra_router._calculate_eta(total_time),
            }]
        try:
            simple_paths = nx.shortest_simple_paths(graph, origin, resolved_destination, weight="weight")
            for rank, path in enumerate(simple_paths, start=1):
                route_cost = 0.0
                path_edges: List[Dict[str, Any]] = []
                for start, end in zip(path[:-1], path[1:]):
                    edge = graph[start][end]
                    route_cost += float(edge["weight"])
                    path_edges.append({"road_id": edge["road_id"], "source_zone": start, "target_zone": end})
                path, route_cost, path_edges, _ = self.dijkstra_router._append_facility_leg(
                    path=path,
                    route_cost=route_cost,
                    route_edges=path_edges,
                    destination_meta=destination_meta,
                    incident=incident,
                )
                routes.append({
                    "precomputed_rank": rank,
                    "path": path,
                    "total_time": route_cost,
                    "blocked_edges": [edge["road_id"] for edge in excluded_edges if edge.get("road_id") != "*"],
                    "route_edges": path_edges,
                    "eta": self.dijkstra_router._calculate_eta(route_cost),
                })
                if len(routes) >= self.k:
                    break
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            return []
        return routes
