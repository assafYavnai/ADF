import { pool } from "../db/connection.js";
import { resolveScope, scopeFilterSQL } from "./scope.js";
import { modernMemoryEvidenceClause } from "../evidence-policy.js";

export interface ContextSummary {
  items: ContextItem[];
  total: number;
  scope: string | null;
}

export interface ContextItem {
  id: string;
  content_type: string;
  trust_level: string;
  context_priority: string;
  preview: string;
  tags: string[];
  created_at: string;
}

export async function getContextSummary(
  scope: string,
  contentType?: string,
  limit: number = 50,
  includeLegacy: boolean = false
): Promise<ContextSummary> {
  const resolved = await resolveScope(scope);
  const scopeFilter = scopeFilterSQL(resolved);

  let query = `
    SELECT
      m.id,
      m.content,
      m.content_type,
      m.trust_level,
      m.context_priority,
      m.tags,
      m.created_at
    FROM memory_items m
    LEFT JOIN decisions d ON d.memory_item_id = m.id
    WHERE ${scopeFilter.clause}
  `;
  const params: (string | number)[] = [...scopeFilter.params];

  if (contentType) {
    query += ` AND m.content_type = $${params.length + 1}`;
    params.push(contentType);
  }
  if (!includeLegacy) {
    query += ` AND ${modernMemoryEvidenceClause("m", "d")}`;
  }

  query += ` ORDER BY
    CASE m.context_priority
      WHEN 'p0' THEN 0
      WHEN 'p1' THEN 1
      WHEN 'p2' THEN 2
      WHEN 'p3' THEN 3
    END ASC,
    m.created_at DESC
  LIMIT $${params.length + 1}`;
  params.push(limit);

  const { rows } = await pool.query(query, params);

  return {
    items: rows.map((row) => {
      const content = row.content as Record<string, unknown>;
      const text =
        (content.search_text as string) ??
        (content.text as string) ??
        JSON.stringify(content);

      return {
        id: row.id,
        content_type: row.content_type,
        trust_level: row.trust_level,
        context_priority: row.context_priority,
        preview: text.length > 300 ? text.slice(0, 300) + "..." : text,
        tags: row.tags,
        created_at: row.created_at,
      };
    }),
    total: rows.length,
    scope: scope ?? null,
  };
}

export async function listRecent(
  scope: string,
  contentType?: string,
  limit: number = 20,
  offset: number = 0,
  includeLegacy: boolean = false
): Promise<{ items: ContextItem[]; total: number; has_more: boolean }> {
  const resolved = await resolveScope(scope);
  const scopeFilter = scopeFilterSQL(resolved);

  let countQuery = `SELECT COUNT(*) FROM memory_items m LEFT JOIN decisions d ON d.memory_item_id = m.id WHERE ${scopeFilter.clause}`;
  const countParams = [...scopeFilter.params];

  if (contentType) {
    countQuery += ` AND m.content_type = $${countParams.length + 1}`;
    countParams.push(contentType);
  }
  if (!includeLegacy) {
    countQuery += ` AND ${modernMemoryEvidenceClause("m", "d")}`;
  }

  const { rows: countRows } = await pool.query(countQuery, countParams);
  const total = parseInt(countRows[0].count, 10);

  let query = `
    SELECT m.id, m.content, m.content_type, m.trust_level,
           m.context_priority, m.tags, m.created_at
    FROM memory_items m
    LEFT JOIN decisions d ON d.memory_item_id = m.id
    WHERE ${scopeFilter.clause}
  `;
  const params: (string | number)[] = [...scopeFilter.params];

  if (contentType) {
    query += ` AND m.content_type = $${params.length + 1}`;
    params.push(contentType);
  }
  if (!includeLegacy) {
    query += ` AND ${modernMemoryEvidenceClause("m", "d")}`;
  }

  query += ` ORDER BY m.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const { rows } = await pool.query(query, params);

  return {
    items: rows.map((row) => {
      const content = row.content as Record<string, unknown>;
      const text =
        (content.search_text as string) ??
        (content.text as string) ??
        JSON.stringify(content);
      return {
        id: row.id,
        content_type: row.content_type,
        trust_level: row.trust_level,
        context_priority: row.context_priority,
        preview: text.length > 500 ? text.slice(0, 500) + "..." : text,
        tags: row.tags,
        created_at: row.created_at,
      };
    }),
    total,
    has_more: offset + limit < total,
  };
}
