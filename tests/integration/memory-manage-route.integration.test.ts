import test from "node:test";
import assert from "node:assert/strict";
import { pool } from "../../components/memory-engine/src/db/connection.js";
import { MemoryEngineClient } from "../../COO/controller/memory-engine-client.js";
import { createSystemProvenance } from "../../shared/provenance/types.js";

test("memory_manage enforces exact scope on the mutation route and returns truthful receipts", async () => {
  const client = await MemoryEngineClient.connect(process.cwd());
  let memoryId: string | null = null;

  try {
    const capture = await client.captureMemory(
      "Scoped memory-manage integration test",
      "text",
      ["integration"],
      "assafyavnai/shippingagent",
      createSystemProvenance("tests/integration/memory-manage:capture")
    );

    memoryId = typeof capture.id === "string" ? capture.id : null;
    assert.ok(memoryId, "capture should return memory id");

    const wrongScope = await client.manageMemory(
      "archive",
      memoryId,
      "assafyavnai",
      createSystemProvenance("tests/integration/memory-manage:wrong-scope"),
      { reason: "should not mutate outside exact scope" }
    );

    assert.equal(wrongScope.status, "not_found");
    assert.equal(wrongScope.success, false);

    const rowBefore = await pool.query("SELECT tags FROM memory_items WHERE id = $1", [memoryId]);
    assert.equal(rowBefore.rows.length, 1);
    assert.equal((rowBefore.rows[0].tags as string[]).includes("archived"), false);

    const rightScope = await client.manageMemory(
      "archive",
      memoryId,
      "assafyavnai/shippingagent",
      createSystemProvenance("tests/integration/memory-manage:right-scope"),
      { reason: "archive within exact scope" }
    );

    assert.equal(rightScope.status, "archived");
    assert.equal(rightScope.success, true);
    assert.equal(rightScope.affected_rows, 1);

    const rowAfter = await pool.query("SELECT tags FROM memory_items WHERE id = $1", [memoryId]);
    assert.equal(rowAfter.rows.length, 1);
    assert.equal((rowAfter.rows[0].tags as string[]).includes("archived"), true);
  } finally {
    if (memoryId) {
      await pool.query("DELETE FROM memory_items WHERE id = $1", [memoryId]);
    }
    await client.close();
  }
});
