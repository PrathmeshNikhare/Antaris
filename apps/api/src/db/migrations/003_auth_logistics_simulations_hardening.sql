-- ─── Migration 003: Auth, RBAC, Database-Backed Logistics, Station Thresholds, Mission Events & Simulation Persistence ───

-- 1. Operator Password Authentication & Station Access Scope
ALTER TABLE operators
  ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
  ADD COLUMN IF NOT EXISTS email VARCHAR(100);

-- 2. Inventory Items Enhancement
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS storage_location VARCHAR(100) DEFAULT 'Main Store Depot',
  ADD COLUMN IF NOT EXISTS criticality VARCHAR(20) DEFAULT 'HIGH',
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'NOMINAL';

-- 3. Inventory Transactions (Immutable transaction ledger)
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id VARCHAR(60) PRIMARY KEY,
  station_id VARCHAR(50) NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  item_id VARCHAR(50) NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  transaction_type VARCHAR(30) NOT NULL, -- 'DELIVERY', 'CONSUMPTION', 'ADJUSTMENT', 'TRANSFER'
  quantity DOUBLE PRECISION NOT NULL,
  previous_quantity DOUBLE PRECISION NOT NULL,
  new_quantity DOUBLE PRECISION NOT NULL,
  reason TEXT,
  operator_id VARCHAR(60),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_tx_station ON inventory_transactions(station_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_tx_item ON inventory_transactions(item_id, created_at DESC);

-- 4. Cargo Missions
CREATE TABLE IF NOT EXISTS cargo_missions (
  id VARCHAR(60) PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  origin VARCHAR(100) NOT NULL,
  destination_station_id VARCHAR(50) NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  vessel_or_aircraft VARCHAR(100) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PLANNED', -- 'PLANNED', 'PROCESSING', 'IN_TRANSIT', 'DELIVERED', 'DELAYED', 'CANCELLED'
  departure_date TIMESTAMPTZ,
  eta TIMESTAMPTZ NOT NULL,
  eta_confidence_pct NUMERIC(5,2) NOT NULL DEFAULT 92.0,
  max_payload_kg DOUBLE PRECISION NOT NULL,
  current_payload_kg DOUBLE PRECISION NOT NULL DEFAULT 0,
  weather_risk VARCHAR(20) NOT NULL DEFAULT 'LOW',
  delivery_buffer_days INTEGER NOT NULL DEFAULT 14,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cargo_missions_station ON cargo_missions(destination_station_id, status);

-- 5. Cargo Requisitions (Lifecycle: REQUESTED -> AUTHORITY_APPROVED -> PROCESSING -> IN_TRANSIT -> DELIVERED)
CREATE TABLE IF NOT EXISTS cargo_requisitions (
  id VARCHAR(60) PRIMARY KEY,
  station_id VARCHAR(50) NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  item_id VARCHAR(50) NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  item_name VARCHAR(150) NOT NULL,
  category VARCHAR(50) NOT NULL,
  requested_quantity DOUBLE PRECISION NOT NULL,
  unit VARCHAR(30) NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'HIGH', -- 'ROUTINE', 'MEDIUM', 'HIGH', 'CRITICAL', 'EMERGENCY'
  status VARCHAR(30) NOT NULL DEFAULT 'REQUESTED', -- 'REQUESTED', 'AUTHORITY_APPROVED', 'PROCESSING', 'IN_TRANSIT', 'DELIVERED', 'REJECTED', 'CANCELLED'
  reason TEXT NOT NULL,
  requested_by VARCHAR(60) NOT NULL,
  approved_by VARCHAR(60),
  mission_id VARCHAR(60) REFERENCES cargo_missions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cargo_req_station ON cargo_requisitions(station_id, status);

-- 6. Station Thresholds & Configuration
CREATE TABLE IF NOT EXISTS station_thresholds (
  id VARCHAR(60) PRIMARY KEY,
  station_id VARCHAR(50) NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  metric VARCHAR(100) NOT NULL,
  warning_threshold_low DOUBLE PRECISION,
  warning_threshold_high DOUBLE PRECISION,
  critical_threshold_low DOUBLE PRECISION,
  critical_threshold_high DOUBLE PRECISION,
  updated_by VARCHAR(60) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  comment TEXT,
  CONSTRAINT uq_station_metric_threshold UNIQUE (station_id, metric)
);

CREATE INDEX IF NOT EXISTS idx_thresholds_station ON station_thresholds(station_id);

-- 7. Operational Mission Events (Separate from Security Audit Log)
CREATE TABLE IF NOT EXISTS mission_events (
  id VARCHAR(60) PRIMARY KEY,
  station_id VARCHAR(50) NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL, -- 'SENSOR', 'ALERT', 'ENERGY', 'LOGISTICS', 'RESEARCH', 'SYSTEM', 'COMMUNICATION', 'MAINTENANCE', 'MISSION'
  severity VARCHAR(20) NOT NULL DEFAULT 'INFO', -- 'INFO', 'WARNING', 'CRITICAL'
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  asset_id VARCHAR(50) REFERENCES assets(id) ON DELETE SET NULL,
  alert_id VARCHAR(50) REFERENCES alerts(id) ON DELETE SET NULL,
  source VARCHAR(50) NOT NULL DEFAULT 'SIMULATED',
  provenance_type VARCHAR(50) NOT NULL DEFAULT 'SIMULATED',
  zone VARCHAR(100),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_station_time ON mission_events(station_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_category ON mission_events(station_id, category);

-- 8. Enhance Simulation Runs Persistence
ALTER TABLE simulation_runs
  ADD COLUMN IF NOT EXISTS title VARCHAR(200),
  ADD COLUMN IF NOT EXISTS label VARCHAR(50) DEFAULT 'SIMULATION',
  ADD COLUMN IF NOT EXISTS model_version VARCHAR(50),
  ADD COLUMN IF NOT EXISTS deterministic_seed VARCHAR(50),
  ADD COLUMN IF NOT EXISTS parameters JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS comparisons JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS blast_radius JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS operational_risk JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS recovery_state JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS explanation TEXT;
