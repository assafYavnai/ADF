import { randomUUID } from "node:crypto";
import { pool, withTransaction } from "../db/connection.js";
import { generateEmbedding, toVectorLiteral } from "../embeddings.js";
import { resolveScope } from "../services/scope.js";
import { normalizeTags, resolveContextPriority, resolveCompressionPolicy } from "../services/context-policy.js";
import { LogDecisionInput } from "../schemas/decision.js";
import { LEGACY_PROVENANCE, type Provenance } from "../provenance.js";
import { logger } from "../logger.js";
import type pg from "pg";

function extractProvenance(args: Record<string, unknown>): Provenance {
  const p = args.provenance as Record<string, unknown> | undefined;
  if (!p) return { ...LEGACY_PROVENANCE, source_path: "memory-engine/decision/log" };
  return {
    invocation_id: (p.invocation_id as string) ?? LEGACY_PROVENANCE.invocation_id,
    provider: (p.provider as Provenance["provider"]) ?? "system",
    model: (p.model as string) ?? "none",
    reasoning: (p.reasoning as string) ?? "none",
    was_fallback: (p.was_fallback as boolean) ?? false,
    source_path: (p.source_path as string) ?? "memory-engine/decision/log",
    timestamp: (p.timestamp as string) ?? new Date().toISOString(),
  };
}

export async function logDecision(
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const input = LogDecisionInput.parse(args);
  const prov = extractProvenance(args);
  const tags = normalizeTags([...input.tags, "decision"]);
  const priority = resolveContextPriority("decision", tags);
  const compression = resolveCompressionPolicy("decision", tags);

  let scope = null;
  if (input.scope) {
    scope = await resolveScope(input.scope);
  }

  const memoryId = randomUUID();
  const decisionId = randomUUID();
  const content = {
    text: `${input.title}: ${input.reasoning}`,
    search_text: `${input.title} ${input.reasoning}`,
  };

  const result = await withTransaction(async (client: pg.PoolClient) => {
    await client.query(
      `INSERT INTO memory_items
        (id, content, content_type, trust_level, scope_level,
         org_id, project_id, initiative_id, phase_id, thread_id,
         tags, context_priority, compression_policy,
         invocation_id, provider, model, reasoning, was_fallback, source_path)
       VALUES ($1, $2, 'decision', 'working', $3, $4, $5, $6, $7, $8, $9, $10, $11,
               $12, $13, $14, $15, $16, $17)`,
      [
        memoryId, JSON.stringify(content),
        scope?.scope_level ?? "organization",
        scope?.org_id, scope?.project_id, scope?.initiative_id,
        scope?.phase_id, scope?.thread_id,
        tags, priority, compression,
        prov.invocation_id, prov.provider, prov.model,
        prov.reasoning, prov.was_fallback, prov.source_path,
      ]
    );

    await client.query(
      `INSERT INTO decisions
        (id, memory_item_id, title, reasoning, alternatives_considered, decided_by, status,
         invocation_id, provider, model, source_path)
       VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8, $9, $10)`,
      [
        decisionId, memoryId, input.title, input.reasoning,
        JSON.stringify(input.alternatives_considered), input.decided_by,
        prov.invocation_id, prov.provider, prov.model, prov.source_path,
      ]
    );

    try {
      const embedding = await generateEmbedding(content.search_text);
      await client.query(
        `INSERT INTO memory_embeddings (id, memory_item_id, model, version, embedding, is_active,
           invocation_id, source_path)
         VALUES ($1, $2, $3, $4, $5::vector, TRUE, $6, $7)`,
        [randomUUID(), memoryId, "nomic-embed-text", "1", toVectorLiteral(embedding),
         prov.invocation_id, prov.source_path]
      );
    } catch (err) {
      logger.warn("Decision embedding failed:", err);
    }

    return { memory_id: memoryId, decision_id: decisionId };
  });

  return {
    content: [{ type: "text", text: JSON.stringify({ status: "created", ...result }, null, 2) }],
  };
}

export const DECISION_TOOL_DEFINITIONS = [
  {
    name: "log_decision",
    description: "Log a structured decision with reasoning and alternatives considered",
    inputSchema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Decision title" },
        reasoning: { type: "string", description: "Why this decision was made" },
        alternatives_considered: {
          type: "array",
          items: {
            type: "object",
            properties: {
              option: { type: "string" },
              pros: { type: "array", items: { type: "string" } },
              cons: { type: "array", items: { type: "string" } },
              rejected_reason: { type: "string" },
            },
            required: ["option"],
          },
          default: [],
        },
        scope: { type: "string" },
        tags: { type: "array", items: { type: "string" }, default: [] },
        decided_by: { type: "string", default: "ceo" },
        provenance: { type: "object", description: "Provenance object from caller" },
      },
      required: ["title", "reasoning"],
    },
  },
];
