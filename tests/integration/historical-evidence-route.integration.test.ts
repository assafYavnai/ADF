import test from "node:test";
import assert from "node:assert/strict";
import { pool } from "../../components/memory-engine/src/db/connection.js";
import { MemoryEngineClient } from "../../COO/controller/memory-engine-client.js";
import { createSystemProvenance } from "../../shared/provenance/types.js";

const LEGACY_MARKER = "ADF_LEGACY_SENTINEL_V1";

test("default reads exclude explicitly archived legacy evidence and explicit legacy reads expose the new markers", async () => {
  const client = await MemoryEngineClient.connect(process.cwd());
  const marker = `historical-evidence-${Date.now()}`;
  let memoryId: string | null = null;

  try {
    const capture = await client.captureMemory(
      `explicit evidence format marker ${marker}`,
      "text",
      ["integration", "historical-evidence-route"],
      "assafyavnai/shippingagent",
      createSystemProvenance("tests/integration/historical-evidence-route:capture")
    );
    memoryId = typeof capture.id === "string" ? capture.id : null;
    assert.ok(memoryId, "capture should return memory id");

    const { rows: currentRows } = await pool.query(
      `SELECT evidence_format_version, evidence_lifecycle_status, legacy_marker
       FROM memory_items
       WHERE id = $1`,
      [memoryId]
    );
    assert.equal(currentRows.length, 1);
    assert.equal(currentRows[0].evidence_format_version, 2);
    assert.equal(currentRows[0].evidence_lifecycle_status, "current");
    assert.equal(currentRows[0].legacy_marker, null);

    await pool.query(
      `UPDATE memory_items
       SET evidence_lifecycle_status = 'legacy_archived',
           legacy_marker = $2
       WHERE id = $1`,
      [memoryId, LEGACY_MARKER]
    );

    const modernResults = await client.searchMemory(
      marker,
      "assafyavnai/shippingagent",
      createSystemProvenance("tests/integration/historical-evidence-route:search-modern"),
      { include_legacy: false, max_results: 20 }
    );
    assert.ok(!modernResults.some((row) => row.id === memoryId), "default read should exclude archived legacy evidence");

    const legacyResults = await client.searchMemory(
      marker,
      "assafyavnai/shippingagent",
      createSystemProvenance("tests/integration/historical-evidence-route:search-legacy"),
      { include_legacy: true, max_results: 20 }
    );
    const legacyRow = legacyResults.find((row) => row.id === memoryId);
    assert.ok(legacyRow, "explicit legacy read should return the archived legacy evidence");
    assert.equal(legacyRow.evidence_format_version, 2);
    assert.equal(legacyRow.evidence_lifecycle_status, "legacy_archived");
    assert.equal(legacyRow.legacy_marker, LEGACY_MARKER);
  } finally {
    if (memoryId) {
      await pool.query("DELETE FROM memory_items WHERE id = $1", [memoryId]);
    }
    await client.close();
  }
});
