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
const TelemetryPartitionSchema = z.enum(["production", "proof"]);

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

const TelemetryFilterSchema = z.object({
  category: TelemetryCategorySchema.optional(),
  source_path: z.string().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  operation: z.string().optional(),
  telemetry_partition: TelemetryPartitionSchema.optional(),
  thread_id: z.string().optional(),
  workflow: z.string().optional(),
  trace_id: z.string().optional(),
  since: z.string().optional(),
  until: z.string().optional(),
  limit: z.number().optional(),
  provenance: ProvenanceSchema.optional(),
});

const KpiSummaryInputSchema = z.object({
  since: z.string().optional(),
  until: z.string().optional(),
  source_path: z.string().default("COO/"),
  telemetry_partition: TelemetryPartitionSchema.default("production"),
  workflow: z.string().optional(),
  thread_id: z.string().optional(),
  trace_id: z.string().optional(),
  provenance: ProvenanceSchema.optional(),
});

type TelemetryMetricInput = z.infer<typeof TelemetryMetricInputSchema>;

export async function handleEmitMetric(
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const event = normalizeMetricEvent(TelemetryMetricInputSchema.parse(args));
  await insertMetricEvents(pool, [event]);
  return { content: [{ type: "text", text: "ok" }] };
}

export async function handleEmitMetricsBatch(
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const batch = TelemetryMetricsBatchInputSchema.parse(args);
  const events = batch.events.map((event) => normalizeMetricEvent(event));

  await insertMetricEvents(pool, events);
  return { content: [{ type: "text", text: "ok" }] };
}

export async function handleQueryMetrics(
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const filters = TelemetryFilterSchema.parse(args);
  const parts = buildTelemetryFilterParts(filters);
  const limit = Math.min(filters.limit ?? 100, 1000);
  const params = [...parts.params, limit];
  const rows = await pool.query(
    `SELECT * FROM telemetry ${parts.where} ORDER BY created_at DESC LIMIT $${params.length}`,
    params,
  );

  return { content: [{ type: "text", text: JSON.stringify(rows.rows, null, 2) }] };
}

export async function handleGetCostSummary(
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const filters = TelemetryFilterSchema.parse(args);
  const since = filters.since ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const until = filters.until ?? new Date().toISOString();
  const parts = buildTelemetryFilterParts({
    ...filters,
    since,
    until,
  });

  const breakdown = await pool.query(
    `SELECT
       provider,
       model,
       source_path,
       COUNT(*)::int AS call_count,
       COALESCE(SUM(tokens_in), 0)::int AS total_tokens_in,
       COALESCE(SUM(tokens_out), 0)::int AS total_tokens_out,
       COALESCE(SUM(estimated_cost_usd), 0)::numeric(10,6) AS total_cost_usd,
       COALESCE(AVG(latency_ms), 0)::int AS avg_latency_ms,
       SUM(CASE WHEN was_fallback THEN 1 ELSE 0 END)::int AS fallback_count,
       SUM(CASE WHEN NOT success THEN 1 ELSE 0 END)::int AS failure_count
     FROM telemetry
     ${parts.where}
     GROUP BY provider, model, source_path
     ORDER BY total_cost_usd DESC NULLS LAST`,
    parts.params,
  );

  const totals = await pool.query(
    `SELECT
       COUNT(*)::int AS total_calls,
       COALESCE(SUM(tokens_in), 0)::int AS total_tokens_in,
       COALESCE(SUM(tokens_out), 0)::int AS total_tokens_out,
       COALESCE(SUM(estimated_cost_usd), 0)::numeric(10,6) AS total_cost_usd,
       COALESCE(AVG(latency_ms), 0)::int AS avg_latency_ms
     FROM telemetry
     ${parts.where}`,
    parts.params,
  );

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ period: { since, until }, breakdown: breakdown.rows, totals: totals.rows[0] }, null, 2),
      },
    ],
  };
}

export async function handleGetKpiSummary(
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const input = KpiSummaryInputSchema.parse(args);
  const since = input.since ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const until = input.until ?? new Date().toISOString();
  const baseFilters = {
    since,
    until,
    source_path: input.source_path,
    telemetry_partition: input.telemetry_partition,
    workflow: input.workflow,
    thread_id: input.thread_id,
    trace_id: input.trace_id,
  };
  const parts = buildTelemetryFilterParts(baseFilters);
  const allPartitionsParts = buildTelemetryFilterParts({
    ...baseFilters,
    telemetry_partition: undefined,
  });
  const kpiUsageParts = buildTelemetryFilterParts({
    since,
    until,
    telemetry_partition: input.telemetry_partition,
  });

  const [
    averageTurnLatency,
    averageClassifierLatency,
    averageContextLatency,
    averageLlmLatency,
    averageBrainLatency,
    averagePersistenceLatency,
    averageWorkflowLatency,
    turnLatencyBreakdown,
    workflowBreakdown,
    routeStageBreakdown,
    fallbackBreakdown,
    brainBreakdown,
    persistenceBreakdown,
    freezeSummary,
    lifecycleParitySummary,
    pushbackSummary,
    spoolReplaySummary,
    partitionBreakdown,
    metadataCompletenessSummary,
    llmCostQualitySummary,
    kpiApiUsageSummary,
  ] = await Promise.all([
    numericAggregate(parts, `SELECT COALESCE(AVG(latency_ms), 0)::int AS value FROM telemetry ${parts.where} AND operation = 'handle_turn'`),
    numericAggregate(parts, `SELECT COALESCE(AVG(latency_ms), 0)::int AS value FROM telemetry ${parts.where} AND operation = 'classifier_step'`),
    numericAggregate(parts, `SELECT COALESCE(AVG(latency_ms), 0)::int AS value FROM telemetry ${parts.where} AND operation = 'context_assemble'`),
    numericAggregate(parts, `SELECT COALESCE(AVG(latency_ms), 0)::int AS value FROM telemetry ${parts.where} AND category = 'llm'`),
    numericAggregate(parts, `SELECT COALESCE(AVG(latency_ms), 0)::int AS value FROM telemetry ${parts.where} AND category = 'memory'`),
    numericAggregate(parts, `SELECT COALESCE(AVG(latency_ms), 0)::int AS value FROM telemetry ${parts.where} AND operation IN ('thread_create', 'thread_load', 'thread_save')`),
    numericAggregate(parts, `SELECT COALESCE(AVG(latency_ms), 0)::int AS value FROM telemetry ${parts.where} AND operation = 'workflow_execute'`),
    pool.query(
      `SELECT
         COALESCE(percentile_disc(0.50) WITHIN GROUP (ORDER BY latency_ms), 0)::int AS p50_latency_ms,
         COALESCE(percentile_disc(0.95) WITHIN GROUP (ORDER BY latency_ms), 0)::int AS p95_latency_ms,
         COALESCE(percentile_disc(0.99) WITHIN GROUP (ORDER BY latency_ms), 0)::int AS p99_latency_ms,
         SUM(CASE WHEN latency_ms > 1000 THEN 1 ELSE 0 END)::int AS over_1s_count,
         SUM(CASE WHEN latency_ms > 10000 THEN 1 ELSE 0 END)::int AS over_10s_count,
         SUM(CASE WHEN latency_ms > 60000 THEN 1 ELSE 0 END)::int AS over_60s_count
       FROM telemetry
       ${parts.where}
         AND operation = 'handle_turn'`,
      parts.params,
    ),
    pool.query(
      `SELECT
         COALESCE(metadata->>'workflow', 'unknown') AS workflow,
         COUNT(*)::int AS total_turns,
         SUM(CASE WHEN NOT success THEN 1 ELSE 0 END)::int AS failure_count,
         COALESCE(AVG(latency_ms), 0)::int AS avg_latency_ms,
         COALESCE(percentile_disc(0.95) WITHIN GROUP (ORDER BY latency_ms), 0)::int AS p95_latency_ms
       FROM telemetry
       ${parts.where}
         AND operation = 'handle_turn'
       GROUP BY COALESCE(metadata->>'workflow', 'unknown')
       ORDER BY total_turns DESC, workflow ASC`,
      parts.params,
    ),
    pool.query(
      `SELECT
         COALESCE(NULLIF(metadata->>'route_stage', ''), 'unknown') AS route_stage,
         COUNT(*)::int AS total_turns,
         SUM(CASE WHEN NOT success THEN 1 ELSE 0 END)::int AS failure_count,
         COALESCE(AVG(latency_ms), 0)::int AS avg_latency_ms,
         COALESCE(percentile_disc(0.95) WITHIN GROUP (ORDER BY latency_ms), 0)::int AS p95_latency_ms
       FROM telemetry
       ${parts.where}
         AND operation = 'handle_turn'
       GROUP BY COALESCE(NULLIF(metadata->>'route_stage', ''), 'unknown')
       ORDER BY failure_count DESC, total_turns DESC, route_stage ASC`,
      parts.params,
    ),
    pool.query(
      `SELECT
         provider,
         model,
         COUNT(*)::int AS total_calls,
         SUM(CASE WHEN was_fallback THEN 1 ELSE 0 END)::int AS fallback_count,
         COALESCE(
           ROUND((SUM(CASE WHEN was_fallback THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0)) * 100, 2),
           0
         ) AS fallback_rate_pct
       FROM telemetry
       ${parts.where}
         AND category = 'llm'
       GROUP BY provider, model
       ORDER BY total_calls DESC, provider ASC, model ASC`,
      parts.params,
    ),
    pool.query(
      `SELECT
         operation,
         COUNT(*)::int AS total_calls,
         SUM(CASE WHEN NOT success THEN 1 ELSE 0 END)::int AS failure_count,
         COALESCE(AVG(latency_ms), 0)::int AS avg_latency_ms
       FROM telemetry
       ${parts.where}
         AND category = 'memory'
       GROUP BY operation
       ORDER BY total_calls DESC, operation ASC`,
      parts.params,
    ),
    pool.query(
      `SELECT
         operation,
         COUNT(*)::int AS total_calls,
         SUM(CASE WHEN NOT success THEN 1 ELSE 0 END)::int AS failure_count,
         COALESCE(AVG(latency_ms), 0)::int AS avg_latency_ms
       FROM telemetry
       ${parts.where}
         AND operation IN ('thread_create', 'thread_load', 'thread_save', 'thread_resume_lookup')
       GROUP BY operation
       ORDER BY total_calls DESC, operation ASC`,
      parts.params,
    ),
    pool.query(
      `WITH onion_rows AS (
         SELECT
           metadata->>'trace_id' AS trace_id,
           latency_ms,
           COALESCE(NULLIF(metadata->>'llm_tokens_in', '')::int, 0) AS llm_tokens_in,
           COALESCE(NULLIF(metadata->>'llm_tokens_out', '')::int, 0) AS llm_tokens_out,
           COALESCE(NULLIF(metadata->>'llm_estimated_cost_usd', '')::numeric, 0) AS llm_estimated_cost_usd,
           COALESCE(NULLIF(metadata->>'clarification_requested', '')::boolean, false) AS clarification_requested,
           COALESCE(NULLIF(metadata->>'reopened_scope', '')::boolean, false) AS reopened_scope,
           metadata->>'lifecycle_status' AS lifecycle_status
         FROM telemetry
         ${parts.where}
           AND operation = 'onion_turn'
           AND COALESCE(NULLIF(metadata->>'trace_id', ''), '') <> ''
       ),
       terminal_traces AS (
         SELECT trace_id
           FROM onion_rows
          WHERE lifecycle_status = 'handoff_ready'
         UNION
         SELECT DISTINCT metadata->>'trace_id' AS trace_id
           FROM telemetry
           ${parts.where}
           AND operation = 'memory_manage:publish_finalized_requirement'
            AND success = true
            AND COALESCE(NULLIF(metadata->>'trace_id', ''), '') <> ''
       ),
       freeze_traces AS (
         SELECT
           terminal_traces.trace_id,
           COUNT(onion_rows.trace_id)::int AS turns_to_freeze,
           COALESCE(SUM(onion_rows.latency_ms), 0)::int AS time_to_freeze_ms,
           COALESCE(SUM(onion_rows.llm_tokens_in), 0)::int AS tokens_in_to_freeze,
           COALESCE(SUM(onion_rows.llm_tokens_out), 0)::int AS tokens_out_to_freeze,
           COALESCE(SUM(onion_rows.llm_estimated_cost_usd), 0)::numeric(10,6) AS cost_to_freeze_usd,
           SUM(CASE WHEN onion_rows.clarification_requested THEN 1 ELSE 0 END)::int AS clarification_turns,
           SUM(CASE WHEN onion_rows.reopened_scope THEN 1 ELSE 0 END)::int AS reopen_count
         FROM terminal_traces
         LEFT JOIN onion_rows
           ON onion_rows.trace_id = terminal_traces.trace_id
         GROUP BY terminal_traces.trace_id
       )
       SELECT
         COUNT(*)::int AS frozen_trace_count,
         COALESCE(AVG(NULLIF(turns_to_freeze, 0)), 0)::numeric(10,2) AS avg_turns_to_freeze,
         COALESCE(AVG(NULLIF(time_to_freeze_ms, 0)), 0)::numeric(10,2) AS avg_time_to_freeze_ms,
         COALESCE(AVG(NULLIF(tokens_in_to_freeze + tokens_out_to_freeze, 0)), 0)::numeric(10,2) AS avg_tokens_to_freeze,
         COALESCE(AVG(clarification_turns), 0)::numeric(10,2) AS avg_clarification_turns_per_requirement,
         COALESCE(SUM(reopen_count), 0)::int AS reopen_count,
         COALESCE(AVG(NULLIF(cost_to_freeze_usd, 0)), 0)::numeric(10,6) AS avg_cost_to_freeze_usd
       FROM freeze_traces`,
      parts.params,
    ),
    pool.query(
      `WITH onion_handoff_traces AS (
         SELECT DISTINCT metadata->>'trace_id' AS trace_id
           FROM telemetry
           ${parts.where}
           AND operation = 'onion_turn'
            AND success = true
            AND metadata->>'lifecycle_status' = 'handoff_ready'
            AND COALESCE(NULLIF(metadata->>'trace_id', ''), '') <> ''
       ),
       published_traces AS (
         SELECT DISTINCT metadata->>'trace_id' AS trace_id
           FROM telemetry
           ${parts.where}
           AND operation = 'memory_manage:publish_finalized_requirement'
            AND success = true
            AND COALESCE(NULLIF(metadata->>'trace_id', ''), '') <> ''
       ),
       reconciled_traces AS (
         SELECT trace_id FROM onion_handoff_traces
         UNION
         SELECT trace_id FROM published_traces
       )
       SELECT
         (SELECT COUNT(*)::int FROM onion_handoff_traces) AS onion_handoff_trace_count,
         (SELECT COUNT(*)::int FROM published_traces) AS published_finalized_trace_count,
         (SELECT COUNT(*)::int FROM reconciled_traces) AS reconciled_frozen_trace_count,
         (
           SELECT COUNT(*)::int
             FROM published_traces p
            WHERE NOT EXISTS (
              SELECT 1
                FROM onion_handoff_traces o
               WHERE o.trace_id = p.trace_id
            )
         ) AS publish_without_onion_handoff_count,
         (
           SELECT COUNT(*)::int
             FROM onion_handoff_traces o
            WHERE NOT EXISTS (
              SELECT 1
                FROM published_traces p
               WHERE p.trace_id = o.trace_id
            )
         ) AS onion_handoff_without_publish_count`,
      parts.params,
    ),
    pool.query(
      `SELECT COUNT(*)::int AS pushback_count
         FROM telemetry
         ${parts.where}
           AND operation = 'handle_turn'
           AND metadata->>'workflow' = 'pushback'`,
      parts.params,
    ),
    pool.query(
      `SELECT
         SUM(CASE WHEN operation = 'telemetry_replay' THEN 1 ELSE 0 END)::int AS replay_count,
         COALESCE(SUM(CASE WHEN operation = 'telemetry_replay' THEN NULLIF(metadata->>'replayed_events', '')::int ELSE 0 END), 0)::int AS replayed_event_count,
         SUM(CASE WHEN operation = 'cli_shutdown' AND metadata->>'telemetry_close_status' = 'spooled' THEN 1 ELSE 0 END)::int AS spool_count
       FROM telemetry
       ${parts.where}
         AND operation IN ('telemetry_replay', 'cli_shutdown')`,
      parts.params,
    ),
    pool.query(
      `SELECT
         COALESCE(NULLIF(metadata->>'telemetry_partition', ''), 'production') AS telemetry_partition,
         COUNT(*)::int AS total_events,
         SUM(CASE WHEN operation = 'handle_turn' THEN 1 ELSE 0 END)::int AS route_count
       FROM telemetry
       ${allPartitionsParts.where}
       GROUP BY COALESCE(NULLIF(metadata->>'telemetry_partition', ''), 'production')
       ORDER BY telemetry_partition ASC`,
      allPartitionsParts.params,
    ),
    pool.query(
      `SELECT
         COUNT(*)::int AS total_turns,
         SUM(CASE WHEN metadata ? 'workflow' THEN 1 ELSE 0 END)::int AS workflow_key_count,
         SUM(CASE WHEN metadata ? 'trace_id' THEN 1 ELSE 0 END)::int AS trace_id_key_count,
         SUM(CASE WHEN metadata ? 'route_stage' THEN 1 ELSE 0 END)::int AS route_stage_key_count,
         SUM(CASE WHEN metadata ? 'result_status' THEN 1 ELSE 0 END)::int AS result_status_key_count,
         SUM(CASE WHEN COALESCE(NULLIF(metadata->>'workflow', ''), 'unknown') = 'unknown' THEN 1 ELSE 0 END)::int AS unknown_workflow_count,
         SUM(CASE WHEN NOT success THEN 1 ELSE 0 END)::int AS failed_turn_count,
         SUM(CASE WHEN NOT success AND COALESCE(NULLIF(metadata->>'error_class', ''), '') <> '' THEN 1 ELSE 0 END)::int AS failed_error_class_count,
         SUM(CASE WHEN NOT success AND COALESCE(NULLIF(metadata->>'error_code', ''), '') <> '' THEN 1 ELSE 0 END)::int AS failed_error_code_count,
         SUM(CASE WHEN NOT success AND COALESCE(NULLIF(metadata->>'error_message', ''), '') <> '' THEN 1 ELSE 0 END)::int AS failed_error_message_count
       FROM telemetry
       ${parts.where}
         AND operation = 'handle_turn'`,
      parts.params,
    ),
    pool.query(
      `SELECT
         COUNT(*)::int AS total_calls,
         SUM(CASE WHEN was_fallback THEN 1 ELSE 0 END)::int AS fallback_call_count,
         SUM(CASE WHEN estimated_cost_usd IS NULL THEN 1 ELSE 0 END)::int AS uncosted_call_count,
         SUM(CASE WHEN was_fallback AND estimated_cost_usd IS NULL THEN 1 ELSE 0 END)::int AS uncosted_fallback_call_count,
         COALESCE(SUM(tokens_in), 0)::int AS total_tokens_in,
         COALESCE(SUM(tokens_out), 0)::int AS total_tokens_out
       FROM telemetry
       ${parts.where}
         AND category = 'llm'`,
      parts.params,
    ),
    pool.query(
      `SELECT
         operation,
         COUNT(*)::int AS total_calls,
         SUM(CASE WHEN NOT success THEN 1 ELSE 0 END)::int AS failure_count,
         COALESCE(AVG(latency_ms), 0)::int AS avg_latency_ms,
         COALESCE(percentile_disc(0.95) WITHIN GROUP (ORDER BY latency_ms), 0)::int AS p95_latency_ms,
         SUM(CASE WHEN COALESCE(NULLIF(metadata->>'requested_telemetry_partition', ''), 'production') = 'proof' THEN 1 ELSE 0 END)::int AS proof_partition_reads,
         SUM(CASE WHEN COALESCE(NULLIF(metadata->>'telemetry_provenance_mode', ''), 'internal') = 'caller' THEN 1 ELSE 0 END)::int AS caller_provenance_reads
       FROM telemetry
       ${kpiUsageParts.where}
         AND operation IN ('query_metrics', 'get_cost_summary', 'get_kpi_summary')
       GROUP BY operation
       ORDER BY total_calls DESC, operation ASC`,
      kpiUsageParts.params,
    ),
  ]);

  const turnLatencyRow = turnLatencyBreakdown.rows[0] ?? {};
  const freezeRow = freezeSummary.rows[0] ?? {};
  const lifecycleParityRow = lifecycleParitySummary.rows[0] ?? {};
  const pushbackRow = pushbackSummary.rows[0] ?? {};
  const spoolReplayRow = spoolReplaySummary.rows[0] ?? {};
  const metadataCompletenessRow = metadataCompletenessSummary.rows[0] ?? {};
  const llmCostQualityRow = llmCostQualitySummary.rows[0] ?? {};
  const totalTurns = Number(metadataCompletenessRow.total_turns ?? 0);
  const failedTurns = Number(metadataCompletenessRow.failed_turn_count ?? 0);
  const kpiApiUsageRows = kpiApiUsageSummary.rows.map((row) => ({
    ...row,
    total_calls: Number(row.total_calls ?? 0),
    failure_count: Number(row.failure_count ?? 0),
    avg_latency_ms: Number(row.avg_latency_ms ?? 0),
    p95_latency_ms: Number(row.p95_latency_ms ?? 0),
    proof_partition_reads: Number(row.proof_partition_reads ?? 0),
    caller_provenance_reads: Number(row.caller_provenance_reads ?? 0),
  }));

  const payload = {
    filters: {
      since,
      until,
      source_path: input.source_path,
      telemetry_partition: input.telemetry_partition,
      workflow: input.workflow ?? null,
      thread_id: input.thread_id ?? null,
      trace_id: input.trace_id ?? null,
    },
    averages: {
      turn_latency_ms: averageTurnLatency,
      classifier_latency_ms: averageClassifierLatency,
      context_latency_ms: averageContextLatency,
      llm_latency_ms: averageLlmLatency,
      brain_latency_ms: averageBrainLatency,
      persistence_latency_ms: averagePersistenceLatency,
      workflow_latency_ms: averageWorkflowLatency,
    },
    turn_latency: {
      avg_latency_ms: averageTurnLatency,
      p50_latency_ms: Number(turnLatencyRow.p50_latency_ms ?? 0),
      p95_latency_ms: Number(turnLatencyRow.p95_latency_ms ?? 0),
      p99_latency_ms: Number(turnLatencyRow.p99_latency_ms ?? 0),
      over_1s_count: Number(turnLatencyRow.over_1s_count ?? 0),
      over_10s_count: Number(turnLatencyRow.over_10s_count ?? 0),
      over_60s_count: Number(turnLatencyRow.over_60s_count ?? 0),
    },
    requirements_gathering: {
      frozen_trace_count: Number(freezeRow.frozen_trace_count ?? 0),
      avg_turns_to_freeze: Number(freezeRow.avg_turns_to_freeze ?? 0),
      avg_time_to_freeze_ms: Number(freezeRow.avg_time_to_freeze_ms ?? 0),
      avg_tokens_to_freeze: Number(freezeRow.avg_tokens_to_freeze ?? 0),
      avg_cost_to_freeze_usd: Number(freezeRow.avg_cost_to_freeze_usd ?? 0),
      avg_clarification_turns_per_requirement: Number(freezeRow.avg_clarification_turns_per_requirement ?? 0),
      reopen_count: Number(freezeRow.reopen_count ?? 0),
      pushback_count: Number(pushbackRow.pushback_count ?? 0),
      lifecycle_parity: {
        onion_handoff_trace_count: Number(lifecycleParityRow.onion_handoff_trace_count ?? 0),
        published_finalized_trace_count: Number(lifecycleParityRow.published_finalized_trace_count ?? 0),
        reconciled_frozen_trace_count: Number(lifecycleParityRow.reconciled_frozen_trace_count ?? 0),
        publish_without_onion_handoff_count: Number(lifecycleParityRow.publish_without_onion_handoff_count ?? 0),
        onion_handoff_without_publish_count: Number(lifecycleParityRow.onion_handoff_without_publish_count ?? 0),
      },
    },
    workflow_breakdown: workflowBreakdown.rows,
    route_stage_breakdown: routeStageBreakdown.rows,
    fallback_rate_by_provider_model: fallbackBreakdown.rows,
    brain_breakdown: brainBreakdown.rows,
    persistence_breakdown: persistenceBreakdown.rows,
    kpi_api_usage: {
      total_calls: kpiApiUsageRows.reduce((sum, row) => sum + row.total_calls, 0),
      by_operation: kpiApiUsageRows,
    },
    kpi_quality: {
      unknown_workflow_count: Number(metadataCompletenessRow.unknown_workflow_count ?? 0),
      handle_turn_metadata_completeness: {
        total_turns: totalTurns,
        workflow_key_count: Number(metadataCompletenessRow.workflow_key_count ?? 0),
        workflow_key_pct: ratioToPct(Number(metadataCompletenessRow.workflow_key_count ?? 0), totalTurns),
        trace_id_key_count: Number(metadataCompletenessRow.trace_id_key_count ?? 0),
        trace_id_key_pct: ratioToPct(Number(metadataCompletenessRow.trace_id_key_count ?? 0), totalTurns),
        route_stage_key_count: Number(metadataCompletenessRow.route_stage_key_count ?? 0),
        route_stage_key_pct: ratioToPct(Number(metadataCompletenessRow.route_stage_key_count ?? 0), totalTurns),
        result_status_key_count: Number(metadataCompletenessRow.result_status_key_count ?? 0),
        result_status_key_pct: ratioToPct(Number(metadataCompletenessRow.result_status_key_count ?? 0), totalTurns),
        failed_turn_count: failedTurns,
        failed_error_class_count: Number(metadataCompletenessRow.failed_error_class_count ?? 0),
        failed_error_class_pct: ratioToPct(Number(metadataCompletenessRow.failed_error_class_count ?? 0), failedTurns),
        failed_error_code_count: Number(metadataCompletenessRow.failed_error_code_count ?? 0),
        failed_error_code_pct: ratioToPct(Number(metadataCompletenessRow.failed_error_code_count ?? 0), failedTurns),
        failed_error_message_count: Number(metadataCompletenessRow.failed_error_message_count ?? 0),
        failed_error_message_pct: ratioToPct(Number(metadataCompletenessRow.failed_error_message_count ?? 0), failedTurns),
      },
      llm_cost_quality: {
        total_calls: Number(llmCostQualityRow.total_calls ?? 0),
        fallback_call_count: Number(llmCostQualityRow.fallback_call_count ?? 0),
        uncosted_call_count: Number(llmCostQualityRow.uncosted_call_count ?? 0),
        uncosted_call_pct: ratioToPct(Number(llmCostQualityRow.uncosted_call_count ?? 0), Number(llmCostQualityRow.total_calls ?? 0)),
        uncosted_fallback_call_count: Number(llmCostQualityRow.uncosted_fallback_call_count ?? 0),
        total_tokens_in: Number(llmCostQualityRow.total_tokens_in ?? 0),
        total_tokens_out: Number(llmCostQualityRow.total_tokens_out ?? 0),
      },
    },
    spool_replay: {
      replay_count: Number(spoolReplayRow.replay_count ?? 0),
      replayed_event_count: Number(spoolReplayRow.replayed_event_count ?? 0),
      spool_count: Number(spoolReplayRow.spool_count ?? 0),
    },
    production_vs_proof_route_counts: partitionBreakdown.rows,
  };

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
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

function buildTelemetryFilterParts(filters: {
  category?: string;
  source_path?: string;
  provider?: string;
  model?: string;
  operation?: string;
  telemetry_partition?: "production" | "proof";
  thread_id?: string;
  workflow?: string;
  trace_id?: string;
  since?: string;
  until?: string;
}): { where: string; params: unknown[] } {
  const conditions: string[] = ["1=1"];
  const params: unknown[] = [];

  if (filters.category) {
    params.push(filters.category);
    conditions.push(`category = $${params.length}`);
  }
  if (filters.source_path) {
    params.push(`${filters.source_path}%`);
    conditions.push(`source_path LIKE $${params.length}`);
  }
  if (filters.provider) {
    params.push(filters.provider);
    conditions.push(`provider = $${params.length}`);
  }
  if (filters.model) {
    params.push(filters.model);
    conditions.push(`model = $${params.length}`);
  }
  if (filters.operation) {
    params.push(filters.operation);
    conditions.push(`operation = $${params.length}`);
  }
  if (filters.since) {
    params.push(filters.since);
    conditions.push(`created_at >= $${params.length}`);
  }
  if (filters.until) {
    params.push(filters.until);
    conditions.push(`created_at <= $${params.length}`);
  }
  if (filters.telemetry_partition) {
    params.push(filters.telemetry_partition);
    conditions.push(`COALESCE(NULLIF(metadata->>'telemetry_partition', ''), 'production') = $${params.length}`);
  }
  if (filters.thread_id) {
    params.push(filters.thread_id);
    conditions.push(`metadata->>'thread_id' = $${params.length}`);
  }
  if (filters.workflow) {
    params.push(filters.workflow);
    conditions.push(`metadata->>'workflow' = $${params.length}`);
  }
  if (filters.trace_id) {
    params.push(filters.trace_id);
    conditions.push(`metadata->>'trace_id' = $${params.length}`);
  }

  return {
    where: `WHERE ${conditions.join(" AND ")}`,
    params,
  };
}

async function numericAggregate(
  parts: { where: string; params: unknown[] },
  sql: string,
): Promise<number> {
  const { rows } = await pool.query(sql, parts.params);
  return Number(rows[0]?.value ?? 0);
}

function ratioToPct(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }
  return Number(((numerator / denominator) * 100).toFixed(2));
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
        category: { type: "string", enum: ["llm", "memory", "tool", "turn", "system"] },
        source_path: { type: "string" },
        provider: { type: "string" },
        model: { type: "string" },
        operation: { type: "string" },
        telemetry_partition: { type: "string", enum: ["production", "proof"] },
        thread_id: { type: "string" },
        workflow: { type: "string" },
        trace_id: { type: "string" },
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
        source_path: { type: "string" },
        telemetry_partition: { type: "string", enum: ["production", "proof"] },
        workflow: { type: "string" },
        thread_id: { type: "string" },
        trace_id: { type: "string" },
        since: { type: "string", description: "ISO 8601 start (default: 24h ago)" },
        until: { type: "string", description: "ISO 8601 end (default: now)" },
        provenance: { type: "object", description: "Provenance object from caller" },
      },
    },
  },
  {
    name: "get_kpi_summary",
    description: "Read-only KPI rollup derived from raw telemetry; defaults to COO production telemetry only",
    inputSchema: {
      type: "object" as const,
      properties: {
        since: { type: "string", description: "ISO 8601 start (default: 24h ago)" },
        until: { type: "string", description: "ISO 8601 end (default: now)" },
        source_path: { type: "string", description: "Source-path prefix filter (default: COO/)" },
        telemetry_partition: { type: "string", enum: ["production", "proof"], default: "production" },
        workflow: { type: "string" },
        thread_id: { type: "string" },
        trace_id: { type: "string" },
        provenance: { type: "object", description: "Provenance object from caller" },
      },
    },
  },
];
