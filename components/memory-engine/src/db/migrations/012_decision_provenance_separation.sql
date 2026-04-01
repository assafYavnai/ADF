-- 012: Separate business reasoning from provenance reasoning on decisions.

ALTER TABLE decisions
  ADD COLUMN IF NOT EXISTS provenance_reasoning TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS reasoning_state TEXT DEFAULT 'current';

ALTER TABLE decisions
  DROP CONSTRAINT IF EXISTS chk_decisions_reasoning_state;

ALTER TABLE decisions
  ADD CONSTRAINT chk_decisions_reasoning_state
    CHECK (reasoning_state IN ('current', 'legacy_recovered', 'legacy_unrecoverable'));

UPDATE decisions d
SET
  provenance_reasoning = COALESCE(NULLIF(m.reasoning, ''), 'none'),
  reasoning = CASE
    WHEN d.reasoning <> 'none' THEN d.reasoning
    WHEN legacy.content_text IS NOT NULL AND legacy.content_text LIKE d.title || ': %'
      THEN substring(legacy.content_text FROM char_length(d.title) + 3)
    ELSE d.reasoning
  END,
  reasoning_state = CASE
    WHEN d.reasoning <> 'none' THEN 'current'
    WHEN legacy.content_text IS NOT NULL AND legacy.content_text LIKE d.title || ': %'
      THEN 'legacy_recovered'
    ELSE 'legacy_unrecoverable'
  END
FROM memory_items m
CROSS JOIN LATERAL (
  SELECT CASE
    WHEN left(m.content::text, 1) = '{' THEN m.content::jsonb->>'text'
    ELSE NULL
  END AS content_text
) legacy
WHERE d.memory_item_id = m.id;

UPDATE decisions
SET
  provenance_reasoning = COALESCE(NULLIF(provenance_reasoning, ''), 'none'),
  reasoning_state = COALESCE(reasoning_state, 'legacy_unrecoverable')
WHERE provenance_reasoning IS NULL
   OR reasoning_state IS NULL;

ALTER TABLE decisions
  ALTER COLUMN provenance_reasoning SET NOT NULL,
  ALTER COLUMN reasoning_state SET NOT NULL;
