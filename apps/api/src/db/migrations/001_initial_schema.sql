-- ─── Schema Migrations Tracker ─────────────────────────────────
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(50) PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 1. Stations ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stations (
  id VARCHAR(50) PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  location_label VARCHAR(200) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'OPERATIONAL',
  last_sync_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_mode VARCHAR(30) NOT NULL DEFAULT 'SIMULATED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 2. Assets ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assets (
  id VARCHAR(50) PRIMARY KEY,
  station_id VARCHAR(50) NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  parent_asset_id VARCHAR(50) REFERENCES assets(id) ON DELETE SET NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  type VARCHAR(50) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'OPERATIONAL',
  criticality VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
  health_score NUMERIC(5, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_station_asset_code UNIQUE (station_id, code)
);

CREATE INDEX IF NOT EXISTS idx_assets_station_id ON assets(station_id);
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);

-- ─── 3. Telemetry ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS telemetry_points (
  id VARCHAR(50) PRIMARY KEY,
  station_id VARCHAR(50) NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  asset_id VARCHAR(50) REFERENCES assets(id) ON DELETE CASCADE,
  metric VARCHAR(100) NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  unit VARCHAR(30) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  source VARCHAR(30) NOT NULL DEFAULT 'SIMULATOR',
  quality VARCHAR(20) NOT NULL DEFAULT 'GOOD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_station_time ON telemetry_points(station_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_asset_time ON telemetry_points(asset_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_metric_time ON telemetry_points(station_id, metric, timestamp DESC);

-- Optional hypertable conversion if TimescaleDB extension is available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
    PERFORM create_hypertable('telemetry_points', 'timestamp', if_not_exists => TRUE);
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Fallback to standard indexed table if hypertable creation not supported
  NULL;
END $$;

-- ─── 4. Inventory ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_items (
  id VARCHAR(50) PRIMARY KEY,
  station_id VARCHAR(50) NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  quantity DOUBLE PRECISION NOT NULL DEFAULT 0,
  unit VARCHAR(30) NOT NULL,
  minimum_threshold DOUBLE PRECISION NOT NULL DEFAULT 0,
  average_daily_consumption DOUBLE PRECISION NOT NULL DEFAULT 0,
  lead_time_days INTEGER NOT NULL DEFAULT 30,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_station ON inventory_items(station_id);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory_items(station_id, category);

-- ─── 5. Alerts ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
  id VARCHAR(50) PRIMARY KEY,
  station_id VARCHAR(50) NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  asset_id VARCHAR(50) REFERENCES assets(id) ON DELETE CASCADE,
  severity VARCHAR(20) NOT NULL,
  category VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alerts_station_status ON alerts(station_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);

-- ─── 6. Forecasts ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS forecasts (
  id VARCHAR(50) PRIMARY KEY,
  station_id VARCHAR(50) NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  target VARCHAR(100) NOT NULL,
  horizon_hours INTEGER NOT NULL,
  predicted_value DOUBLE PRECISION NOT NULL,
  lower_bound DOUBLE PRECISION,
  upper_bound DOUBLE PRECISION,
  model_version VARCHAR(50) NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forecasts_station_target ON forecasts(station_id, target, generated_at DESC);

-- ─── 7. Simulations ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS simulation_runs (
  id VARCHAR(50) PRIMARY KEY,
  station_id VARCHAR(50) NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  scenario_type VARCHAR(100) NOT NULL,
  input_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  impacts JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_simulations_station ON simulation_runs(station_id, created_at DESC);
