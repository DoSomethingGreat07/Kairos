"""Deterministic large seed corpus for CrisisMap AI bulk loading and validation."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List
import uuid


BASE_LAT = 41.8500
BASE_LON = -87.6500
DISASTER_TYPES = ["fire", "flood", "medical", "storm"]
SEVERITIES = ["critical", "high", "medium", "low"]
SKILLS = [
    "Advanced Life Support",
    "Basic First Aid",
    "CPR",
    "Oxygen Administration",
    "Trauma Support",
    "Fire Suppression",
    "Debris Search",
    "Rope Rescue",
    "Shelter Operations",
    "Supply Distribution",
    "Language Translation",
]
LANGUAGES = ["English", "Spanish", "Hindi", "Arabic", "Telugu"]


def _zone_id(index: int) -> str:
    return f"zone_{chr(ord('a') + index)}"


def _zone_name(index: int) -> str:
    return f"Zone {chr(ord('A') + index)}"


def _stable_uuid(name: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, f"crisismap.ai/{name}"))


def generate_zones() -> List[Dict[str, Any]]:
    zones = []
    for index in range(10):
        row = index // 5
        col = index % 5
        zone_id = _zone_id(index)
        x = 10 + (col * 18)
        y = 10 + (row * 30)
        zones.append({
            "id": zone_id,
            "name": _zone_name(index),
            "polygon_points": [
                {"x": x, "y": y},
                {"x": x + 15, "y": y},
                {"x": x + 16, "y": y + 18},
                {"x": x + 1, "y": y + 20},
            ],
            "created_at": "2026-04-01T00:00:00+00:00",
        })
    return zones


def generate_roads() -> List[Dict[str, Any]]:
    roads: List[Dict[str, Any]] = []
    for index in range(10):
        if index % 5 != 4:
            roads.append(_road(index, index + 1, "h"))
        if index < 5:
            roads.append(_road(index, index + 5, "v"))
    diagonals = [(0, 6), (1, 7), (2, 8), (3, 9), (0, 5), (4, 9), (5, 1), (6, 2), (7, 3), (8, 4)]
    for source, target in diagonals:
        roads.append(_road(source, target, "d"))
    extra = [(0, 2), (2, 4), (5, 7), (7, 9), (1, 6), (3, 8), (0, 7), (2, 9), (5, 2), (6, 9), (1, 8)]
    for source, target in extra:
        roads.append(_road(source, target, "x"))
    deduped: Dict[str, Dict[str, Any]] = {}
    for road in roads:
        deduped[road["road_id"]] = road
    return list(deduped.values())


def _road(source_index: int, target_index: int, road_type: str) -> Dict[str, Any]:
    source_zone = _zone_id(source_index)
    target_zone = _zone_id(target_index)
    base = abs(target_index - source_index)
    distance_km = round(4.5 + (base * 1.7), 1)
    travel_time = round(distance_km * (1.5 if road_type == "d" else 1.2), 1)
    congestion = round(0.9 + ((source_index + target_index) % 4) * 0.15, 2)
    road_id = f"road_{source_zone}_{target_zone}"
    return {
        "road_id": road_id,
        "source_zone": source_zone,
        "target_zone": target_zone,
        "travel_time": travel_time,
        "safe": (source_index + target_index) % 7 != 0,
        "congestion": congestion,
        "has_oxygen": (source_index + target_index) % 3 != 0,
        "distance_km": distance_km,
        "capacity": 180 + ((source_index + target_index) % 5) * 30,
        "passable": (source_index + target_index) % 6 != 0,
        "blocked": (source_index + target_index) % 11 == 0,
        "profile_data": {"road_type": road_type},
    }


def generate_organizations() -> List[Dict[str, Any]]:
    org_specs = [
        ("ORG-MED-001", "Metro Ambulance Command", "Ambulance Service", "zone_a"),
        ("ORG-FIR-002", "Lakefront Fire Operations", "Fire Department", "zone_b"),
        ("ORG-SAR-003", "Urban Search Rescue Group", "Search & Rescue", "zone_c"),
        ("ORG-HOS-004", "Regional Emergency Medicine", "Hospital Emergency Unit", "zone_d"),
        ("ORG-NGO-005", "Community Relief Network", "NGO / Volunteer Organization", "zone_e"),
        ("ORG-DIS-006", "State Disaster Response Cell", "Disaster Relief Unit", "zone_f"),
    ]
    organizations = []
    for code, name, org_type, zone_id in org_specs:
        organizations.append({
            "id": _stable_uuid(code),
            "organization_code": code,
            "name": name,
            "organization_type": org_type,
            "registration_number": code.replace("ORG-", "REG-"),
            "primary_contact_name": f"{name} Desk",
            "primary_contact_phone": f"+13125550{len(organizations)+100}",
            "primary_contact_email": f"{code.lower()}@crisismap.local",
            "headquarters_zone_id": zone_id,
            "coverage_zone_ids": [zone_id, _zone_id((ord(zone_id[-1]) - ord('a') + 1) % 10)],
            "years_of_operation": 5 + len(organizations) * 3,
            "operates_24_7": True,
            "operating_hours": {"start": "00:00", "end": "23:59"},
            "verification_status": "approved",
            "organization_code_active": True,
            "profile_data": {"seed_source": "seed_factory"},
        })
    return organizations


def generate_responders() -> List[Dict[str, Any]]:
    role_cycle = [
        ("Ambulance Driver", "Advanced Life Support"),
        ("Paramedic", "Oxygen Administration"),
        ("Firefighter", "Fire Suppression"),
        ("Rescue Operator", "Debris Search"),
        ("Medical Staff", "Trauma Support"),
    ]
    organizations = generate_organizations()
    responders = []
    for index in range(25):
        role_title, primary_skill = role_cycle[index % len(role_cycle)]
        zone_id = _zone_id(index % 10)
        org = organizations[index % len(organizations)]
        responder_id = f"RSP-{index + 1:03d}"
        responders.append({
            "id": _stable_uuid(responder_id),
            "responder_id": responder_id,
            "organization_id": org["id"],
            "employee_id": f"EMP-{index + 1:03d}",
            "full_name": f"Responder {index + 1}",
            "role_title": role_title,
            "phone": f"+1312777{index + 1000:04d}",
            "profile_photo_url": "",
            "years_of_experience": 1 + (index % 12),
            "responder_type": role_title,
            "capabilities": [primary_skill, SKILLS[(index + 1) % len(SKILLS)], SKILLS[(index + 3) % len(SKILLS)]],
            "active_capabilities": [primary_skill, SKILLS[(index + 1) % len(SKILLS)]],
            "personal_equipment": ["Radio", "Helmet"] + (["Oxygen Kit"] if index % 4 != 0 else []),
            "primary_station_zone_id": zone_id,
            "coverage_zone_ids": [zone_id, _zone_id((index + 1) % 10), _zone_id((index + 2) % 10)],
            "max_travel_radius_km": 10 + (index % 5) * 5,
            "flooded_conditions": index % 3 == 0,
            "fire_conditions": index % 2 == 0,
            "height_conditions": index % 5 in {1, 2},
            "confined_space_conditions": index % 4 in {1, 3},
            "availability_status": "busy" if index % 6 == 0 else "available_now",
            "shift_schedule": {"shift_type": ["day", "night", "rotational", "on_call"][index % 4]},
            "notification_preference": "all_alerts",
            "languages": [LANGUAGES[index % len(LANGUAGES)], "English"],
            "profile_data": {
                "latitude": BASE_LAT + (index % 10) * 0.01,
                "longitude": BASE_LON + (index // 10) * 0.02,
                "skills": [primary_skill, SKILLS[(index + 1) % len(SKILLS)]],
                "has_equipment": index % 4 != 0,
                "available": index % 6 != 0,
                "current_zone": zone_id,
            },
            "status": "active",
        })
    return responders


def generate_volunteers() -> List[Dict[str, Any]]:
    volunteers = []
    for index in range(15):
        volunteer_id = f"VOL-{index + 1:03d}"
        zone_id = _zone_id(index % 10)
        volunteers.append({
            "volunteer_id": volunteer_id,
            "full_name": f"Volunteer {index + 1}",
            "phone": f"+1312888{index + 1000:04d}",
            "skills": [SKILLS[(index + 7) % len(SKILLS)], SKILLS[(index + 2) % len(SKILLS)]],
            "languages": [LANGUAGES[index % len(LANGUAGES)], "English"],
            "available": index % 5 != 0,
            "zone_id": zone_id,
            "latitude": BASE_LAT + (index % 5) * 0.015,
            "longitude": BASE_LON + (index // 5) * 0.02,
            "current_zone_id": _zone_id((index + 1) % 10) if index % 4 == 0 else zone_id,
            "current_latitude": BASE_LAT + (index % 5) * 0.015 + (0.003 if index % 2 == 0 else -0.002),
            "current_longitude": BASE_LON + (index // 5) * 0.02 + (0.004 if index % 3 == 0 else -0.003),
            "profile_data": {"seed_source": "seed_factory"},
        })
    return volunteers


def generate_hospitals() -> List[Dict[str, Any]]:
    hospitals = []
    for index in range(8):
        hospital_id = f"HOS-{index + 1:03d}"
        zone_id = _zone_id(index)
        hospitals.append({
            "hospital_id": hospital_id,
            "name": f"{_zone_name(index)} Emergency Hospital",
            "zone_id": zone_id,
            "available_beds": 20 + (index * 7),
            "total_beds": 80 + (index * 15),
            "latitude": BASE_LAT + index * 0.012,
            "longitude": BASE_LON + index * 0.009,
            "profile_data": {"trauma_center": index % 2 == 0},
        })
    return hospitals


def generate_shelters() -> List[Dict[str, Any]]:
    shelters = []
    for index in range(10):
        shelter_id = f"SHE-{index + 1:03d}"
        zone_id = _zone_id(index)
        capacity = 120 + index * 20
        occupancy = 40 + index * 11
        shelters.append({
            "shelter_id": shelter_id,
            "name": f"{_zone_name(index)} Relief Shelter",
            "zone_id": zone_id,
            "capacity": capacity,
            "occupancy": occupancy,
            "demand": max(20, capacity - occupancy - 15),
            "latitude": BASE_LAT + index * 0.01,
            "longitude": BASE_LON - index * 0.008,
            "profile_data": {"accepts_pets": index % 2 == 0},
        })
    return shelters


def generate_depots() -> List[Dict[str, Any]]:
    depots = []
    assignments = [
        ["SHE-001", "SHE-002"],
        ["SHE-003", "SHE-004"],
        ["SHE-005", "SHE-006"],
        ["SHE-007", "SHE-008"],
        ["SHE-009", "SHE-010"],
    ]
    for index in range(5):
        depot_id = f"DEP-{index + 1:03d}"
        depots.append({
            "depot_id": depot_id,
            "name": f"Supply Depot {index + 1}",
            "zone_id": _zone_id(index * 2),
            "supply": 170 + index * 45,
            "latitude": BASE_LAT + index * 0.018,
            "longitude": BASE_LON + index * 0.015,
            "assigned_shelters": assignments[index],
            "profile_data": {"cold_chain": index % 2 == 0},
        })
    return depots


def generate_tasks() -> List[Dict[str, Any]]:
    tasks = []
    for index in range(20):
        task_id = f"TASK-{index + 1:03d}"
        zone_id = _zone_id(index % 10)
        tasks.append({
            "task_id": task_id,
            "zone_id": zone_id,
            "required_skill": SKILLS[(index + 4) % len(SKILLS)],
            "required_language": LANGUAGES[index % len(LANGUAGES)],
            "latitude": BASE_LAT + (index % 10) * 0.007,
            "longitude": BASE_LON + (index // 10) * 0.011,
            "profile_data": {"priority_band": SEVERITIES[index % len(SEVERITIES)]},
        })
    return tasks


def generate_zone_history() -> List[Dict[str, Any]]:
    priors = []
    for zone_index in range(10):
        for disaster_index, disaster_type in enumerate(DISASTER_TYPES):
            critical = round(0.08 + ((zone_index + disaster_index) % 3) * 0.04, 2)
            high = round(0.24 + ((zone_index + disaster_index) % 4) * 0.05, 2)
            medium = round(0.32 + ((zone_index + disaster_index + 1) % 3) * 0.05, 2)
            low = round(max(0.08, 1.0 - critical - high - medium), 2)
            total = critical + high + medium + low
            priors.append({
                "zone_id": _zone_id(zone_index),
                "disaster_type": disaster_type,
                "prior_critical": round(critical / total, 4),
                "prior_high": round(high / total, 4),
                "prior_medium": round(medium / total, 4),
                "prior_low": round(low / total, 4),
                "profile_data": {"seed_source": "seed_factory"},
            })
    return priors


def generate_sos() -> List[Dict[str, Any]]:
    base_time = datetime(2026, 4, 12, 8, 0, tzinfo=timezone.utc)
    sos_records = []
    for index in range(20):
        zone_id = _zone_id(index % 10)
        disaster_type = DISASTER_TYPES[index % len(DISASTER_TYPES)]
        severity = SEVERITIES[index % len(SEVERITIES)]
        sos_id = f"SOS-{index + 1:03d}"
        needs_oxygen = index % 3 == 0
        is_elderly = index % 4 == 0
        people_count = 1 + (index % 6)
        required_skill = "Oxygen Administration" if needs_oxygen else SKILLS[(index + 5) % len(SKILLS)]
        sos_records.append({
            "sos_id": sos_id,
            "zone_id": zone_id,
            "disaster_type": disaster_type,
            "severity": severity,
            "needs_oxygen": needs_oxygen,
            "people_count": people_count,
            "created_at": (base_time + timedelta(minutes=index * 9)).isoformat(),
            "latitude": BASE_LAT + (index % 10) * 0.009,
            "longitude": BASE_LON + (index // 10) * 0.014,
            "required_skill": required_skill,
            "is_elderly": is_elderly,
            "priority_score": None,
            "inferred_severity": None,
            "incident_data": {
                "zone": zone_id,
                "disaster_type": disaster_type,
                "severity": severity,
                "needs_oxygen": needs_oxygen,
                "people_count": people_count,
                "is_elderly": is_elderly,
                "required_skill": required_skill,
            },
        })
    return sos_records


def build_seed_bundle() -> Dict[str, List[Dict[str, Any]]]:
    return {
        "zones_seed.json": generate_zones(),
        "roads_seed.json": generate_roads(),
        "organizations_seed.json": generate_organizations(),
        "responders_seed.json": generate_responders(),
        "volunteers_seed.json": generate_volunteers(),
        "hospitals_seed.json": generate_hospitals(),
        "shelters_seed.json": generate_shelters(),
        "depots_seed.json": generate_depots(),
        "zone_history_seed.json": generate_zone_history(),
        "tasks_seed.json": generate_tasks(),
        "sos_seed.json": generate_sos(),
    }
