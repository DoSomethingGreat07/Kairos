"""Canonical demo data for operational logic, graph seeding, and tests.

The fields in this module are intentionally aligned with the algorithm input
contracts so the logic layer, graph seed pipeline, and schema audit all speak
the same language.
"""

from __future__ import annotations

from typing import Any, Dict, List


def zone_definitions() -> List[Dict[str, Any]]:
    return [
        {"id": "zone_a", "name": "Zone A", "risk_level": "medium", "latitude": 40.7128, "longitude": -74.0060, "population": 50000},
        {"id": "zone_b", "name": "Zone B", "risk_level": "high", "latitude": 40.7589, "longitude": -73.9851, "population": 75000},
        {"id": "zone_c", "name": "Zone C", "risk_level": "low", "latitude": 40.6782, "longitude": -73.9442, "population": 60000},
        {"id": "zone_d", "name": "Zone D", "risk_level": "medium", "latitude": 40.7282, "longitude": -73.7949, "population": 45000},
        {"id": "zone_e", "name": "Zone E", "risk_level": "high", "latitude": 40.8448, "longitude": -73.8648, "population": 35000},
        {"id": "zone_f", "name": "Zone F", "risk_level": "low", "latitude": 40.5795, "longitude": -74.1502, "population": 25000},
    ]


def road_definitions() -> List[Dict[str, Any]]:
    roads = [
        ("road_ab", "zone_a", "zone_b", 15, True, 1.0, True, 7.5, 30, True),
        ("road_bc", "zone_b", "zone_c", 20, True, 1.2, True, 10.0, 22, True),
        ("road_bd", "zone_b", "zone_d", 25, True, 1.1, False, 12.5, 18, True),
        ("road_be", "zone_b", "zone_e", 30, True, 1.4, True, 15.0, 16, True),
        ("road_cf", "zone_c", "zone_f", 35, True, 1.0, True, 17.5, 20, True),
        ("road_de", "zone_d", "zone_e", 20, False, 1.3, False, 10.0, 12, False),
        ("road_ac", "zone_a", "zone_c", 25, True, 0.9, True, 12.5, 28, True),
        ("road_ad", "zone_a", "zone_d", 30, True, 1.1, False, 15.0, 14, True),
    ]
    return [
        {
            "id": road_id,
            "road_id": road_id,
            "source_zone": source_zone,
            "target_zone": target_zone,
            "travel_time": travel_time,
            "safe": safe,
            "congestion": congestion,
            "has_oxygen": has_oxygen,
            "distance_km": distance_km,
            "capacity": capacity,
            "passable": passable,
        }
        for road_id, source_zone, target_zone, travel_time, safe, congestion, has_oxygen, distance_km, capacity, passable in roads
    ]


def hospital_definitions() -> List[Dict[str, Any]]:
    return [
        {"id": "hospital_1", "name": "City General Hospital", "zone_id": "zone_a", "available_beds": 200, "total_beds": 500, "latitude": 40.7128, "longitude": -74.0060},
        {"id": "hospital_2", "name": "Metropolitan Medical Center", "zone_id": "zone_b", "available_beds": 300, "total_beds": 750, "latitude": 40.7589, "longitude": -73.9851},
        {"id": "hospital_3", "name": "Brooklyn Regional Hospital", "zone_id": "zone_c", "available_beds": 150, "total_beds": 400, "latitude": 40.6782, "longitude": -73.9442},
    ]


def shelter_definitions() -> List[Dict[str, Any]]:
    return [
        {"id": "shelter_1", "name": "Downtown Community Center", "zone_id": "zone_a", "capacity": 200, "occupancy": 150, "demand": 50, "latitude": 40.7128, "longitude": -74.0060},
        {"id": "shelter_2", "name": "Midtown High School", "zone_id": "zone_b", "capacity": 300, "occupancy": 250, "demand": 60, "latitude": 40.7589, "longitude": -73.9851},
        {"id": "shelter_3", "name": "Brooklyn Civic Center", "zone_id": "zone_c", "capacity": 150, "occupancy": 120, "demand": 30, "latitude": 40.6782, "longitude": -73.9442},
    ]


def responder_definitions() -> List[Dict[str, Any]]:
    return [
        {
            "id": "responder_1",
            "name": "Ambulance ALS-1",
            "type": "Advanced Life Support",
            "zone_id": "zone_a",
            "current_zone": "zone_a",
            "capabilities": ["Advanced Life Support", "Oxygen Administration", "Trauma Support"],
            "skills": ["Advanced Life Support", "Oxygen Administration", "Trauma Support"],
            "has_equipment": True,
            "available": True,
            "latitude": 40.7128,
            "longitude": -74.0060,
        },
        {
            "id": "responder_2",
            "name": "Ambulance BLS-1",
            "type": "Basic Life Support",
            "zone_id": "zone_b",
            "current_zone": "zone_b",
            "capabilities": ["Basic First Aid", "CPR", "Oxygen Administration"],
            "skills": ["Basic First Aid", "CPR", "Oxygen Administration"],
            "has_equipment": True,
            "available": True,
            "latitude": 40.7589,
            "longitude": -73.9851,
        },
        {
            "id": "responder_3",
            "name": "Fire Unit 7",
            "type": "Firefighter",
            "zone_id": "zone_c",
            "current_zone": "zone_c",
            "capabilities": ["Fire Suppression", "Rope Rescue", "Debris Search"],
            "skills": ["Fire Suppression", "Rope Rescue", "Debris Search"],
            "has_equipment": True,
            "available": True,
            "latitude": 40.6782,
            "longitude": -73.9442,
        },
        {
            "id": "responder_4",
            "name": "Rapid Response 2",
            "type": "Rescue Operator",
            "zone_id": "zone_d",
            "current_zone": "zone_d",
            "capabilities": ["Trauma Support", "Debris Search"],
            "skills": ["Trauma Support", "Debris Search"],
            "has_equipment": False,
            "available": False,
            "latitude": 40.7282,
            "longitude": -73.7949,
        },
    ]


def volunteer_definitions() -> List[Dict[str, Any]]:
    return [
        {"id": "volunteer_1", "name": "John Smith", "skills": ["Basic First Aid", "Supply Distribution"], "languages": ["English", "Spanish"], "available": True, "latitude": 40.7128, "longitude": -74.0060, "current_latitude": 40.7134, "current_longitude": -74.0048, "zone_id": "zone_a", "current_zone_id": "zone_a"},
        {"id": "volunteer_2", "name": "Maria Garcia", "skills": ["Language Translation", "Child Support"], "languages": ["English", "Spanish"], "available": True, "latitude": 40.7589, "longitude": -73.9851, "current_latitude": 40.7572, "current_longitude": -73.9834, "zone_id": "zone_b", "current_zone_id": "zone_b"},
        {"id": "volunteer_3", "name": "David Chen", "skills": ["Shelter Operations", "Supply Distribution"], "languages": ["English", "Mandarin"], "available": True, "latitude": 40.6782, "longitude": -73.9442, "current_latitude": 40.6791, "current_longitude": -73.9415, "zone_id": "zone_c", "current_zone_id": "zone_c"},
        {"id": "volunteer_4", "name": "Sarah Johnson", "skills": ["Basic First Aid", "Mental Health Support"], "languages": ["English"], "available": False, "latitude": 40.7282, "longitude": -73.7949, "current_latitude": 40.7282, "current_longitude": -73.7949, "zone_id": "zone_d", "current_zone_id": "zone_d"},
    ]


def task_definitions() -> List[Dict[str, Any]]:
    return [
        {"id": "task_1", "required_skill": "Supply Distribution", "required_language": "English", "latitude": 40.7125, "longitude": -74.0058, "zone_id": "zone_a"},
        {"id": "task_2", "required_skill": "Language Translation", "required_language": "Spanish", "latitude": 40.7591, "longitude": -73.9850, "zone_id": "zone_b"},
        {"id": "task_3", "required_skill": "Shelter Operations", "required_language": "English", "latitude": 40.6785, "longitude": -73.9440, "zone_id": "zone_c"},
    ]


def depot_definitions() -> List[Dict[str, Any]]:
    return [
        {"id": "depot_1", "name": "Central Depot", "supply": 120, "zone_id": "zone_a", "latitude": 40.7128, "longitude": -74.0060},
        {"id": "depot_2", "name": "North Depot", "supply": 90, "zone_id": "zone_b", "latitude": 40.7589, "longitude": -73.9851},
        {"id": "depot_3", "name": "South Depot", "supply": 70, "zone_id": "zone_c", "latitude": 40.6782, "longitude": -73.9442},
    ]


def severity_prior_definitions() -> List[Dict[str, Any]]:
    return [
        {"id": "prior_zone_a_fire", "zone_id": "zone_a", "disaster_type": "fire", "prior_critical": 0.10, "prior_high": 0.35, "prior_medium": 0.35, "prior_low": 0.20},
        {"id": "prior_zone_b_flood", "zone_id": "zone_b", "disaster_type": "flood", "prior_critical": 0.15, "prior_high": 0.40, "prior_medium": 0.30, "prior_low": 0.15},
        {"id": "prior_zone_c_medical", "zone_id": "zone_c", "disaster_type": "medical", "prior_critical": 0.08, "prior_high": 0.27, "prior_medium": 0.40, "prior_low": 0.25},
        {"id": "prior_zone_d_storm", "zone_id": "zone_d", "disaster_type": "storm", "prior_critical": 0.12, "prior_high": 0.33, "prior_medium": 0.33, "prior_low": 0.22},
    ]
