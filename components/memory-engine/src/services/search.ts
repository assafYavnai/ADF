import { pool } from "../db/connection.js";
import { generateEmbedding, toVectorLiteral } from "../embeddings.js";
import { resolveScope, type ResolvedScope } from "./scope.js";
import { withDBFallback } from "./lifecycle.js";
import { logger } from "../logger.js";
import type { ContentType, SearchMemoryInput, TrustLevel } from "../schemas/memory-item.js";
import { modernMemoryEvidenceClause } from "../evidence-policy.js";

const MIN_SEMANTIC_SIMILARITY = 0.25;
const CONTENT_TYPE_BONUS = 0.15;

const QUERY_TYPE_HINTS: Array<{ match: RegExp; contentType: ContentType }> = [
  { match: /\bdecision(s)?\b|\bdecide(d|s)?\b/i, contentType: "decision" },
  { match: /\bopen loop(s)?\b|\bfollow[- ]?up(s)?\b|\btodo(s)?\b/i, contentType: "open_loop" },
  { match: /\brule(s)?\b|\bpolicy\b/i, contentType: "rule" },
  { match: /\brequirement(s)?\b|\bspec(s)?\b/i, contentType: "requirement" },
  { match: /\bsetting(s)?\b|\bconfig(uration)?\b/i, contentType: "setting" },
  { match: /\bfinding(s)?\b|\bissue(s)?\b/i, contentType: "finding" },
  { match: /\brole(s)?\b/i, contentType: "role" },
];

export interface SearchResult {
  id: string;
  content: Record<string, unknown>;
  content_type: string;
  trust_level: string;
  tags: string[];
  context_priority: string;
  score: number;
  created_at: string;
  preview: string;
}

export async function searchMemory(
  input: SearchMemoryInput
): Promise<SearchResult[]> {
  return withDBFallback(() => searchMemoryImpl(input), "search_memory");
}

async function searchMemoryImpl(
  input: SearchMemoryInput
): Promise<SearchResult[]> {
  const query = input.query.trim();
  if (!query) {
    return [];
  }

  const scope = await resolveScope(input.scope);
  const normalizedInput = {
    ...input,
    query,
    content_types: normalizeRequestedContentTypes(input),
    trust_levels: normalizeRequestedTrustLevels(input),
  };

  let embedding: number[] | null = null;
  if (normalizedInput.semantic_weight > 0) {
    try {
      embedding = await generateEmbedding(query);
    } catch {
      logger.warn("Embedding generation failed - falling back to keyword search.");
    }
  }

  if (embedding) {
    return hybridSearch(normalizedInput, embedding, scope);
  }
  return keywordSearch(normalizedInput, scope);
}

async function hybridSearch(
  input: SearchMemoryInput & { content_types?: ContentType[]; trust_levels?: TrustLevel[] },
  embedding: number[],
  scope: ResolvedScope
): Promise<SearchResult[]> {
  const vecLiteral = toVectorLiteral(embedding);
  const params: unknown[] = [input.semantic_weight, vecLiteral, input.query];
  const preferredContentTypes = inferPreferredContentTypes(input);
  const rankedConditions = buildRankedConditions(scope, input, params, "m", "d");

  let contentTypeBonusSql = "0";
  if (preferredContentTypes.length > 0) {
    params.push(preferredContentTypes);
    contentTypeBonusSql = `CASE WHEN m.content_type = ANY($${params.length}::text[]) THEN ${CONTENT_TYPE_BONUS} ELSE 0 END`;
  }

  params.push(MIN_SEMANTIC_SIMILARITY);
  const semanticThresholdParam = params.length;
  params.push(input.max_results);
  const limitParam = params.length;

  const sql = `
    WITH ranked AS (
      SELECT
        m.id,
        m.content,
        m.content_type,
        m.trust_level,
        m.tags,
        m.context_priority,
        m.created_at,
        COALESCE(GREATEST(0, 1 - (e.embedding <=> $2::vector)), 0) AS semantic_similarity,
        ts_rank_cd(
          to_tsvector('english', COALESCE(m.content->>'search_text', m.content->>'text', '')),
          plainto_tsquery('english', $3)
        ) AS keyword_similarity,
        ${contentTypeBonusSql} AS content_type_bonus
      FROM memory_items m
      LEFT JOIN decisions d ON d.memory_item_id = m.id
      LEFT JOIN memory_embeddings e ON e.memory_item_id = m.id AND e.is_active = TRUE
      WHERE ${rankedConditions.join(" AND ")}
    )
    SELECT
      id,
      content,
      content_type,
      trust_level,
      tags,
      context_priority,
      created_at,
      (
        $1::float * COALESCE(semantic_similarity, 0) +
        (1 - $1::float) * COALESCE(keyword_similarity, 0) +
        content_type_bonus
      ) AS score
    FROM ranked
    WHERE semantic_similarity >= $${semanticThresholdParam}
       OR keyword_similarity > 0
    ORDER BY score DESC, created_at DESC
    LIMIT $${limitParam}
  `;

  const { rows } = await pool.query(sql, params);
  return rows.map(formatResult);
}

async function keywordSearch(
  input: SearchMemoryInput & { content_types?: ContentType[]; trust_levels?: TrustLevel[] },
  scope: ResolvedScope
): Promise<SearchResult[]> {
  const params: unknown[] = [input.query];
  const preferredContentTypes = inferPreferredContentTypes(input);
  const conditions = buildRankedConditions(scope, input, params, "m", "d");

  let contentTypeBonusSql = "0";
  if (preferredContentTypes.length > 0) {
    params.push(preferredContentTypes);
    contentTypeBonusSql = `CASE WHEN m.content_type = ANY($${params.length}::text[]) THEN ${CONTENT_TYPE_BONUS} ELSE 0 END`;
  }

  params.push(input.max_results);
  const limitParam = params.length;

  const query = `
    SELECT
      m.id,
      m.content,
      m.content_type,
      m.trust_level,
      m.tags,
      m.context_priority,
      m.created_at,
      (
        ts_rank_cd(
          to_tsvector('english', COALESCE(m.content->>'search_text', m.content->>'text', '')),
          plainto_tsquery('english', $1)
        ) + ${contentTypeBonusSql}
      ) AS score
    FROM memory_items m
    LEFT JOIN decisions d ON d.memory_item_id = m.id
    WHERE ${conditions.join(" AND ")}
      AND to_tsvector('english', COALESCE(m.content->>'search_text', m.content->>'text', '')) @@ plainto_tsquery('english', $1)
    ORDER BY score DESC, created_at DESC
    LIMIT $${limitParam}
  `;

  const { rows } = await pool.query(query, params);
  return rows.map(formatResult);
}

function buildRankedConditions(
  scope: ResolvedScope,
  input: SearchMemoryInput & { content_types?: ContentType[]; trust_levels?: TrustLevel[] },
  params: unknown[],
  memoryAlias: string,
  decisionAlias: string
): string[] {
  const conditions = buildScopeConditions(scope, memoryAlias, params);
  appendSearchFilters(input, memoryAlias, conditions, params);
  if (!input.include_legacy) {
    conditions.push(modernMemoryEvidenceClause(memoryAlias, decisionAlias));
  }
  return conditions;
}

function buildScopeConditions(
  scope: ResolvedScope,
  prefix: string,
  params: unknown[]
): string[] {
  const conditions: string[] = [];

  if (scope.org_id) {
    params.push(scope.org_id);
    conditions.push(`${prefix}.org_id = $${params.length}`);
  }
  if (scope.project_id) {
    params.push(scope.project_id);
    conditions.push(`${prefix}.project_id = $${params.length}`);
  }
  if (scope.initiative_id) {
    params.push(scope.initiative_id);
    conditions.push(`${prefix}.initiative_id = $${params.length}`);
  }
  if (scope.phase_id) {
    params.push(scope.phase_id);
    conditions.push(`${prefix}.phase_id = $${params.length}`);
  }
  if (scope.thread_id) {
    params.push(scope.thread_id);
    conditions.push(`${prefix}.thread_id = $${params.length}`);
  }

  return conditions;
}

function appendSearchFilters(
  input: SearchMemoryInput & { content_types?: ContentType[]; trust_levels?: TrustLevel[] },
  prefix: string,
  conditions: string[],
  params: unknown[]
): void {
  if (input.content_types && input.content_types.length > 0) {
    params.push(input.content_types);
    conditions.push(`${prefix}.content_type = ANY($${params.length}::text[])`);
  }

  if (input.trust_levels && input.trust_levels.length > 0) {
    params.push(input.trust_levels);
    conditions.push(`${prefix}.trust_level = ANY($${params.length}::text[])`);
  }
}

function normalizeRequestedContentTypes(input: SearchMemoryInput): ContentType[] | undefined {
  const requested = [
    ...(input.content_types ?? []),
    ...(input.content_type ? [input.content_type] : []),
  ];

  if (requested.length === 0) {
    return undefined;
  }

  return Array.from(new Set(requested));
}

function normalizeRequestedTrustLevels(input: SearchMemoryInput): TrustLevel[] | undefined {
  if (!input.trust_levels || input.trust_levels.length === 0) {
    return undefined;
  }

  return Array.from(new Set(input.trust_levels));
}

function inferPreferredContentTypes(
  input: SearchMemoryInput & { content_types?: ContentType[] }
): ContentType[] {
  if (input.content_types && input.content_types.length > 0) {
    return input.content_types;
  }

  const inferred = QUERY_TYPE_HINTS
    .filter((hint) => hint.match.test(input.query))
    .map((hint) => hint.contentType);

  return Array.from(new Set(inferred));
}

function formatResult(row: Record<string, unknown>): SearchResult {
  const content = row.content as Record<string, unknown>;
  const text =
    (content.search_text as string) ?? (content.text as string) ?? JSON.stringify(content);

  return {
    id: row.id as string,
    content,
    content_type: row.content_type as string,
    trust_level: row.trust_level as string,
    tags: row.tags as string[],
    context_priority: row.context_priority as string,
    score: parseFloat(String(row.score ?? 0)),
    created_at: row.created_at as string,
    preview: text.length > 500 ? text.slice(0, 500) + "..." : text,
  };
}
