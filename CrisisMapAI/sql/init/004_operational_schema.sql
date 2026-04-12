ALTER TABLE responders
ADD COLUMN IF NOT EXISTS responder_id TEXT;

UPDATE responders
SET responder_id = COALESCE(responder_id, 'responder-' || id::text)
WHERE responder_id IS NULL;

ALTER TABLE responders
ALTER COLUMN responder_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_responders_responder_id ON responders(responder_id);

CREATE TABLE IF NOT EXISTS volunteers (
    volunteer_id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    phone TEXT,
    skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    languages JSONB NOT NULL DEFAULT '[]'::jsonb,
    available BOOLEAN NOT NULL DEFAULT TRUE,
    zone_id TEXT REFERENCES zone_definitions(id),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    current_zone_id TEXT REFERENCES zone_definitions(id),
    current_latitude DOUBLE PRECISION,
    current_longitude DOUBLE PRECISION,
    profile_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hospitals (
    hospital_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    zone_id TEXT NOT NULL REFERENCES zone_definitions(id),
    available_beds INTEGER NOT NULL DEFAULT 0,
    total_beds INTEGER NOT NULL DEFAULT 0,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    profile_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shelters (
    shelter_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    zone_id TEXT NOT NULL REFERENCES zone_definitions(id),
    capacity INTEGER NOT NULL DEFAULT 0,
    occupancy INTEGER NOT NULL DEFAULT 0,
    demand INTEGER NOT NULL DEFAULT 0,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    profile_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS depots (
    depot_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    zone_id TEXT NOT NULL REFERENCES zone_definitions(id),
    supply INTEGER NOT NULL DEFAULT 0,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    assigned_shelters JSONB NOT NULL DEFAULT '[]'::jsonb,
    profile_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
    task_id TEXT PRIMARY KEY,
    zone_id TEXT REFERENCES zone_definitions(id),
    required_skill TEXT NOT NULL,
    required_language TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    profile_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS zone_history_priors (
    zone_id TEXT NOT NULL REFERENCES zone_definitions(id),
    disaster_type TEXT NOT NULL,
    prior_critical DOUBLE PRECISION NOT NULL,
    prior_high DOUBLE PRECISION NOT NULL,
    prior_medium DOUBLE PRECISION NOT NULL,
    prior_low DOUBLE PRECISION NOT NULL,
    profile_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (zone_id, disaster_type)
);

CREATE TABLE IF NOT EXISTS road_edges (
    road_id TEXT PRIMARY KEY,
    source_zone TEXT NOT NULL REFERENCES zone_definitions(id),
    target_zone TEXT NOT NULL REFERENCES zone_definitions(id),
    travel_time DOUBLE PRECISION NOT NULL,
    safe BOOLEAN NOT NULL DEFAULT TRUE,
    congestion DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    has_oxygen BOOLEAN NOT NULL DEFAULT FALSE,
    distance_km DOUBLE PRECISION NOT NULL DEFAULT 0,
    capacity INTEGER NOT NULL DEFAULT 0,
    passable BOOLEAN NOT NULL DEFAULT TRUE,
    blocked BOOLEAN NOT NULL DEFAULT FALSE,
    profile_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sos_incidents (
    sos_id TEXT PRIMARY KEY,
    zone_id TEXT REFERENCES zone_definitions(id),
    disaster_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    needs_oxygen BOOLEAN NOT NULL DEFAULT FALSE,
    people_count INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    required_skill TEXT,
    is_elderly BOOLEAN NOT NULL DEFAULT FALSE,
    priority_score DOUBLE PRECISION,
    inferred_severity TEXT,
    incident_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_record_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_volunteers_zone_id ON volunteers(zone_id);
CREATE INDEX IF NOT EXISTS idx_hospitals_zone_id ON hospitals(zone_id);
CREATE INDEX IF NOT EXISTS idx_shelters_zone_id ON shelters(zone_id);
CREATE INDEX IF NOT EXISTS idx_depots_zone_id ON depots(zone_id);
CREATE INDEX IF NOT EXISTS idx_tasks_zone_id ON tasks(zone_id);
CREATE INDEX IF NOT EXISTS idx_road_edges_source_target ON road_edges(source_zone, target_zone);
CREATE INDEX IF NOT EXISTS idx_sos_incidents_zone_created ON sos_incidents(zone_id, created_at DESC);
