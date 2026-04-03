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

test("kpi read routes emit telemetry and KPI summary reports prior KPI API usage", async () => {
  const client = await MemoryEngineClient.connect(process.cwd());
  const callJsonTool = (client as any).callJsonTool.bind(client as any) as (
    name: string,
    args: Record<string, unknown>
  ) => Promise<any>;
  const routeStart = new Date().toISOString();

  try {
    await callJsonTool("query_metrics", {
      since: routeStart,
      source_path: "COO/",
      telemetry_partition: "production",
      limit: 5,
    });

    await callJsonTool("get_cost_summary", {
      since: routeStart,
      source_path: "COO/",
      telemetry_partition: "production",
    });

    const firstSummary = await callJsonTool("get_kpi_summary", {
      since: routeStart,
      source_path: "COO/",
      telemetry_partition: "production",
    });

    assert.ok(Array.isArray(firstSummary.kpi_api_usage?.by_operation));
    assert.ok(
      firstSummary.kpi_api_usage.by_operation.some((row: any) =>
        row.operation === "query_metrics" && Number(row.total_calls ?? 0) >= 1,
      ),
    );
    assert.ok(
      firstSummary.kpi_api_usage.by_operation.some((row: any) =>
        row.operation === "get_cost_summary" && Number(row.total_calls ?? 0) >= 1,
      ),
    );
    assert.ok(
      !firstSummary.kpi_api_usage.by_operation.some((row: any) =>
        row.operation === "get_kpi_summary" && Number(row.total_calls ?? 0) > 0,
      ),
    );

    const secondSummary = await callJsonTool("get_kpi_summary", {
      since: routeStart,
      source_path: "COO/",
      telemetry_partition: "production",
    });

    assert.ok(
      secondSummary.kpi_api_usage.by_operation.some((row: any) =>
        row.operation === "get_kpi_summary" && Number(row.total_calls ?? 0) >= 1,
      ),
    );

    const routeRows = await pool.query(
      `SELECT operation, source_path, metadata
         FROM telemetry
        WHERE operation IN ('query_metrics', 'get_cost_summary', 'get_kpi_summary')
          AND created_at >= $1
        ORDER BY created_at ASC`,
      [routeStart],
    );

    assert.ok(
      routeRows.rows.some((row) =>
        row.operation === "query_metrics"
        && row.source_path === "memory-engine/internal/tool-route-telemetry/query_metrics"
        && row.metadata?.telemetry_provenance_mode === "internal"
        && row.metadata?.requested_telemetry_partition === "production"
        && Number(row.metadata?.requested_limit ?? 0) === 5,
      ),
    );
    assert.ok(
      routeRows.rows.some((row) =>
        row.operation === "get_cost_summary"
        && row.source_path === "memory-engine/internal/tool-route-telemetry/get_cost_summary"
        && row.metadata?.requested_telemetry_partition === "production"
        && row.metadata?.requested_source_path === "COO/",
      ),
    );
    assert.ok(
      routeRows.rows.some((row) =>
        row.operation === "get_kpi_summary"
        && row.source_path === "memory-engine/internal/tool-route-telemetry/get_kpi_summary"
        && row.metadata?.requested_telemetry_partition === "production"
        && row.metadata?.requested_source_path === "COO/"
        && Number(row.metadata?.workflow_count ?? 0) >= 0,
      ),
    );
  } finally {
    await pool.query(
      `DELETE FROM telemetry
        WHERE created_at >= $1
          AND operation IN ('query_metrics', 'get_cost_summary', 'get_kpi_summary')
          AND source_path IN ($2, $3, $4)`,
      [
        routeStart,
        "memory-engine/internal/tool-route-telemetry/query_metrics",
        "memory-engine/internal/tool-route-telemetry/get_cost_summary",
        "memory-engine/internal/tool-route-telemetry/get_kpi_summary",
      ],
    );
    await client.close();
  }
});
