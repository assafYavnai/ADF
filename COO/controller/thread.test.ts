import test from "node:test";
import assert from "node:assert/strict";
import { createEvent, createThread, serializeForLLM, getLatestSessionHandles } from "./thread.js";

test("serializeForLLM compacts around the latest state commit", () => {
  const thread = createThread();
  thread.events.push(
    createEvent("state_commit", {
      summary: "checkpoint",
      openLoops: ["loop-a"],
      decisions: ["decision-a"],
      sessionHandles: {
        classifier: {
          provider: "codex",
          model: "gpt-5.3-codex-spark",
          session_id: "11111111-1111-1111-1111-111111111111",
          source: "provider_returned",
        },
        intelligence: {
          provider: "codex",
          model: "gpt-5.4",
          session_id: "22222222-2222-2222-2222-222222222222",
          source: "caller_assigned",
        },
      },
    })
  );

  for (let i = 0; i < 20; i++) {
    thread.events.push(createEvent("user_input", { message: `recent-${i}` }));
  }

  const serialized = serializeForLLM(thread);

  assert.match(serialized, /<state_commit>/);
  assert.match(serialized, /recent-19/);
  assert.ok(!serialized.includes("recent-0"));
});

test("getLatestSessionHandles returns the latest checkpointed session handles", () => {
  const thread = createThread();
  thread.events.push(
    createEvent("state_commit", {
      summary: "checkpoint",
      openLoops: [],
      decisions: [],
      sessionHandles: {
        classifier: {
          provider: "claude",
          model: "sonnet",
          session_id: "33333333-3333-3333-3333-333333333333",
          source: "manual_recovery",
        },
      },
    })
  );

  const handles = getLatestSessionHandles(thread);
  assert.equal(handles.classifier?.session_id, "33333333-3333-3333-3333-333333333333");
});

test("createThread preserves explicit scope path", () => {
  const thread = createThread("assafyavnai/shippingagent/phase1-baseline");
  assert.equal(thread.scopePath, "assafyavnai/shippingagent/phase1-baseline");
});
