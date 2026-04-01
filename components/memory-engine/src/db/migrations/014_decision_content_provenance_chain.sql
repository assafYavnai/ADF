-- 014: Carry decision content provenance separately from write provenance.

ALTER TABLE decisions
  ADD COLUMN IF NOT EXISTS derivation_mode TEXT DEFAULT 'legacy_unknown',
  ADD COLUMN IF NOT EXISTS content_invocation_id UUID,
  ADD COLUMN IF NOT EXISTS content_provider TEXT,
  ADD COLUMN IF NOT EXISTS content_model TEXT,
  ADD COLUMN IF NOT EXISTS content_reasoning TEXT,
  ADD COLUMN IF NOT EXISTS content_was_fallback BOOLEAN,
  ADD COLUMN IF NOT EXISTS content_source_path TEXT;

ALTER TABLE decisions
  DROP CONSTRAINT IF EXISTS chk_decisions_derivation_mode;

ALTER TABLE decisions
  ADD CONSTRAINT chk_decisions_derivation_mode
    CHECK (derivation_mode IN ('direct_input', 'llm_extracted', 'legacy_unknown'));

UPDATE decisions
SET
  derivation_mode = CASE
    WHEN source_path = 'system/pre-provenance'
      OR invocation_id = '00000000-0000-0000-0000-000000000000'::uuid
      THEN 'legacy_unknown'
    ELSE 'direct_input'
  END,
  content_invocation_id = CASE
    WHEN source_path = 'system/pre-provenance'
      OR invocation_id = '00000000-0000-0000-0000-000000000000'::uuid
      THEN NULL
    ELSE invocation_id
  END,
  content_provider = CASE
    WHEN source_path = 'system/pre-provenance'
      OR invocation_id = '00000000-0000-0000-0000-000000000000'::uuid
      THEN NULL
    ELSE provider
  END,
  content_model = CASE
    WHEN source_path = 'system/pre-provenance'
      OR invocation_id = '00000000-0000-0000-0000-000000000000'::uuid
      THEN NULL
    ELSE model
  END,
  content_reasoning = CASE
    WHEN source_path = 'system/pre-provenance'
      OR invocation_id = '00000000-0000-0000-0000-000000000000'::uuid
      THEN NULL
    ELSE provenance_reasoning
  END,
  content_was_fallback = CASE
    WHEN source_path = 'system/pre-provenance'
      OR invocation_id = '00000000-0000-0000-0000-000000000000'::uuid
      THEN NULL
    ELSE was_fallback
  END,
  content_source_path = CASE
    WHEN source_path = 'system/pre-provenance'
      OR invocation_id = '00000000-0000-0000-0000-000000000000'::uuid
      THEN NULL
    ELSE source_path
  END
WHERE content_invocation_id IS NULL
   OR content_provider IS NULL
   OR content_model IS NULL
   OR content_reasoning IS NULL
   OR content_was_fallback IS NULL
   OR content_source_path IS NULL
   OR derivation_mode IS NULL;

ALTER TABLE decisions
  DROP CONSTRAINT IF EXISTS chk_decisions_content_provenance_chain;

ALTER TABLE decisions
  ADD CONSTRAINT chk_decisions_content_provenance_chain
    CHECK (
      (
        derivation_mode IN ('direct_input', 'llm_extracted')
        AND content_invocation_id IS NOT NULL
        AND content_provider IS NOT NULL
        AND content_model IS NOT NULL
        AND content_reasoning IS NOT NULL
        AND content_was_fallback IS NOT NULL
        AND content_source_path IS NOT NULL
      )
      OR derivation_mode = 'legacy_unknown'
    );

ALTER TABLE decisions
  ALTER COLUMN derivation_mode SET NOT NULL;
