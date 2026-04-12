from __future__ import annotations

from contextlib import contextmanager
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, Generator, List, Optional
import json
import uuid

try:
    import psycopg
    from psycopg.rows import dict_row
except ModuleNotFoundError:  # pragma: no cover - handled at runtime if dependency is missing
    psycopg = None
    dict_row = None

from ..config import settings


QUERY_LOG_PATH = Path(__file__).resolve().parents[3] / "sql" / "queries_executed.log"


class PostgresClient:
    def __init__(self) -> None:
        self.dsn = settings.postgres_url

    @contextmanager
    def connection(self) -> Generator[psycopg.Connection, None, None]:
        if psycopg is None:
            raise RuntimeError("psycopg is required for Postgres access but is not installed.")
        conn = psycopg.connect(self.dsn, row_factory=dict_row)
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def log_query(self, query: str, params: Optional[Dict[str, Any]] = None) -> None:
        QUERY_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with QUERY_LOG_PATH.open("a", encoding="utf-8") as query_log:
            query_log.write(
                f"\n-- {datetime.utcnow().isoformat()}Z\n{query.strip()}\n"
            )
            if params:
                query_log.write(f"-- params: {json.dumps(self._json_safe(params), default=str)}\n")

    def _json_safe(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return {key: self._json_value(value) for key, value in payload.items()}

    def _json_value(self, value: Any) -> Any:
        if isinstance(value, (datetime, date)):
            return value.isoformat()
        if isinstance(value, dict):
            return {key: self._json_value(item) for key, item in value.items()}
        if isinstance(value, list):
            return [self._json_value(item) for item in value]
        if isinstance(value, tuple):
            return [self._json_value(item) for item in value]
        return value

    def dumps_json(self, payload: Any) -> str:
        return json.dumps(self._json_value(payload))

    def fetch_all(self, query: str, params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        self.log_query(query, params)
        with self.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(query, params or {})
                return cur.fetchall()

    def fetch_one(self, query: str, params: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        rows = self.fetch_all(query, params)
        return rows[0] if rows else None

    def execute(self, query: str, params: Optional[Dict[str, Any]] = None) -> None:
        self.log_query(query, params)
        with self.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(query, params or {})

    def execute_many(self, query: str, params_list: List[Dict[str, Any]]) -> None:
        if not params_list:
            return
        for params in params_list:
            self.log_query(query, params)
        with self.connection() as conn:
            with conn.cursor() as cur:
                cur.executemany(query, params_list)


class RegistrationRepository:
    def __init__(self, client: Optional[PostgresClient] = None) -> None:
        self.client = client or PostgresClient()

    def _json(self, payload: Any) -> str:
        return self.client.dumps_json(payload)

    def get_zones(self) -> List[Dict[str, Any]]:
        query = """
        SELECT id, name, polygon_points
        FROM zone_definitions
        ORDER BY name
        """
        return self.client.fetch_all(query)

    def save_draft(self, role: str, current_step: int, draft_data: Dict[str, Any], draft_id: Optional[str] = None) -> Dict[str, Any]:
        if draft_id:
            query = """
            UPDATE registration_drafts
            SET current_step = %(current_step)s,
                draft_data = %(draft_data)s::jsonb,
                updated_at = NOW()
            WHERE id = %(draft_id)s AND role = %(role)s
            RETURNING id, role, current_step, draft_data, status, updated_at
            """
            params = {
                "draft_id": draft_id,
                "role": role,
                "current_step": current_step,
                "draft_data": self._json(draft_data),
            }
            row = self.client.fetch_one(query, params)
            if row:
                return row

        query = """
        INSERT INTO registration_drafts (id, role, current_step, draft_data, status)
        VALUES (%(draft_id)s, %(role)s, %(current_step)s, %(draft_data)s::jsonb, 'draft')
        RETURNING id, role, current_step, draft_data, status, updated_at
        """
        params = {
            "draft_id": draft_id or str(uuid.uuid4()),
            "role": role,
            "current_step": current_step,
            "draft_data": self._json(draft_data),
        }
        row = self.client.fetch_one(query, params)
        if not row:
            raise RuntimeError("Unable to save registration draft.")
        return row

    def get_draft(self, role: str, draft_id: str) -> Optional[Dict[str, Any]]:
        query = """
        SELECT id, role, current_step, draft_data, status, updated_at
        FROM registration_drafts
        WHERE id = %(draft_id)s AND role = %(role)s
        """
        return self.client.fetch_one(query, {"draft_id": draft_id, "role": role})

    def save_victim_tier1(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        draft = self.save_draft(
            role="victim",
            current_step=payload["current_step"],
            draft_data=payload,
            draft_id=payload.get("draft_id"),
        )
        query = """
        INSERT INTO victim_profiles (
            draft_id, full_name, phone, date_of_birth, age, preferred_language, profile_photo_url,
            home_zone_id, work_zone_id, frequent_zone_ids, profile_data, status
        )
        VALUES (
            %(draft_id)s, %(full_name)s, %(phone)s, %(date_of_birth)s, %(age)s, %(preferred_language)s, %(profile_photo_url)s,
            %(home_zone_id)s, %(work_zone_id)s, %(frequent_zone_ids)s::jsonb, %(profile_data)s::jsonb, 'draft_tier1'
        )
        ON CONFLICT (draft_id) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            phone = EXCLUDED.phone,
            date_of_birth = EXCLUDED.date_of_birth,
            age = EXCLUDED.age,
            preferred_language = EXCLUDED.preferred_language,
            profile_photo_url = EXCLUDED.profile_photo_url,
            home_zone_id = EXCLUDED.home_zone_id,
            work_zone_id = EXCLUDED.work_zone_id,
            frequent_zone_ids = EXCLUDED.frequent_zone_ids,
            profile_data = EXCLUDED.profile_data,
            updated_at = NOW()
        RETURNING id, draft_id, status, updated_at
        """
        identity = payload["identity"]
        location_profile = payload["location_profile"]
        params = {
            "draft_id": draft["id"],
            "full_name": identity["full_name"],
            "phone": identity["phone"],
            "date_of_birth": identity["date_of_birth"],
            "age": identity["age"],
            "preferred_language": identity["preferred_language"],
            "profile_photo_url": identity.get("profile_photo_url"),
            "home_zone_id": location_profile["home_zone"],
            "work_zone_id": location_profile.get("work_zone"),
            "frequent_zone_ids": self._json(location_profile.get("frequent_zones", [])),
            "profile_data": self._json(payload),
        }
        row = self.client.fetch_one(query, params)
        if not row:
            raise RuntimeError("Unable to save victim tier 1 registration.")
        row["draft"] = draft
        return row

    def save_victim_profile(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        draft = self.save_draft(
            role="victim",
            current_step=payload["current_step"],
            draft_data=payload,
            draft_id=payload.get("draft_id"),
        )
        identity = payload["identity"]
        location_profile = payload["location_profile"]
        query = """
        INSERT INTO victim_profiles (
            draft_id, full_name, phone, date_of_birth, age, preferred_language, profile_photo_url,
            home_zone_id, work_zone_id, frequent_zone_ids, profile_data, status
        )
        VALUES (
            %(draft_id)s, %(full_name)s, %(phone)s, %(date_of_birth)s, %(age)s, %(preferred_language)s, %(profile_photo_url)s,
            %(home_zone_id)s, %(work_zone_id)s, %(frequent_zone_ids)s::jsonb, %(profile_data)s::jsonb, 'active'
        )
        ON CONFLICT (draft_id) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            phone = EXCLUDED.phone,
            date_of_birth = EXCLUDED.date_of_birth,
            age = EXCLUDED.age,
            preferred_language = EXCLUDED.preferred_language,
            profile_photo_url = EXCLUDED.profile_photo_url,
            home_zone_id = EXCLUDED.home_zone_id,
            work_zone_id = EXCLUDED.work_zone_id,
            frequent_zone_ids = EXCLUDED.frequent_zone_ids,
            profile_data = EXCLUDED.profile_data,
            status = 'active',
            updated_at = NOW()
        RETURNING id, draft_id, status, updated_at, profile_data
        """
        params = {
            "draft_id": draft["id"],
            "full_name": identity["full_name"],
            "phone": identity["phone"],
            "date_of_birth": identity["date_of_birth"],
            "age": identity["age"],
            "preferred_language": identity["preferred_language"],
            "profile_photo_url": identity.get("profile_photo_url"),
            "home_zone_id": location_profile["home_zone"],
            "work_zone_id": location_profile.get("work_zone"),
            "frequent_zone_ids": self._json(location_profile.get("frequent_zones", [])),
            "profile_data": self._json(payload),
        }
        row = self.client.fetch_one(query, params)
        if not row:
            raise RuntimeError("Unable to save victim profile.")
        row["draft"] = draft
        return row

    def get_victim_profile_by_phone(self, phone: str) -> Optional[Dict[str, Any]]:
        query = """
        SELECT id, draft_id, full_name, phone, preferred_language, profile_data, status, updated_at
        FROM victim_profiles
        WHERE phone = %(phone)s
        ORDER BY updated_at DESC
        LIMIT 1
        """
        return self.client.fetch_one(query, {"phone": phone})

    def save_organization_profile(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        draft = self.save_draft(
            role="organization",
            current_step=payload["current_step"],
            draft_data=payload,
            draft_id=payload.get("draft_id"),
        )
        identity = payload["identity"]
        coverage = payload["coverage"]
        code = payload["organization_code"]

        org_query = """
        INSERT INTO organizations (
            draft_id, organization_code, name, organization_type, registration_number,
            primary_contact_name, primary_contact_phone, primary_contact_email, logo_url,
            headquarters_zone_id, coverage_zone_ids, years_of_operation, operates_24_7,
            operating_hours, verification_status, organization_code_active, profile_data
        )
        VALUES (
            %(draft_id)s, %(organization_code)s, %(name)s, %(organization_type)s, %(registration_number)s,
            %(primary_contact_name)s, %(primary_contact_phone)s, %(primary_contact_email)s, %(logo_url)s,
            %(headquarters_zone_id)s, %(coverage_zone_ids)s::jsonb, %(years_of_operation)s, %(operates_24_7)s,
            %(operating_hours)s::jsonb, 'pending_verification', FALSE, %(profile_data)s::jsonb
        )
        ON CONFLICT (draft_id) DO UPDATE SET
            organization_code = EXCLUDED.organization_code,
            name = EXCLUDED.name,
            organization_type = EXCLUDED.organization_type,
            registration_number = EXCLUDED.registration_number,
            primary_contact_name = EXCLUDED.primary_contact_name,
            primary_contact_phone = EXCLUDED.primary_contact_phone,
            primary_contact_email = EXCLUDED.primary_contact_email,
            logo_url = EXCLUDED.logo_url,
            headquarters_zone_id = EXCLUDED.headquarters_zone_id,
            coverage_zone_ids = EXCLUDED.coverage_zone_ids,
            years_of_operation = EXCLUDED.years_of_operation,
            operates_24_7 = EXCLUDED.operates_24_7,
            operating_hours = EXCLUDED.operating_hours,
            profile_data = EXCLUDED.profile_data,
            updated_at = NOW()
        RETURNING id, draft_id, organization_code, verification_status, organization_code_active, updated_at
        """
        org_params = {
            "draft_id": draft["id"],
            "organization_code": code,
            "name": identity["organization_name"],
            "organization_type": identity["organization_type"],
            "registration_number": identity["registration_number"],
            "primary_contact_name": identity["primary_contact_name"],
            "primary_contact_phone": identity["primary_contact_phone"],
            "primary_contact_email": identity["primary_contact_email"],
            "logo_url": identity.get("logo_url"),
            "headquarters_zone_id": coverage["headquarters_zone"],
            "coverage_zone_ids": self._json(coverage["coverage_zones"]),
            "years_of_operation": coverage["years_of_operation"],
            "operates_24_7": coverage["operates_24_7"],
            "operating_hours": self._json(coverage.get("operating_hours") or {}),
            "profile_data": self._json(payload),
        }
        organization = self.client.fetch_one(org_query, org_params)
        if not organization:
            raise RuntimeError("Unable to save organization profile.")

        organization_id = organization["id"]

        self.client.execute("DELETE FROM organization_vehicles WHERE organization_id = %(organization_id)s", {"organization_id": organization_id})
        self.client.execute("DELETE FROM organization_shelters WHERE organization_id = %(organization_id)s", {"organization_id": organization_id})
        self.client.execute("DELETE FROM organization_invites WHERE organization_id = %(organization_id)s", {"organization_id": organization_id})

        vehicle_query = """
        INSERT INTO organization_vehicles (
            organization_id, vehicle_type, vehicle_identifier, passenger_capacity, equipment,
            fuel_type, operational_range_km, currently_operational, home_zone_id,
            is_active_resource, profile_data
        )
        VALUES (
            %(organization_id)s, %(vehicle_type)s, %(vehicle_identifier)s, %(passenger_capacity)s, %(equipment)s::jsonb,
            %(fuel_type)s, %(operational_range_km)s, %(currently_operational)s, %(home_zone_id)s,
            FALSE, %(profile_data)s::jsonb
        )
        """
        for vehicle in payload.get("equipment_inventory", {}).get("vehicles", []):
            self.client.execute(vehicle_query, {
                "organization_id": organization_id,
                "vehicle_type": vehicle["vehicle_type"],
                "vehicle_identifier": vehicle["vehicle_identifier"],
                "passenger_capacity": vehicle["passenger_capacity"],
                "equipment": self._json(vehicle.get("equipment", [])),
                "fuel_type": vehicle["fuel_type"],
                "operational_range_km": vehicle["operational_range_km"],
                "currently_operational": vehicle["currently_operational"],
                "home_zone_id": vehicle["home_zone"],
                "profile_data": self._json(vehicle),
            })

        shelter_query = """
        INSERT INTO organization_shelters (
            organization_id, shelter_name, address, zone_id, total_capacity,
            accepts_pets, has_medical_bay, has_backup_power_generator, currently_operational,
            is_active_resource, profile_data
        )
        VALUES (
            %(organization_id)s, %(shelter_name)s, %(address)s, %(zone_id)s, %(total_capacity)s,
            %(accepts_pets)s, %(has_medical_bay)s, %(has_backup_power_generator)s, %(currently_operational)s,
            FALSE, %(profile_data)s::jsonb
        )
        """
        for shelter in payload.get("equipment_inventory", {}).get("shelters", []):
            self.client.execute(shelter_query, {
                "organization_id": organization_id,
                "shelter_name": shelter["shelter_name"],
                "address": shelter["address"],
                "zone_id": shelter["zone"],
                "total_capacity": shelter["total_capacity"],
                "accepts_pets": shelter["accepts_pets"],
                "has_medical_bay": shelter["has_medical_bay"],
                "has_backup_power_generator": shelter["has_backup_power_generator"],
                "currently_operational": shelter["currently_operational"],
                "profile_data": self._json(shelter),
            })

        invite_query = """
        INSERT INTO organization_invites (organization_id, invite_email, organization_code, status)
        VALUES (%(organization_id)s, %(invite_email)s, %(organization_code)s, 'pending')
        """
        for invite_email in payload.get("responder_roster", {}).get("invite_emails", []):
            self.client.execute(invite_query, {
                "organization_id": organization_id,
                "invite_email": invite_email,
                "organization_code": code,
            })

        organization["draft"] = draft
        return organization

    def approve_organization(self, organization_id: str) -> Optional[Dict[str, Any]]:
        query = """
        UPDATE organizations
        SET verification_status = 'approved',
            organization_code_active = TRUE,
            updated_at = NOW()
        WHERE id = %(organization_id)s
        RETURNING id, name, organization_code, verification_status, organization_code_active
        """
        organization = self.client.fetch_one(query, {"organization_id": organization_id})
        if not organization:
            return None
        self.client.execute(
            "UPDATE organization_vehicles SET is_active_resource = TRUE WHERE organization_id = %(organization_id)s",
            {"organization_id": organization_id},
        )
        self.client.execute(
            "UPDATE organization_shelters SET is_active_resource = TRUE WHERE organization_id = %(organization_id)s",
            {"organization_id": organization_id},
        )
        return organization

    def validate_organization_code(self, organization_code: str) -> Optional[Dict[str, Any]]:
        query = """
        SELECT id, name, organization_code, verification_status, organization_code_active
        FROM organizations
        WHERE organization_code = %(organization_code)s
        """
        return self.client.fetch_one(query, {"organization_code": organization_code})

    def get_active_organization_vehicles(self, organization_id: str) -> List[Dict[str, Any]]:
        query = """
        SELECT id, vehicle_type, vehicle_identifier
        FROM organization_vehicles
        WHERE organization_id = %(organization_id)s
          AND is_active_resource = TRUE
        ORDER BY vehicle_type, vehicle_identifier
        """
        return self.client.fetch_all(query, {"organization_id": organization_id})

    def ensure_responder_organization(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        organization = self.validate_organization_code(payload["organization_code"])
        if organization:
            if not organization.get("organization_code_active"):
                organization = self.client.fetch_one(
                    """
                    UPDATE organizations
                    SET organization_code_active = TRUE,
                        verification_status = COALESCE(NULLIF(verification_status, ''), 'bypassed_verification'),
                        updated_at = NOW()
                    WHERE id = %(organization_id)s
                    RETURNING id, name, organization_code, verification_status, organization_code_active
                    """,
                    {"organization_id": organization["id"]},
                ) or organization
            return organization

        profile = payload.get("registration_profile") or {}
        org_profile = profile.get("organization") or {}
        contact = profile.get("contact") or {}
        coverage = profile.get("coverage") or {}
        person = profile.get("personal") or {}

        query = """
        INSERT INTO organizations (
            organization_code, name, organization_type, registration_number,
            primary_contact_name, primary_contact_phone, primary_contact_email, logo_url,
            headquarters_zone_id, coverage_zone_ids, years_of_operation, operates_24_7,
            operating_hours, verification_status, organization_code_active, profile_data
        )
        VALUES (
            %(organization_code)s, %(name)s, %(organization_type)s, %(registration_number)s,
            %(primary_contact_name)s, %(primary_contact_phone)s, %(primary_contact_email)s, NULL,
            %(headquarters_zone_id)s, %(coverage_zone_ids)s::jsonb, 0, TRUE,
            '{}'::jsonb, 'bypassed_verification', TRUE, %(profile_data)s::jsonb
        )
        RETURNING id, name, organization_code, verification_status, organization_code_active
        """
        return self.client.fetch_one(query, {
            "organization_code": payload["organization_code"],
            "name": org_profile.get("name") or payload["organization_code"],
            "organization_type": org_profile.get("type") or "Other",
            "registration_number": org_profile.get("branch_id") or payload["organization_code"],
            "primary_contact_name": person.get("full_name") or org_profile.get("branch_name") or "Responder Intake",
            "primary_contact_phone": contact.get("mobile") or org_profile.get("contact_number") or payload["identity"]["phone"],
            "primary_contact_email": org_profile.get("official_email") or payload["identity"].get("email") or f"{payload['organization_code'].lower()}@placeholder.local",
            "headquarters_zone_id": coverage.get("base_zone"),
            "coverage_zone_ids": self._json(coverage.get("coverage_zones", [])),
            "profile_data": self._json(profile or {"source": "responder_registration_bypass"}),
        })

    def save_responder_profile(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        draft = self.save_draft(
            role="responder",
            current_step=payload["current_step"],
            draft_data=payload,
            draft_id=payload.get("draft_id"),
        )
        identity = payload["identity"]
        capabilities = payload["capability_profile"]
        equipment = payload["vehicle_and_equipment"]
        coverage = payload["zone_coverage"]
        availability = payload["availability"]
        organization = self.ensure_responder_organization(payload)
        if not organization:
            raise RuntimeError("Unable to prepare organization record for responder registration.")

        responder_query = """
        INSERT INTO responders (
            draft_id, organization_id, employee_id, full_name, role_title, phone, profile_photo_url,
            years_of_experience, responder_type, capabilities, active_capabilities, personal_equipment,
            assigned_vehicle_id, primary_station_zone_id, coverage_zone_ids, max_travel_radius_km,
            flooded_conditions, fire_conditions, height_conditions, confined_space_conditions,
            availability_status, availability_start_at, shift_schedule, notification_preference, languages,
            profile_data, status
        )
        VALUES (
            %(draft_id)s, %(organization_id)s, %(employee_id)s, %(full_name)s, %(role_title)s, %(phone)s, %(profile_photo_url)s,
            %(years_of_experience)s, %(responder_type)s, %(capabilities)s::jsonb, %(active_capabilities)s::jsonb, %(personal_equipment)s::jsonb,
            %(assigned_vehicle_id)s, %(primary_station_zone_id)s, %(coverage_zone_ids)s::jsonb, %(max_travel_radius_km)s,
            %(flooded_conditions)s, %(fire_conditions)s, %(height_conditions)s, %(confined_space_conditions)s,
            %(availability_status)s, %(availability_start_at)s, %(shift_schedule)s::jsonb, %(notification_preference)s, %(languages)s::jsonb,
            %(profile_data)s::jsonb, 'active'
        )
        ON CONFLICT (organization_id, employee_id) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            role_title = EXCLUDED.role_title,
            phone = EXCLUDED.phone,
            profile_photo_url = EXCLUDED.profile_photo_url,
            years_of_experience = EXCLUDED.years_of_experience,
            responder_type = EXCLUDED.responder_type,
            capabilities = EXCLUDED.capabilities,
            active_capabilities = EXCLUDED.active_capabilities,
            personal_equipment = EXCLUDED.personal_equipment,
            assigned_vehicle_id = EXCLUDED.assigned_vehicle_id,
            primary_station_zone_id = EXCLUDED.primary_station_zone_id,
            coverage_zone_ids = EXCLUDED.coverage_zone_ids,
            max_travel_radius_km = EXCLUDED.max_travel_radius_km,
            flooded_conditions = EXCLUDED.flooded_conditions,
            fire_conditions = EXCLUDED.fire_conditions,
            height_conditions = EXCLUDED.height_conditions,
            confined_space_conditions = EXCLUDED.confined_space_conditions,
            availability_status = EXCLUDED.availability_status,
            availability_start_at = EXCLUDED.availability_start_at,
            shift_schedule = EXCLUDED.shift_schedule,
            notification_preference = EXCLUDED.notification_preference,
            languages = EXCLUDED.languages,
            profile_data = EXCLUDED.profile_data,
            updated_at = NOW()
        RETURNING id, organization_id, employee_id, full_name, updated_at
        """
        active_capabilities = payload.get("active_capabilities") or capabilities["capabilities"]
        responder = self.client.fetch_one(responder_query, {
            "draft_id": draft["id"],
            "organization_id": organization["id"],
            "employee_id": identity["employee_id"],
            "full_name": identity["full_name"],
            "role_title": identity["role_title"],
            "phone": identity["phone"],
            "profile_photo_url": identity["profile_photo_url"],
            "years_of_experience": identity["years_of_experience"],
            "responder_type": capabilities["responder_type"],
            "capabilities": self._json(capabilities["capabilities"]),
            "active_capabilities": self._json(active_capabilities),
            "personal_equipment": self._json(equipment["personal_equipment"]),
            "assigned_vehicle_id": equipment.get("assigned_vehicle_id"),
            "primary_station_zone_id": coverage["primary_station_zone"],
            "coverage_zone_ids": self._json(coverage["coverage_zones"]),
            "max_travel_radius_km": coverage["max_travel_radius_km"],
            "flooded_conditions": coverage["comfortable_flooded"],
            "fire_conditions": coverage["comfortable_fire"],
            "height_conditions": coverage["comfortable_height"],
            "confined_space_conditions": coverage["comfortable_confined"],
            "availability_status": availability["status"],
            "availability_start_at": availability.get("start_at"),
            "shift_schedule": self._json(availability["shift_schedule"]),
            "notification_preference": availability["notification_preference"],
            "languages": self._json(availability["languages"]),
            "profile_data": self._json(payload),
        })
        if not responder:
            raise RuntimeError("Unable to save responder profile.")

        self.client.execute("DELETE FROM responder_certifications WHERE responder_id = %(responder_id)s", {"responder_id": responder["id"]})
        certification_query = """
        INSERT INTO responder_certifications (
            responder_id, certification_name, issuing_body, issue_date, expiry_date, certificate_number, is_expired
        )
        VALUES (
            %(responder_id)s, %(certification_name)s, %(issuing_body)s, %(issue_date)s, %(expiry_date)s, %(certificate_number)s, %(is_expired)s
        )
        """
        for certification in capabilities.get("certifications", []):
            self.client.execute(certification_query, {
                "responder_id": responder["id"],
                "certification_name": certification["certification_name"],
                "issuing_body": certification["issuing_body"],
                "issue_date": certification["issue_date"],
                "expiry_date": certification["expiry_date"],
                "certificate_number": certification.get("certificate_number"),
                "is_expired": certification.get("is_expired", False),
            })

        responder["organization"] = organization
        responder["draft"] = draft
        return responder

    def create_auth_account(self, role: str, subject_id: str, login_identifier: str, password_hash: str, password_salt: str, email: Optional[str] = None, otp_enabled: bool = False) -> Dict[str, Any]:
        query = """
        INSERT INTO auth_accounts (
            role, subject_id, login_identifier, email, password_hash, password_salt, otp_enabled
        )
        VALUES (
            %(role)s, %(subject_id)s, %(login_identifier)s, %(email)s, %(password_hash)s, %(password_salt)s, %(otp_enabled)s
        )
        ON CONFLICT (role, login_identifier) DO UPDATE SET
            email = EXCLUDED.email,
            password_hash = EXCLUDED.password_hash,
            password_salt = EXCLUDED.password_salt,
            otp_enabled = EXCLUDED.otp_enabled,
            updated_at = NOW()
        RETURNING id, role, subject_id, login_identifier, email, otp_enabled
        """
        row = self.client.fetch_one(query, {
            "role": role,
            "subject_id": subject_id,
            "login_identifier": login_identifier,
            "email": email,
            "password_hash": password_hash,
            "password_salt": password_salt,
            "otp_enabled": otp_enabled,
        })
        if not row:
            raise RuntimeError("Unable to create auth account.")
        return row

    def get_auth_account(self, role: str, login_identifier: str) -> Optional[Dict[str, Any]]:
        query = """
        SELECT *
        FROM auth_accounts
        WHERE role = %(role)s AND login_identifier = %(login_identifier)s
        """
        return self.client.fetch_one(query, {"role": role, "login_identifier": login_identifier})

    def create_otp(self, role: str, login_identifier: str, otp_code: str, expires_at: str) -> Dict[str, Any]:
        query = """
        INSERT INTO auth_otps (role, login_identifier, otp_code, expires_at)
        VALUES (%(role)s, %(login_identifier)s, %(otp_code)s, %(expires_at)s)
        RETURNING id, role, login_identifier, otp_code, expires_at
        """
        row = self.client.fetch_one(query, {
            "role": role,
            "login_identifier": login_identifier,
            "otp_code": otp_code,
            "expires_at": expires_at,
        })
        if not row:
            raise RuntimeError("Unable to create OTP.")
        return row

    def consume_valid_otp(self, role: str, login_identifier: str, otp_code: str) -> Optional[Dict[str, Any]]:
        query = """
        UPDATE auth_otps
        SET consumed_at = NOW()
        WHERE id = (
            SELECT id
            FROM auth_otps
            WHERE role = %(role)s
              AND login_identifier = %(login_identifier)s
              AND otp_code = %(otp_code)s
              AND consumed_at IS NULL
              AND expires_at > NOW()
            ORDER BY created_at DESC
            LIMIT 1
        )
        RETURNING id, role, login_identifier, otp_code, expires_at
        """
        return self.client.fetch_one(query, {"role": role, "login_identifier": login_identifier, "otp_code": otp_code})

    def expire_certifications(self) -> int:
        query = """
        UPDATE responder_certifications
        SET is_expired = expiry_date < CURRENT_DATE
        WHERE is_expired IS DISTINCT FROM (expiry_date < CURRENT_DATE)
        RETURNING id
        """
        rows = self.client.fetch_all(query)
        return len(rows)

    def get_profile(self, role: str, subject_id: str) -> Optional[Dict[str, Any]]:
        if role == "victim":
            query = """
            SELECT id, draft_id, full_name, phone, preferred_language, profile_data, status, updated_at
            FROM victim_profiles
            WHERE id = %(subject_id)s
            """
        elif role == "organization":
            query = """
            SELECT id, draft_id, name, organization_code, verification_status, profile_data, updated_at
            FROM organizations
            WHERE id = %(subject_id)s
            """
        elif role == "responder":
            query = """
            SELECT id, draft_id, full_name, employee_id, profile_data, status, updated_at
            FROM responders
            WHERE id = %(subject_id)s
            """
        else:
            return None
        return self.client.fetch_one(query, {"subject_id": subject_id})

    def update_profile_data(self, role: str, subject_id: str, profile_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if role == "victim":
            query = """
            UPDATE victim_profiles
            SET profile_data = %(profile_data)s::jsonb, updated_at = NOW()
            WHERE id = %(subject_id)s
            RETURNING id, updated_at, profile_data
            """
        elif role == "organization":
            query = """
            UPDATE organizations
            SET profile_data = %(profile_data)s::jsonb, updated_at = NOW()
            WHERE id = %(subject_id)s
            RETURNING id, updated_at, profile_data
            """
        elif role == "responder":
            query = """
            UPDATE responders
            SET profile_data = %(profile_data)s::jsonb, updated_at = NOW()
            WHERE id = %(subject_id)s
            RETURNING id, updated_at, profile_data
            """
        else:
            return None
        return self.client.fetch_one(query, {"subject_id": subject_id, "profile_data": self._json(profile_data)})
