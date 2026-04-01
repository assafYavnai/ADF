import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../../components/memory-engine/src/db/connection.js";
import { MemoryEngineClient } from "../../COO/controller/memory-engine-client.js";
import { createSystemProvenance } from "../../shared/provenance/types.js";

test("mutation routes reject missing provenance and the DB blocks fresh sentinel provenance writes", async () => {
  const client = await MemoryEngineClient.connect(process.cwd());
  let memoryId: string | null = null;
  const callJsonTool = (client as any).callJsonTool.bind(client as any) as (
    name: string,
    args: Record<string, unknown>
  ) => Promise<Record<string, unknown>>;

  try {
    await assert.rejects(
      () => callJsonTool("capture_memory", {
        content: "missing provenance capture",
        content_type: "text",
        scope: "assafyavnai/shippingagent",
      }),
      /provenance/i
    );

    await assert.rejects(
      () => callJsonTool("log_decision", {
        title: "Missing provenance decision",
        reasoning: "Should fail closed",
        scope: "assafyavnai/shippingagent",
      }),
      /provenance/i
    );

    await assert.rejects(
      () => callJsonTool("rules_manage", {
        action: "create",
        scope: "assafyavnai/shippingagent",
        title: "Missing provenance rule",
        body: { text: "Should fail closed" },
      }),
      /provenance/i
    );

    const capture = await client.captureMemory(
      "provenance route memory_manage target",
      "text",
      ["integration"],
      "assafyavnai/shippingagent",
      createSystemProvenance("tests/integration/provenance-route:capture")
    );
    memoryId = typeof capture.id === "string" ? capture.id : null;
    assert.ok(memoryId, "capture should return memory id");

    await assert.rejects(
      () => callJsonTool("memory_manage", {
        action: "archive",
        memory_id: memoryId,
        scope: "assafyavnai/shippingagent",
      }),
      /provenance/i
    );

    await assert.rejects(
      () =>
        pool.query(
          `INSERT INTO memory_items (
             id, content, content_type, trust_level, scope_level,
             org_id, project_id, initiative_id, phase_id, thread_id,
             tags, context_priority, compression_policy,
             invocation_id, provider, model, reasoning, was_fallback, source_path
           )
           VALUES (
             $1, $2::jsonb, 'text', 'working', 'project',
             $3, $4, NULL, NULL, NULL,
             ARRAY[]::text[], 'p1', 'full',
             '00000000-0000-0000-0000-000000000000'::uuid, 'system', 'none', 'none', FALSE, 'system/pre-provenance'
           )`,
          [
            randomUUID(),
            JSON.stringify({ text: "legacy sentinel should be rejected" }),
            "00000000-0000-0000-0000-000000000001",
            "00000000-0000-0000-0000-000000000002",
          ]
        ),
      /legacy sentinel provenance/i
    );
  } finally {
    if (memoryId) {
      await pool.query("DELETE FROM memory_items WHERE id = $1", [memoryId]);
    }
    await client.close();
  }
});
