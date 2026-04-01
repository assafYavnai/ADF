BEGIN;

ALTER TABLE memory_items
    DROP CONSTRAINT IF EXISTS chk_memory_items_content_type;

ALTER TABLE memory_items
    ADD CONSTRAINT chk_memory_items_content_type CHECK (
        content_type IN (
            'text',
            'decision',
            'intent',
            'context',
            'lesson',
            'convention',
            'requirement',
            'note',
            'open_loop',
            'artifact_ref',
            'rule',
            'role',
            'setting',
            'finding'
        )
    );

COMMIT;
