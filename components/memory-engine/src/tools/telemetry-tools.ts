import { pool } from "../db/connection.js";

export async function handleEmitMetric(
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const p = args.provenance as Record<string, unknown> | undefined;
  if (!p || !p.invocation_id || !p.source_path) {
    throw new Error("emit_metric requires provenance with at least invocation_id and source_path");
  }

  await pool.query(
    `INSERT INTO telemetry
      (invocation_id, provider, model, reasoning, was_fallback,
       source_path, category, operation, latency_ms, success,
       tokens_in, tokens_out, estimated_cost_usd, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      p?.invocation_id ?? "00000000-0000-0000-0000-000000000000",
      p?.provider ?? "system",
      p?.model ?? "none",
      p?.reasoning ?? "none",
      p?.was_fallback ?? false,
      p?.source_path ?? "system/unknown",
      args.category ?? "system",
      args.operation ?? "unknown",
      args.latency_ms ?? 0,
      args.success ?? true,
      args.tokens_in ?? null,
      args.tokens_out ?? null,
      args.estimated_cost_usd ?? null,
      JSON.stringify(args.metadata ?? {}),
    ]
  );

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

export const TELEMETRY_TOOL_DEFINITIONS = [
  {
    name: "emit_metric",
    description: "Fire-and-forget: record a telemetry metric event",
    inputSchema: {
      type: "object" as const,
      properties: {
        provenance: { type: "object", description: "Provenance object" },
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
