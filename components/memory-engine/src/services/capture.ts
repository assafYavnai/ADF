import { randomUUID } from "node:crypto";
import { pool, withTransaction } from "../db/connection.js";
import { generateEmbedding, toVectorLiteral } from "../embeddings.js";
import { resolveScope } from "./scope.js";
import { resolveContextPriority, resolveCompressionPolicy, normalizeTags } from "./context-policy.js";
import { withDBFallback } from "./lifecycle.js";
import { logger } from "../logger.js";
import type { CaptureMemoryInput } from "../schemas/memory-item.js";
import type pg from "pg";

interface CaptureResult {
  id: string;
  status: "created" | "duplicate_exact" | "duplicate_semantic" | "enriched";
  message: string;
}

export async function captureMemory(
  input: CaptureMemoryInput
): Promise<CaptureResult> {
  return withDBFallback(() => captureMemoryImpl(input), "capture_memory");
}

async function captureMemoryImpl(
  input: CaptureMemoryInput
): Promise<CaptureResult> {
  const content = normalizeContent(input.content);
  const text = extractText(content);
  const tags = normalizeTags(input.tags);
  const priority = resolveContextPriority(input.content_type, tags);
  const compression = resolveCompressionPolicy(input.content_type, tags);

  let scope = null;
  if (input.scope) {
    scope = await resolveScope(input.scope);
  }

  if (!input.skip_dedup) {
    const exactDup = await findExactDuplicate(text, scope);
    if (exactDup) {
      return {
        id: exactDup,
        status: "duplicate_exact",
        message: "Exact duplicate found — skipped.",
      };
    }

    const semanticDup = await findSemanticDuplicate(text, scope);
    if (semanticDup) {
      return {
        id: semanticDup,
        status: "duplicate_semantic",
        message: "Semantically similar entry found — skipped.",
      };
    }
  }

  const id = randomUUID();

  return withTransaction(async (client: pg.PoolClient) => {
    await client.query(
      `INSERT INTO memory_items
        (id, content, content_type, trust_level, scope_level,
         org_id, project_id, initiative_id, phase_id, thread_id,
         tags, context_priority, compression_policy)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        id,
        JSON.stringify(content),
        input.content_type,
        input.trust_level,
        scope?.scope_level ?? "organization",
        scope?.org_id,
        scope?.project_id,
        scope?.initiative_id,
        scope?.phase_id,
        scope?.thread_id,
        tags,
        priority,
        compression,
      ]
    );

    try {
      const embedding = await generateEmbedding(text);
      await client.query(
        `INSERT INTO memory_embeddings (id, memory_item_id, model, version, embedding, is_active)
         VALUES ($1, $2, $3, $4, $5::vector, TRUE)`,
        [randomUUID(), id, "nomic-embed-text", "1", toVectorLiteral(embedding)]
      );
    } catch (err) {
      logger.warn("Embedding generation failed, item saved without embedding:", err);
    }

    return { id, status: "created" as const, message: "Memory captured." };
  });
}

function normalizeContent(
  content: string | Record<string, unknown>
): Record<string, unknown> {
  if (typeof content === "string") {
    return { text: content };
  }
  return content;
}

function extractText(content: Record<string, unknown>): string {
  if (typeof content.search_text === "string") return content.search_text;
  if (typeof content.text === "string") return content.text;
  return JSON.stringify(content);
}

async function findExactDuplicate(
  text: string,
  scope: Awaited<ReturnType<typeof resolveScope>> | null
): Promise<string | null> {
  const content = JSON.stringify({ text });
  let query = `SELECT id FROM memory_items WHERE content = $1::jsonb`;
  const params: (string | null)[] = [content];

  if (scope?.org_id) {
    query += ` AND org_id = $${params.length + 1}`;
    params.push(scope.org_id);
  }

  query += " LIMIT 1";
  const { rows } = await pool.query(query, params);
  return rows[0]?.id ?? null;
}

async function findSemanticDuplicate(
  text: string,
  scope: Awaited<ReturnType<typeof resolveScope>> | null
): Promise<string | null> {
  if (text.length < 120) return null;

  try {
    const embedding = await generateEmbedding(text);
    const vecLiteral = toVectorLiteral(embedding);

    let query = `
      SELECT m.id, 1 - (e.embedding <=> $1::vector) AS similarity
      FROM memory_embeddings e
      JOIN memory_items m ON m.id = e.memory_item_id
      WHERE e.is_active = TRUE`;
    const params: string[] = [vecLiteral];

    if (scope?.org_id) {
      query += ` AND m.org_id = $${params.length + 1}`;
      params.push(scope.org_id);
    }

    query += ` ORDER BY e.embedding <=> $1::vector LIMIT 1`;
    const { rows } = await pool.query(query, params);

    if (rows[0] && rows[0].similarity >= 0.985) {
      return rows[0].id;
    }
  } catch {
    logger.warn("Semantic dedup check failed — skipping.");
  }

  return null;
}
