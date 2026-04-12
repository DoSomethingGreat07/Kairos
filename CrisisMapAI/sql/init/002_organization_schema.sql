CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_id UUID UNIQUE REFERENCES registration_drafts(id) ON DELETE SET NULL,
    organization_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    organization_type TEXT NOT NULL,
    registration_number TEXT NOT NULL,
    primary_contact_name TEXT NOT NULL,
    primary_contact_phone TEXT NOT NULL,
    primary_contact_email TEXT NOT NULL,
    logo_url TEXT,
    headquarters_zone_id TEXT REFERENCES zone_definitions(id),
    coverage_zone_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    years_of_operation INTEGER NOT NULL DEFAULT 0,
    operates_24_7 BOOLEAN NOT NULL DEFAULT TRUE,
    operating_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
    verification_status TEXT NOT NULL DEFAULT 'pending_verification',
    organization_code_active BOOLEAN NOT NULL DEFAULT FALSE,
    profile_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organization_vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    vehicle_type TEXT NOT NULL,
    vehicle_identifier TEXT NOT NULL,
    passenger_capacity INTEGER NOT NULL DEFAULT 0,
    equipment JSONB NOT NULL DEFAULT '[]'::jsonb,
    fuel_type TEXT NOT NULL,
    operational_range_km INTEGER NOT NULL DEFAULT 0,
    currently_operational BOOLEAN NOT NULL DEFAULT TRUE,
    home_zone_id TEXT REFERENCES zone_definitions(id),
    is_active_resource BOOLEAN NOT NULL DEFAULT FALSE,
    profile_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organization_shelters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    shelter_name TEXT NOT NULL,
    address TEXT NOT NULL,
    zone_id TEXT REFERENCES zone_definitions(id),
    total_capacity INTEGER NOT NULL DEFAULT 0,
    accepts_pets BOOLEAN NOT NULL DEFAULT FALSE,
    has_medical_bay BOOLEAN NOT NULL DEFAULT FALSE,
    has_backup_power_generator BOOLEAN NOT NULL DEFAULT FALSE,
    currently_operational BOOLEAN NOT NULL DEFAULT TRUE,
    is_active_resource BOOLEAN NOT NULL DEFAULT FALSE,
    profile_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organization_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    invite_email TEXT NOT NULL,
    organization_code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_verification_status ON organizations(verification_status);
CREATE INDEX IF NOT EXISTS idx_organization_vehicles_org_id ON organization_vehicles(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_shelters_org_id ON organization_shelters(organization_id);
