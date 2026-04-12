CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS zone_definitions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    polygon_points JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS registration_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role TEXT NOT NULL,
    current_step INTEGER NOT NULL DEFAULT 1,
    draft_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS victim_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_id UUID UNIQUE REFERENCES registration_drafts(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    date_of_birth DATE NOT NULL,
    age INTEGER NOT NULL,
    preferred_language TEXT NOT NULL,
    profile_photo_url TEXT,
    home_zone_id TEXT REFERENCES zone_definitions(id),
    work_zone_id TEXT REFERENCES zone_definitions(id),
    frequent_zone_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    profile_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'draft_tier1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_registration_drafts_role ON registration_drafts(role);
CREATE INDEX IF NOT EXISTS idx_victim_profiles_phone ON victim_profiles(phone);

INSERT INTO zone_definitions (id, name, polygon_points)
VALUES
    ('zone_a', 'Zone A', '[{"x":6,"y":8},{"x":31,"y":6},{"x":35,"y":27},{"x":10,"y":30}]'::jsonb),
    ('zone_b', 'Zone B', '[{"x":34,"y":6},{"x":59,"y":7},{"x":57,"y":29},{"x":35,"y":27}]'::jsonb),
    ('zone_c', 'Zone C', '[{"x":60,"y":8},{"x":89,"y":8},{"x":88,"y":31},{"x":57,"y":29}]'::jsonb),
    ('zone_d', 'Zone D', '[{"x":9,"y":33},{"x":35,"y":30},{"x":38,"y":58},{"x":13,"y":62}]'::jsonb),
    ('zone_e', 'Zone E', '[{"x":39,"y":31},{"x":87,"y":31},{"x":85,"y":60},{"x":38,"y":58}]'::jsonb)
ON CONFLICT (id) DO NOTHING;
