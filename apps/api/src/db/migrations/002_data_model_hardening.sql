-- ─── Migration 002: Data Model Hardening ─────────────────────────

-- 1. Extend Telemetry Points with sequence and ingestion timestamp
ALTER TABLE telemetry_points
  ADD COLUMN IF NOT EXISTS sequence BIGINT,
  ADD COLUMN IF NOT EXISTS ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_telemetry_asset_seq ON telemetry_points(station_id, asset_id, sequence DESC);

-- 2. Extend Alerts structure
ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS rule_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS confidence NUMERIC(4, 2) DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS detected_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS recommended_action TEXT,
  ADD COLUMN IF NOT EXISTS evidence_window JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS impact_summary TEXT;

-- 3. Asset Dependencies
CREATE TABLE IF NOT EXISTS asset_dependencies (
  id VARCHAR(60) PRIMARY KEY,
  from_asset_id VARCHAR(50) NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  to_asset_id VARCHAR(50) NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  dependency_type VARCHAR(50) NOT NULL,
  criticality VARCHAR(20) NOT NULL DEFAULT 'HIGH',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_asset_dep UNIQUE (from_asset_id, to_asset_id, dependency_type)
);

CREATE INDEX IF NOT EXISTS idx_asset_dep_from ON asset_dependencies(from_asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_dep_to ON asset_dependencies(to_asset_id);

-- 4. Metric Definitions
CREATE TABLE IF NOT EXISTS metric_definitions (
  id VARCHAR(60) PRIMARY KEY,
  metric VARCHAR(100) UNIQUE NOT NULL,
  canonical_unit VARCHAR(30) NOT NULL,
  min_plausible DOUBLE PRECISION NOT NULL,
  max_plausible DOUBLE PRECISION NOT NULL,
  warning_threshold_low DOUBLE PRECISION,
  warning_threshold_high DOUBLE PRECISION,
  critical_threshold_low DOUBLE PRECISION,
  critical_threshold_high DOUBLE PRECISION,
  expected_sampling_interval_seconds INT NOT NULL DEFAULT 5,
  aggregation_strategy VARCHAR(30) NOT NULL DEFAULT 'AVG',
  allowed_asset_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Maintenance Events
CREATE TABLE IF NOT EXISTS maintenance_events (
  id VARCHAR(60) PRIMARY KEY,
  station_id VARCHAR(50) NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  asset_id VARCHAR(50) NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  maintenance_type VARCHAR(50) NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  parts_used JSONB DEFAULT '[]'::jsonb,
  result VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maint_station_asset ON maintenance_events(station_id, asset_id);
CREATE INDEX IF NOT EXISTS idx_maint_scheduled ON maintenance_events(scheduled_at DESC);

-- 6. Operators & Roles
CREATE TABLE IF NOT EXISTS operators (
  id VARCHAR(60) PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'OPERATOR',
  station_id VARCHAR(50) REFERENCES stations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Audit Events
CREATE TABLE IF NOT EXISTS audit_events (
  id VARCHAR(60) PRIMARY KEY,
  operator_id VARCHAR(60),
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id VARCHAR(100),
  previous_state JSONB DEFAULT '{}'::jsonb,
  new_state JSONB DEFAULT '{}'::jsonb,
  result VARCHAR(30) NOT NULL DEFAULT 'SUCCESS',
  correlation_id VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_events(target_type, target_id);

-- 8. Command Workflow Foundations (Simulated policy and audit trail; no physical actuation)
CREATE TABLE IF NOT EXISTS command_requests (
  id VARCHAR(60) PRIMARY KEY,
  command_type VARCHAR(50) NOT NULL,
  target_asset_id VARCHAR(50) REFERENCES assets(id) ON DELETE CASCADE,
  station_id VARCHAR(50) NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  parameters JSONB DEFAULT '{}'::jsonb,
  requested_by VARCHAR(60) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS command_approvals (
  id VARCHAR(60) PRIMARY KEY,
  command_request_id VARCHAR(60) NOT NULL REFERENCES command_requests(id) ON DELETE CASCADE,
  approved_by VARCHAR(60) NOT NULL,
  decision VARCHAR(30) NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
