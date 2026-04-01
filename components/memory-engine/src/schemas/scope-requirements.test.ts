import test from "node:test";
import assert from "node:assert/strict";
import { CaptureMemoryInput, MemoryManageInput, SearchMemoryInput } from "./memory-item.js";
import { DecisionSchema, LogDecisionInput } from "./decision.js";
import { GovernanceManageInput } from "./governance.js";

function sampleProvenance(sourcePath: string) {
  return {
    invocation_id: "11111111-1111-1111-1111-111111111111",
    provider: "system" as const,
    model: "none",
    reasoning: "test",
    was_fallback: false,
    source_path: sourcePath,
    timestamp: new Date().toISOString(),
  };
}

test("capture and decision writes require explicit scope", () => {
  assert.throws(() => {
    CaptureMemoryInput.parse({
      content: "remember this",
      content_type: "text",
      provenance: sampleProvenance("tests/scope-requirements"),
    });
  });

  assert.throws(() => {
    LogDecisionInput.parse({
      title: "Choose X",
      reasoning: "Because",
      provenance: sampleProvenance("tests/scope-requirements"),
    });
  });

  assert.throws(() => {
    CaptureMemoryInput.parse({
      content: "remember this",
      content_type: "text",
      scope: undefined,
      provenance: sampleProvenance("tests/scope-requirements"),
    });
  });
});

test("governance actions no longer advertise update or transition", () => {
  assert.throws(() => {
    GovernanceManageInput.parse({
      family: "rule",
      action: "update",
    });
  });

  assert.doesNotThrow(() => {
    GovernanceManageInput.parse({
      family: "rule",
      action: "create",
      scope: "assafyavnai/shippingagent",
      title: "Freeze requirements before implementation",
      provenance: sampleProvenance("tests/scope-requirements"),
    });
  });

  assert.throws(() => {
    GovernanceManageInput.parse({
      family: "artifact_ref",
      action: "list",
      scope: "assafyavnai/shippingagent",
    });
  });
});

test("scoped read contracts fail at parse time when scope is missing", () => {
  assert.throws(() => {
    SearchMemoryInput.parse({
      query: "decision",
    });
  });

  assert.throws(() => {
    GovernanceManageInput.parse({
      family: "rule",
      action: "search",
      query: "freeze",
    });
  });

  assert.throws(() => {
    GovernanceManageInput.parse({
      family: "rule",
      action: "list",
    });
  });

  assert.throws(() => {
    MemoryManageInput.parse({
      action: "delete",
      memory_id: "11111111-1111-1111-1111-111111111111",
      provenance: sampleProvenance("tests/scope-requirements"),
    });
  });
});

test("mutation contracts require provenance at parse time", () => {
  assert.throws(() => {
    CaptureMemoryInput.parse({
      content: "remember this",
      content_type: "text",
      scope: "assafyavnai/shippingagent",
    });
  });

  assert.throws(() => {
    LogDecisionInput.parse({
      title: "Choose X",
      reasoning: "Because",
      scope: "assafyavnai/shippingagent",
    });
  });

  assert.throws(() => {
    GovernanceManageInput.parse({
      family: "rule",
      action: "create",
      scope: "assafyavnai/shippingagent",
      title: "Freeze requirements",
    });
  });

  assert.throws(() => {
    MemoryManageInput.parse({
      action: "archive",
      memory_id: "11111111-1111-1111-1111-111111111111",
      scope: "assafyavnai/shippingagent",
    });
  });
});

test("decision schema allows nullable decided_by to match runtime and DB", () => {
  assert.doesNotThrow(() => {
    DecisionSchema.parse({
      id: "11111111-1111-1111-1111-111111111111",
      memory_item_id: "22222222-2222-2222-2222-222222222222",
      title: "Freeze requirements",
      reasoning: "Needed for downstream execution",
      provenance_reasoning: "controller review pass",
      derivation_mode: "direct_input",
      content_invocation_id: "44444444-4444-4444-4444-444444444444",
      content_provider: "system",
      content_model: "none",
      content_reasoning: "controller review pass",
      content_was_fallback: false,
      content_source_path: "tests/scope-requirements/content",
      alternatives_considered: [],
      decided_by: null,
      status: "active",
      invocation_id: "33333333-3333-3333-3333-333333333333",
      provider: "system",
      model: "none",
      was_fallback: false,
      source_path: "tests/scope-requirements",
      reasoning_state: "current",
      created_at: new Date().toISOString(),
    });
  });
});
