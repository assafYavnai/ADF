ALTER TABLE memory_items
    ADD COLUMN IF NOT EXISTS workflow_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_memory_items_workflow_metadata_gin
    ON memory_items USING GIN (workflow_metadata);

CREATE INDEX IF NOT EXISTS idx_memory_items_workflow_kind
    ON memory_items ((workflow_metadata->>'workflow_kind'));

CREATE INDEX IF NOT EXISTS idx_memory_items_workflow_id
    ON memory_items ((workflow_metadata->>'workflow_id'));

CREATE INDEX IF NOT EXISTS idx_memory_items_workflow_parent_id
    ON memory_items ((workflow_metadata->>'parent_workflow_id'));

CREATE INDEX IF NOT EXISTS idx_memory_items_workflow_topic_slug
    ON memory_items ((workflow_metadata->>'topic_slug'));

CREATE INDEX IF NOT EXISTS idx_memory_items_workflow_status
    ON memory_items ((workflow_metadata->>'status'));

CREATE INDEX IF NOT EXISTS idx_memory_items_workflow_linked_plan_id
    ON memory_items ((workflow_metadata->>'linked_plan_id'));

CREATE INDEX IF NOT EXISTS idx_memory_items_workflow_linked_discussion_id
    ON memory_items ((workflow_metadata->>'linked_discussion_id'));

CREATE INDEX IF NOT EXISTS idx_memory_items_workflow_revision_number
    ON memory_items (((workflow_metadata->>'revision_number')::int))
    WHERE workflow_metadata ? 'revision_number';

CREATE INDEX IF NOT EXISTS idx_memory_items_workflow_sequence_number
    ON memory_items (((workflow_metadata->>'sequence_number')::int))
    WHERE workflow_metadata ? 'sequence_number';
