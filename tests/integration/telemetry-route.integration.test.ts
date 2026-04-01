import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../../components/memory-engine/src/db/connection.js";
import { MemoryEngineClient } from "../../COO/controller/memory-engine-client.js";

test("telemetry routes reject partial provenance and use explicit internal provenance for caller-less tool telemetry", async () => {
  const client = await MemoryEngineClient.connect(process.cwd());
  const callJsonTool = (client as any).callJsonTool.bind(client as any) as (
    name: string,
    args: Record<string, unknown>
  ) => Promise<any>;
  const partialInvocationId = randomUUID();
  const partialBatchInvocationId = randomUUID();
  const routeStart = new Date().toISOString();

  try {
    await assert.rejects(
      () => callJsonTool("emit_metric", {
        provenance: {
          invocation_id: partialInvocationId,
          source_path: "tests/integration/telemetry-route:partial",
        },
        category: "system",
        operation: "partial_metric",
        latency_ms: 1,
        success: true,
      }),
      /provenance/i
    );

    const partialRows = await pool.query(
      "SELECT COUNT(*)::int AS count FROM telemetry WHERE invocation_id = $1",
      [partialInvocationId]
    );
    assert.equal(partialRows.rows[0]?.count ?? 0, 0);

    await assert.rejects(
      () => callJsonTool("emit_metrics_batch", {
        events: [
          {
            provenance: {
              invocation_id: partialBatchInvocationId,
              source_path: "tests/integration/telemetry-route:partial-batch",
            },
            category: "system",
            operation: "partial_metric_batch",
            latency_ms: 1,
            success: true,
          },
        ],
      }),
      /provenance/i
    );

    const partialBatchRows = await pool.query(
      "SELECT COUNT(*)::int AS count FROM telemetry WHERE invocation_id = $1",
      [partialBatchInvocationId]
    );
    assert.equal(partialBatchRows.rows[0]?.count ?? 0, 0);

    await callJsonTool("list_recent", {
      scope: "assafyavnai/shippingagent",
      limit: 1,
    });

    const routeRows = await pool.query(
      `SELECT source_path, provider, model, reasoning, metadata
         FROM telemetry
        WHERE operation = 'list_recent'
          AND created_at >= $1
        ORDER BY created_at DESC
        LIMIT 1`,
      [routeStart]
    );
    assert.equal(routeRows.rows.length, 1);
    assert.equal(routeRows.rows[0]?.source_path, "memory-engine/internal/tool-route-telemetry/list_recent");
    assert.equal(routeRows.rows[0]?.provider, "system");
    assert.equal(routeRows.rows[0]?.model, "none");
    assert.equal(routeRows.rows[0]?.reasoning, "none");
    assert.equal(routeRows.rows[0]?.metadata?.telemetry_provenance_mode, "internal");
  } finally {
    await pool.query(
      `DELETE FROM telemetry
        WHERE invocation_id IN ($1, $2)
           OR (operation = 'list_recent' AND created_at >= $3 AND source_path = $4)`,
      [
        partialInvocationId,
        partialBatchInvocationId,
        routeStart,
        "memory-engine/internal/tool-route-telemetry/list_recent",
      ]
    );
    await client.close();
  }
});
