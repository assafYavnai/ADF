import { pool } from "../db/connection.js";
import { generateEmbedding, toVectorLiteral } from "../embeddings.js";
import { resolveScope, scopeFilterSQL } from "./scope.js";
import { withDBFallback } from "./lifecycle.js";
import { logger } from "../logger.js";
import type { SearchMemoryInput } from "../schemas/memory-item.js";

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
  let scope = null;
  if (input.scope) {
    scope = await resolveScope(input.scope);
  }

  let embedding: number[] | null = null;
  if (input.semantic_weight > 0) {
    try {
      embedding = await generateEmbedding(input.query);
    } catch {
      logger.warn("Embedding generation failed — falling back to keyword search.");
    }
  }

  if (embedding) {
    return hybridSearch(input, embedding, scope);
  }
  return keywordSearch(input, scope);
}

async function hybridSearch(
  input: SearchMemoryInput,
  embedding: number[],
  scope: Awaited<ReturnType<typeof resolveScope>> | null
): Promise<SearchResult[]> {
  const vecLiteral = toVectorLiteral(embedding);
  const scopeFilter = scope ? scopeFilterSQL(scope) : { clause: "TRUE", params: [] };

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
        $1::float * (1 - (e.embedding <=> $2::vector)) +
        (1 - $1::float) * ts_rank_cd(
          to_tsvector('english', COALESCE(m.content->>'search_text', m.content->>'text', '')),
          plainto_tsquery('english', $3)
        )
      ) AS score
    FROM memory_items m
    LEFT JOIN memory_embeddings e ON e.memory_item_id = m.id AND e.is_active = TRUE
    WHERE ${scopeFilter.clause.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + 3}`)}
    ORDER BY score DESC
    LIMIT $${scopeFilter.params.length + 4}
  `;

  const params = [
    input.semantic_weight,
    vecLiteral,
    input.query,
    ...scopeFilter.params,
    input.max_results,
  ];

  if (input.content_type) {
    // Inject content_type filter into the WHERE clause
    const ctParam = params.length + 1;
    const modifiedQuery = query.replace(
      `WHERE ${scopeFilter.clause.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + 3}`)}`,
      `WHERE ${scopeFilter.clause.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + 3}`)} AND m.content_type = $${ctParam}`
    );
    params.push(input.content_type);
    const { rows } = await pool.query(modifiedQuery, params);
    return rows.map(formatResult);
  }

  const { rows } = await pool.query(query, params);
  return rows.map(formatResult);
}

async function keywordSearch(
  input: SearchMemoryInput,
  scope: Awaited<ReturnType<typeof resolveScope>> | null
): Promise<SearchResult[]> {
  const scopeFilter = scope ? scopeFilterSQL(scope) : { clause: "TRUE", params: [] };

  let query = `
    SELECT
      m.id,
      m.content,
      m.content_type,
      m.trust_level,
      m.tags,
      m.context_priority,
      m.created_at,
      ts_rank_cd(
        to_tsvector('english', COALESCE(m.content->>'search_text', m.content->>'text', '')),
        plainto_tsquery('english', $1)
      ) AS score
    FROM memory_items m
    WHERE ${scopeFilter.clause.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + 1}`)}
  `;
  const params: (string | number)[] = [input.query, ...scopeFilter.params];

  if (input.content_type) {
    query += ` AND m.content_type = $${params.length + 1}`;
    params.push(input.content_type);
  }

  query += ` ORDER BY score DESC LIMIT $${params.length + 1}`;
  params.push(input.max_results);

  const { rows } = await pool.query(query, params);
  return rows.map(formatResult);
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
