-- 016: Upgrade durable evidence rows into an explicit format/lifecycle contract.

SELECT set_config('project_brain.bypass_lock', 'on', true);

ALTER TABLE memory_items DISABLE TRIGGER trg_enforce_trust_immutability;
ALTER TABLE memory_items DISABLE TRIGGER trg_reject_legacy_provenance_memory_items;
ALTER TABLE decisions DISABLE TRIGGER trg_reject_legacy_provenance_decisions;
ALTER TABLE memory_embeddings DISABLE TRIGGER trg_reject_legacy_provenance_memory_embeddings;

ALTER TABLE memory_items
  ADD COLUMN IF NOT EXISTS evidence_format_version SMALLINT DEFAULT 2,
  ADD COLUMN IF NOT EXISTS evidence_lifecycle_status TEXT DEFAULT 'current',
  ADD COLUMN IF NOT EXISTS legacy_marker TEXT;

ALTER TABLE decisions
  ADD COLUMN IF NOT EXISTS evidence_format_version SMALLINT DEFAULT 2,
  ADD COLUMN IF NOT EXISTS evidence_lifecycle_status TEXT DEFAULT 'current',
  ADD COLUMN IF NOT EXISTS legacy_marker TEXT;

ALTER TABLE memory_embeddings
  ADD COLUMN IF NOT EXISTS evidence_format_version SMALLINT DEFAULT 2,
  ADD COLUMN IF NOT EXISTS evidence_lifecycle_status TEXT DEFAULT 'current',
  ADD COLUMN IF NOT EXISTS legacy_marker TEXT;

UPDATE memory_items
SET
  evidence_format_version = 2,
  evidence_lifecycle_status = CASE
    WHEN invocation_id = '00000000-0000-0000-0000-000000000000'::uuid
      OR source_path = 'system/pre-provenance'
      THEN 'legacy_archived'
    ELSE 'current'
  END,
  legacy_marker = CASE
    WHEN invocation_id = '00000000-0000-0000-0000-000000000000'::uuid
      OR source_path = 'system/pre-provenance'
      THEN 'ADF_LEGACY_SENTINEL_V1'
    ELSE NULL
  END
WHERE evidence_format_version IS NULL
   OR evidence_format_version <> 2
   OR evidence_lifecycle_status IS NULL
   OR (
        (invocation_id = '00000000-0000-0000-0000-000000000000'::uuid OR source_path = 'system/pre-provenance')
        AND (evidence_lifecycle_status <> 'legacy_archived' OR legacy_marker IS DISTINCT FROM 'ADF_LEGACY_SENTINEL_V1')
      )
   OR (
        NOT (invocation_id = '00000000-0000-0000-0000-000000000000'::uuid OR source_path = 'system/pre-provenance')
        AND (evidence_lifecycle_status <> 'current' OR legacy_marker IS NOT NULL)
      );

UPDATE decisions d
SET
  evidence_format_version = 2,
  evidence_lifecycle_status = CASE
    WHEN d.invocation_id = '00000000-0000-0000-0000-000000000000'::uuid
      OR d.source_path = 'system/pre-provenance'
      OR d.derivation_mode = 'legacy_unknown'
      OR d.reasoning_state IN ('legacy_recovered', 'legacy_unrecoverable')
      OR m.evidence_lifecycle_status = 'legacy_archived'
      THEN 'legacy_archived'
    ELSE 'current'
  END,
  legacy_marker = CASE
    WHEN d.invocation_id = '00000000-0000-0000-0000-000000000000'::uuid
      OR d.source_path = 'system/pre-provenance'
      OR d.derivation_mode = 'legacy_unknown'
      OR d.reasoning_state IN ('legacy_recovered', 'legacy_unrecoverable')
      OR m.evidence_lifecycle_status = 'legacy_archived'
      THEN 'ADF_LEGACY_SENTINEL_V1'
    ELSE NULL
  END
FROM memory_items m
WHERE d.memory_item_id = m.id
  AND (
    d.evidence_format_version IS NULL
    OR d.evidence_format_version <> 2
    OR d.evidence_lifecycle_status IS NULL
    OR (
         (d.invocation_id = '00000000-0000-0000-0000-000000000000'::uuid
          OR d.source_path = 'system/pre-provenance'
          OR d.derivation_mode = 'legacy_unknown'
          OR d.reasoning_state IN ('legacy_recovered', 'legacy_unrecoverable')
          OR m.evidence_lifecycle_status = 'legacy_archived')
         AND (d.evidence_lifecycle_status <> 'legacy_archived' OR d.legacy_marker IS DISTINCT FROM 'ADF_LEGACY_SENTINEL_V1')
       )
    OR (
         NOT (d.invocation_id = '00000000-0000-0000-0000-000000000000'::uuid
              OR d.source_path = 'system/pre-provenance'
              OR d.derivation_mode = 'legacy_unknown'
              OR d.reasoning_state IN ('legacy_recovered', 'legacy_unrecoverable')
              OR m.evidence_lifecycle_status = 'legacy_archived')
         AND (d.evidence_lifecycle_status <> 'current' OR d.legacy_marker IS NOT NULL)
       )
  );

UPDATE memory_embeddings e
SET
  evidence_format_version = 2,
  evidence_lifecycle_status = CASE
    WHEN e.invocation_id = '00000000-0000-0000-0000-000000000000'::uuid
      OR e.source_path = 'system/pre-provenance'
      OR m.evidence_lifecycle_status = 'legacy_archived'
      THEN 'legacy_archived'
    ELSE 'current'
  END,
  legacy_marker = CASE
    WHEN e.invocation_id = '00000000-0000-0000-0000-000000000000'::uuid
      OR e.source_path = 'system/pre-provenance'
      OR m.evidence_lifecycle_status = 'legacy_archived'
      THEN 'ADF_LEGACY_SENTINEL_V1'
    ELSE NULL
  END
FROM memory_items m
WHERE e.memory_item_id = m.id
  AND (
    e.evidence_format_version IS NULL
    OR e.evidence_format_version <> 2
    OR e.evidence_lifecycle_status IS NULL
    OR (
         (e.invocation_id = '00000000-0000-0000-0000-000000000000'::uuid
          OR e.source_path = 'system/pre-provenance'
          OR m.evidence_lifecycle_status = 'legacy_archived')
         AND (e.evidence_lifecycle_status <> 'legacy_archived' OR e.legacy_marker IS DISTINCT FROM 'ADF_LEGACY_SENTINEL_V1')
       )
    OR (
         NOT (e.invocation_id = '00000000-0000-0000-0000-000000000000'::uuid
              OR e.source_path = 'system/pre-provenance'
              OR m.evidence_lifecycle_status = 'legacy_archived')
         AND (e.evidence_lifecycle_status <> 'current' OR e.legacy_marker IS NOT NULL)
       )
  );

ALTER TABLE memory_items
  ALTER COLUMN evidence_format_version SET DEFAULT 2,
  ALTER COLUMN evidence_format_version SET NOT NULL,
  ALTER COLUMN evidence_lifecycle_status SET DEFAULT 'current',
  ALTER COLUMN evidence_lifecycle_status SET NOT NULL;

ALTER TABLE decisions
  ALTER COLUMN evidence_format_version SET DEFAULT 2,
  ALTER COLUMN evidence_format_version SET NOT NULL,
  ALTER COLUMN evidence_lifecycle_status SET DEFAULT 'current',
  ALTER COLUMN evidence_lifecycle_status SET NOT NULL;

ALTER TABLE memory_embeddings
  ALTER COLUMN evidence_format_version SET DEFAULT 2,
  ALTER COLUMN evidence_format_version SET NOT NULL,
  ALTER COLUMN evidence_lifecycle_status SET DEFAULT 'current',
  ALTER COLUMN evidence_lifecycle_status SET NOT NULL;

ALTER TABLE memory_items
  DROP CONSTRAINT IF EXISTS chk_memory_items_evidence_format_version,
  DROP CONSTRAINT IF EXISTS chk_memory_items_evidence_lifecycle_status,
  DROP CONSTRAINT IF EXISTS chk_memory_items_legacy_marker_consistency;

ALTER TABLE decisions
  DROP CONSTRAINT IF EXISTS chk_decisions_evidence_format_version,
  DROP CONSTRAINT IF EXISTS chk_decisions_evidence_lifecycle_status,
  DROP CONSTRAINT IF EXISTS chk_decisions_legacy_marker_consistency;

ALTER TABLE memory_embeddings
  DROP CONSTRAINT IF EXISTS chk_memory_embeddings_evidence_format_version,
  DROP CONSTRAINT IF EXISTS chk_memory_embeddings_evidence_lifecycle_status,
  DROP CONSTRAINT IF EXISTS chk_memory_embeddings_legacy_marker_consistency;

ALTER TABLE memory_items
  ADD CONSTRAINT chk_memory_items_evidence_format_version
    CHECK (evidence_format_version = 2),
  ADD CONSTRAINT chk_memory_items_evidence_lifecycle_status
    CHECK (evidence_lifecycle_status IN ('current', 'legacy_archived')),
  ADD CONSTRAINT chk_memory_items_legacy_marker_consistency
    CHECK (
      (evidence_lifecycle_status = 'current' AND legacy_marker IS NULL)
      OR (evidence_lifecycle_status = 'legacy_archived' AND legacy_marker = 'ADF_LEGACY_SENTINEL_V1')
    );

ALTER TABLE decisions
  ADD CONSTRAINT chk_decisions_evidence_format_version
    CHECK (evidence_format_version = 2),
  ADD CONSTRAINT chk_decisions_evidence_lifecycle_status
    CHECK (evidence_lifecycle_status IN ('current', 'legacy_archived')),
  ADD CONSTRAINT chk_decisions_legacy_marker_consistency
    CHECK (
      (evidence_lifecycle_status = 'current' AND legacy_marker IS NULL)
      OR (evidence_lifecycle_status = 'legacy_archived' AND legacy_marker = 'ADF_LEGACY_SENTINEL_V1')
    );

ALTER TABLE memory_embeddings
  ADD CONSTRAINT chk_memory_embeddings_evidence_format_version
    CHECK (evidence_format_version = 2),
  ADD CONSTRAINT chk_memory_embeddings_evidence_lifecycle_status
    CHECK (evidence_lifecycle_status IN ('current', 'legacy_archived')),
  ADD CONSTRAINT chk_memory_embeddings_legacy_marker_consistency
    CHECK (
      (evidence_lifecycle_status = 'current' AND legacy_marker IS NULL)
      OR (evidence_lifecycle_status = 'legacy_archived' AND legacy_marker = 'ADF_LEGACY_SENTINEL_V1')
    );

CREATE INDEX IF NOT EXISTS idx_memory_items_evidence_lifecycle
  ON memory_items (evidence_lifecycle_status, content_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_decisions_evidence_lifecycle
  ON decisions (evidence_lifecycle_status, derivation_mode, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_memory_embeddings_evidence_lifecycle
  ON memory_embeddings (evidence_lifecycle_status, created_at DESC);

ALTER TABLE memory_items ENABLE TRIGGER trg_enforce_trust_immutability;
ALTER TABLE memory_items ENABLE TRIGGER trg_reject_legacy_provenance_memory_items;
ALTER TABLE decisions ENABLE TRIGGER trg_reject_legacy_provenance_decisions;
ALTER TABLE memory_embeddings ENABLE TRIGGER trg_reject_legacy_provenance_memory_embeddings;

SELECT set_config('project_brain.bypass_lock', 'off', true);
