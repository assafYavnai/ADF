import test from "node:test";
import assert from "node:assert/strict";
import { createThread } from "../../COO/controller/thread.js";
import { assembleContext } from "../../COO/context-engineer/context-engineer.js";
import { pool } from "../../components/memory-engine/src/db/connection.js";
import { MemoryEngineClient } from "../../COO/controller/memory-engine-client.js";
import { createSystemProvenance } from "../../shared/provenance/types.js";

test("hidden COO recall injects only reviewed scoped governance memory from a mixed corpus", async () => {
  const client = await MemoryEngineClient.connect(process.cwd());
  const sharedTopic = `governance-recall-${Date.now()}`;
  const reviewedMarker = `reviewed-rule-${Date.now()}`;
  const workingMarker = `working-rule-${Date.now()}`;
  let reviewedId: string | null = null;
  let workingId: string | null = null;

  try {
    const reviewed = await client.createRule(
      reviewedMarker,
      `${sharedTopic} ${reviewedMarker} approved body`,
      ["integration", "retrieval-route"],
      "assafyavnai/shippingagent",
      createSystemProvenance("tests/integration/retrieval-route:reviewed-create")
    );
    reviewedId = typeof reviewed.id === "string" ? reviewed.id : null;
    assert.ok(reviewedId, "reviewed rule should return id");

    const working = await client.createRule(
      workingMarker,
      `${sharedTopic} ${workingMarker} draft body`,
      ["integration", "retrieval-route"],
      "assafyavnai/shippingagent",
      createSystemProvenance("tests/integration/retrieval-route:working-create")
    );
    workingId = typeof working.id === "string" ? working.id : null;
    assert.ok(workingId, "working rule should return id");

    const trustReceipt = await client.manageMemory(
      "update_trust_level",
      reviewedId,
      "assafyavnai/shippingagent",
      createSystemProvenance("tests/integration/retrieval-route:trust"),
      { trust_level: "reviewed" }
    );
    assert.equal(trustReceipt.status, "trust_level_updated");

    const ctx = await assembleContext(
      createThread("assafyavnai/shippingagent"),
      sharedTopic,
      {
        projectRoot: process.cwd(),
        promptsDir: `${process.cwd()}\\COO\\intelligence`,
        memoryDir: `${process.cwd()}\\memory`,
        scopePath: "assafyavnai/shippingagent",
        brainSearch: async (query, scopePath, provenance, options) => {
          const results = await client.searchMemory(query, scopePath, provenance, {
            content_type: options?.contentType,
            content_types: options?.contentTypes,
            trust_levels: options?.trustLevels,
            max_results: options?.maxResults,
          });
          return results.map((result) => ({
            id: String(result.id ?? ""),
            content_type: String(result.content_type ?? "text"),
            trust_level: String(result.trust_level ?? "working"),
            preview: String(result.preview ?? ""),
            context_priority: String(result.context_priority ?? "p2"),
            score: Number(result.score ?? 0),
          }));
        },
      }
    );

    assert.match(ctx.knowledgeContext, new RegExp(reviewedMarker));
    assert.doesNotMatch(ctx.knowledgeContext, new RegExp(workingMarker));
  } finally {
    if (reviewedId) {
      await pool.query("DELETE FROM memory_items WHERE id = $1", [reviewedId]);
    }
    if (workingId) {
      await pool.query("DELETE FROM memory_items WHERE id = $1", [workingId]);
    }
    await client.close();
  }
});
