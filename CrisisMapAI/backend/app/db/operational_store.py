from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional
import csv
import json

from .postgres import PostgresClient


SQL_INIT_DIR = Path(__file__).resolve().parents[3] / "sql" / "init"


def _coerce_scalar(value: str) -> Any:
    text = value.strip()
    if text == "":
        return None
    if text.lower() in {"true", "false"}:
        return text.lower() == "true"
    if text[0] in "[{" and text[-1] in "]}":
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return value
    try:
        if "." in text:
            return float(text)
        return int(text)
    except ValueError:
        return value


def load_seed_file(path: Path) -> List[Dict[str, Any]]:
    if path.suffix.lower() == ".json":
        return json.loads(path.read_text(encoding="utf-8"))
    if path.suffix.lower() == ".csv":
        with path.open("r", encoding="utf-8", newline="") as handle:
            return [{key: _coerce_scalar(value) for key, value in row.items()} for row in csv.DictReader(handle)]
    raise ValueError(f"Unsupported seed file format: {path}")


class OperationalRepository:
    """Batch seed, execution trace, and replay storage for operational data."""

    def __init__(self, client: Optional[PostgresClient] = None) -> None:
        self.client = client or PostgresClient()

    def ensure_schema(self) -> None:
        for sql_file in sorted(SQL_INIT_DIR.glob("*.sql")):
            query = sql_file.read_text(encoding="utf-8")
            self.client.execute(query)

    def truncate_operational_data(self) -> None:
        query = """
        TRUNCATE TABLE
            case_execution_log,
            priority_queue_results,
            dijkstra_route_results,
            yen_route_results,
            hungarian_assignment_results,
            gale_shapley_results,
            min_cost_flow_results,
            bayesian_severity_results,
            sos_incidents,
            road_edges,
            zone_history_priors,
            tasks,
            depots,
            shelters,
            hospitals,
            volunteers,
            responders,
            organizations,
            zone_definitions
        RESTART IDENTITY CASCADE
        """
        self.client.execute(query)

    def seed_batch_from_directory(self, seed_dir: Path) -> Dict[str, int]:
        self.ensure_schema()
        counts = {}
        ordered_files = [
            "zones_seed.json",
            "organizations_seed.json",
            "responders_seed.json",
            "volunteers_seed.json",
            "hospitals_seed.json",
            "shelters_seed.json",
            "depots_seed.json",
            "roads_seed.json",
            "zone_history_seed.json",
            "tasks_seed.json",
            "sos_seed.json",
        ]
        for file_name in ordered_files:
            file_path = seed_dir / file_name
            if not file_path.exists():
                continue
            rows = load_seed_file(file_path)
            counts[file_name] = len(rows)
            if file_name == "zones_seed.json":
                self.upsert_zones(rows)
            elif file_name == "organizations_seed.json":
                self.upsert_organizations(rows)
            elif file_name == "responders_seed.json":
                self.upsert_responders(rows)
            elif file_name == "volunteers_seed.json":
                self.upsert_volunteers(rows)
            elif file_name == "hospitals_seed.json":
                self.upsert_hospitals(rows)
            elif file_name == "shelters_seed.json":
                self.upsert_shelters(rows)
            elif file_name == "depots_seed.json":
                self.upsert_depots(rows)
            elif file_name == "roads_seed.json":
                self.upsert_roads(rows)
            elif file_name == "zone_history_seed.json":
                self.upsert_zone_history(rows)
            elif file_name == "tasks_seed.json":
                self.upsert_tasks(rows)
            elif file_name == "sos_seed.json":
                self.upsert_sos(rows)
        return counts

    def _execute_json_upsert(self, query: str, rows: Iterable[Dict[str, Any]]) -> None:
        payload = self.client.dumps_json(list(rows))
        self.client.execute(query, {"rows": payload})

    def upsert_zones(self, rows: List[Dict[str, Any]]) -> None:
        query = """
        INSERT INTO zone_definitions (id, name, polygon_points, created_at)
        SELECT row.id, row.name, row.polygon_points, COALESCE(row.created_at, NOW())
        FROM jsonb_to_recordset(%(rows)s::jsonb) AS row(
            id TEXT,
            name TEXT,
            polygon_points JSONB,
            created_at TIMESTAMPTZ
        )
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            polygon_points = EXCLUDED.polygon_points
        """
        self._execute_json_upsert(query, rows)

    def upsert_organizations(self, rows: List[Dict[str, Any]]) -> None:
        query = """
        INSERT INTO organizations (
            id, organization_code, name, organization_type, registration_number,
            primary_contact_name, primary_contact_phone, primary_contact_email,
            headquarters_zone_id, coverage_zone_ids, years_of_operation, operates_24_7,
            operating_hours, verification_status, organization_code_active, profile_data
        )
        SELECT
            row.id::uuid,
            row.organization_code,
            row.name,
            row.organization_type,
            row.registration_number,
            row.primary_contact_name,
            row.primary_contact_phone,
            row.primary_contact_email,
            row.headquarters_zone_id,
            COALESCE(row.coverage_zone_ids, '[]'::jsonb),
            COALESCE(row.years_of_operation, 0),
            COALESCE(row.operates_24_7, TRUE),
            COALESCE(row.operating_hours, '{}'::jsonb),
            COALESCE(row.verification_status, 'approved'),
            COALESCE(row.organization_code_active, TRUE),
            COALESCE(row.profile_data, '{}'::jsonb)
        FROM jsonb_to_recordset(%(rows)s::jsonb) AS row(
            id TEXT,
            organization_code TEXT,
            name TEXT,
            organization_type TEXT,
            registration_number TEXT,
            primary_contact_name TEXT,
            primary_contact_phone TEXT,
            primary_contact_email TEXT,
            headquarters_zone_id TEXT,
            coverage_zone_ids JSONB,
            years_of_operation INTEGER,
            operates_24_7 BOOLEAN,
            operating_hours JSONB,
            verification_status TEXT,
            organization_code_active BOOLEAN,
            profile_data JSONB
        )
        ON CONFLICT (organization_code) DO UPDATE SET
            name = EXCLUDED.name,
            organization_type = EXCLUDED.organization_type,
            registration_number = EXCLUDED.registration_number,
            primary_contact_name = EXCLUDED.primary_contact_name,
            primary_contact_phone = EXCLUDED.primary_contact_phone,
            primary_contact_email = EXCLUDED.primary_contact_email,
            headquarters_zone_id = EXCLUDED.headquarters_zone_id,
            coverage_zone_ids = EXCLUDED.coverage_zone_ids,
            years_of_operation = EXCLUDED.years_of_operation,
            operates_24_7 = EXCLUDED.operates_24_7,
            operating_hours = EXCLUDED.operating_hours,
            verification_status = EXCLUDED.verification_status,
            organization_code_active = EXCLUDED.organization_code_active,
            profile_data = EXCLUDED.profile_data,
            updated_at = NOW()
        """
        self._execute_json_upsert(query, rows)

    def upsert_responders(self, rows: List[Dict[str, Any]]) -> None:
        query = """
        INSERT INTO responders (
            id, responder_id, organization_id, employee_id, full_name, role_title, phone,
            profile_photo_url, years_of_experience, responder_type, capabilities, active_capabilities,
            personal_equipment, primary_station_zone_id, coverage_zone_ids, max_travel_radius_km,
            flooded_conditions, fire_conditions, height_conditions, confined_space_conditions,
            availability_status, shift_schedule, notification_preference, languages, profile_data, status
        )
        SELECT
            row.id::uuid,
            row.responder_id,
            row.organization_id::uuid,
            row.employee_id,
            row.full_name,
            row.role_title,
            row.phone,
            COALESCE(row.profile_photo_url, ''),
            COALESCE(row.years_of_experience, 0),
            row.responder_type,
            COALESCE(row.capabilities, '[]'::jsonb),
            COALESCE(row.active_capabilities, '[]'::jsonb),
            COALESCE(row.personal_equipment, '[]'::jsonb),
            row.primary_station_zone_id,
            COALESCE(row.coverage_zone_ids, '[]'::jsonb),
            COALESCE(row.max_travel_radius_km, 5),
            COALESCE(row.flooded_conditions, FALSE),
            COALESCE(row.fire_conditions, FALSE),
            COALESCE(row.height_conditions, FALSE),
            COALESCE(row.confined_space_conditions, FALSE),
            COALESCE(row.availability_status, 'available_now'),
            COALESCE(row.shift_schedule, '{}'::jsonb),
            COALESCE(row.notification_preference, 'emergency_only'),
            COALESCE(row.languages, '[]'::jsonb),
            COALESCE(row.profile_data, '{}'::jsonb),
            COALESCE(row.status, 'active')
        FROM jsonb_to_recordset(%(rows)s::jsonb) AS row(
            id TEXT,
            responder_id TEXT,
            organization_id TEXT,
            employee_id TEXT,
            full_name TEXT,
            role_title TEXT,
            phone TEXT,
            profile_photo_url TEXT,
            years_of_experience INTEGER,
            responder_type TEXT,
            capabilities JSONB,
            active_capabilities JSONB,
            personal_equipment JSONB,
            primary_station_zone_id TEXT,
            coverage_zone_ids JSONB,
            max_travel_radius_km INTEGER,
            flooded_conditions BOOLEAN,
            fire_conditions BOOLEAN,
            height_conditions BOOLEAN,
            confined_space_conditions BOOLEAN,
            availability_status TEXT,
            shift_schedule JSONB,
            notification_preference TEXT,
            languages JSONB,
            profile_data JSONB,
            status TEXT
        )
        ON CONFLICT (responder_id) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            role_title = EXCLUDED.role_title,
            phone = EXCLUDED.phone,
            years_of_experience = EXCLUDED.years_of_experience,
            responder_type = EXCLUDED.responder_type,
            capabilities = EXCLUDED.capabilities,
            active_capabilities = EXCLUDED.active_capabilities,
            personal_equipment = EXCLUDED.personal_equipment,
            primary_station_zone_id = EXCLUDED.primary_station_zone_id,
            coverage_zone_ids = EXCLUDED.coverage_zone_ids,
            max_travel_radius_km = EXCLUDED.max_travel_radius_km,
            flooded_conditions = EXCLUDED.flooded_conditions,
            fire_conditions = EXCLUDED.fire_conditions,
            height_conditions = EXCLUDED.height_conditions,
            confined_space_conditions = EXCLUDED.confined_space_conditions,
            availability_status = EXCLUDED.availability_status,
            shift_schedule = EXCLUDED.shift_schedule,
            notification_preference = EXCLUDED.notification_preference,
            languages = EXCLUDED.languages,
            profile_data = EXCLUDED.profile_data,
            status = EXCLUDED.status,
            updated_at = NOW()
        """
        self._execute_json_upsert(query, rows)

    def upsert_volunteers(self, rows: List[Dict[str, Any]]) -> None:
        query = """
        INSERT INTO volunteers (
            volunteer_id, full_name, phone, skills, languages, available, zone_id,
            latitude, longitude, current_zone_id, current_latitude, current_longitude, profile_data
        )
        SELECT
            row.volunteer_id,
            row.full_name,
            row.phone,
            COALESCE(row.skills, '[]'::jsonb),
            COALESCE(row.languages, '[]'::jsonb),
            COALESCE(row.available, TRUE),
            row.zone_id,
            row.latitude,
            row.longitude,
            row.current_zone_id,
            row.current_latitude,
            row.current_longitude,
            COALESCE(row.profile_data, '{}'::jsonb)
        FROM jsonb_to_recordset(%(rows)s::jsonb) AS row(
            volunteer_id TEXT,
            full_name TEXT,
            phone TEXT,
            skills JSONB,
            languages JSONB,
            available BOOLEAN,
            zone_id TEXT,
            latitude DOUBLE PRECISION,
            longitude DOUBLE PRECISION,
            current_zone_id TEXT,
            current_latitude DOUBLE PRECISION,
            current_longitude DOUBLE PRECISION,
            profile_data JSONB
        )
        ON CONFLICT (volunteer_id) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            phone = EXCLUDED.phone,
            skills = EXCLUDED.skills,
            languages = EXCLUDED.languages,
            available = EXCLUDED.available,
            zone_id = EXCLUDED.zone_id,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            current_zone_id = EXCLUDED.current_zone_id,
            current_latitude = EXCLUDED.current_latitude,
            current_longitude = EXCLUDED.current_longitude,
            profile_data = EXCLUDED.profile_data,
            updated_at = NOW()
        """
        self._execute_json_upsert(query, rows)

    def upsert_hospitals(self, rows: List[Dict[str, Any]]) -> None:
        query = """
        INSERT INTO hospitals (
            hospital_id, name, zone_id, available_beds, total_beds, latitude, longitude, profile_data
        )
        SELECT
            row.hospital_id, row.name, row.zone_id, row.available_beds, row.total_beds,
            row.latitude, row.longitude, COALESCE(row.profile_data, '{}'::jsonb)
        FROM jsonb_to_recordset(%(rows)s::jsonb) AS row(
            hospital_id TEXT,
            name TEXT,
            zone_id TEXT,
            available_beds INTEGER,
            total_beds INTEGER,
            latitude DOUBLE PRECISION,
            longitude DOUBLE PRECISION,
            profile_data JSONB
        )
        ON CONFLICT (hospital_id) DO UPDATE SET
            name = EXCLUDED.name,
            zone_id = EXCLUDED.zone_id,
            available_beds = EXCLUDED.available_beds,
            total_beds = EXCLUDED.total_beds,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            profile_data = EXCLUDED.profile_data,
            updated_at = NOW()
        """
        self._execute_json_upsert(query, rows)

    def upsert_shelters(self, rows: List[Dict[str, Any]]) -> None:
        query = """
        INSERT INTO shelters (
            shelter_id, name, zone_id, capacity, occupancy, demand, latitude, longitude, profile_data
        )
        SELECT
            row.shelter_id, row.name, row.zone_id, row.capacity, row.occupancy, row.demand,
            row.latitude, row.longitude, COALESCE(row.profile_data, '{}'::jsonb)
        FROM jsonb_to_recordset(%(rows)s::jsonb) AS row(
            shelter_id TEXT,
            name TEXT,
            zone_id TEXT,
            capacity INTEGER,
            occupancy INTEGER,
            demand INTEGER,
            latitude DOUBLE PRECISION,
            longitude DOUBLE PRECISION,
            profile_data JSONB
        )
        ON CONFLICT (shelter_id) DO UPDATE SET
            name = EXCLUDED.name,
            zone_id = EXCLUDED.zone_id,
            capacity = EXCLUDED.capacity,
            occupancy = EXCLUDED.occupancy,
            demand = EXCLUDED.demand,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            profile_data = EXCLUDED.profile_data,
            updated_at = NOW()
        """
        self._execute_json_upsert(query, rows)

    def upsert_depots(self, rows: List[Dict[str, Any]]) -> None:
        query = """
        INSERT INTO depots (
            depot_id, name, zone_id, supply, latitude, longitude, assigned_shelters, profile_data
        )
        SELECT
            row.depot_id, row.name, row.zone_id, row.supply, row.latitude, row.longitude,
            COALESCE(row.assigned_shelters, '[]'::jsonb), COALESCE(row.profile_data, '{}'::jsonb)
        FROM jsonb_to_recordset(%(rows)s::jsonb) AS row(
            depot_id TEXT,
            name TEXT,
            zone_id TEXT,
            supply INTEGER,
            latitude DOUBLE PRECISION,
            longitude DOUBLE PRECISION,
            assigned_shelters JSONB,
            profile_data JSONB
        )
        ON CONFLICT (depot_id) DO UPDATE SET
            name = EXCLUDED.name,
            zone_id = EXCLUDED.zone_id,
            supply = EXCLUDED.supply,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            assigned_shelters = EXCLUDED.assigned_shelters,
            profile_data = EXCLUDED.profile_data,
            updated_at = NOW()
        """
        self._execute_json_upsert(query, rows)

    def upsert_roads(self, rows: List[Dict[str, Any]]) -> None:
        query = """
        INSERT INTO road_edges (
            road_id, source_zone, target_zone, travel_time, safe, congestion,
            has_oxygen, distance_km, capacity, passable, blocked, profile_data
        )
        SELECT
            row.road_id, row.source_zone, row.target_zone, row.travel_time, row.safe,
            row.congestion, row.has_oxygen, row.distance_km, row.capacity,
            row.passable, COALESCE(row.blocked, FALSE), COALESCE(row.profile_data, '{}'::jsonb)
        FROM jsonb_to_recordset(%(rows)s::jsonb) AS row(
            road_id TEXT,
            source_zone TEXT,
            target_zone TEXT,
            travel_time DOUBLE PRECISION,
            safe BOOLEAN,
            congestion DOUBLE PRECISION,
            has_oxygen BOOLEAN,
            distance_km DOUBLE PRECISION,
            capacity INTEGER,
            passable BOOLEAN,
            blocked BOOLEAN,
            profile_data JSONB
        )
        ON CONFLICT (road_id) DO UPDATE SET
            source_zone = EXCLUDED.source_zone,
            target_zone = EXCLUDED.target_zone,
            travel_time = EXCLUDED.travel_time,
            safe = EXCLUDED.safe,
            congestion = EXCLUDED.congestion,
            has_oxygen = EXCLUDED.has_oxygen,
            distance_km = EXCLUDED.distance_km,
            capacity = EXCLUDED.capacity,
            passable = EXCLUDED.passable,
            blocked = EXCLUDED.blocked,
            profile_data = EXCLUDED.profile_data,
            updated_at = NOW()
        """
        self._execute_json_upsert(query, rows)

    def upsert_zone_history(self, rows: List[Dict[str, Any]]) -> None:
        query = """
        INSERT INTO zone_history_priors (
            zone_id, disaster_type, prior_critical, prior_high, prior_medium, prior_low, profile_data
        )
        SELECT
            row.zone_id, row.disaster_type, row.prior_critical, row.prior_high,
            row.prior_medium, row.prior_low, COALESCE(row.profile_data, '{}'::jsonb)
        FROM jsonb_to_recordset(%(rows)s::jsonb) AS row(
            zone_id TEXT,
            disaster_type TEXT,
            prior_critical DOUBLE PRECISION,
            prior_high DOUBLE PRECISION,
            prior_medium DOUBLE PRECISION,
            prior_low DOUBLE PRECISION,
            profile_data JSONB
        )
        ON CONFLICT (zone_id, disaster_type) DO UPDATE SET
            prior_critical = EXCLUDED.prior_critical,
            prior_high = EXCLUDED.prior_high,
            prior_medium = EXCLUDED.prior_medium,
            prior_low = EXCLUDED.prior_low,
            profile_data = EXCLUDED.profile_data,
            updated_at = NOW()
        """
        self._execute_json_upsert(query, rows)

    def upsert_tasks(self, rows: List[Dict[str, Any]]) -> None:
        query = """
        INSERT INTO tasks (
            task_id, zone_id, required_skill, required_language, latitude, longitude, profile_data
        )
        SELECT
            row.task_id, row.zone_id, row.required_skill, row.required_language,
            row.latitude, row.longitude, COALESCE(row.profile_data, '{}'::jsonb)
        FROM jsonb_to_recordset(%(rows)s::jsonb) AS row(
            task_id TEXT,
            zone_id TEXT,
            required_skill TEXT,
            required_language TEXT,
            latitude DOUBLE PRECISION,
            longitude DOUBLE PRECISION,
            profile_data JSONB
        )
        ON CONFLICT (task_id) DO UPDATE SET
            zone_id = EXCLUDED.zone_id,
            required_skill = EXCLUDED.required_skill,
            required_language = EXCLUDED.required_language,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            profile_data = EXCLUDED.profile_data,
            updated_at = NOW()
        """
        self._execute_json_upsert(query, rows)

    def upsert_sos(self, rows: List[Dict[str, Any]]) -> None:
        query = """
        INSERT INTO sos_incidents (
            sos_id, zone_id, disaster_type, severity, needs_oxygen, people_count,
            created_at, latitude, longitude, required_skill, is_elderly,
            priority_score, inferred_severity, incident_data
        )
        SELECT
            row.sos_id, row.zone_id, row.disaster_type, row.severity, COALESCE(row.needs_oxygen, FALSE),
            row.people_count, row.created_at, row.latitude, row.longitude, row.required_skill,
            COALESCE(row.is_elderly, FALSE), row.priority_score, row.inferred_severity,
            COALESCE(row.incident_data, '{}'::jsonb)
        FROM jsonb_to_recordset(%(rows)s::jsonb) AS row(
            sos_id TEXT,
            zone_id TEXT,
            disaster_type TEXT,
            severity TEXT,
            needs_oxygen BOOLEAN,
            people_count INTEGER,
            created_at TIMESTAMPTZ,
            latitude DOUBLE PRECISION,
            longitude DOUBLE PRECISION,
            required_skill TEXT,
            is_elderly BOOLEAN,
            priority_score DOUBLE PRECISION,
            inferred_severity TEXT,
            incident_data JSONB
        )
        ON CONFLICT (sos_id) DO UPDATE SET
            zone_id = EXCLUDED.zone_id,
            disaster_type = EXCLUDED.disaster_type,
            severity = EXCLUDED.severity,
            needs_oxygen = EXCLUDED.needs_oxygen,
            people_count = EXCLUDED.people_count,
            created_at = EXCLUDED.created_at,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            required_skill = EXCLUDED.required_skill,
            is_elderly = EXCLUDED.is_elderly,
            priority_score = EXCLUDED.priority_score,
            inferred_severity = EXCLUDED.inferred_severity,
            incident_data = EXCLUDED.incident_data,
            updated_at = NOW()
        """
        self._execute_json_upsert(query, rows)

    def save_incident(self, incident: Dict[str, Any]) -> None:
        payload = {
            "sos_id": incident["sos_id"],
            "zone_id": incident.get("zone"),
            "disaster_type": incident.get("disaster_type"),
            "severity": incident.get("severity") or incident.get("inferred_severity") or "medium",
            "needs_oxygen": incident.get("needs_oxygen", incident.get("oxygen_required", False)),
            "people_count": incident.get("people_count", 1),
            "created_at": incident.get("created_at"),
            "latitude": incident.get("latitude", 0.0),
            "longitude": incident.get("longitude", 0.0),
            "required_skill": incident.get("required_skill"),
            "is_elderly": incident.get("is_elderly", incident.get("elderly", False)),
            "priority_score": incident.get("priority_score"),
            "inferred_severity": incident.get("inferred_severity"),
            "incident_data": incident,
        }
        self.upsert_sos([payload])

    def log_case_stage(self, sos_id: str, stage_name: str, status: str, metadata: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        query = """
        INSERT INTO case_execution_log (sos_id, stage_name, status, metadata)
        VALUES (%(sos_id)s, %(stage_name)s, %(status)s, %(metadata)s::jsonb)
        RETURNING id, sos_id, stage_name, status, timestamp, metadata
        """
        return self.client.fetch_one(query, {
            "sos_id": sos_id,
            "stage_name": stage_name,
            "status": status,
            "metadata": self.client.dumps_json(metadata or {}),
        })

    def save_priority_result(self, sos_id: str, incident: Dict[str, Any], score: float, explanation: str) -> Optional[Dict[str, Any]]:
        query = """
        INSERT INTO priority_queue_results (
            sos_id, severity, needs_oxygen, people_count, priority_score, explanation_text, result_payload
        )
        VALUES (
            %(sos_id)s, %(severity)s, %(needs_oxygen)s, %(people_count)s, %(priority_score)s,
            %(explanation_text)s, %(result_payload)s::jsonb
        )
        RETURNING id, executed_at
        """
        return self.client.fetch_one(query, {
            "sos_id": sos_id,
            "severity": incident.get("severity", "medium"),
            "needs_oxygen": incident.get("needs_oxygen", incident.get("oxygen_required", False)),
            "people_count": incident.get("people_count", 1),
            "priority_score": score,
            "explanation_text": explanation,
            "result_payload": self.client.dumps_json({"score": score, "incident": incident}),
        })

    def save_bayesian_result(self, sos_id: str, incident: Dict[str, Any], result: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        query = """
        INSERT INTO bayesian_severity_results (
            sos_id, zone_id, disaster_type, inferred_severity, posterior, explanation_text, result_payload
        )
        VALUES (
            %(sos_id)s, %(zone_id)s, %(disaster_type)s, %(inferred_severity)s, %(posterior)s::jsonb,
            %(explanation_text)s, %(result_payload)s::jsonb
        )
        RETURNING id, executed_at
        """
        return self.client.fetch_one(query, {
            "sos_id": sos_id,
            "zone_id": incident.get("zone"),
            "disaster_type": incident.get("disaster_type"),
            "inferred_severity": result.get("inferred_severity"),
            "posterior": self.client.dumps_json(result.get("posterior", {})),
            "explanation_text": result.get("explanation", ""),
            "result_payload": self.client.dumps_json(result),
        })

    def save_dijkstra_result(self, sos_id: str, origin_zone: str, destination_zone: str, route_result: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        query = """
        INSERT INTO dijkstra_route_results (
            sos_id, origin_zone, destination_zone, route, route_cost, excluded_edges, explanation_text, result_payload
        )
        VALUES (
            %(sos_id)s, %(origin_zone)s, %(destination_zone)s, %(route)s::jsonb, %(route_cost)s,
            %(excluded_edges)s::jsonb, %(explanation_text)s, %(result_payload)s::jsonb
        )
        RETURNING id, executed_at
        """
        return self.client.fetch_one(query, {
            "sos_id": sos_id,
            "origin_zone": origin_zone,
            "destination_zone": destination_zone,
            "route": self.client.dumps_json(route_result.get("route", [])),
            "route_cost": route_result.get("route_cost", 0),
            "excluded_edges": self.client.dumps_json(route_result.get("excluded_edges", [])),
            "explanation_text": route_result.get("explanation", ""),
            "result_payload": self.client.dumps_json(route_result),
        })

    def save_yen_result(self, sos_id: str, origin_zone: str, destination_zone: str, routes: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        explanation = f"Stored {len(routes)} ranked backup routes for instant replay."
        query = """
        INSERT INTO yen_route_results (
            sos_id, origin_zone, destination_zone, routes, total_primary_cost, explanation_text, result_payload
        )
        VALUES (
            %(sos_id)s, %(origin_zone)s, %(destination_zone)s, %(routes)s::jsonb, %(total_primary_cost)s,
            %(explanation_text)s, %(result_payload)s::jsonb
        )
        RETURNING id, executed_at
        """
        return self.client.fetch_one(query, {
            "sos_id": sos_id,
            "origin_zone": origin_zone,
            "destination_zone": destination_zone,
            "routes": self.client.dumps_json(routes),
            "total_primary_cost": routes[0].get("total_time") if routes else None,
            "explanation_text": explanation,
            "result_payload": self.client.dumps_json({"routes": routes}),
        })

    def save_hungarian_result(self, sos_id: str, assignment: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        penalties = assignment.get("penalties") or []
        query = """
        INSERT INTO hungarian_assignment_results (
            sos_id, responder_id, final_cost, penalties, explanation_text, result_payload
        )
        VALUES (
            %(sos_id)s, %(responder_id)s, %(final_cost)s, %(penalties)s::jsonb, %(explanation_text)s, %(result_payload)s::jsonb
        )
        RETURNING id, executed_at
        """
        return self.client.fetch_one(query, {
            "sos_id": sos_id,
            "responder_id": assignment.get("responder_id"),
            "final_cost": assignment.get("cost", assignment.get("final_cost", 0)),
            "penalties": self.client.dumps_json(penalties),
            "explanation_text": assignment.get("explanation", ""),
            "result_payload": self.client.dumps_json(assignment),
        })

    def save_gale_shapley_result(self, sos_id: str, matches: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        explanation = f"Stored {len(matches)} volunteer-task stable matches."
        query = """
        INSERT INTO gale_shapley_results (
            sos_id, match_count, matches, explanation_text, result_payload
        )
        VALUES (
            %(sos_id)s, %(match_count)s, %(matches)s::jsonb, %(explanation_text)s, %(result_payload)s::jsonb
        )
        RETURNING id, executed_at
        """
        return self.client.fetch_one(query, {
            "sos_id": sos_id,
            "match_count": len(matches),
            "matches": self.client.dumps_json(matches),
            "explanation_text": explanation,
            "result_payload": self.client.dumps_json({"matches": matches}),
        })

    def save_min_cost_flow_result(self, sos_id: str, result: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        query = """
        INSERT INTO min_cost_flow_results (
            sos_id, total_cost, flow_plan, explanation_text, result_payload
        )
        VALUES (
            %(sos_id)s, %(total_cost)s, %(flow_plan)s::jsonb, %(explanation_text)s, %(result_payload)s::jsonb
        )
        RETURNING id, executed_at
        """
        return self.client.fetch_one(query, {
            "sos_id": sos_id,
            "total_cost": result.get("total_cost", 0),
            "flow_plan": self.client.dumps_json(result.get("flow_plan", [])),
            "explanation_text": result.get("explanation", ""),
            "result_payload": self.client.dumps_json(result),
        })

    def get_case_replay(self, sos_id: str) -> Dict[str, Any]:
        def latest(table: str) -> Optional[Dict[str, Any]]:
            return self.client.fetch_one(
                f"SELECT * FROM {table} WHERE sos_id = %(sos_id)s ORDER BY executed_at DESC LIMIT 1",
                {"sos_id": sos_id},
            )

        incident = self.client.fetch_one(
            "SELECT * FROM sos_incidents WHERE sos_id = %(sos_id)s",
            {"sos_id": sos_id},
        )
        stages = self.client.fetch_all(
            """
            SELECT stage_name, status, timestamp, metadata
            FROM case_execution_log
            WHERE sos_id = %(sos_id)s
            ORDER BY timestamp ASC
            """,
            {"sos_id": sos_id},
        )
        if not incident:
            return {"sos_id": sos_id, "incident": None, "stages": [], "results": {}}
        return {
            "sos_id": sos_id,
            "incident": incident,
            "stages": stages,
            "results": {
                "priority_queue": latest("priority_queue_results"),
                "bayesian_severity": latest("bayesian_severity_results"),
                "dijkstra": latest("dijkstra_route_results"),
                "yen_routes": latest("yen_route_results"),
                "hungarian_assignment": latest("hungarian_assignment_results"),
                "gale_shapley": latest("gale_shapley_results"),
                "min_cost_flow": latest("min_cost_flow_results"),
            },
        }

    def get_table_count(self, table_name: str, id_column: str) -> Dict[str, int]:
        query = f"""
        SELECT COUNT(*)::int AS row_count, COUNT(DISTINCT {id_column})::int AS distinct_ids
        FROM {table_name}
        """
        result = self.client.fetch_one(query)
        return result or {"row_count": 0, "distinct_ids": 0}
