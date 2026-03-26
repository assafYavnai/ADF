BEGIN;

DROP INDEX IF EXISTS idx_memory_items_search_vector;
ALTER TABLE memory_items DROP COLUMN IF EXISTS search_vector;

DO $$
DECLARE
    content_data_type text;
BEGIN
    SELECT data_type
    INTO content_data_type
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'memory_items'
      AND column_name = 'content';

    IF content_data_type IS DISTINCT FROM 'jsonb' THEN
        EXECUTE $sql$
            ALTER TABLE memory_items
            ALTER COLUMN content TYPE JSONB
            USING jsonb_build_object('text', content)
        $sql$;
    END IF;
END $$;

ALTER TABLE memory_items
    ADD COLUMN search_vector TSVECTOR GENERATED ALWAYS AS (
        to_tsvector('english', COALESCE(content->>'search_text', content->>'text', content::text))
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_memory_items_search_vector ON memory_items USING GIN (search_vector);

DROP FUNCTION IF EXISTS hybrid_search(
    TEXT,
    VECTOR(768),
    UUID,
    UUID,
    UUID,
    UUID,
    UUID,
    TEXT,
    TEXT,
    INTEGER,
    DOUBLE PRECISION,
    DOUBLE PRECISION
);

CREATE FUNCTION hybrid_search(
    p_query_text TEXT DEFAULT NULL,
    p_query_embedding VECTOR(768) DEFAULT NULL,
    p_scope_org_id UUID DEFAULT NULL,
    p_scope_project_id UUID DEFAULT NULL,
    p_scope_initiative_id UUID DEFAULT NULL,
    p_scope_phase_id UUID DEFAULT NULL,
    p_scope_thread_id UUID DEFAULT NULL,
    p_content_type TEXT DEFAULT NULL,
    p_model TEXT DEFAULT 'nomic-embed-text',
    p_max_results INTEGER DEFAULT 10,
    p_semantic_weight DOUBLE PRECISION DEFAULT 0.6,
    p_keyword_weight DOUBLE PRECISION DEFAULT 0.4
)
RETURNS TABLE (
    memory_item_id UUID,
    content JSONB,
    content_type TEXT,
    trust_level TEXT,
    scope_level TEXT,
    created_at TIMESTAMPTZ,
    semantic_rank INTEGER,
    keyword_rank INTEGER,
    score DOUBLE PRECISION
)
LANGUAGE SQL
STABLE
AS $$
WITH filtered_items AS (
    SELECT mi.*
    FROM memory_items mi
    WHERE (p_content_type IS NULL OR mi.content_type = p_content_type)
      AND (p_scope_org_id IS NULL OR mi.org_id = p_scope_org_id)
      AND (p_scope_project_id IS NULL OR mi.project_id = p_scope_project_id)
      AND (p_scope_initiative_id IS NULL OR mi.initiative_id = p_scope_initiative_id)
      AND (p_scope_phase_id IS NULL OR mi.phase_id = p_scope_phase_id)
      AND (p_scope_thread_id IS NULL OR mi.thread_id = p_scope_thread_id)
),
query_terms AS (
    SELECT NULLIF(btrim(coalesce(p_query_text, '')), '') AS q
),
semantic_ranked AS (
    SELECT
        fi.id AS memory_item_id,
        row_number() OVER (ORDER BY me.embedding <=> p_query_embedding) AS semantic_rank
    FROM filtered_items fi
    JOIN memory_embeddings me
      ON me.memory_item_id = fi.id
    WHERE p_query_embedding IS NOT NULL
      AND me.is_active = true
      AND me.model = p_model
),
keyword_ranked AS (
    SELECT
        fi.id AS memory_item_id,
        row_number() OVER (
            ORDER BY ts_rank(fi.search_vector, plainto_tsquery('english', qt.q)) DESC, fi.created_at DESC
        ) AS keyword_rank
    FROM filtered_items fi
    CROSS JOIN query_terms qt
    WHERE qt.q IS NOT NULL
      AND fi.search_vector @@ plainto_tsquery('english', qt.q)
),
joined AS (
    SELECT
        fi.id,
        fi.content,
        fi.content_type,
        fi.trust_level,
        fi.scope_level,
        fi.created_at,
        sr.semantic_rank,
        kr.keyword_rank,
        coalesce(p_semantic_weight / (60 + sr.semantic_rank), 0)
            + coalesce(p_keyword_weight / (60 + kr.keyword_rank), 0) AS score
    FROM filtered_items fi
    LEFT JOIN semantic_ranked sr ON sr.memory_item_id = fi.id
    LEFT JOIN keyword_ranked kr ON kr.memory_item_id = fi.id
    WHERE sr.semantic_rank IS NOT NULL OR kr.keyword_rank IS NOT NULL
)
SELECT
    id AS memory_item_id,
    content,
    content_type,
    trust_level,
    scope_level,
    created_at,
    semantic_rank,
    keyword_rank,
    score
FROM joined
ORDER BY score DESC, created_at DESC
LIMIT GREATEST(coalesce(p_max_results, 10), 1);
$$;

COMMIT;
