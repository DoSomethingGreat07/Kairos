from datetime import date
from typing import Any, Dict, List, Optional
import uuid
import secrets

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator, model_validator

from ..db.postgres import RegistrationRepository
from ..auth.security import hash_password


router = APIRouter()
repository = RegistrationRepository()


class ZoneDefinitionResponse(BaseModel):
    id: str
    name: str
    polygon_points: List[Dict[str, float]]


class DraftSaveRequest(BaseModel):
    role: str
    current_step: int = Field(ge=1)
    draft_data: Dict[str, Any]
    draft_id: Optional[str] = None


class VictimIdentityStep(BaseModel):
    full_name: str = Field(min_length=2)
    phone: str = Field(min_length=7)
    email: Optional[str] = None
    date_of_birth: date
    preferred_language: str
    profile_photo_url: Optional[str] = None
    age: Optional[int] = None

    @field_validator("full_name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return value.strip()

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 7:
            raise ValueError("Phone number must be valid.")
        return value

    @model_validator(mode="after")
    def derive_age(self) -> "VictimIdentityStep":
        today = date.today()
        self.age = today.year - self.date_of_birth.year - (
            (today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day)
        )
        if self.age < 5:
            raise ValueError("Date of birth must result in age 5 or older.")
        return self


class VictimLocationStep(BaseModel):
    home_zone: str
    work_zone: Optional[str] = None
    frequent_zones: List[str] = Field(default_factory=list, max_length=3)


class VictimTier1Request(BaseModel):
    draft_id: Optional[str] = None
    current_step: int = Field(default=2, ge=1, le=6)
    identity: VictimIdentityStep
    location_profile: VictimLocationStep


class VictimMedicalProfileStep(BaseModel):
    blood_type: str
    allergies: List[str] = Field(default_factory=list)
    other_allergy: Optional[str] = None
    medications: Optional[str] = None
    conditions: Dict[str, bool]
    home_oxygen_device: bool = False


class VictimHouseholdProfileStep(BaseModel):
    household_size: int = Field(ge=1)
    children_under_12: int = Field(ge=0)
    elderly_members: int = Field(ge=0)
    mobility_limited_members: int = Field(ge=0)
    has_pets: bool = False
    pet_types: List[str] = Field(default_factory=list)
    pet_count: int = Field(default=0, ge=0)
    has_vehicle: bool = False
    vehicle_type: Optional[str] = None
    home_medical_equipment: List[str] = Field(default_factory=list)


class VictimEmergencyContactsStep(BaseModel):
    primary_name: str
    primary_phone: str
    primary_relationship: str
    secondary_name: Optional[str] = None
    secondary_phone: Optional[str] = None
    secondary_relationship: Optional[str] = None


class VictimConsentStep(BaseModel):
    share_location_with_responders: bool
    understands_not_replacement_for_emergency_services: bool
    password: str = Field(min_length=8)
    receive_zone_verification_alerts: bool = False
    receive_general_zone_alerts: bool = False
    share_anonymized_incident_data: bool = False


class VictimTier2Request(VictimTier1Request):
    current_step: int = Field(default=6, ge=6, le=6)
    medical_profile: VictimMedicalProfileStep
    household_profile: VictimHouseholdProfileStep
    emergency_contacts: VictimEmergencyContactsStep
    consent_preferences: VictimConsentStep


class OrganizationIdentityStep(BaseModel):
    organization_name: str
    organization_type: str
    registration_number: str
    primary_contact_name: str
    primary_contact_phone: str
    primary_contact_email: Optional[str] = None
    logo_url: Optional[str] = None


class OrganizationCoverageStep(BaseModel):
    headquarters_zone: str
    coverage_zones: List[str] = Field(min_length=1)
    years_of_operation: int = Field(ge=0)
    operates_24_7: bool = True
    operating_hours: Dict[str, Dict[str, str]] = Field(default_factory=dict)


class OrganizationVehicleEntry(BaseModel):
    vehicle_type: str
    vehicle_identifier: str
    passenger_capacity: int = Field(ge=0)
    equipment: List[str] = Field(default_factory=list)
    fuel_type: str
    operational_range_km: int = Field(ge=0)
    currently_operational: bool
    home_zone: str


class OrganizationShelterEntry(BaseModel):
    shelter_name: str
    address: str
    zone: str
    total_capacity: int = Field(ge=0)
    accepts_pets: bool
    has_medical_bay: bool
    has_backup_power_generator: bool
    currently_operational: bool


class OrganizationEquipmentInventoryStep(BaseModel):
    vehicles: List[OrganizationVehicleEntry] = Field(default_factory=list)
    oxygen_cylinders: int = Field(default=0, ge=0)
    first_aid_kits: int = Field(default=0, ge=0)
    stretchers: int = Field(default=0, ge=0)
    wheelchairs: int = Field(default=0, ge=0)
    blood_inventory: Dict[str, int] = Field(default_factory=dict)
    medications: List[Dict[str, Any]] = Field(default_factory=list)
    operates_shelters: bool = False
    shelters: List[OrganizationShelterEntry] = Field(default_factory=list)
    communication: Dict[str, Any] = Field(default_factory=dict)


class OrganizationResponderRosterStep(BaseModel):
    invite_emails: List[str] = Field(default_factory=list)


class OrganizationAuthorizationStep(BaseModel):
    proof_of_registration_url: Optional[str] = None
    authorized_signatory_name: str
    authorized_signatory_title: Optional[str] = None
    password: str = Field(min_length=8)
    agree_data_sharing: bool
    agree_operational_guidelines: bool


class OrganizationRegistrationRequest(BaseModel):
    draft_id: Optional[str] = None
    current_step: int = Field(default=5, ge=5, le=5)
    organization_code: Optional[str] = None
    identity: OrganizationIdentityStep
    coverage: OrganizationCoverageStep
    equipment_inventory: OrganizationEquipmentInventoryStep
    responder_roster: OrganizationResponderRosterStep
    authorization: OrganizationAuthorizationStep


class ResponderOrganizationStep(BaseModel):
    code: str
    name: str
    type: str
    branch_name: str
    branch_id: Optional[str] = None
    official_email: Optional[str] = None
    contact_number: str
    verification_status: str = "pending"


class ResponderPersonalStep(BaseModel):
    full_name: str
    responder_id: Optional[str] = None
    date_of_birth: date
    gender: Optional[str] = None
    government_id_type: str
    government_id_number: str
    profile_photo_url: Optional[str] = None


class ResponderRoleStep(BaseModel):
    primary_role: str
    secondary_role: Optional[str] = None
    response_categories: List[str] = Field(default_factory=list)
    experience_years: int = Field(default=0, ge=0)
    rank: str
    shift_type: str
    shelter_operations_experience: Optional[str] = None


class ResponderStructuredCertification(BaseModel):
    certification_name: Optional[str] = None
    certification_number: Optional[str] = None
    expiry_date: Optional[date] = None
    proof_url: Optional[str] = None


class ResponderSkillsStep(BaseModel):
    capabilities: List[str] = Field(default_factory=list)
    certifications: List[ResponderStructuredCertification] = Field(default_factory=list)
    special_medical_capabilities: List[str] = Field(default_factory=list)
    languages: List[str] = Field(default_factory=list)


class ResponderVehicleStep(BaseModel):
    assigned: bool = False
    assigned_vehicle_id: Optional[str] = None
    vehicle_type: Optional[str] = None
    registration_number: Optional[str] = None
    capacity: int = Field(default=1, ge=1)
    equipment: List[str] = Field(default_factory=list)
    operational_status: str = "Ready"
    driver_license_type: Optional[str] = None
    route_constraints: List[str] = Field(default_factory=list)


class ResponderCoverageStep(BaseModel):
    base_zone: str
    coverage_zones: List[str] = Field(default_factory=list)
    availability: str
    shift_start: Optional[str] = None
    shift_end: Optional[str] = None
    max_response_radius_km: int = Field(default=25, ge=5, le=100)
    outside_zone_allowed: bool = False
    location_sharing: bool = False
    preferred_disaster_types: List[str] = Field(default_factory=list)


class ResponderContactStep(BaseModel):
    mobile: str
    backup_contact: Optional[str] = None
    radio_call_sign: Optional[str] = None
    preferred_contact_method: str
    emergency_contact_name: Optional[str] = None
    emergency_contact_number: Optional[str] = None


class ResponderVerificationStep(BaseModel):
    government_id_url: Optional[str] = None
    organization_badge_url: Optional[str] = None
    certification_proof_url: Optional[str] = None
    driver_license_url: Optional[str] = None
    medical_license_url: Optional[str] = None
    status: str = "pending"
    background_check_completed: bool = False
    supervisor_approval: bool = False


class ResponderAccountStep(BaseModel):
    username: Optional[str] = None
    password: str = Field(min_length=8)
    terms_acknowledged: bool
    data_sharing_consent: bool
    dispatch_location_consent: bool


class ResponderRegistrationRequest(BaseModel):
    draft_id: Optional[str] = None
    current_step: int = Field(default=6, ge=6, le=6)
    organization: ResponderOrganizationStep
    personal: ResponderPersonalStep
    role: ResponderRoleStep
    skills: ResponderSkillsStep
    vehicle: ResponderVehicleStep
    coverage: ResponderCoverageStep
    contact: ResponderContactStep
    verification: ResponderVerificationStep
    account: ResponderAccountStep

    @model_validator(mode="after")
    def validate_conditional_requirements(self) -> "ResponderRegistrationRequest":
        primary_role = self.role.primary_role
        vehicle_roles = {"Ambulance Driver", "Firefighter", "Rescue Operator", "Logistics Staff", "Boat Operator", "Helicopter Operator"}
        medical_roles = {"Paramedic", "Medical Staff"}
        transport_roles = {"Boat Operator", "Helicopter Operator"}

        if not self.skills.capabilities:
            raise ValueError("At least one skill is required.")
        if not self.skills.languages:
            raise ValueError("At least one language is required.")
        if primary_role == "Shelter Coordinator" and not (self.role.shelter_operations_experience or "").strip():
            raise ValueError("Shelter coordinators must provide shelter operations experience.")
        if primary_role in vehicle_roles and self.vehicle.assigned:
            if not self.vehicle.vehicle_type or not self.vehicle.registration_number:
                raise ValueError("Assigned vehicle roles require vehicle type and registration number.")
        if primary_role in {"Ambulance Driver", "Boat Operator", "Helicopter Operator"}:
            if not (self.vehicle.driver_license_type or "").strip():
                raise ValueError("This transport role requires a driver or permit type.")
            if not (self.verification.driver_license_url or "").strip():
                raise ValueError("This transport role requires a driver license upload.")
        if primary_role in medical_roles:
            if not (self.verification.medical_license_url or "").strip():
                raise ValueError("Medical responders must upload a medical license.")
            if not (self.verification.certification_proof_url or "").strip():
                raise ValueError("Medical responders must upload certification proof.")
        if primary_role in transport_roles:
            certs = [cert for cert in self.skills.certifications if cert.certification_name or cert.certification_number]
            if not certs:
                raise ValueError("Special transport roles require at least one certification.")
            if any(cert.expiry_date is None for cert in certs):
                raise ValueError("Special transport certifications require expiry dates.")
            if any(not (cert.proof_url or "").strip() for cert in certs):
                raise ValueError("Special transport certifications require proof URLs.")
        if not self.account.terms_acknowledged or not self.account.data_sharing_consent or not self.account.dispatch_location_consent:
            raise ValueError("All account acknowledgements and operational consents are required.")
        return self


@router.get("/registration/zones", response_model=List[ZoneDefinitionResponse])
async def get_zone_definitions():
    try:
        return repository.get_zones()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to load zones: {exc}")


@router.post("/registration/drafts")
async def save_registration_draft(request: DraftSaveRequest):
    try:
        return repository.save_draft(
            role=request.role,
            current_step=request.current_step,
            draft_data=request.draft_data,
            draft_id=request.draft_id,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to save draft: {exc}")


@router.get("/registration/drafts/{role}/{draft_id}")
async def get_registration_draft(role: str, draft_id: str):
    try:
        draft = repository.get_draft(role=role, draft_id=draft_id)
        if not draft:
            raise HTTPException(status_code=404, detail="Draft not found.")
        return draft
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to load draft: {exc}")


@router.post("/registration/victim/tier1")
async def save_victim_tier1(request: VictimTier1Request):
    try:
        payload = request.model_dump()
        payload["draft_id"] = payload.get("draft_id") or str(uuid.uuid4())
        return repository.save_victim_tier1(payload)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to save victim registration: {exc}")


@router.post("/registration/victim/tier2")
async def save_victim_tier2(request: VictimTier2Request):
    try:
        payload = request.model_dump()
        payload["draft_id"] = payload.get("draft_id") or str(uuid.uuid4())
        payload["consent_preferences"].pop("password", None)
        victim = repository.save_victim_profile(payload)
        password_record = hash_password(request.consent_preferences.password)
        repository.create_auth_account(
            role="victim",
            subject_id=victim["id"],
            login_identifier=request.identity.phone,
            password_hash=password_record.password_hash,
            password_salt=password_record.salt,
            email=request.identity.email,
            otp_enabled=True,
        )
        if request.identity.email:
            repository.create_auth_account(
                role="victim",
                subject_id=victim["id"],
                login_identifier=request.identity.email,
                password_hash=password_record.password_hash,
                password_salt=password_record.salt,
                email=request.identity.email,
                otp_enabled=True,
            )
        return victim
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to complete victim registration: {exc}")


@router.post("/registration/organization")
async def save_organization_registration(request: OrganizationRegistrationRequest):
    try:
        payload = request.model_dump()
        payload["draft_id"] = payload.get("draft_id") or str(uuid.uuid4())
        payload["organization_code"] = payload.get("organization_code") or f"ORG-{secrets.token_hex(3).upper()}"
        payload["authorization"].pop("password", None)
        organization = repository.save_organization_profile(payload)
        password_record = hash_password(request.authorization.password)
        repository.create_auth_account(
            role="organization",
            subject_id=organization["id"],
            login_identifier=request.identity.registration_number,
            password_hash=password_record.password_hash,
            password_salt=password_record.salt,
            email=request.identity.primary_contact_email,
            otp_enabled=False,
        )
        return organization
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to save organization registration: {exc}")


@router.post("/registration/organization/{organization_id}/approve")
async def approve_organization(organization_id: str):
    try:
        organization = repository.approve_organization(organization_id)
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found.")
        return organization
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to approve organization: {exc}")


@router.get("/registration/organization-code/{organization_code}")
async def validate_organization_code(organization_code: str):
    try:
        organization = repository.validate_organization_code(organization_code)
        if not organization:
            raise HTTPException(status_code=404, detail="Organization code not found or not yet approved. Contact your organization.")
        organization["vehicles"] = repository.get_active_organization_vehicles(organization["id"])
        return organization
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to validate organization code: {exc}")


def build_responder_storage_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    organization = payload["organization"]
    personal = payload["personal"]
    role = payload["role"]
    skills = payload["skills"]
    vehicle = payload["vehicle"]
    coverage = payload["coverage"]
    contact = payload["contact"]
    verification = payload["verification"]
    account = payload["account"]

    primary_role = role["primary_role"]
    responder_id = (personal.get("responder_id") or "").strip() or f"VOL-{personal['government_id_number'][-6:]}"
    shift_type = role["shift_type"]
    shift_schedule = {
        day: shift_type
        for day in ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    }

    certifications = []
    for certification in skills.get("certifications", []):
        if not certification.get("certification_name") and not certification.get("certification_number"):
            continue
        expiry_date = certification.get("expiry_date")
        certifications.append({
            "certification_name": certification.get("certification_name") or "Unspecified Certification",
            "issuing_body": organization["name"],
            "issue_date": personal["date_of_birth"],
            "expiry_date": expiry_date or date.today().isoformat(),
            "certificate_number": certification.get("certification_number"),
            "proof_url": certification.get("proof_url"),
        })

    specialization_notes = ", ".join(filter(None, [
        join_values(skills.get("special_medical_capabilities")),
        role.get("shelter_operations_experience"),
        join_values(vehicle.get("route_constraints")),
    ])) or None

    return {
        "draft_id": payload.get("draft_id"),
        "current_step": payload["current_step"],
        "organization_code": organization["code"],
        "identity": {
            "full_name": personal["full_name"],
            "employee_id": responder_id,
            "role_title": primary_role,
            "phone": contact["mobile"],
            "email": organization.get("official_email"),
            "date_of_birth": personal["date_of_birth"],
            "preferred_language": skills["languages"][0] if skills.get("languages") else None,
            "home_base": organization.get("branch_name"),
            "profile_photo_url": personal.get("profile_photo_url"),
            "years_of_experience": role.get("experience_years", 0),
            "password": account["password"],
        },
        "capability_profile": {
            "responder_type": primary_role,
            "operational_tier": role.get("rank"),
            "capabilities": skills.get("capabilities", []),
            "incident_preferences": coverage.get("preferred_disaster_types", []),
            "can_lead_team": role.get("rank", "").lower() in {"team lead", "incident commander", "supervisor"},
            "can_drive_response_vehicle": vehicle.get("assigned", False),
            "specialization_notes": specialization_notes,
            "certifications": certifications,
        },
        "vehicle_and_equipment": {
            "assigned_vehicle_id": vehicle.get("assigned_vehicle_id"),
            "vehicle_preference": vehicle.get("vehicle_type"),
            "personal_equipment": vehicle.get("equipment", []),
            "communication_devices": [contact["preferred_contact_method"]] + ([contact["radio_call_sign"]] if contact.get("radio_call_sign") else []),
            "go_bag_ready": vehicle.get("operational_status") == "Ready",
            "gps_device_carried": coverage.get("location_sharing", False),
            "can_self_deploy": coverage.get("outside_zone_allowed", False),
            "field_notes": join_values([
                vehicle.get("operational_status"),
                vehicle.get("driver_license_type"),
                join_values(vehicle.get("route_constraints")),
            ]),
        },
        "zone_coverage": {
            "primary_station_zone": coverage["base_zone"],
            "secondary_station_zone": None,
            "coverage_zones": coverage.get("coverage_zones", []),
            "unavailable_zones": [],
            "max_travel_radius_km": coverage.get("max_response_radius_km", 25),
            "comfortable_flooded": "Flood" in coverage.get("preferred_disaster_types", []),
            "comfortable_fire": "Fire" in coverage.get("preferred_disaster_types", []),
            "comfortable_height": primary_role in {"Firefighter", "Rescue Operator", "Helicopter Operator"},
            "comfortable_confined": primary_role in {"Firefighter", "Rescue Operator"},
            "night_operations_ok": shift_type in {"Night", "Rotational", "On-call"},
            "shelter_support_ok": "Shelter Support" in role.get("response_categories", []) or primary_role == "Shelter Coordinator",
            "cross_zone_deployment_ok": coverage.get("outside_zone_allowed", False),
        },
        "availability": {
            "status": coverage["availability"].lower().replace(" ", "_"),
            "start_at": None,
            "shift_schedule": shift_schedule,
            "notification_preference": contact["preferred_contact_method"],
            "off_duty_reachable": coverage["availability"] in {"Available", "On Standby"},
            "languages": [{"language": language, "proficiency": "Fluent"} for language in skills.get("languages", [])],
            "emergency_contact_name": contact["emergency_contact_name"],
            "emergency_contact_phone": contact["emergency_contact_number"],
            "emergency_contact_relationship": "Emergency Contact",
            "checkin_notes": join_values([
                contact.get("backup_contact"),
                contact.get("radio_call_sign"),
                coverage.get("shift_start"),
                coverage.get("shift_end"),
            ]),
            "agree_follow_chain_of_command": verification.get("supervisor_approval", False),
            "agree_keep_certifications_updated": bool(skills.get("certifications")),
            "allow_shift_change_alerts": coverage["availability"] != "Off Duty",
        },
        "registration_profile": payload,
        "verification_profile": verification,
    }


def join_values(values: Any) -> Optional[str]:
    if isinstance(values, list):
        cleaned = [str(value).strip() for value in values if value]
        return ", ".join(cleaned) or None
    if values is None:
        return None
    value = str(values).strip()
    return value or None


@router.post("/registration/responder")
async def save_responder_registration(request: ResponderRegistrationRequest):
    try:
        structured_payload = request.model_dump(mode="json")
        structured_payload["draft_id"] = structured_payload.get("draft_id") or str(uuid.uuid4())
        payload = build_responder_storage_payload(structured_payload)
        payload["draft_id"] = structured_payload["draft_id"]
        payload["identity"].pop("password", None)
        today = date.today()
        expired_certifications = {
            certification["certification_name"]
            for certification in payload["capability_profile"].get("certifications", [])
            if date.fromisoformat(certification["expiry_date"]) < today
        }
        capability_to_certification = {
            "Advanced life support": {"ACLS", "EMT-P"},
            "Pediatric care": {"PALS"},
            "Obstetric emergency response": {"NRP"},
            "Hazmat response": {"HAZWOPER"},
            "Swift water rescue": {"Swift Water Rescue"},
            "Search and rescue": {"USAR"},
        }
        active_capabilities = []
        for capability in payload["capability_profile"]["capabilities"]:
            required_certs = capability_to_certification.get(capability)
            if required_certs and required_certs.issubset(expired_certifications):
                continue
            active_capabilities.append(capability)
        payload["active_capabilities"] = active_capabilities
        responder = repository.save_responder_profile(payload)
        password_record = hash_password(request.account.password)
        login_identifier = (
            (request.account.username or "").strip()
            or (request.personal.responder_id or "").strip()
            or f"responder-{responder['id']}"
        )
        repository.create_auth_account(
            role="responder",
            subject_id=responder["id"],
            login_identifier=login_identifier,
            password_hash=password_record.password_hash,
            password_salt=password_record.salt,
            email=request.organization.official_email,
            otp_enabled=True,
        )
        return responder
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to save responder registration: {exc}")


@router.post("/registration/responder/certifications/expire-check")
async def expire_responder_certifications():
    try:
        updated = repository.expire_certifications()
        return {"updated_certifications": updated}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to update certification expiry state: {exc}")
