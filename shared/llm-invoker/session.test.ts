import test from "node:test";
import assert from "node:assert/strict";
import {
  buildInvocationSessionResult,
  createClaudeFreshSessionHandle,
  extractCodexThreadIdFromJsonOutput,
  parseClaudePrintJson,
  shouldRetryWithFreshSession,
} from "./session.js";

test("extractCodexThreadIdFromJsonOutput finds thread ids in Codex JSONL output", () => {
  const threadId = extractCodexThreadIdFromJsonOutput([
    "{\"type\":\"thread.started\",\"thread_id\":\"019d401d-3bd7-7dd0-89c9-40b49398b1fb\"}",
    "{\"type\":\"item.completed\",\"item\":{\"id\":\"item_0\",\"type\":\"agent_message\",\"text\":\"OK\"}}",
  ].join("\n"));

  assert.equal(threadId, "019d401d-3bd7-7dd0-89c9-40b49398b1fb");
});

test("parseClaudePrintJson returns the model response and session id", () => {
  const parsed = parseClaudePrintJson(JSON.stringify({
    type: "result",
    subtype: "success",
    result: "OK",
    session_id: "53c67ac7-ccd7-43b5-9f92-525ad705f018",
  }));

  assert.equal(parsed.response, "OK");
  assert.equal(parsed.sessionId, "53c67ac7-ccd7-43b5-9f92-525ad705f018");
});

test("shouldRetryWithFreshSession recognizes missing-session errors", () => {
  assert.equal(
    shouldRetryWithFreshSession("codex", new Error("thread/resume: thread/resume failed: no rollout found for thread id 00000000-0000-0000-0000-000000000000")),
    true
  );
  assert.equal(
    shouldRetryWithFreshSession("claude", new Error("No conversation found with session ID: 00000000-0000-0000-0000-000000000000")),
    true
  );
  assert.equal(shouldRetryWithFreshSession("gemini", new Error("No session found")), false);
});

test("session helpers build fresh Claude handles and session results", () => {
  const handle = createClaudeFreshSessionHandle();
  const result = buildInvocationSessionResult(handle, "fresh");

  assert.equal(handle.provider, "claude");
  assert.match(handle.session_id, /^[0-9a-f-]{36}$/i);
  assert.equal(handle.source, "caller_assigned");
  assert.equal(result.handle, handle);
  assert.equal(result.status, "fresh");
});
