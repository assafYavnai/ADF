import { randomUUID } from "node:crypto";
import { withTransaction } from "../db/connection.js";
import { generateEmbedding, toVectorLiteral } from "../embeddings.js";
import { resolveScope } from "../services/scope.js";
import { normalizeTags, resolveContextPriority, resolveCompressionPolicy } from "../services/context-policy.js";
import { LogDecisionInput } from "../schemas/decision.js";
import type { Provenance } from "../provenance.js";
import { logger } from "../logger.js";
import type pg from "pg";

export async function logDecision(
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const input = LogDecisionInput.parse(args);
  const prov = input.provenance;
  const contentProv = input.content_provenance ?? prov;
  const derivationMode = input.content_provenance ? "llm_extracted" : "direct_input";
  const tags = normalizeTags([...input.tags, "decision"]);
  const priority = resolveContextPriority("decision", tags);
  const compression = resolveCompressionPolicy("decision", tags);
  const scope = await resolveScope(input.scope);

  const memoryId = randomUUID();
  const decisionId = randomUUID();
  const content = {
    text: `${input.title}: ${input.reasoning}`,
    search_text: `${input.title} ${input.reasoning}`,
  };

  const result = await withTransaction(async (client: pg.PoolClient) => {
    const decidedById = await resolveDecidedByAgentId(client, input.decided_by);

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
        scope.scope_level,
        scope.org_id, scope.project_id, scope.initiative_id,
        scope.phase_id, scope.thread_id,
        tags, priority, compression,
        prov.invocation_id, prov.provider, prov.model,
        prov.reasoning, prov.was_fallback, prov.source_path,
      ]
    );

    await client.query(
      `INSERT INTO decisions
        (id, memory_item_id, title, reasoning, provenance_reasoning, derivation_mode,
         content_invocation_id, content_provider, content_model, content_reasoning,
         content_was_fallback, content_source_path,
         alternatives_considered, decided_by, status,
         invocation_id, provider, model, was_fallback, source_path, reasoning_state)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'active', $15, $16, $17, $18, $19, 'current')`,
      [
        decisionId, memoryId, input.title, input.reasoning, prov.reasoning, derivationMode,
        contentProv.invocation_id, contentProv.provider, contentProv.model, contentProv.reasoning,
        contentProv.was_fallback, contentProv.source_path,
        JSON.stringify(input.alternatives_considered), decidedById,
        prov.invocation_id, prov.provider, prov.model, prov.was_fallback, prov.source_path,
      ]
    );

    try {
      const embedding = await generateEmbedding(content.search_text);
      await client.query(
        `INSERT INTO memory_embeddings (id, memory_item_id, model, version, embedding, is_active,
           invocation_id, provider, model_name, reasoning, was_fallback, source_path)
         VALUES ($1, $2, $3, $4, $5::vector, TRUE, $6, $7, $8, $9, $10, $11)`,
        [randomUUID(), memoryId, "nomic-embed-text", "1", toVectorLiteral(embedding),
         prov.invocation_id, prov.provider, prov.model, prov.reasoning, prov.was_fallback, prov.source_path]
      );
    } catch (err) {
      logger.warn("Decision embedding failed:", err);
    }

    return {
      memory_id: memoryId,
      decision_id: decisionId,
      derivation_mode: derivationMode,
      content_invocation_id: contentProv.invocation_id,
      write_invocation_id: prov.invocation_id,
    };
  });

  return {
    content: [{ type: "text", text: JSON.stringify({ status: "created", ...result }, null, 2) }],
  };
}

async function resolveDecidedByAgentId(
  client: pg.PoolClient,
  decidedBy: string | undefined
): Promise<string | null> {
  const label = decidedBy?.trim();
  if (!label) {
    return null;
  }

  const uuidMatch = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(label);
  if (uuidMatch) {
    const { rows } = await client.query("SELECT id FROM agents WHERE id = $1 LIMIT 1", [label]);
    if (rows[0]?.id) {
      return rows[0].id as string;
    }
  }

  const { rows: existing } = await client.query(
    "SELECT id FROM agents WHERE lower(name) = lower($1) LIMIT 1",
    [label]
  );
  if (existing[0]?.id) {
    return existing[0].id as string;
  }

  const agentId = uuidMatch ? label : randomUUID();
  const { rows } = await client.query(
    `INSERT INTO agents (id, name, agent_type, is_active)
     VALUES ($1, $2, 'human', TRUE)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [agentId, label]
  );

  return (rows[0]?.id as string) ?? agentId;
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
        decided_by: { type: "string", description: "Optional decision owner label or UUID" },
        provenance: { type: "object", description: "Provenance object from caller" },
        content_provenance: {
          type: "object",
          description: "Optional provenance for the source that produced the structured decision content, such as an LLM extractor invocation",
        },
      },
      required: ["title", "reasoning", "scope", "provenance"],
    },
  },
];
