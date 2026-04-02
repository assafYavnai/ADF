import test from "node:test";
import assert from "node:assert/strict";
import { ClassifierOutput } from "./classifier.js";

test("classifier workflow contract only includes live COO routes", () => {
  assert.doesNotThrow(() => {
    ClassifierOutput.parse({
      intent: "remember this",
      workflow: "memory_operation",
      confidence: 0.9,
    });
  });

  assert.doesNotThrow(() => {
    ClassifierOutput.parse({
      intent: "shape a feature scope",
      workflow: "requirements_gathering_onion",
      confidence: 0.9,
    });
  });

  assert.throws(() => {
    ClassifierOutput.parse({
      intent: "delegate this",
      workflow: "specialist_path",
      confidence: 0.9,
    });
  });
});
