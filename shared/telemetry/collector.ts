import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { MetricEvent } from "./types.js";
import { MetricEvent as MetricEventSchema } from "./types.js";

type MetricSink = (events: MetricEvent[]) => Promise<void>;

export interface TelemetrySinkOptions {
  outboxPath?: string;
  shutdownTimeoutMs?: number;
}

export interface TelemetryCloseResult {
  status: "drained" | "spooled" | "timed_out";
  pending_events: number;
  outbox_path: string | null;
}

let sink: MetricSink | null = null;
const buffer: MetricEvent[] = [];
let inFlightBatch: MetricEvent[] | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let exitFlushRegistered = false;
let activeFlush: Promise<void> | null = null;
let replayPromise: Promise<number> | null = null;
let outboxPath: string | null = null;
let shutdownTimeoutMs = 5_000;

const FLUSH_INTERVAL_MS = 1_000;
const MAX_BUFFER_SIZE = 100;

export function configureSink(s: MetricSink, options: TelemetrySinkOptions = {}): void {
  sink = s;
  if (options.outboxPath !== undefined) {
    outboxPath = options.outboxPath;
  }
  if (options.shutdownTimeoutMs !== undefined) {
    shutdownTimeoutMs = options.shutdownTimeoutMs;
  }
  ensureExitFlushHandler();
  if (buffer.length > 0) {
    void flush();
  }
}

export function emit(event: MetricEvent): void {
  ensureExitFlushHandler();
  buffer.push(event);

  if (buffer.length >= MAX_BUFFER_SIZE) {
    void flush();
    return;
  }

  scheduleFlushIfNeeded();
}

export async function flush(): Promise<void> {
  ensureExitFlushHandler();

  if (replayPromise) {
    await replayPromise.catch((err) => {
      console.error("[telemetry] Replay failed:", err);
    });
  }

  if (activeFlush) {
    return activeFlush;
  }

  if (buffer.length === 0) {
    return;
  }

  activeFlush = runFlushCycle();
  return activeFlush.finally(() => {
    activeFlush = null;
    scheduleFlushIfNeeded();
  });
}

export async function drain(): Promise<void> {
  ensureExitFlushHandler();
  void flush();

  while (!isIdle()) {
    if (activeFlush) {
      await Promise.race([activeFlush, delay(25)]);
      continue;
    }
    await delay(25);
  }
}

export async function close(options: { timeoutMs?: number } = {}): Promise<TelemetryCloseResult> {
  ensureExitFlushHandler();
  void flush();

  const timeoutMs = options.timeoutMs ?? shutdownTimeoutMs;
  const deadline = timeoutMs > 0 ? Date.now() + timeoutMs : Number.POSITIVE_INFINITY;

  while (!isIdle()) {
    if (Date.now() >= deadline) {
      return persistPendingTelemetry();
    }

    if (activeFlush) {
      await Promise.race([activeFlush, delay(25)]);
      continue;
    }

    await delay(25);
  }

  return {
    status: "drained",
    pending_events: 0,
    outbox_path: outboxPath,
  };
}

export async function replayPersistedMetrics(): Promise<number> {
  if (replayPromise) {
    return replayPromise;
  }

  replayPromise = loadOutboxAndReplay();
  return replayPromise.finally(() => {
    replayPromise = null;
  });
}

export function hasConfiguredSink(): boolean {
  return sink !== null;
}

export function getBufferedMetricCount(): number {
  return buffer.length + (inFlightBatch?.length ?? 0);
}

export function createPgSink(pool: { query: (text: string, params: unknown[]) => Promise<unknown> }): MetricSink {
  return async (events: MetricEvent[]) => {
    if (events.length === 0) return;

    const values: unknown[] = [];
    const placeholders: string[] = [];
    let idx = 1;

    for (const event of events) {
      const tokensIn = "tokens_in" in event ? event.tokens_in ?? null : null;
      const tokensOut = "tokens_out" in event ? event.tokens_out ?? null : null;
      const costUsd = "estimated_cost_usd" in event ? event.estimated_cost_usd ?? null : null;

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
        tokensIn,
        tokensOut,
        costUsd,
        JSON.stringify(event.metadata ?? {}),
        event.provenance.timestamp,
      );
      idx += 15;
    }

    await pool.query(
      `INSERT INTO telemetry
        (id, invocation_id, provider, model, reasoning, was_fallback,
         source_path, category, operation, latency_ms, success,
         tokens_in, tokens_out, estimated_cost_usd, metadata, created_at)
       VALUES ${placeholders.join(", ")}`,
      values
    );
  };
}

export function resetForTests(): void {
  sink = null;
  buffer.splice(0, buffer.length);
  inFlightBatch = null;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  activeFlush = null;
  replayPromise = null;
  outboxPath = null;
  shutdownTimeoutMs = 5_000;
}

function ensureExitFlushHandler(): void {
  if (exitFlushRegistered) return;
  exitFlushRegistered = true;

  process.once("beforeExit", () => {
    void close().catch((err) => {
      console.error("[telemetry] Close failed:", err);
    });
  });
}

function scheduleFlushIfNeeded(): void {
  if (buffer.length === 0 || flushTimer || activeFlush) {
    return;
  }

  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush().catch((err) => {
      console.error("[telemetry] Flush failed:", err);
    });
  }, FLUSH_INTERVAL_MS);
}

function clearFlushTimer(): void {
  if (!flushTimer) {
    return;
  }
  clearTimeout(flushTimer);
  flushTimer = null;
}

async function runFlushCycle(): Promise<void> {
  try {
    while (buffer.length > 0) {
      clearFlushTimer();
      const batch = buffer.splice(0, buffer.length);
      inFlightBatch = batch;

      try {
        if (!sink) {
          throw new Error(`No sink configured for ${batch.length} telemetry metrics`);
        }

        await sink(batch);
        inFlightBatch = null;
      } catch (err) {
        inFlightBatch = null;
        buffer.unshift(...batch);
        console.error("[telemetry] Flush failed:", err);
        scheduleFlushIfNeeded();
        break;
      }
    }
  } finally {
    inFlightBatch = null;
  }
}

async function loadOutboxAndReplay(): Promise<number> {
  if (!sink || !outboxPath) {
    return 0;
  }

  const persisted = await readOutbox();
  if (persisted.length === 0) {
    return 0;
  }

  await sink(persisted);
  await rm(outboxPath, { force: true });
  return persisted.length;
}

async function persistPendingTelemetry(): Promise<TelemetryCloseResult> {
  const pending = collectPendingMetrics();
  if (pending.length === 0) {
    return {
      status: "drained",
      pending_events: 0,
      outbox_path: outboxPath,
    };
  }

  if (!outboxPath) {
    return {
      status: "timed_out",
      pending_events: pending.length,
      outbox_path: null,
    };
  }

  await mkdir(dirname(outboxPath), { recursive: true });
  const existing = await readOutbox();
  const merged = [...existing, ...pending];
  await writeFile(outboxPath, JSON.stringify(merged, null, 2), "utf-8");
  clearPendingMetrics();

  return {
    status: "spooled",
    pending_events: merged.length,
    outbox_path: outboxPath,
  };
}

async function readOutbox(): Promise<MetricEvent[]> {
  if (!outboxPath) {
    return [];
  }

  try {
    const raw = await readFile(outboxPath, "utf-8");
    const parsed = JSON.parse(raw);
    return MetricEventSchema.array().parse(parsed);
  } catch (err) {
    if (isMissingFileError(err)) {
      return [];
    }
    throw err;
  }
}

function collectPendingMetrics(): MetricEvent[] {
  if (!inFlightBatch) {
    return [...buffer];
  }
  return [...inFlightBatch, ...buffer];
}

function clearPendingMetrics(): void {
  buffer.splice(0, buffer.length);
  inFlightBatch = null;
  clearFlushTimer();
}

function isIdle(): boolean {
  return buffer.length === 0 && inFlightBatch === null && activeFlush === null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isMissingFileError(err: unknown): boolean {
  return err instanceof Error
    && "code" in err
    && (err as NodeJS.ErrnoException).code === "ENOENT";
}
