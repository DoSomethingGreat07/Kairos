"""Canonical operational data aligned to the seeded JSON fixtures."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List
import json


SEED_DIR = Path(__file__).resolve().parents[3] / "data" / "seed"


def _read_seed(name: str) -> List[Dict[str, Any]]:
    path = SEED_DIR / name
    return json.loads(path.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def _zone_anchor_lookup() -> Dict[str, Dict[str, float]]:
    anchors: Dict[str, List[tuple[float, float]]] = {}
    for hospital in _read_seed("hospitals_seed.json"):
        zone_id = hospital.get("zone_id")
        latitude = hospital.get("latitude")
        longitude = hospital.get("longitude")
        if zone_id and latitude is not None and longitude is not None:
            anchors.setdefault(zone_id, []).append((float(latitude), float(longitude)))
    for responder in _read_seed("responders_seed.json"):
        zone_id = responder.get("primary_station_zone_id") or responder.get("profile_data", {}).get("current_zone")
        latitude = responder.get("profile_data", {}).get("latitude")
        longitude = responder.get("profile_data", {}).get("longitude")
        if zone_id and latitude is not None and longitude is not None:
            anchors.setdefault(zone_id, []).append((float(latitude), float(longitude)))

    return {
        zone_id: {
            "latitude": sum(lat for lat, _ in values) / len(values),
            "longitude": sum(lon for _, lon in values) / len(values),
        }
        for zone_id, values in anchors.items()
        if values
    }


def zone_definitions() -> List[Dict[str, Any]]:
    anchors = _zone_anchor_lookup()
    rows = []
    for zone in _read_seed("zones_seed.json"):
        zone_id = zone["id"]
        anchor = anchors.get(zone_id, {})
        rows.append(
            {
                "id": zone_id,
                "name": zone["name"],
                "risk_level": "medium",
                "latitude": anchor.get("latitude"),
                "longitude": anchor.get("longitude"),
                "population": 50000,
                "polygon_points": zone.get("polygon_points", []),
            }
        )
    return rows


def road_definitions() -> List[Dict[str, Any]]:
    return [
        {
            "id": row["road_id"],
            "road_id": row["road_id"],
            "source_zone": row["source_zone"],
            "target_zone": row["target_zone"],
            "travel_time": row["travel_time"],
            "safe": row.get("safe", not row.get("blocked", False)),
            "congestion": row.get("congestion", 1.0),
            "has_oxygen": row.get("has_oxygen", False),
            "distance_km": row.get("distance_km", 0),
            "capacity": row.get("capacity", 0),
            "passable": row.get("passable", not row.get("blocked", False)),
        }
        for row in _read_seed("roads_seed.json")
    ]


def hospital_definitions() -> List[Dict[str, Any]]:
    return [
        {
            "id": row["hospital_id"].lower().replace("-", "_"),
            "hospital_id": row["hospital_id"],
            "name": row["name"],
            "zone_id": row["zone_id"],
            "available_beds": row["available_beds"],
            "total_beds": row["total_beds"],
            "latitude": row.get("latitude"),
            "longitude": row.get("longitude"),
        }
        for row in _read_seed("hospitals_seed.json")
    ]


def shelter_definitions() -> List[Dict[str, Any]]:
    return [
        {
            "id": row["shelter_id"].lower().replace("-", "_"),
            "shelter_id": row["shelter_id"],
            "name": row["name"],
            "zone_id": row["zone_id"],
            "capacity": row["capacity"],
            "occupancy": row["occupancy"],
            "demand": row["demand"],
            "latitude": row.get("latitude"),
            "longitude": row.get("longitude"),
        }
        for row in _read_seed("shelters_seed.json")
    ]


def responder_definitions() -> List[Dict[str, Any]]:
    rows = []
    for row in _read_seed("responders_seed.json"):
        profile_data = row.get("profile_data") or {}
        capabilities = row.get("capabilities") or []
        skills = row.get("active_capabilities") or profile_data.get("skills") or capabilities
        availability = str(row.get("availability_status", "")).lower()
        rows.append(
            {
                "id": row["id"],
                "name": row["full_name"],
                "type": row["responder_type"],
                "zone_id": row.get("primary_station_zone_id"),
                "current_zone": profile_data.get("current_zone") or row.get("primary_station_zone_id"),
                "capabilities": capabilities,
                "skills": skills,
                "has_equipment": bool(profile_data.get("has_equipment") or row.get("personal_equipment")),
                "available": profile_data.get("available") if profile_data.get("available") is not None else availability in {"available_now", "available", "on_call"},
                "latitude": profile_data.get("latitude"),
                "longitude": profile_data.get("longitude"),
            }
        )
    return rows


def volunteer_definitions() -> List[Dict[str, Any]]:
    return [
        {
            "id": row["volunteer_id"],
            "name": row["full_name"],
            "skills": row.get("skills", []),
            "languages": row.get("languages", []),
            "available": row.get("available", False),
            "latitude": row.get("latitude"),
            "longitude": row.get("longitude"),
            "current_latitude": row.get("latitude"),
            "current_longitude": row.get("longitude"),
            "zone_id": row.get("zone_id"),
            "current_zone_id": row.get("zone_id"),
            "profile_data": row.get("profile_data", {}),
        }
        for row in _read_seed("volunteers_seed.json")
    ]


def task_definitions() -> List[Dict[str, Any]]:
    return [
        {
            "id": row["task_id"],
            "required_skill": row["required_skill"],
            "required_language": row["required_language"],
            "latitude": row.get("latitude"),
            "longitude": row.get("longitude"),
            "zone_id": row.get("zone_id"),
        }
        for row in _read_seed("tasks_seed.json")
    ]


def depot_definitions() -> List[Dict[str, Any]]:
    return [
        {
            "id": row["depot_id"].lower().replace("-", "_"),
            "depot_id": row["depot_id"],
            "name": row["name"],
            "supply": row["supply"],
            "zone_id": row["zone_id"],
            "latitude": row.get("latitude"),
            "longitude": row.get("longitude"),
        }
        for row in _read_seed("depots_seed.json")
    ]


def severity_prior_definitions() -> List[Dict[str, Any]]:
    return [
        {
            "id": f"prior_{row['zone_id']}_{row['disaster_type']}",
            "zone_id": row["zone_id"],
            "disaster_type": row["disaster_type"],
            "prior_critical": row["prior_critical"],
            "prior_high": row["prior_high"],
            "prior_medium": row["prior_medium"],
            "prior_low": row["prior_low"],
        }
        for row in _read_seed("zone_history_seed.json")
    ]
