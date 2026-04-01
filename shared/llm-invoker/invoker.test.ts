import test from "node:test";
import assert from "node:assert/strict";
import { createLLMProvenance } from "../provenance/types.js";
import type { MetricEvent } from "../telemetry/types.js";
import {
  buildInvocationTelemetryEvent,
} from "./invoker.js";

test("buildInvocationTelemetryEvent captures llm attempt metadata and usage", () => {
  const attempt = {
    provenance: createLLMProvenance(
      "019d45c5-0000-4000-8000-000000000001",
      "codex",
      "gpt-5.4",
      "medium",
      false,
      "shared/llm-invoker/test"
    ),
    latency_ms: 123,
    success: true,
    session_status: "resumed",
    usage: {
      prompt_chars: 100,
      response_chars: 40,
      tokens_in_estimated: 25,
      tokens_out_estimated: 10,
      estimated_cost_usd: 0.0003,
      token_estimation_basis: "char_heuristic_v1",
      cost_estimation_basis: "configured_model_rate_v1",
    },
  } satisfies Parameters<typeof buildInvocationTelemetryEvent>[0];

  const directEvent = buildInvocationTelemetryEvent(attempt, 1, 2) as Extract<MetricEvent, { category: "llm" }>;
  assert.equal(directEvent.category, "llm");
  assert.equal(directEvent.operation, "invoke_attempt");
  assert.equal(directEvent.success, true);
  assert.equal(directEvent.tokens_in, 25);
  assert.equal(directEvent.tokens_out, 10);
  assert.equal(directEvent.estimated_cost_usd, 0.0003);
  assert.equal((directEvent.metadata as Record<string, unknown>).attempt_index, 1);
  assert.equal((directEvent.metadata as Record<string, unknown>).attempt_count, 2);
  assert.equal((directEvent.metadata as Record<string, unknown>).session_status, "resumed");

  const failedAttempt = {
    provenance: createLLMProvenance(
      "019d45c5-0000-4000-8000-000000000002",
      "claude",
      "sonnet-4.5",
      "high",
      true,
      "shared/llm-invoker/test"
    ),
    latency_ms: 456,
    success: false,
    session_status: "replaced",
    error_message: "model timed out",
    usage: {
      prompt_chars: 160,
      response_chars: 0,
      tokens_in_estimated: 40,
      tokens_out_estimated: 0,
      estimated_cost_usd: 0.00012,
      token_estimation_basis: "char_heuristic_v1",
      cost_estimation_basis: "configured_model_rate_v1",
    },
  } satisfies Parameters<typeof buildInvocationTelemetryEvent>[0];

  const failedEvent = buildInvocationTelemetryEvent(failedAttempt, 2, 2) as Extract<MetricEvent, { category: "llm" }>;
  assert.equal(failedEvent.success, false);
  assert.equal(failedEvent.tokens_in, 40);
  assert.equal(failedEvent.tokens_out, 0);
  assert.equal((failedEvent.metadata as Record<string, unknown>).attempt_index, 2);
  assert.equal((failedEvent.metadata as Record<string, unknown>).attempt_count, 2);
  assert.equal((failedEvent.metadata as Record<string, unknown>).session_status, "replaced");
  assert.equal((failedEvent.metadata as Record<string, unknown>).error_message, "model timed out");
});
