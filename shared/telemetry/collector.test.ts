import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  close,
  configureSink,
  drain,
  emit,
  flush,
  getBufferedMetricCount,
  replayPersistedMetrics,
  resetForTests,
} from "./collector.js";
import type { MetricEvent } from "./types.js";

const SAMPLE_EVENT: MetricEvent = {
  provenance: {
    invocation_id: "11111111-1111-1111-1111-111111111111",
    provider: "system",
    model: "none",
    reasoning: "none",
    was_fallback: false,
    source_path: "tests/telemetry",
    timestamp: new Date().toISOString(),
  },
  category: "system",
  operation: "collector_test",
  latency_ms: 1,
  success: true,
};

test("collector drain waits for in-flight flush and emits queued events before shutdown", async () => {
  resetForTests();

  const batches: string[][] = [];
  let releaseFirstBatch = () => {};
  let firstBatchStartedResolve: () => void = () => {};
  const firstBatchStarted = new Promise<void>((resolve) => {
    firstBatchStartedResolve = resolve;
  });
  const firstBatchReleased = new Promise<void>((resolve) => {
    releaseFirstBatch = resolve;
  });

  configureSink(async (events) => {
    batches.push(events.map((event) => event.operation));
    if (batches.length === 1) {
      firstBatchStartedResolve();
      await firstBatchReleased;
    }
  });

  emit({ ...SAMPLE_EVENT, operation: "batch_one" });
  const draining = drain();
  await firstBatchStarted;

  emit({ ...SAMPLE_EVENT, operation: "batch_two" });
  releaseFirstBatch();

  await draining;

  assert.equal(getBufferedMetricCount(), 0);
  assert.deepEqual(batches, [["batch_one"], ["batch_two"]]);

  resetForTests();
});

test("collector requeues a failed batch and drain eventually clears it", async () => {
  resetForTests();
  let attempts = 0;

  configureSink(async () => {
    attempts += 1;
    if (attempts === 1) {
      throw new Error("sink down");
    }
  });

  emit(SAMPLE_EVENT);
  await flush();
  assert.equal(getBufferedMetricCount(), 1);

  const result = await drain();
  assert.equal(result.status, "drained");
  assert.equal(getBufferedMetricCount(), 0);
  assert.equal(attempts, 2);

  resetForTests();
});

test("collector close bounds shutdown by spooling pending metrics and replays them on next startup", async () => {
  resetForTests();
  const tempRoot = await mkdtemp(join(tmpdir(), "adf-telemetry-collector-test-"));
  const outboxPath = join(tempRoot, "telemetry-outbox.json");

  try {
    configureSink(
      async () => {
        await new Promise(() => {});
      },
      {
        outboxPath,
        shutdownTimeoutMs: 50,
      }
    );

    emit({ ...SAMPLE_EVENT, operation: "spooled_event" });
    const result = await close();

    assert.equal(result.status, "spooled");
    assert.equal(getBufferedMetricCount(), 0);

    const persisted = JSON.parse(await readFile(outboxPath, "utf-8")) as MetricEvent[];
    assert.equal(persisted.length, 1);
    assert.equal(persisted[0].operation, "spooled_event");

    resetForTests();

    const replayedOperations: string[] = [];
    configureSink(
      async (events) => {
        replayedOperations.push(...events.map((event) => event.operation));
      },
      {
        outboxPath,
        shutdownTimeoutMs: 50,
      }
    );

    const replayedCount = await replayPersistedMetrics();
    assert.equal(replayedCount, 1);
    assert.deepEqual(replayedOperations, ["spooled_event"]);
  } finally {
    resetForTests();
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("collector drain shares bounded shutdown semantics when the sink never recovers", async () => {
  resetForTests();
  const tempRoot = await mkdtemp(join(tmpdir(), "adf-telemetry-drain-test-"));
  const outboxPath = join(tempRoot, "telemetry-outbox.json");

  try {
    configureSink(
      async () => {
        throw new Error("sink permanently unavailable");
      },
      {
        outboxPath,
        shutdownTimeoutMs: 50,
      }
    );

    emit({ ...SAMPLE_EVENT, operation: "drain_spooled_event" });
    const result = await drain();

    assert.equal(result.status, "spooled");
    assert.equal(getBufferedMetricCount(), 0);
    const persisted = JSON.parse(await readFile(outboxPath, "utf-8")) as MetricEvent[];
    assert.equal(persisted.length, 1);
    assert.equal(persisted[0].operation, "drain_spooled_event");
  } finally {
    resetForTests();
    await rm(tempRoot, { recursive: true, force: true });
  }
});
