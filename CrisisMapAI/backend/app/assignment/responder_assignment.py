"""Responder assignment using the Hungarian algorithm."""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional

import numpy as np
from scipy.optimize import linear_sum_assignment

from ..operations.default_data import responder_definitions, zone_definitions


class ResponderAssignment:
    def __init__(self, responders: Optional[List[Dict[str, Any]]] = None, zones: Optional[List[Dict[str, Any]]] = None) -> None:
        self.responders = responders or responder_definitions()
        self.zone_lookup = {zone["id"]: zone for zone in (zones or zone_definitions())}

    def assign_responder(
        self,
        incident: Dict[str, Any],
        dispatch_mode: Optional[Dict[str, Any]] = None,
        route_details: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        if route_details and route_details.get("route_cost") == float("inf"):
            return {
                "assigned": False,
                "reason": "No safe route available",
                "responder_id": None,
                "responder_name": None,
                "responder_type": None,
                "cost_score": None,
                "eta": route_details.get("eta", "No safe route available"),
                "eta_minutes": 0,
                "destination": route_details.get("destination"),
                "route": route_details.get("route", []),
                "dispatch_match_applied": False,
                "explanation": "Responder assignment blocked because the routing layer found no safe path to the destination.",
                "penalties": {
                    "distance_meters": None,
                    "required_skill": incident.get("required_skill") or self._infer_required_skill(incident),
                    "skill_mismatch": None,
                    "equipment_missing": None,
                    "final_cost": None,
                    "explanation": "Assignment skipped: no safe route available.",
                },
                "status": "blocked_access",
            }
        incidents = [incident]
        available_responders = [row for row in self.responders if row.get("available", False)]
        dispatch_filtered = self._filter_for_dispatch_mode(available_responders, dispatch_mode)
        using_dispatch_filter = bool(dispatch_filtered)
        available_responders = dispatch_filtered or available_responders
        if not available_responders:
            return {
                "assigned": False,
                "reason": "No available responders",
                "explanation": "All responders were excluded because available = false.",
            }

        cost_matrix, details = self.build_cost_matrix(incidents, available_responders)
        row_indexes, col_indexes = linear_sum_assignment(cost_matrix)
        if len(row_indexes) == 0:
            return {"assigned": False, "reason": "No feasible assignment", "explanation": "The Hungarian algorithm found no feasible assignment."}

        responder_index = int(col_indexes[0])
        responder = available_responders[responder_index]
        penalty_details = details[0][responder_index]
        final_eta = (route_details or {}).get("eta") or f"{max(1, round(penalty_details['distance_meters'] / 250))} minutes"
        final_route = (route_details or {}).get("route", [])
        final_destination = (route_details or {}).get("destination")

        return {
            "assigned": True,
            "responder_id": responder["id"],
            "responder_name": responder["name"],
            "responder_type": responder["type"],
            "cost_score": float(cost_matrix[0][responder_index]),
            "eta": final_eta,
            "eta_minutes": self._eta_to_minutes(final_eta),
            "destination": final_destination,
            "route": final_route,
            "dispatch_match_applied": using_dispatch_filter,
            "explanation": penalty_details["explanation"],
            "penalties": penalty_details,
        }

    def _filter_for_dispatch_mode(self, responders: List[Dict[str, Any]], dispatch_mode: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not dispatch_mode:
            return responders
        responder_type = str(dispatch_mode.get("responder_type", "")).lower()
        if not responder_type:
            return responders
        normalized = responder_type.replace("_", " ")
        filtered = [
            responder for responder in responders
            if self._matches_dispatch_type(normalized, responder)
        ]
        return filtered

    @staticmethod
    def _matches_dispatch_type(dispatch_type: str, responder: Dict[str, Any]) -> bool:
        responder_type = str(responder.get("type", "")).lower()
        responder_skills = {str(skill).lower() for skill in (responder.get("skills") or responder.get("capabilities") or [])}
        dispatch_words = set(dispatch_type.split())
        if "advanced" in dispatch_words and "life" in dispatch_words:
            return "advanced life support" in responder_type or "advanced life support" in responder_skills
        if "basic" in dispatch_words and "ambulance" in dispatch_words:
            return "basic life support" in responder_type or "basic life support" in responder_skills or "basic first aid" in responder_skills
        if "fire" in dispatch_words:
            return "fire" in responder_type or "fire suppression" in responder_skills
        if "rescue" in dispatch_words:
            return "rescue" in responder_type or "debris search" in responder_skills
        if "ambulance" in dispatch_words:
            return "life support" in responder_type or "oxygen administration" in responder_skills
        return True

    def build_cost_matrix(
        self,
        incidents: List[Dict[str, Any]],
        responders: List[Dict[str, Any]],
    ) -> tuple[np.ndarray, List[List[Dict[str, Any]]]]:
        matrix = np.zeros((len(incidents), len(responders)))
        detail_rows: List[List[Dict[str, Any]]] = []
        for incident_index, incident in enumerate(incidents):
            row_details: List[Dict[str, Any]] = []
            for responder_index, responder in enumerate(responders):
                detail = self._compute_cost_detail(incident, responder)
                matrix[incident_index, responder_index] = detail["final_cost"]
                row_details.append(detail)
            detail_rows.append(row_details)
        return matrix, detail_rows

    def _compute_cost_detail(self, incident: Dict[str, Any], responder: Dict[str, Any]) -> Dict[str, Any]:
        incident_latitude, incident_longitude, coordinate_source = self._incident_coordinates(incident)
        distance_meters = self._haversine_meters(
            incident_latitude,
            incident_longitude,
            responder.get("latitude"),
            responder.get("longitude"),
        )
        required_skill = incident.get("required_skill") or self._infer_required_skill(incident)
        responder_skills = set(responder.get("skills") or responder.get("capabilities") or [])
        skill_mismatch = required_skill is not None and required_skill not in responder_skills
        equipment_required = bool(incident.get("needs_oxygen", incident.get("oxygen_required", False)))
        equipment_missing = equipment_required and not responder.get("has_equipment", False)

        final_cost = distance_meters + (5000 if skill_mismatch else 0) + (9999 if equipment_missing else 0)
        reasons = [f"distance={distance_meters:.1f}m via {coordinate_source}"]
        if skill_mismatch:
            reasons.append(f"skill mismatch (+5000) for required skill '{required_skill}'")
        if equipment_missing:
            reasons.append("equipment missing (+9999) for oxygen need")

        return {
            "distance_meters": distance_meters,
            "required_skill": required_skill,
            "skill_mismatch": skill_mismatch,
            "equipment_missing": equipment_missing,
            "final_cost": final_cost,
            "explanation": " | ".join(reasons),
        }

    def _incident_coordinates(self, incident: Dict[str, Any]) -> tuple[Optional[float], Optional[float], str]:
        latitude = incident.get("latitude") or incident.get("location", {}).get("latitude")
        longitude = incident.get("longitude") or incident.get("location", {}).get("longitude")
        if latitude is not None and longitude is not None:
            return latitude, longitude, "reported coordinates"
        zone_id = incident.get("zone") or incident.get("location", {}).get("zone")
        zone = self.zone_lookup.get(zone_id or "")
        if zone:
            return zone.get("latitude"), zone.get("longitude"), f"zone centroid {zone_id}"
        return None, None, "fallback distance"

    @staticmethod
    def _infer_required_skill(incident: Dict[str, Any]) -> Optional[str]:
        if incident.get("needs_oxygen", incident.get("oxygen_required", False)):
            return "Oxygen Administration"
        disaster_type = str(incident.get("disaster_type", "")).lower()
        if disaster_type == "fire":
            return "Fire Suppression"
        if disaster_type == "flood":
            return "Flood Rescue"
        if incident.get("injury"):
            return "Trauma Support"
        return None

    @staticmethod
    def _haversine_meters(lat1: Optional[float], lon1: Optional[float], lat2: Optional[float], lon2: Optional[float]) -> float:
        if None in {lat1, lon1, lat2, lon2}:
            return 10_000.0
        radius = 6_371_000
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)
        a = math.sin(delta_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
        return 2 * radius * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    @staticmethod
    def _eta_to_minutes(eta: str) -> int:
        try:
            return max(1, int(str(eta).split()[0]))
        except (ValueError, IndexError):
            return 0
