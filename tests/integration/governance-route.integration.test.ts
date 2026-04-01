import test from "node:test";
import assert from "node:assert/strict";
import { pool } from "../../components/memory-engine/src/db/connection.js";
import { MemoryEngineClient } from "../../COO/controller/memory-engine-client.js";
import { createSystemProvenance } from "../../shared/provenance/types.js";

test("governance create/list/get/search work end to end through the MCP route", async () => {
  const client = await MemoryEngineClient.connect(process.cwd());
  const callJsonTool = (client as any).callJsonTool.bind(client as any) as (
    name: string,
    args: Record<string, unknown>
  ) => Promise<any>;
  const title = `Governance route rule ${Date.now()}`;
  let ruleId: string | null = null;

  try {
    const created = await client.createRule(
      title,
      `${title} body`,
      ["integration", "governance-route"],
      "assafyavnai/shippingagent",
      createSystemProvenance("tests/integration/governance-route:create")
    );

    ruleId = typeof created.id === "string" ? created.id : null;
    assert.ok(ruleId, "governance create should return id");

    const listed = await callJsonTool("rules_manage", {
      action: "list",
      scope: "assafyavnai/shippingagent",
    }) as Array<Record<string, unknown>>;
    assert.ok(listed.some((row) => row.id === ruleId), "list should include the created rule");

    const got = await callJsonTool("rules_manage", {
      action: "get",
      id: ruleId,
      scope: "assafyavnai/shippingagent",
    }) as Record<string, unknown>;
    assert.equal(got.id, ruleId);

    const searched = await callJsonTool("rules_manage", {
      action: "search",
      scope: "assafyavnai/shippingagent",
      query: title,
    }) as Array<Record<string, unknown>>;
    assert.ok(searched.some((row) => row.id === ruleId), "search should include the created rule");
  } finally {
    if (ruleId) {
      await pool.query("DELETE FROM memory_items WHERE id = $1", [ruleId]);
    }
    await client.close();
  }
});
