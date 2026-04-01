import { z } from "zod";
import { pool } from "../db/connection.js";
import { ProvenanceSchema } from "../provenance.js";

interface NormalizedMetricEvent {
  provenance: {
    invocation_id: string;
    provider: string;
    model: string;
    reasoning: string;
    was_fallback: boolean;
    source_path: string;
    timestamp?: string;
  };
  category: string;
  operation: string;
  latency_ms: number;
  success: boolean;
  tokens_in?: number | null;
  tokens_out?: number | null;
  estimated_cost_usd?: number | null;
  metadata?: Record<string, unknown>;
}

const TelemetryCategorySchema = z.enum(["llm", "memory", "tool", "turn", "system"]);

const TelemetryMetricInputSchema = z.object({
  provenance: ProvenanceSchema,
  category: TelemetryCategorySchema,
  operation: z.string(),
  latency_ms: z.number(),
  success: z.boolean(),
  tokens_in: z.number().nullable().optional(),
  tokens_out: z.number().nullable().optional(),
  estimated_cost_usd: z.number().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const TelemetryMetricsBatchInputSchema = z.object({
  events: z.array(TelemetryMetricInputSchema).min(1),
});

type TelemetryMetricInput = z.infer<typeof TelemetryMetricInputSchema>;

export async function handleEmitMetric(
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const event = normalizeMetricEvent(TelemetryMetricInputSchema.parse(args));
  await insertMetricEvents(pool, [event]);
  return { content: [{ type: "text", text: "ok" }] };
}

export async function handleEmitMetricsBatch(
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const batch = TelemetryMetricsBatchInputSchema.parse(args);
  const events = batch.events.map((event) => normalizeMetricEvent(event));

  await insertMetricEvents(pool, events);
  return { content: [{ type: "text", text: "ok" }] };
}

export async function handleQueryMetrics(
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (args.category) {
    conditions.push(`category = $${idx++}`);
    params.push(args.category);
  }
  if (args.source_path) {
    conditions.push(`source_path LIKE $${idx++}`);
    params.push(`${args.source_path}%`);
  }
  if (args.provider) {
    conditions.push(`provider = $${idx++}`);
    params.push(args.provider);
  }
  if (args.model) {
    conditions.push(`model = $${idx++}`);
    params.push(args.model);
  }
  if (args.since) {
    conditions.push(`created_at >= $${idx++}`);
    params.push(args.since);
  }
  if (args.until) {
    conditions.push(`created_at <= $${idx++}`);
    params.push(args.until);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = Math.min(Number(args.limit) || 100, 1000);
  params.push(limit);

  const { rows } = await pool.query(
    `SELECT * FROM telemetry ${where} ORDER BY created_at DESC LIMIT $${idx}`,
    params
  );

  return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
}

export async function handleGetCostSummary(
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const since = (args.since as string) ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const until = (args.until as string) ?? new Date().toISOString();

  const { rows } = await pool.query(
    `SELECT
       provider,
       model,
       source_path,
       COUNT(*) as call_count,
       SUM(tokens_in) as total_tokens_in,
       SUM(tokens_out) as total_tokens_out,
       SUM(estimated_cost_usd) as total_cost_usd,
       AVG(latency_ms)::int as avg_latency_ms,
       SUM(CASE WHEN was_fallback THEN 1 ELSE 0 END) as fallback_count,
       SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failure_count
     FROM telemetry
     WHERE created_at >= $1 AND created_at <= $2
     GROUP BY provider, model, source_path
     ORDER BY total_cost_usd DESC NULLS LAST`,
    [since, until]
  );

  const totals = await pool.query(
    `SELECT
       COUNT(*) as total_calls,
       SUM(tokens_in) as total_tokens_in,
       SUM(tokens_out) as total_tokens_out,
       SUM(estimated_cost_usd) as total_cost_usd,
       AVG(latency_ms)::int as avg_latency_ms
     FROM telemetry
     WHERE created_at >= $1 AND created_at <= $2`,
    [since, until]
  );

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ period: { since, until }, breakdown: rows, totals: totals.rows[0] }, null, 2),
      },
    ],
  };
}

export async function insertMetricEvents(
  db: { query: (text: string, params: unknown[]) => Promise<unknown> },
  events: NormalizedMetricEvent[]
): Promise<void> {
  if (events.length === 0) return;

  const values: unknown[] = [];
  const placeholders: string[] = [];
  let idx = 1;

  for (const event of events) {
    placeholders.push(
      `(gen_random_uuid(), $${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5}, $${idx + 6}, $${idx + 7}, $${idx + 8}, $${idx + 9}, $${idx + 10}, $${idx + 11}, $${idx + 12}, $${idx + 13}, $${idx + 14})`
    );
    values.push(
      event.provenance.invocation_id,
      event.provenance.provider,
      event.provenance.model,
      event.provenance.reasoning,
      event.provenance.was_fallback,
      event.provenance.source_path,
      event.category,
      event.operation,
      event.latency_ms,
      event.success,
      event.tokens_in ?? null,
      event.tokens_out ?? null,
      event.estimated_cost_usd ?? null,
      JSON.stringify(event.metadata ?? {}),
      event.provenance.timestamp ?? new Date().toISOString(),
    );
    idx += 15;
  }

  await db.query(
    `INSERT INTO telemetry
      (id, invocation_id, provider, model, reasoning, was_fallback,
       source_path, category, operation, latency_ms, success,
       tokens_in, tokens_out, estimated_cost_usd, metadata, created_at)
     VALUES ${placeholders.join(", ")}`,
    values
  );
}

function normalizeMetricEvent(args: TelemetryMetricInput): NormalizedMetricEvent {
  return {
    provenance: {
      invocation_id: args.provenance.invocation_id,
      provider: args.provenance.provider,
      model: args.provenance.model,
      reasoning: args.provenance.reasoning,
      was_fallback: args.provenance.was_fallback,
      source_path: args.provenance.source_path,
      timestamp: args.provenance.timestamp,
    },
    category: args.category,
    operation: args.operation,
    latency_ms: args.latency_ms,
    success: args.success,
    tokens_in: toOptionalNumber(args.tokens_in),
    tokens_out: toOptionalNumber(args.tokens_out),
    estimated_cost_usd: toOptionalNumber(args.estimated_cost_usd),
    metadata: args.metadata ?? {},
  };
}

function toOptionalNumber(value: unknown): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export const TELEMETRY_TOOL_DEFINITIONS = [
  {
    name: "emit_metric",
    description: "Fire-and-forget: record a telemetry metric event",
    inputSchema: {
      type: "object" as const,
      properties: {
        provenance: {
          type: "object",
          description: "Full provenance object from caller",
          properties: {
            invocation_id: { type: "string", format: "uuid" },
            provider: { type: "string", enum: ["codex", "claude", "gemini", "openai", "system"] },
            model: { type: "string" },
            reasoning: { type: "string" },
            was_fallback: { type: "boolean" },
            source_path: { type: "string" },
            timestamp: { type: "string" },
          },
          required: ["invocation_id", "provider", "model", "reasoning", "was_fallback", "source_path", "timestamp"],
        },
        category: { type: "string", enum: ["llm", "memory", "tool", "turn", "system"] },
        operation: { type: "string" },
        latency_ms: { type: "number" },
        success: { type: "boolean" },
        tokens_in: { type: "number" },
        tokens_out: { type: "number" },
        estimated_cost_usd: { type: "number" },
        metadata: { type: "object" },
      },
      required: ["provenance", "category", "operation", "latency_ms", "success"],
    },
  },
  {
    name: "emit_metrics_batch",
    description: "Record a batch of telemetry metric events atomically",
    inputSchema: {
      type: "object" as const,
      properties: {
        events: {
          type: "array",
          items: {
            type: "object",
            properties: {
              provenance: {
                type: "object",
                properties: {
                  invocation_id: { type: "string", format: "uuid" },
                  provider: { type: "string", enum: ["codex", "claude", "gemini", "openai", "system"] },
                  model: { type: "string" },
                  reasoning: { type: "string" },
                  was_fallback: { type: "boolean" },
                  source_path: { type: "string" },
                  timestamp: { type: "string" },
                },
                required: ["invocation_id", "provider", "model", "reasoning", "was_fallback", "source_path", "timestamp"],
              },
              category: { type: "string", enum: ["llm", "memory", "tool", "turn", "system"] },
              operation: { type: "string" },
              latency_ms: { type: "number" },
              success: { type: "boolean" },
              tokens_in: { type: "number" },
              tokens_out: { type: "number" },
              estimated_cost_usd: { type: "number" },
              metadata: { type: "object" },
            },
            required: ["provenance", "category", "operation", "latency_ms", "success"],
          },
          minItems: 1,
        },
      },
      required: ["events"],
    },
  },
  {
    name: "query_metrics",
    description: "Query telemetry metrics with filters",
    inputSchema: {
      type: "object" as const,
      properties: {
        category: { type: "string" },
        source_path: { type: "string" },
        provider: { type: "string" },
        model: { type: "string" },
        since: { type: "string" },
        until: { type: "string" },
        limit: { type: "number", default: 100 },
        provenance: { type: "object", description: "Provenance object from caller" },
      },
    },
  },
  {
    name: "get_cost_summary",
    description: "Get aggregated cost summary by provider/model/source for a time period",
    inputSchema: {
      type: "object" as const,
      properties: {
        since: { type: "string", description: "ISO 8601 start (default: 24h ago)" },
        until: { type: "string", description: "ISO 8601 end (default: now)" },
        provenance: { type: "object", description: "Provenance object from caller" },
      },
    },
  },
];
