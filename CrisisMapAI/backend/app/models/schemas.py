from datetime import datetime
from typing import Any, Dict, List, Optional
import re

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


PHONE_PATTERN = re.compile(r"^\+?[0-9\s().-]{7,20}$")


class SOSLocation(BaseModel):
    zone: Optional[str] = Field(default=None, max_length=120)
    custom_zone: Optional[str] = Field(default=None, max_length=120)
    area_type: Optional[str] = Field(default=None, max_length=80)
    landmark: Optional[str] = Field(default=None, max_length=120)
    place_name: Optional[str] = Field(default=None, max_length=120)
    street_access: Optional[str] = Field(default=None, max_length=120)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    access_difficulty: Optional[str] = Field(default=None, max_length=80)
    floor_level: Optional[str] = Field(default=None, max_length=80)
    nearby_safe_spot: Optional[str] = Field(default=None, max_length=120)
    gps: Optional[str] = Field(default=None, max_length=120)

    @field_validator("zone")
    @classmethod
    def validate_zone(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        return value or None

    @field_validator(
        "custom_zone",
        "area_type",
        "landmark",
        "place_name",
        "street_access",
        "access_difficulty",
        "floor_level",
        "nearby_safe_spot",
        "gps",
    )
    @classmethod
    def clean_optional_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        return value or None

    @model_validator(mode="after")
    def validate_zone_details(self) -> "SOSLocation":
        if not any([self.zone, self.custom_zone, self.landmark, self.place_name, self.street_access, self.area_type, self.latitude is not None, self.longitude is not None]):
            raise ValueError("Provide at least one usable location detail.")
        if self.latitude is not None or self.longitude is not None:
            if self.latitude is None or self.longitude is None:
                raise ValueError("Both latitude and longitude are required when GPS coordinates are entered.")
        return self


class SOSMedical(BaseModel):
    injuries: bool = False
    injured_count: Optional[int] = None
    injury_severity: Optional[str] = None
    oxygen_required: bool = False
    oxygen_count: Optional[int] = None
    elderly: bool = False
    elderly_count: Optional[int] = None
    children: bool = False
    children_count: Optional[int] = None
    disabled: bool = False
    disabled_count: Optional[int] = None

    @field_validator("injury_severity")
    @classmethod
    def normalize_injury_severity(cls, value: Optional[str]) -> Optional[str]:
        return value.lower().strip() if value else None

    @field_validator("injured_count", "oxygen_count", "elderly_count", "children_count", "disabled_count")
    @classmethod
    def validate_counts(cls, value: Optional[int]) -> Optional[int]:
        if value is not None and value < 0:
            raise ValueError("Counts cannot be negative.")
        if value == 0:
            return None
        return value

    @model_validator(mode="after")
    def validate_conditional_fields(self) -> "SOSMedical":
        if self.injuries and not self.injury_severity:
            raise ValueError("Injury severity is required when injuries are present.")
        if self.injuries and not self.injured_count:
            raise ValueError("Injured count must be provided when injuries are present.")
        if not self.injuries:
            self.injury_severity = None
            self.injured_count = None

        if self.oxygen_required and not self.oxygen_count:
            self.oxygen_count = 1
        if not self.oxygen_required:
            self.oxygen_count = None

        if self.elderly and not self.elderly_count:
            raise ValueError("Elderly count must be provided when elderly people are involved.")
        if not self.elderly:
            self.elderly_count = None

        if self.children and not self.children_count:
            raise ValueError("Children count must be provided when children are involved.")
        if not self.children:
            self.children_count = None

        if self.disabled and not self.disabled_count:
            raise ValueError("Disabled count must be provided when mobility support is needed.")
        if not self.disabled:
            self.disabled_count = None

        return self


class SOSAccess(BaseModel):
    trapped: bool = False
    road_status: str = "unknown"
    safe_exit: bool = True
    building_type: str = "house"

    @field_validator("road_status")
    @classmethod
    def normalize_road_status(cls, value: str) -> str:
        value = value.lower().strip()
        allowed = {"clear", "blocked", "unknown"}
        if value not in allowed:
            raise ValueError(f"Road accessibility must be one of: {', '.join(sorted(allowed))}.")
        return value

    @field_validator("building_type")
    @classmethod
    def normalize_building_type(cls, value: str) -> str:
        value = value.lower().strip()
        allowed = {"apartment", "house", "road", "public building", "industrial"}
        if value not in allowed:
            raise ValueError(f"Building type must be one of: {', '.join(sorted(allowed))}.")
        return value


class SOSContact(BaseModel):
    name: Optional[str] = Field(default=None, max_length=100)
    phone: Optional[str] = None
    language: str = "English"

    @field_validator("name", "phone")
    @classmethod
    def normalize_contact_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        return value or None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: Optional[str]) -> Optional[str]:
        if value and not PHONE_PATTERN.match(value):
            raise ValueError("Phone number format is invalid.")
        return value

    @field_validator("language")
    @classmethod
    def normalize_language(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Preferred language is required.")
        return value


class SOSRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    incident_id: Optional[str] = None
    timestamp: Optional[datetime] = None
    disaster_type: str
    location: Optional[SOSLocation] = None
    severity: str = "medium"
    people_count: int = Field(default=1, ge=1, le=500)
    medical: SOSMedical = Field(default_factory=SOSMedical)
    access: SOSAccess = Field(default_factory=SOSAccess)
    contact: SOSContact = Field(default_factory=SOSContact)
    notes: Optional[str] = Field(default=None, max_length=500)
    photo_filename: Optional[str] = Field(default=None, max_length=255)
    required_skill: Optional[str] = Field(default=None, max_length=120)

    # Backward-compatible fields for the existing React client and downstream modules.
    zone: Optional[str] = None
    oxygen_required: bool = False
    injury: bool = False
    elderly: bool = False
    note: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def merge_legacy_fields(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data

        payload = dict(data)

        location = dict(payload.get("location") or {})
        zone = (payload.get("zone") or location.get("zone") or "").strip()
        landmark = location.get("landmark") or payload.get("landmark")
        gps = location.get("gps") or payload.get("gps")
        if zone:
            location.setdefault("zone", zone)
            location.setdefault("landmark", landmark)
            location.setdefault("gps", gps)
            payload["location"] = location

        medical = dict(payload.get("medical") or {})
        medical.setdefault("injuries", payload.get("injury", False))
        medical.setdefault("oxygen_required", payload.get("oxygen_required", False))
        medical.setdefault("elderly", payload.get("elderly", False))
        payload["medical"] = medical

        payload["notes"] = payload.get("notes", payload.get("note"))
        return payload

    @field_validator("disaster_type")
    @classmethod
    def validate_disaster_type(cls, value: str) -> str:
        value = value.lower().strip()
        allowed = {"fire", "flood", "earthquake", "storm", "landslide", "medical emergency", "accident", "medical"}
        if value not in allowed:
            raise ValueError("Disaster type is required and must be a supported option.")
        return value

    @field_validator("severity")
    @classmethod
    def validate_severity(cls, value: str) -> str:
        value = value.lower().strip()
        allowed = {"low", "medium", "high", "critical"}
        if value not in allowed:
            raise ValueError("Severity must be low, medium, high, or critical.")
        return value

    @field_validator("notes", "note")
    @classmethod
    def clean_notes(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        return value or None

    @model_validator(mode="after")
    def synchronize_flat_fields(self) -> "SOSRequest":
        if not self.location:
            raise ValueError("Location is required.")
        combined_vulnerable_count = sum(filter(None, [
            self.medical.children_count,
            self.medical.elderly_count,
            self.medical.disabled_count,
            self.medical.injured_count,
        ]))
        if combined_vulnerable_count > self.people_count:
            raise ValueError("Children, elderly, disabled, and injured counts cannot exceed total people count.")

        self.zone = self.location.zone or self.location.custom_zone or "Location pending"
        self.oxygen_required = self.medical.oxygen_required
        self.injury = self.medical.injuries
        self.elderly = self.medical.elderly
        self.note = self.notes
        return self

    def to_incident(self, sos_id: str, timestamp: datetime) -> Dict[str, Any]:
        critical_needs = []
        if self.medical.oxygen_required:
            critical_needs.append(f"oxygen x{self.medical.oxygen_count}")
        if self.medical.injuries:
            critical_needs.append(f"{self.medical.injured_count} {self.medical.injury_severity or 'unspecified'} injuries")
        if self.medical.elderly:
            critical_needs.append(f"{self.medical.elderly_count} elderly people")
        if self.medical.children:
            critical_needs.append(f"{self.medical.children_count} children")
        if self.medical.disabled:
            critical_needs.append(f"{self.medical.disabled_count} needing mobility support")
        if self.access.trapped:
            critical_needs.append("trapped occupants")
        if self.access.road_status == "blocked":
            critical_needs.append("blocked road access")

        incident = {
            "id": sos_id,
            "incident_id": self.incident_id or sos_id,
            "disaster_type": self.disaster_type,
            "sos_id": sos_id,
            "zone": self.zone,
            "location": self.location.model_dump(),
            "severity": self.severity,
            "people_count": self.people_count,
            "needs_oxygen": self.medical.oxygen_required,
            "oxygen_required": self.medical.oxygen_required,
            "injury": self.medical.injuries,
            "elderly": self.medical.elderly,
            "is_elderly": self.medical.elderly,
            "note": self.notes,
            "medical": self.medical.model_dump(),
            "access": self.access.model_dump(),
            "contact": self.contact.model_dump(),
            "photo_filename": self.photo_filename,
            "required_skill": self.required_skill,
            "latitude": self.location.latitude,
            "longitude": self.location.longitude,
            "critical_needs": critical_needs,
            "mass_casualty": self.people_count > 50,
            "timestamp": timestamp,
            "created_at": timestamp,
            "status": "received",
        }
        extra_fields = getattr(self, "__pydantic_extra__", {}) or {}
        if "registered_victim_profile" in extra_fields:
            incident["registered_victim_profile"] = extra_fields["registered_victim_profile"]
        return incident


class SOSResponse(BaseModel):
    sos_id: str
    status: str
    priority_score: float
    eta: str
    responder: Optional[str]
    destination: Optional[str]
    message: str
    algorithm_results: Dict[str, Any] = Field(default_factory=dict)


class Incident(BaseModel):
    id: str
    sos_id: Optional[str] = None
    disaster_type: str
    zone: str
    severity: str
    people_count: int
    needs_oxygen: bool = False
    oxygen_required: bool
    injury: bool
    elderly: bool
    is_elderly: bool = False
    required_skill: Optional[str] = None
    note: Optional[str]
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location: Optional[Dict[str, Any]] = None
    medical: Optional[Dict[str, Any]] = None
    access: Optional[Dict[str, Any]] = None
    contact: Optional[Dict[str, Any]] = None
    photo_filename: Optional[str] = None
    critical_needs: Optional[List[str]] = None
    mass_casualty: bool = False
    timestamp: datetime
    created_at: Optional[datetime] = None
    status: str
    priority_score: Optional[float]
    inferred_severity: Optional[str]
    severity_posterior: Optional[Dict[str, float]] = None
    explainability: Optional[Dict[str, Any]] = None
    dispatch_mode: Optional[Dict[str, Any]]
    route: Optional[List[str]]
    distance: Optional[float]
    eta: Optional[str]
    backup_routes: Optional[List[List[str]]]
    assignment: Optional[Dict[str, Any]]
    volunteers: Optional[List[Dict[str, Any]]]
    supply_plan: Optional[Dict[str, Any]]
    messages: Optional[Dict[str, str]]


class Responder(BaseModel):
    id: str
    name: str
    type: str
    capabilities: List[str]
    skills: List[str] = Field(default_factory=list)
    zone: str
    current_zone: Optional[str] = None
    available: bool
    has_equipment: bool = False
    latitude: Optional[float]
    longitude: Optional[float]


class Hospital(BaseModel):
    id: str
    name: str
    zone: str
    available_beds: int
    total_beds: int
    latitude: Optional[float]
    longitude: Optional[float]


class Shelter(BaseModel):
    id: str
    name: str
    zone: str
    capacity: int
    occupancy: int
    demand: int = 0
    latitude: Optional[float]
    longitude: Optional[float]


class Zone(BaseModel):
    id: str
    name: str
    risk_level: str
    latitude: Optional[float]
    longitude: Optional[float]


class Route(BaseModel):
    origin: str
    destination: str
    path: List[str]
    distance: float
    blocked: bool = False


class RoadEdge(BaseModel):
    road_id: str
    source_zone: str
    target_zone: str
    travel_time: float
    safe: bool
    congestion: float
    has_oxygen: bool
    distance_km: float
    capacity: int
    passable: bool


class Volunteer(BaseModel):
    volunteer_id: str
    latitude: float
    longitude: float
    current_zone_id: Optional[str] = None
    current_latitude: Optional[float] = None
    current_longitude: Optional[float] = None
    skills: List[str]
    languages: List[str]
    available: bool


class VolunteerTask(BaseModel):
    task_id: str
    latitude: float
    longitude: float
    required_skill: str
    required_language: str


class Depot(BaseModel):
    depot_id: str
    supply: int
    zone: str
    latitude: float
    longitude: float


class SeverityPrior(BaseModel):
    zone_id: str
    disaster_type: str
    prior_critical: float
    prior_high: float
    prior_medium: float
    prior_low: float
