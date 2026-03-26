BEGIN;

ALTER TABLE IF EXISTS plan
    ADD COLUMN IF NOT EXISTS current_revision_id uuid,
    ADD COLUMN IF NOT EXISTS current_revision_number integer,
    ADD COLUMN IF NOT EXISTS latest_revision_number integer,
    ADD COLUMN IF NOT EXISTS source_discussion_id uuid;

CREATE INDEX IF NOT EXISTS idx_plan_current_revision_id ON plan(current_revision_id);
CREATE INDEX IF NOT EXISTS idx_plan_source_discussion_id ON plan(source_discussion_id);

ALTER TABLE IF EXISTS plan_revision
    ADD COLUMN IF NOT EXISTS based_on_revision integer,
    ADD COLUMN IF NOT EXISTS diff_from_previous jsonb,
    ADD COLUMN IF NOT EXISTS implemented_cr_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS source_discussion_id uuid;

CREATE INDEX IF NOT EXISTS idx_plan_revision_plan_id_revision_number ON plan_revision(plan_id, revision_number);
CREATE INDEX IF NOT EXISTS idx_plan_revision_source_discussion_id ON plan_revision(source_discussion_id);

ALTER TABLE IF EXISTS change_request
    ADD COLUMN IF NOT EXISTS plan_id uuid,
    ADD COLUMN IF NOT EXISTS target_revision integer,
    ADD COLUMN IF NOT EXISTS reason text,
    ADD COLUMN IF NOT EXISTS delta_summary text,
    ADD COLUMN IF NOT EXISTS transition_reason text,
    ADD COLUMN IF NOT EXISTS linked_revision_id uuid,
    ADD COLUMN IF NOT EXISTS resulting_revision_id uuid,
    ADD COLUMN IF NOT EXISTS resulting_revision_number integer;

CREATE INDEX IF NOT EXISTS idx_change_request_plan_id ON change_request(plan_id);
CREATE INDEX IF NOT EXISTS idx_change_request_linked_revision_id ON change_request(linked_revision_id);
CREATE INDEX IF NOT EXISTS idx_change_request_resulting_revision_id ON change_request(resulting_revision_id);

ALTER TABLE IF EXISTS discussion
    ADD COLUMN IF NOT EXISTS topic_slug text,
    ADD COLUMN IF NOT EXISTS entry_count integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_sequence_number integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_discussion_topic_slug ON discussion(topic_slug);

ALTER TABLE IF EXISTS discussion_entry
    ADD COLUMN IF NOT EXISTS title text,
    ADD COLUMN IF NOT EXISTS discussion_mode text,
    ADD COLUMN IF NOT EXISTS linked_plan_id uuid,
    ADD COLUMN IF NOT EXISTS linked_revision_id uuid,
    ADD COLUMN IF NOT EXISTS target_revision integer;

CREATE INDEX IF NOT EXISTS idx_discussion_entry_discussion_id_sequence ON discussion_entry(discussion_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_discussion_entry_linked_plan_id ON discussion_entry(linked_plan_id);
CREATE INDEX IF NOT EXISTS idx_discussion_entry_linked_revision_id ON discussion_entry(linked_revision_id);

COMMIT;
