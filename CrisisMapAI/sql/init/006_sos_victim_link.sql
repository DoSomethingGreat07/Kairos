ALTER TABLE sos_incidents
ADD COLUMN IF NOT EXISTS victim_profile_id UUID REFERENCES victim_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sos_incidents_victim_profile_id
ON sos_incidents(victim_profile_id, created_at DESC);
