CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_organizations_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_projects_org_slug UNIQUE (org_id, slug),
    CONSTRAINT chk_projects_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE TABLE IF NOT EXISTS initiatives (
    id UUID PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_initiatives_project_slug UNIQUE (project_id, slug),
    CONSTRAINT chk_initiatives_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE TABLE IF NOT EXISTS phases (
    id UUID PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    initiative_id UUID NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_phases_initiative_slug UNIQUE (initiative_id, slug),
    CONSTRAINT chk_phases_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE TABLE IF NOT EXISTS threads (
    id UUID PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    initiative_id UUID NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
    phase_id UUID NOT NULL REFERENCES phases(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_threads_phase_slug UNIQUE (phase_id, slug),
    CONSTRAINT chk_threads_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    agent_type TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memory_items (
    id UUID PRIMARY KEY,
    content TEXT NOT NULL,
    content_type TEXT NOT NULL,
    trust_level TEXT NOT NULL,
    scope_level TEXT NOT NULL,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    initiative_id UUID REFERENCES initiatives(id) ON DELETE CASCADE,
    phase_id UUID REFERENCES phases(id) ON DELETE CASCADE,
    thread_id UUID REFERENCES threads(id) ON DELETE CASCADE,
    tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    source_ref TEXT,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    search_vector TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED,
    CONSTRAINT chk_memory_items_content_type CHECK (
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
            'artifact_ref'
        )
    ),
    CONSTRAINT chk_memory_items_trust_level CHECK (
        trust_level IN ('working', 'reviewed', 'locked')
    ),
    CONSTRAINT chk_memory_items_scope_level CHECK (
        scope_level IN ('organization', 'project', 'initiative', 'phase', 'thread')
    ),
    CONSTRAINT chk_memory_items_scope_matrix CHECK (
        (scope_level = 'organization' AND org_id IS NOT NULL AND project_id IS NULL AND initiative_id IS NULL AND phase_id IS NULL AND thread_id IS NULL)
        OR
        (scope_level = 'project' AND org_id IS NOT NULL AND project_id IS NOT NULL AND initiative_id IS NULL AND phase_id IS NULL AND thread_id IS NULL)
        OR
        (scope_level = 'initiative' AND org_id IS NOT NULL AND project_id IS NOT NULL AND initiative_id IS NOT NULL AND phase_id IS NULL AND thread_id IS NULL)
        OR
        (scope_level = 'phase' AND org_id IS NOT NULL AND project_id IS NOT NULL AND initiative_id IS NOT NULL AND phase_id IS NOT NULL AND thread_id IS NULL)
        OR
        (scope_level = 'thread' AND org_id IS NOT NULL AND project_id IS NOT NULL AND initiative_id IS NOT NULL AND phase_id IS NOT NULL AND thread_id IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS memory_embeddings (
    id UUID PRIMARY KEY,
    memory_item_id UUID NOT NULL REFERENCES memory_items(id) ON DELETE CASCADE,
    model TEXT NOT NULL,
    version TEXT,
    embedding VECTOR(768) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS decisions (
    id UUID PRIMARY KEY,
    memory_item_id UUID NOT NULL UNIQUE REFERENCES memory_items(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    reasoning TEXT NOT NULL,
    alternatives_considered JSONB NOT NULL DEFAULT '[]'::JSONB,
    status TEXT NOT NULL DEFAULT 'active',
    superseded_by UUID REFERENCES decisions(id) ON DELETE SET NULL,
    decided_by UUID REFERENCES agents(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_decisions_status CHECK (status IN ('active', 'superseded', 'deprecated'))
);

CREATE TABLE IF NOT EXISTS memory_links (
    id UUID PRIMARY KEY,
    source_memory_item_id UUID NOT NULL REFERENCES memory_items(id) ON DELETE CASCADE,
    target_memory_item_id UUID NOT NULL REFERENCES memory_items(id) ON DELETE CASCADE,
    link_type TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_memory_links_not_self CHECK (source_memory_item_id <> target_memory_item_id),
    CONSTRAINT uq_memory_links_source_target_type UNIQUE (source_memory_item_id, target_memory_item_id, link_type)
);

CREATE INDEX IF NOT EXISTS idx_memory_items_tags ON memory_items USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_memory_items_search_vector ON memory_items USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_memory_items_scope_created_at ON memory_items (org_id, project_id, initiative_id, phase_id, thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_items_content_type ON memory_items (content_type);
CREATE INDEX IF NOT EXISTS idx_memory_items_trust_level ON memory_items (trust_level);
CREATE INDEX IF NOT EXISTS idx_memory_embeddings_memory_item ON memory_embeddings (memory_item_id);
CREATE INDEX IF NOT EXISTS idx_memory_embeddings_model_active ON memory_embeddings (model, is_active);
CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions (status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_memory_embeddings_active_item_model
    ON memory_embeddings (memory_item_id, model)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_memory_embeddings_hnsw_nomic_active
    ON memory_embeddings USING HNSW (embedding vector_cosine_ops)
    WHERE model = 'nomic-embed-text' AND is_active = true;

CREATE OR REPLACE FUNCTION validate_scope_chain()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_TABLE_NAME = 'initiatives' THEN
        IF NOT EXISTS (
            SELECT 1
            FROM projects p
            WHERE p.id = NEW.project_id
              AND p.org_id = NEW.org_id
        ) THEN
            RAISE EXCEPTION 'Invalid scope chain: project % does not belong to organization %', NEW.project_id, NEW.org_id;
        END IF;
        RETURN NEW;
    END IF;

    IF TG_TABLE_NAME = 'phases' THEN
        IF NOT EXISTS (
            SELECT 1
            FROM initiatives i
            WHERE i.id = NEW.initiative_id
              AND i.project_id = NEW.project_id
              AND i.org_id = NEW.org_id
        ) THEN
            RAISE EXCEPTION 'Invalid scope chain: initiative % does not belong to project % and organization %', NEW.initiative_id, NEW.project_id, NEW.org_id;
        END IF;
        RETURN NEW;
    END IF;

    IF TG_TABLE_NAME = 'threads' THEN
        IF NOT EXISTS (
            SELECT 1
            FROM phases p
            WHERE p.id = NEW.phase_id
              AND p.initiative_id = NEW.initiative_id
              AND p.project_id = NEW.project_id
              AND p.org_id = NEW.org_id
        ) THEN
            RAISE EXCEPTION 'Invalid scope chain: phase % does not match provided initiative/project/organization', NEW.phase_id;
        END IF;
        RETURN NEW;
    END IF;

    IF TG_TABLE_NAME = 'memory_items' THEN
        IF NEW.project_id IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1
                FROM projects p
                WHERE p.id = NEW.project_id
                  AND p.org_id = NEW.org_id
            ) THEN
                RAISE EXCEPTION 'Invalid scope chain for memory_items: project % does not belong to organization %', NEW.project_id, NEW.org_id;
            END IF;
        END IF;

        IF NEW.initiative_id IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1
                FROM initiatives i
                WHERE i.id = NEW.initiative_id
                  AND i.project_id = NEW.project_id
                  AND i.org_id = NEW.org_id
            ) THEN
                RAISE EXCEPTION 'Invalid scope chain for memory_items: initiative % does not belong to provided project/organization', NEW.initiative_id;
            END IF;
        END IF;

        IF NEW.phase_id IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1
                FROM phases p
                WHERE p.id = NEW.phase_id
                  AND p.initiative_id = NEW.initiative_id
                  AND p.project_id = NEW.project_id
                  AND p.org_id = NEW.org_id
            ) THEN
                RAISE EXCEPTION 'Invalid scope chain for memory_items: phase % does not belong to provided initiative/project/organization', NEW.phase_id;
            END IF;
        END IF;

        IF NEW.thread_id IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1
                FROM threads t
                WHERE t.id = NEW.thread_id
                  AND t.phase_id = NEW.phase_id
                  AND t.initiative_id = NEW.initiative_id
                  AND t.project_id = NEW.project_id
                  AND t.org_id = NEW.org_id
            ) THEN
                RAISE EXCEPTION 'Invalid scope chain for memory_items: thread % does not belong to provided phase/initiative/project/organization', NEW.thread_id;
            END IF;
        END IF;

        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_trust_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    bypass_setting TEXT;
BEGIN
    bypass_setting := current_setting('project_brain.bypass_lock', true);

    IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE')
       AND OLD.trust_level = 'locked'
       AND coalesce(bypass_setting, 'off') <> 'on' THEN
        RAISE EXCEPTION 'memory_items row % is locked and cannot be modified', OLD.id;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_scope_chain_initiatives ON initiatives;
CREATE TRIGGER trg_validate_scope_chain_initiatives
BEFORE INSERT OR UPDATE ON initiatives
FOR EACH ROW
EXECUTE FUNCTION validate_scope_chain();

DROP TRIGGER IF EXISTS trg_validate_scope_chain_phases ON phases;
CREATE TRIGGER trg_validate_scope_chain_phases
BEFORE INSERT OR UPDATE ON phases
FOR EACH ROW
EXECUTE FUNCTION validate_scope_chain();

DROP TRIGGER IF EXISTS trg_validate_scope_chain_threads ON threads;
CREATE TRIGGER trg_validate_scope_chain_threads
BEFORE INSERT OR UPDATE ON threads
FOR EACH ROW
EXECUTE FUNCTION validate_scope_chain();

DROP TRIGGER IF EXISTS trg_validate_scope_chain_memory_items ON memory_items;
CREATE TRIGGER trg_validate_scope_chain_memory_items
BEFORE INSERT OR UPDATE ON memory_items
FOR EACH ROW
EXECUTE FUNCTION validate_scope_chain();

DROP TRIGGER IF EXISTS trg_enforce_trust_immutability ON memory_items;
CREATE TRIGGER trg_enforce_trust_immutability
BEFORE UPDATE OR DELETE ON memory_items
FOR EACH ROW
EXECUTE FUNCTION enforce_trust_immutability();

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

CREATE OR REPLACE FUNCTION hybrid_search(
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
    content TEXT,
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

INSERT INTO organizations (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Assaf Yavnai', 'assafyavnai')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO projects (id, org_id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'ShippingAgent', 'shippingagent')
ON CONFLICT (org_id, slug) DO NOTHING;

INSERT INTO initiatives (id, org_id, project_id, name, slug)
VALUES
    ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'CTO Framework', 'cto-framework'),
    ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Phase1 Baseline', 'phase1-baseline')
ON CONFLICT (project_id, slug) DO NOTHING;

INSERT INTO agents (id, name, agent_type, is_active)
VALUES
    ('00000000-0000-0000-0000-000000000101', 'cto', 'coordinator', true),
    ('00000000-0000-0000-0000-000000000102', 'coordinator', 'coordinator', true),
    ('00000000-0000-0000-0000-000000000103', 'implementor', 'implementor', true),
    ('00000000-0000-0000-0000-000000000104', 'qa-agent', 'qa', true),
    ('00000000-0000-0000-0000-000000000105', 'researcher', 'researcher', true)
ON CONFLICT (name) DO NOTHING;
