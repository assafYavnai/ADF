import test from "node:test";
import assert from "node:assert/strict";
import { resolveContextPriority, resolveCompressionPolicy } from "./context-policy.js";

test("governance families are treated as high priority context", () => {
  for (const contentType of ["rule", "role", "setting", "finding"] as const) {
    assert.equal(resolveContextPriority(contentType, []), "p0");
    assert.equal(resolveCompressionPolicy(contentType, []), "full");
  }
});
