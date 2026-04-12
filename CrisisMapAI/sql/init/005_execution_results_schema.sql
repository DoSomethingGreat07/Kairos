CREATE TABLE IF NOT EXISTS case_execution_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sos_id TEXT NOT NULL REFERENCES sos_incidents(sos_id) ON DELETE CASCADE,
    stage_name TEXT NOT NULL,
    status TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS priority_queue_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sos_id TEXT NOT NULL REFERENCES sos_incidents(sos_id) ON DELETE CASCADE,
    severity TEXT NOT NULL,
    needs_oxygen BOOLEAN NOT NULL,
    people_count INTEGER NOT NULL,
    priority_score DOUBLE PRECISION NOT NULL,
    explanation_text TEXT NOT NULL,
    result_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dijkstra_route_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sos_id TEXT NOT NULL REFERENCES sos_incidents(sos_id) ON DELETE CASCADE,
    origin_zone TEXT NOT NULL,
    destination_zone TEXT NOT NULL,
    route JSONB NOT NULL DEFAULT '[]'::jsonb,
    route_cost DOUBLE PRECISION NOT NULL,
    excluded_edges JSONB NOT NULL DEFAULT '[]'::jsonb,
    explanation_text TEXT NOT NULL,
    result_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS yen_route_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sos_id TEXT NOT NULL REFERENCES sos_incidents(sos_id) ON DELETE CASCADE,
    origin_zone TEXT NOT NULL,
    destination_zone TEXT NOT NULL,
    k INTEGER NOT NULL DEFAULT 3,
    routes JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_primary_cost DOUBLE PRECISION,
    explanation_text TEXT NOT NULL,
    result_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hungarian_assignment_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sos_id TEXT NOT NULL REFERENCES sos_incidents(sos_id) ON DELETE CASCADE,
    responder_id TEXT,
    final_cost DOUBLE PRECISION NOT NULL,
    penalties JSONB NOT NULL DEFAULT '[]'::jsonb,
    explanation_text TEXT NOT NULL,
    result_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gale_shapley_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sos_id TEXT NOT NULL REFERENCES sos_incidents(sos_id) ON DELETE CASCADE,
    match_count INTEGER NOT NULL DEFAULT 0,
    matches JSONB NOT NULL DEFAULT '[]'::jsonb,
    explanation_text TEXT NOT NULL,
    result_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS min_cost_flow_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sos_id TEXT NOT NULL REFERENCES sos_incidents(sos_id) ON DELETE CASCADE,
    total_cost DOUBLE PRECISION NOT NULL,
    flow_plan JSONB NOT NULL DEFAULT '[]'::jsonb,
    explanation_text TEXT NOT NULL,
    result_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bayesian_severity_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sos_id TEXT NOT NULL REFERENCES sos_incidents(sos_id) ON DELETE CASCADE,
    zone_id TEXT,
    disaster_type TEXT NOT NULL,
    inferred_severity TEXT NOT NULL,
    posterior JSONB NOT NULL DEFAULT '{}'::jsonb,
    explanation_text TEXT NOT NULL,
    result_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_execution_log_sos_id ON case_execution_log(sos_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_priority_queue_results_sos_id ON priority_queue_results(sos_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_dijkstra_route_results_sos_id ON dijkstra_route_results(sos_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_yen_route_results_sos_id ON yen_route_results(sos_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_hungarian_assignment_results_sos_id ON hungarian_assignment_results(sos_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_gale_shapley_results_sos_id ON gale_shapley_results(sos_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_min_cost_flow_results_sos_id ON min_cost_flow_results(sos_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_bayesian_severity_results_sos_id ON bayesian_severity_results(sos_id, executed_at DESC);
