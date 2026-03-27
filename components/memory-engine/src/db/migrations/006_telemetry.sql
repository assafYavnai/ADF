-- 006: Telemetry table (append-only metrics)
CREATE TABLE IF NOT EXISTS telemetry (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invocation_id UUID NOT NULL,
  provider      TEXT NOT NULL,
  model         TEXT NOT NULL,
  reasoning     TEXT NOT NULL DEFAULT 'none',
  was_fallback  BOOLEAN NOT NULL DEFAULT FALSE,
  source_path   TEXT NOT NULL,
  category      TEXT NOT NULL CHECK (category IN ('llm', 'memory', 'tool', 'turn', 'system')),
  operation     TEXT NOT NULL,
  latency_ms    INTEGER NOT NULL,
  success       BOOLEAN NOT NULL,
  tokens_in     INTEGER,
  tokens_out    INTEGER,
  estimated_cost_usd NUMERIC(10,6),
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_telemetry_created_at ON telemetry (created_at DESC);
CREATE INDEX idx_telemetry_category ON telemetry (category);
CREATE INDEX idx_telemetry_source_path ON telemetry (source_path);
CREATE INDEX idx_telemetry_invocation_id ON telemetry (invocation_id);
CREATE INDEX idx_telemetry_provider_model ON telemetry (provider, model);
