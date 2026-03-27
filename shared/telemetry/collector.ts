import type { MetricEvent } from "./types.js";

/**
 * Telemetry Collector — async fire-and-forget metric emission.
 *
 * Zero latency to caller. Metrics are queued and flushed to the
 * memory engine MCP server (or direct DB) asynchronously.
 *
 * In Phase 2a, we start with direct DB writes via pg pool.
 * MCP transport can be added later without changing the API.
 */

type MetricSink = (events: MetricEvent[]) => Promise<void>;

let sink: MetricSink | null = null;
const buffer: MetricEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_INTERVAL_MS = 1000;
const MAX_BUFFER_SIZE = 100;

/**
 * Configure the telemetry sink. Must be called once at startup.
 */
export function configureSink(s: MetricSink): void {
  sink = s;
}

/**
 * Emit a metric event. Returns immediately — zero latency to caller.
 * Metric is buffered and flushed asynchronously.
 */
export function emit(event: MetricEvent): void {
  buffer.push(event);

  if (buffer.length >= MAX_BUFFER_SIZE) {
    flush();
    return;
  }

  if (!flushTimer) {
    flushTimer = setTimeout(() => flush(), FLUSH_INTERVAL_MS);
  }
}

/**
 * Flush buffered metrics to the sink. Called automatically on
 * buffer full or timer expiry. Can also be called manually on shutdown.
 */
export async function flush(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  if (buffer.length === 0) return;

  const batch = buffer.splice(0, buffer.length);

  if (!sink) {
    // No sink configured — log to stderr as fallback
    console.error(`[telemetry] No sink configured. Dropping ${batch.length} metrics.`);
    return;
  }

  try {
    await sink(batch);
  } catch (err) {
    // Telemetry must never crash the caller. Log and continue.
    console.error("[telemetry] Flush failed:", err);
  }
}

/**
 * Create a PostgreSQL sink for direct DB writes.
 */
export function createPgSink(pool: { query: (text: string, params: unknown[]) => Promise<unknown> }): MetricSink {
  return async (events: MetricEvent[]) => {
    for (const event of events) {
      await pool.query(
        `INSERT INTO telemetry
          (id, invocation_id, provider, model, reasoning, was_fallback,
           source_path, category, operation, latency_ms, success,
           tokens_in, tokens_out, estimated_cost_usd, metadata, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                 $11, $12, $13, $14, NOW())`,
        [
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
          "tokens_in" in event ? event.tokens_in ?? null : null,
          "tokens_out" in event ? event.tokens_out ?? null : null,
          "estimated_cost_usd" in event ? event.estimated_cost_usd ?? null : null,
          JSON.stringify(event.metadata ?? {}),
        ]
      );
    }
  };
}
