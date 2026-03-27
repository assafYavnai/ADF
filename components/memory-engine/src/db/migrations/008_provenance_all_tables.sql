-- 008: Add provenance columns to decisions and memory_embeddings tables

ALTER TABLE decisions
  ADD COLUMN IF NOT EXISTS invocation_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS model TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS reasoning TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS was_fallback BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS source_path TEXT DEFAULT 'system/unknown';

ALTER TABLE memory_embeddings
  ADD COLUMN IF NOT EXISTS invocation_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
  ADD COLUMN IF NOT EXISTS source_path TEXT DEFAULT 'system/unknown';

-- Backfill existing rows
UPDATE decisions SET
  invocation_id = '00000000-0000-0000-0000-000000000000',
  provider = 'system',
  model = 'none',
  reasoning = 'none',
  was_fallback = FALSE,
  source_path = 'system/pre-provenance'
WHERE source_path IS NULL OR source_path = 'system/unknown';

UPDATE memory_embeddings SET
  invocation_id = '00000000-0000-0000-0000-000000000000',
  source_path = 'system/pre-provenance'
WHERE source_path IS NULL OR source_path = 'system/unknown';
