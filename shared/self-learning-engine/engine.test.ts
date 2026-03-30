import test from "node:test";
import assert from "node:assert/strict";
import { parseLearningOutputJson } from "./engine.js";

test("parseLearningOutputJson strips BOM and normalizes applies_to strings", () => {
  const parsed = parseLearningOutputJson(
    "\uFEFF" +
      JSON.stringify({
        new_rules: [
          {
            id: "ARB-999",
            rule: "Example rule",
            applies_to: "[\"<outputs>\",\"<completion>\"]",
            do: "Do the thing",
            dont: "Do not do the thing",
            source: "Round 1: example",
            version: 1,
          },
        ],
        existing_rules_covering: [],
        no_rule_needed: [],
      })
  );

  assert.deepEqual(parsed.new_rules[0].applies_to, ["<outputs>", "<completion>"]);
});
