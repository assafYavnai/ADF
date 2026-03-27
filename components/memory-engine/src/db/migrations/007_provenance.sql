-- 007: Add provenance columns to memory_items
ALTER TABLE memory_items
  ADD COLUMN IF NOT EXISTS invocation_id UUID,
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS reasoning TEXT,
  ADD COLUMN IF NOT EXISTS was_fallback BOOLEAN,
  ADD COLUMN IF NOT EXISTS source_path TEXT;

-- Backfill existing rows with sentinel provenance
UPDATE memory_items
SET
  invocation_id = '00000000-0000-0000-0000-000000000000',
  provider = 'system',
  model = 'none',
  reasoning = 'none',
  was_fallback = FALSE,
  source_path = 'system/pre-provenance'
WHERE invocation_id IS NULL;

-- Set defaults for future inserts
ALTER TABLE memory_items
  ALTER COLUMN invocation_id SET DEFAULT '00000000-0000-0000-0000-000000000000',
  ALTER COLUMN provider SET DEFAULT 'system',
  ALTER COLUMN model SET DEFAULT 'none',
  ALTER COLUMN reasoning SET DEFAULT 'none',
  ALTER COLUMN was_fallback SET DEFAULT FALSE,
  ALTER COLUMN source_path SET DEFAULT 'system/unknown';

CREATE INDEX IF NOT EXISTS idx_memory_items_invocation_id ON memory_items (invocation_id);
CREATE INDEX IF NOT EXISTS idx_memory_items_source_path ON memory_items (source_path);
