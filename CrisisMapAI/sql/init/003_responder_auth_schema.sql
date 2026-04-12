CREATE TABLE IF NOT EXISTS auth_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role TEXT NOT NULL,
    subject_id UUID NOT NULL,
    login_identifier TEXT NOT NULL,
    email TEXT,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    otp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (role, login_identifier)
);

CREATE TABLE IF NOT EXISTS auth_otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role TEXT NOT NULL,
    login_identifier TEXT NOT NULL,
    otp_code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS responders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_id UUID UNIQUE REFERENCES registration_drafts(id) ON DELETE SET NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role_title TEXT NOT NULL,
    phone TEXT NOT NULL,
    profile_photo_url TEXT NOT NULL,
    years_of_experience INTEGER NOT NULL DEFAULT 0,
    responder_type TEXT NOT NULL,
    capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
    active_capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
    personal_equipment JSONB NOT NULL DEFAULT '[]'::jsonb,
    assigned_vehicle_id UUID REFERENCES organization_vehicles(id) ON DELETE SET NULL,
    primary_station_zone_id TEXT REFERENCES zone_definitions(id),
    coverage_zone_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    max_travel_radius_km INTEGER NOT NULL DEFAULT 5,
    flooded_conditions BOOLEAN NOT NULL DEFAULT FALSE,
    fire_conditions BOOLEAN NOT NULL DEFAULT FALSE,
    height_conditions BOOLEAN NOT NULL DEFAULT FALSE,
    confined_space_conditions BOOLEAN NOT NULL DEFAULT FALSE,
    availability_status TEXT NOT NULL DEFAULT 'available_now',
    availability_start_at TIMESTAMPTZ,
    shift_schedule JSONB NOT NULL DEFAULT '{}'::jsonb,
    notification_preference TEXT NOT NULL DEFAULT 'emergency_only',
    languages JSONB NOT NULL DEFAULT '[]'::jsonb,
    profile_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, employee_id)
);

CREATE TABLE IF NOT EXISTS responder_certifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    responder_id UUID NOT NULL REFERENCES responders(id) ON DELETE CASCADE,
    certification_name TEXT NOT NULL,
    issuing_body TEXT NOT NULL,
    issue_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    certificate_number TEXT,
    is_expired BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_accounts_role_identifier ON auth_accounts(role, login_identifier);
CREATE INDEX IF NOT EXISTS idx_responders_org_id ON responders(organization_id);
CREATE INDEX IF NOT EXISTS idx_responder_certs_responder_id ON responder_certifications(responder_id);
