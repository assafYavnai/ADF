-- 016: Telemetry KPI indexes for partitioned COO rollups

CREATE INDEX IF NOT EXISTS idx_telemetry_partition
  ON telemetry ((COALESCE(NULLIF(metadata->>'telemetry_partition', ''), 'production')));

CREATE INDEX IF NOT EXISTS idx_telemetry_thread_id
  ON telemetry ((metadata->>'thread_id'));

CREATE INDEX IF NOT EXISTS idx_telemetry_workflow
  ON telemetry ((metadata->>'workflow'));

CREATE INDEX IF NOT EXISTS idx_telemetry_trace_id
  ON telemetry ((metadata->>'trace_id'));

CREATE INDEX IF NOT EXISTS idx_telemetry_operation_created_at
  ON telemetry (operation, created_at DESC);
