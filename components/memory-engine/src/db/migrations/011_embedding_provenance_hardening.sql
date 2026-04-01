-- 011: Bring memory_embeddings provenance closer to memory_items/decisions

ALTER TABLE memory_embeddings
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS model_name TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS reasoning TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS was_fallback BOOLEAN DEFAULT FALSE;

UPDATE memory_embeddings e
SET
  provider = COALESCE(m.provider, 'system'),
  model_name = COALESCE(m.model, e.model, 'none'),
  reasoning = COALESCE(m.reasoning, 'none'),
  was_fallback = COALESCE(m.was_fallback, FALSE),
  source_path = COALESCE(NULLIF(e.source_path, 'system/unknown'), m.source_path, 'system/pre-provenance')
FROM memory_items m
WHERE m.id = e.memory_item_id
  AND (
    e.provider IS NULL
    OR e.provider = 'system'
    OR e.model_name IS NULL
    OR e.model_name = 'none'
    OR e.reasoning IS NULL
    OR e.reasoning = 'none'
    OR e.source_path IS NULL
    OR e.source_path = 'system/unknown'
  );

UPDATE memory_embeddings
SET
  provider = COALESCE(provider, 'system'),
  model_name = COALESCE(model_name, model, 'none'),
  reasoning = COALESCE(reasoning, 'none'),
  was_fallback = COALESCE(was_fallback, FALSE),
  source_path = COALESCE(source_path, 'system/pre-provenance')
WHERE provider IS NULL
   OR model_name IS NULL
   OR reasoning IS NULL
   OR was_fallback IS NULL
   OR source_path IS NULL;
