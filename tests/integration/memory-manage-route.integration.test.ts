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

test("memory_manage delete removes the scoped row and reports the receipt truthfully", async () => {
  const client = await MemoryEngineClient.connect(process.cwd());
  let memoryId: string | null = null;

  try {
    const capture = await client.captureMemory(
      "Scoped memory-manage delete test",
      "text",
      ["integration"],
      "assafyavnai/shippingagent",
      createSystemProvenance("tests/integration/memory-manage:delete-capture")
    );

    memoryId = typeof capture.id === "string" ? capture.id : null;
    assert.ok(memoryId, "capture should return memory id");

    const deleted = await client.manageMemory(
      "delete",
      memoryId,
      "assafyavnai/shippingagent",
      createSystemProvenance("tests/integration/memory-manage:delete")
    );

    assert.equal(deleted.status, "deleted");
    assert.equal(deleted.success, true);
    assert.equal(deleted.affected_rows, 1);

    const row = await pool.query("SELECT id FROM memory_items WHERE id = $1", [memoryId]);
    assert.equal(row.rows.length, 0);
    memoryId = null;
  } finally {
    if (memoryId) {
      await pool.query("DELETE FROM memory_items WHERE id = $1", [memoryId]);
    }
    await client.close();
  }
});

test("memory_manage update_tags updates tags through the scoped route", async () => {
  const client = await MemoryEngineClient.connect(process.cwd());
  let memoryId: string | null = null;

  try {
    const capture = await client.captureMemory(
      "Scoped memory-manage update-tags test",
      "text",
      ["integration"],
      "assafyavnai/shippingagent",
      createSystemProvenance("tests/integration/memory-manage:update-tags-capture")
    );

    memoryId = typeof capture.id === "string" ? capture.id : null;
    assert.ok(memoryId, "capture should return memory id");

    const updated = await client.manageMemory(
      "update_tags",
      memoryId,
      "assafyavnai/shippingagent",
      createSystemProvenance("tests/integration/memory-manage:update-tags"),
      { tags: ["integration", "updated"] }
    );

    assert.equal(updated.status, "tags_updated");
    assert.equal(updated.success, true);

    const row = await pool.query("SELECT tags FROM memory_items WHERE id = $1", [memoryId]);
    assert.deepEqual(row.rows[0].tags, ["integration", "updated"]);
  } finally {
    if (memoryId) {
      await pool.query("DELETE FROM memory_items WHERE id = $1", [memoryId]);
    }
    await client.close();
  }
});

test("memory_manage update_trust_level updates trust through the scoped route", async () => {
  const client = await MemoryEngineClient.connect(process.cwd());
  let memoryId: string | null = null;

  try {
    const capture = await client.captureMemory(
      "Scoped memory-manage trust test",
      "text",
      ["integration"],
      "assafyavnai/shippingagent",
      createSystemProvenance("tests/integration/memory-manage:update-trust-capture")
    );

    memoryId = typeof capture.id === "string" ? capture.id : null;
    assert.ok(memoryId, "capture should return memory id");

    const updated = await client.manageMemory(
      "update_trust_level",
      memoryId,
      "assafyavnai/shippingagent",
      createSystemProvenance("tests/integration/memory-manage:update-trust"),
      { trust_level: "reviewed" }
    );

    assert.equal(updated.status, "trust_level_updated");
    assert.equal(updated.success, true);

    const row = await pool.query("SELECT trust_level FROM memory_items WHERE id = $1", [memoryId]);
    assert.equal(row.rows[0].trust_level, "reviewed");
  } finally {
    if (memoryId) {
      await pool.query("DELETE FROM memory_items WHERE id = $1", [memoryId]);
    }
    await client.close();
  }
});

test("memory_manage archive retires a provisional finalized requirement from default readers", async () => {
  const client = await MemoryEngineClient.connect(process.cwd());
  let memoryId: string | null = null;

  try {
    const created = await client.createRequirement(
      "Finalized requirements: provisional archive",
      {
        artifact_kind: "requirement_list",
        trace_id: "integration-test-archive",
        artifact: {
          artifact_kind: "requirement_list",
          human_scope: {
            topic: "Archive provisional finalized requirement",
            goal: "Prove provisional finalized rows leave current truth after archive.",
            expected_result: "Default readers do not surface the retired row.",
            success_view: "A later retry can publish a single locked replacement.",
          },
          major_parts: [],
          boundaries: [],
          open_decisions: [],
          source_approval_turn_id: "approval-turn",
        },
      },
      ["requirements-gathering", "onion", "finalized-requirement-list", "coo-owned"],
      "assafyavnai/shippingagent",
      createSystemProvenance("tests/integration/memory-manage:archive-create"),
      { workflow_status: "pending_finalization" },
    );

    memoryId = typeof created.id === "string" ? created.id : null;
    assert.ok(memoryId, "createRequirement should return memory id");

    const provisionalReaders = await Promise.all([
      (client as any).callJsonTool("requirements_manage", {
        action: "list",
        scope: "assafyavnai/shippingagent",
      }) as Promise<Array<Record<string, unknown>>>,
      client.searchMemory(
        "Finalized requirements",
        "assafyavnai/shippingagent",
        createSystemProvenance("tests/integration/memory-manage:archive-provisional-search"),
        {
          content_types: ["requirement"],
          max_results: 20,
        },
      ),
      (client as any).callJsonTool("get_context_summary", {
        scope: "assafyavnai/shippingagent",
        content_type: "requirement",
        limit: 50,
      }) as Promise<{ items?: Array<Record<string, unknown>> }>,
    ]);
    assert.ok(!provisionalReaders[0].some((result) => result.id === memoryId));
    assert.ok(!provisionalReaders[1].some((result) => result.id === memoryId));
    assert.ok(!(provisionalReaders[2].items ?? []).some((result) => result.id === memoryId));

    const archived = await client.manageMemory(
      "archive",
      memoryId,
      "assafyavnai/shippingagent",
      createSystemProvenance("tests/integration/memory-manage:archive"),
      { reason: "Retire provisional finalized requirement after lock failure." },
    );

    assert.equal(archived.status, "archived");
    assert.equal(archived.success, true);
    assert.equal(archived.affected_rows, 1);

    const row = await pool.query(
      "SELECT trust_level, tags, workflow_metadata FROM memory_items WHERE id = $1",
      [memoryId],
    );
    assert.equal(row.rows.length, 1);
    assert.equal(row.rows[0].trust_level, "working");
    assert.ok((row.rows[0].tags as string[]).includes("archived"));
    assert.equal(row.rows[0].workflow_metadata?.status, "archived");

    const requirementsList = await (client as any).callJsonTool("requirements_manage", {
      action: "list",
      scope: "assafyavnai/shippingagent",
    }) as Array<Record<string, unknown>>;
    assert.ok(!requirementsList.some((result) => result.id === memoryId));

    const searchResults = await client.searchMemory(
      "Finalized requirements",
      "assafyavnai/shippingagent",
      createSystemProvenance("tests/integration/memory-manage:archive-search"),
      {
        content_types: ["requirement"],
        max_results: 20,
      },
    );
    assert.ok(!searchResults.some((result) => result.id === memoryId));

    const contextSummary = await (client as any).callJsonTool("get_context_summary", {
      scope: "assafyavnai/shippingagent",
      content_type: "requirement",
      limit: 50,
    }) as { items?: Array<Record<string, unknown>> };
    assert.ok(!(contextSummary.items ?? []).some((result) => result.id === memoryId));
  } finally {
    if (memoryId) {
      await pool.query("DELETE FROM memory_items WHERE id = $1", [memoryId]);
    }
    await client.close();
  }
});

test("memory_manage supersede retires locked COO-owned finalized requirements and hides them from default readers", async () => {
  const client = await MemoryEngineClient.connect(process.cwd());
  let memoryId: string | null = null;

  try {
    const created = await client.createRequirement(
      "Finalized requirements: integration supersede",
      {
        artifact_kind: "requirement_list",
        trace_id: "integration-test",
        artifact: {
          artifact_kind: "requirement_list",
          human_scope: {
            topic: "Integration supersede proof",
            goal: "Verify governed retirement of a locked finalized requirement.",
            expected_result: "Old finalized requirement no longer appears as current truth.",
            success_view: "The replacement path can continue after retirement.",
          },
          major_parts: [],
          boundaries: [],
          open_decisions: [],
          source_approval_turn_id: "approval-turn",
        },
      },
      ["requirements-gathering", "onion", "finalized-requirement-list", "coo-owned"],
      "assafyavnai/shippingagent",
      createSystemProvenance("tests/integration/memory-manage:supersede-create"),
      { workflow_status: "pending_finalization" },
    );

    memoryId = typeof created.id === "string" ? created.id : null;
    assert.ok(memoryId, "createRequirement should return memory id");

    const lockReceipt = await client.manageMemory(
      "update_trust_level",
      memoryId,
      "assafyavnai/shippingagent",
      createSystemProvenance("tests/integration/memory-manage:supersede-lock"),
      {
        trust_level: "locked",
        reason: "Prepare finalized requirement for retirement.",
        workflow_status: "current",
      },
    );
    assert.equal(lockReceipt.status, "trust_level_updated");
    assert.equal(lockReceipt.success, true);

    const supersedeReceipt = await client.manageMemory(
      "supersede",
      memoryId,
      "assafyavnai/shippingagent",
      createSystemProvenance("tests/integration/memory-manage:supersede"),
      { reason: "Reopened onion scope superseded the old finalized requirement." },
    );

    assert.equal(supersedeReceipt.status, "superseded");
    assert.equal(supersedeReceipt.success, true);
    assert.equal(supersedeReceipt.affected_rows, 1);

    const row = await pool.query(
      "SELECT trust_level, tags, workflow_metadata FROM memory_items WHERE id = $1",
      [memoryId],
    );
    assert.equal(row.rows.length, 1);
    assert.equal(row.rows[0].trust_level, "locked");
    assert.ok((row.rows[0].tags as string[]).includes("superseded"));
    assert.equal(row.rows[0].workflow_metadata?.status, "superseded");

    const searchResults = await client.searchMemory(
      "Finalized requirements",
      "assafyavnai/shippingagent",
      createSystemProvenance("tests/integration/memory-manage:supersede-search"),
      {
        content_types: ["requirement"],
        trust_levels: ["locked"],
        max_results: 20,
      },
    );
    assert.ok(!searchResults.some((result) => result.id === memoryId));

    const requirementsList = await (client as any).callJsonTool("requirements_manage", {
      action: "list",
      scope: "assafyavnai/shippingagent",
    }) as Array<Record<string, unknown>>;
    assert.ok(!requirementsList.some((result) => result.id === memoryId));
  } finally {
    if (memoryId) {
      const dbClient = await pool.connect();
      try {
        await dbClient.query("BEGIN");
        await dbClient.query(`SELECT set_config('project_brain.bypass_lock', 'on', true)`);
        await dbClient.query("DELETE FROM memory_items WHERE id = $1", [memoryId]);
        await dbClient.query("COMMIT");
      } catch (error) {
        await dbClient.query("ROLLBACK").catch(() => {});
        throw error;
      } finally {
        dbClient.release();
      }
    }
    await client.close();
  }
});
