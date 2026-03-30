import test from "node:test";
import assert from "node:assert/strict";
import type { RoleBuilderRequest } from "../schemas/request.js";
import type { ParticipantRecord } from "../schemas/result.js";
import { buildRunTelemetrySnapshot } from "./run-telemetry.js";

function createRequest(): RoleBuilderRequest {
  return {
    job_id: "telemetry-test",
    role_slug: "agent-role-builder",
    runtime: {
      execution_mode: "live-roster-v1",
    },
  } as RoleBuilderRequest;
}

test("buildRunTelemetrySnapshot summarizes reviewer outcomes and provider failures", () => {
  const request = createRequest();
  const participants = [
    {
      participant_id: "reviewer-0",
      provider: "codex",
      model: "gpt-5.4",
      role: "reviewer",
      verdict: "approved",
      round: 0,
      was_fallback: false,
    },
    {
      participant_id: "reviewer-1",
      provider: "claude",
      model: "sonnet",
      role: "reviewer",
      verdict: "parse-error",
      round: 0,
      was_fallback: false,
    },
  ] as ParticipantRecord[];

  const snapshot = buildRunTelemetrySnapshot({
    request,
    startedAtMs: Date.now() - 2500,
    startedAtIso: "2026-03-30T16:00:00.000Z",
    currentPhase: "round-0-complete",
    roundsAttempted: 1,
    roundsCompleted: 1,
    participants,
    telemetryEvents: [
      {
        provenance: {
          invocation_id: "11111111-1111-4111-8111-111111111111",
          provider: "codex",
          model: "gpt-5.4",
          reasoning: "high",
          was_fallback: false,
          source_path: "test",
          timestamp: "2026-03-30T16:00:00.000Z",
        },
        category: "llm",
        operation: "invoke-codex",
        latency_ms: 100,
        success: false,
      },
      {
        provenance: {
          invocation_id: "22222222-2222-4222-8222-222222222222",
          provider: "claude",
          model: "sonnet",
          reasoning: "high",
          was_fallback: false,
          source_path: "test",
          timestamp: "2026-03-30T16:00:00.000Z",
        },
        category: "llm",
        operation: "invoke-claude",
        latency_ms: 100,
        success: false,
      },
    ],
    governanceBinding: {
      snapshot_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      snapshot_manifest_path: "tools/agent-role-builder/runs/test/governance-snapshot.json",
    },
    latestLearningPath: "tools/agent-role-builder/runs/test/rounds/round-0/learning.json",
    runPostmortemPath: "tools/agent-role-builder/runs/test/run-postmortem.json",
    cyclePostmortemPath: null,
    resultPath: null,
    terminalStatus: null,
    stopReason: null,
  });

  assert.equal(snapshot.reviewer_success_count, 1);
  assert.equal(snapshot.reviewer_error_count, 1);
  assert.equal(snapshot.rounds_attempted, 1);
  assert.equal(snapshot.rounds_completed, 1);
  assert.equal(snapshot.learning_artifact_written, true);
  assert.equal(snapshot.governance_snapshot_path, "tools/agent-role-builder/runs/test/governance-snapshot.json");
  assert.deepEqual(snapshot.provider_failures, [
    { provider: "claude", count: 1 },
    { provider: "codex", count: 1 },
  ]);
});
