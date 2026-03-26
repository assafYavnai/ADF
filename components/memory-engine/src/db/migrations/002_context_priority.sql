ALTER TABLE memory_items
    ADD COLUMN IF NOT EXISTS context_priority TEXT,
    ADD COLUMN IF NOT EXISTS compression_policy TEXT;

SET project_brain.bypass_lock = 'on';

DROP TABLE IF EXISTS _pb_backfill_context_policy;
CREATE TEMP TABLE _pb_backfill_context_policy AS
SELECT id, content_type, tags
FROM memory_items
WHERE context_priority IS NULL OR compression_policy IS NULL;

UPDATE memory_items
SET context_priority = COALESCE(context_priority, 'p2'),
    compression_policy = COALESCE(compression_policy, 'bullet')
WHERE id IN (SELECT id FROM _pb_backfill_context_policy);

UPDATE memory_items m
SET context_priority = 'p0',
    compression_policy = 'full'
FROM _pb_backfill_context_policy b
WHERE m.id = b.id
  AND (
      b.content_type IN ('requirement', 'convention')
      OR b.tags && ARRAY['mandatory', 'brain-governance', 'rules', 'ceo-cto', 'workflow']
  );

UPDATE memory_items m
SET context_priority = 'p1',
    compression_policy = 'executive'
FROM _pb_backfill_context_policy b
WHERE m.id = b.id
  AND b.content_type = 'decision'
  AND m.context_priority <> 'p0';

UPDATE memory_items m
SET context_priority = 'p3',
    compression_policy = 'drop'
FROM _pb_backfill_context_policy b
WHERE m.id = b.id
  AND b.tags && ARRAY['implementation-summary', 'phase-closeout', 'ops-log', 'artifact-log'];

DROP TABLE IF EXISTS _pb_backfill_context_policy;

ALTER TABLE memory_items
    ALTER COLUMN context_priority SET DEFAULT 'p2',
    ALTER COLUMN compression_policy SET DEFAULT 'bullet';

UPDATE memory_items
SET context_priority = 'p2'
WHERE context_priority IS NULL;

UPDATE memory_items
SET compression_policy = 'bullet'
WHERE compression_policy IS NULL;

ALTER TABLE memory_items
    ALTER COLUMN context_priority SET NOT NULL,
    ALTER COLUMN compression_policy SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_memory_items_context_priority'
    ) THEN
        ALTER TABLE memory_items
            ADD CONSTRAINT chk_memory_items_context_priority CHECK (
                context_priority IN ('p0', 'p1', 'p2', 'p3')
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_memory_items_compression_policy'
    ) THEN
        ALTER TABLE memory_items
            ADD CONSTRAINT chk_memory_items_compression_policy CHECK (
                compression_policy IN ('full', 'executive', 'bullet', 'drop')
            );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_memory_items_context_priority
    ON memory_items (org_id, project_id, initiative_id, phase_id, thread_id, context_priority, created_at DESC);

RESET project_brain.bypass_lock;
