import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../../components/memory-engine/src/db/connection.js";
import { DecisionSchema } from "../../components/memory-engine/src/schemas/decision.js";
import { MemoryEngineClient } from "../../COO/controller/memory-engine-client.js";
import { createLLMProvenance } from "../../shared/provenance/types.js";

const repoRoot = resolve(fileURLToPath(new URL("../../", import.meta.url)));

test("decision logging route persists a scoped decision through the MCP client", async () => {
  const client = await MemoryEngineClient.connect(repoRoot);
  const title = `Decision route test ${Date.now()}`;
  let memoryId: string | null = null;
  let decisionId: string | null = null;
  const provenance = createLLMProvenance(
    randomUUID(),
    "codex",
    "gpt-5.4",
    "decision-route-test",
    false,
    "tests/integration/decision-route"
  );

  try {
    const result = await client.logDecision(
      title,
      "Integration proof for decision persistence",
      [],
      "assafyavnai/shippingagent",
      provenance
    );

    memoryId = typeof result.memory_id === "string" ? result.memory_id : null;
    decisionId = typeof result.decision_id === "string" ? result.decision_id : null;

    assert.ok(memoryId, "memory_id should be returned");
    assert.ok(decisionId, "decision_id should be returned");

    const { rows } = await pool.query(
      `SELECT d.*,
              m.id AS memory_id,
              m.scope_level
       FROM decisions d
       JOIN memory_items m ON m.id = d.memory_item_id
       WHERE d.id = $1`,
      [decisionId]
    );

    assert.equal(rows.length, 1);
    const decision = DecisionSchema.parse(rows[0]);

    assert.equal(decision.id, decisionId);
    assert.equal(rows[0].memory_id, memoryId);
    assert.equal(decision.title, title);
    assert.equal(decision.reasoning, "Integration proof for decision persistence");
    assert.equal(decision.provenance_reasoning, provenance.reasoning);
    assert.equal(decision.reasoning_state, "current");
    assert.equal(decision.derivation_mode, "direct_input");
    assert.equal(decision.content_invocation_id, provenance.invocation_id);
    assert.equal(decision.content_provider, provenance.provider);
    assert.equal(decision.content_model, provenance.model);
    assert.equal(decision.content_reasoning, provenance.reasoning);
    assert.equal(decision.content_was_fallback, provenance.was_fallback);
    assert.equal(decision.content_source_path, provenance.source_path);
    assert.equal(decision.provider, provenance.provider);
    assert.equal(decision.model, provenance.model);
    assert.equal(decision.invocation_id, provenance.invocation_id);
    assert.equal(rows[0].scope_level, "project");
  } finally {
    if (memoryId) {
      await pool.query("DELETE FROM memory_items WHERE id = $1", [memoryId]);
    }
    await client.close();
  }
});

test("legacy decision rows can be repaired from the companion memory item without inventing data", async () => {
  const client = await MemoryEngineClient.connect(repoRoot);
  const title = `Legacy decision repair test ${Date.now()}`;
  let memoryId: string | null = null;
  let decisionId: string | null = null;

  try {
    const result = await client.logDecision(
      title,
      "Original business reasoning survives in memory content",
      [],
      "assafyavnai/shippingagent",
      createLLMProvenance(
        randomUUID(),
        "codex",
        "gpt-5.4",
        "legacy-decision-test",
        false,
        "tests/integration/decision-route"
      )
    );

    memoryId = typeof result.memory_id === "string" ? result.memory_id : null;
    decisionId = typeof result.decision_id === "string" ? result.decision_id : null;

    assert.ok(memoryId, "memory_id should be returned");
    assert.ok(decisionId, "decision_id should be returned");

    await pool.query(
      `UPDATE decisions
       SET reasoning = 'none',
           provenance_reasoning = 'none',
           reasoning_state = 'legacy_unrecoverable'
       WHERE id = $1`,
      [decisionId]
    );

    await pool.query(
      `UPDATE memory_items
       SET content = $1::jsonb
       WHERE id = $2`,
      [JSON.stringify({ text: "Original business reasoning survives in memory content" }), memoryId]
    );

    await pool.query(
      `WITH legacy_source AS (
         SELECT d.id,
                d.title,
                m.reasoning AS provenance_reasoning,
                CASE
                  WHEN left(m.content::text, 1) = '{' THEN m.content::jsonb->>'text'
                  ELSE NULL
                END AS content_text
         FROM decisions d
         JOIN memory_items m ON m.id = d.memory_item_id
         WHERE d.id = $1
       )
       UPDATE decisions d
       SET provenance_reasoning = COALESCE(NULLIF(legacy_source.provenance_reasoning, ''), 'none'),
           reasoning = CASE
             WHEN d.reasoning <> 'none' THEN d.reasoning
             WHEN legacy_source.content_text IS NOT NULL AND legacy_source.content_text LIKE legacy_source.title || ': %'
               THEN substring(legacy_source.content_text FROM char_length(legacy_source.title) + 3)
             WHEN legacy_source.content_text IS NOT NULL AND legacy_source.content_text <> ''
               THEN legacy_source.content_text
             ELSE d.reasoning
           END,
           reasoning_state = CASE
             WHEN d.reasoning <> 'none' THEN 'current'
             WHEN legacy_source.content_text IS NOT NULL AND legacy_source.content_text LIKE legacy_source.title || ': %'
               THEN 'legacy_recovered'
             WHEN legacy_source.content_text IS NOT NULL AND legacy_source.content_text <> ''
               THEN 'legacy_recovered'
             ELSE 'legacy_unrecoverable'
           END
       FROM legacy_source
       WHERE d.id = legacy_source.id`,
      [decisionId]
    );

    const { rows } = await pool.query(
      `SELECT *
       FROM decisions
       WHERE id = $1`,
      [decisionId]
    );

    assert.equal(rows.length, 1);
    const repaired = DecisionSchema.parse(rows[0]);
    assert.equal(repaired.reasoning, "Original business reasoning survives in memory content");
    assert.equal(repaired.provenance_reasoning, "legacy-decision-test");
    assert.equal(repaired.reasoning_state, "legacy_recovered");
    assert.equal(repaired.derivation_mode, "direct_input");
  } finally {
    if (memoryId) {
      await pool.query("DELETE FROM memory_items WHERE id = $1", [memoryId]);
    }
    await client.close();
  }
});

test("decision logging persists separate content provenance when the structured decision was extracted earlier", async () => {
  const client = await MemoryEngineClient.connect(repoRoot);
  const title = `Decision provenance chain test ${Date.now()}`;
  let memoryId: string | null = null;
  let decisionId: string | null = null;
  const writeProvenance = createLLMProvenance(
    randomUUID(),
    "codex",
    "gpt-5.4",
    "decision-write-route-test",
    false,
    "tests/integration/decision-route/write"
  );
  const contentProvenance = createLLMProvenance(
    randomUUID(),
    "claude",
    "sonnet",
    "decision-extractor-test",
    true,
    "tests/integration/decision-route/extractor"
  );

  try {
    const result = await client.logDecision(
      title,
      "Persist both the write and extractor provenance chains",
      [],
      "assafyavnai/shippingagent",
      writeProvenance,
      contentProvenance
    );

    memoryId = typeof result.memory_id === "string" ? result.memory_id : null;
    decisionId = typeof result.decision_id === "string" ? result.decision_id : null;

    assert.ok(memoryId, "memory_id should be returned");
    assert.ok(decisionId, "decision_id should be returned");

    const { rows } = await pool.query(
      `SELECT *
       FROM decisions
       WHERE id = $1`,
      [decisionId]
    );

    assert.equal(rows.length, 1);
    const decision = DecisionSchema.parse(rows[0]);

    assert.equal(decision.derivation_mode, "llm_extracted");
    assert.equal(decision.invocation_id, writeProvenance.invocation_id);
    assert.equal(decision.provider, writeProvenance.provider);
    assert.equal(decision.source_path, writeProvenance.source_path);
    assert.equal(decision.content_invocation_id, contentProvenance.invocation_id);
    assert.equal(decision.content_provider, contentProvenance.provider);
    assert.equal(decision.content_model, contentProvenance.model);
    assert.equal(decision.content_reasoning, contentProvenance.reasoning);
    assert.equal(decision.content_was_fallback, contentProvenance.was_fallback);
    assert.equal(decision.content_source_path, contentProvenance.source_path);
  } finally {
    if (memoryId) {
      await pool.query("DELETE FROM memory_items WHERE id = $1", [memoryId]);
    }
    await client.close();
  }
});
