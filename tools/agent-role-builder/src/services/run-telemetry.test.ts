import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { RoleBuilderRequest } from "../schemas/request.js";
import type { ParticipantRecord } from "../schemas/result.js";
import { buildRunHistoryLedgerEntry, buildRunTelemetrySnapshot, writeRunTelemetry } from "./run-telemetry.js";

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

test("buildRunHistoryLedgerEntry wraps a telemetry snapshot without changing it", () => {
  const snapshot = buildRunTelemetrySnapshot({
    request: createRequest(),
    startedAtMs: Date.now() - 500,
    startedAtIso: "2026-03-30T16:00:00.000Z",
    currentPhase: "startup",
    roundsAttempted: 0,
    roundsCompleted: 0,
    participants: [],
    telemetryEvents: [],
    governanceBinding: null,
    latestLearningPath: null,
    runPostmortemPath: null,
    cyclePostmortemPath: null,
    resultPath: null,
    terminalStatus: null,
    stopReason: null,
  });

  const entry = buildRunHistoryLedgerEntry(snapshot);

  assert.equal(entry.schema_version, "1.0");
  assert.equal(entry.component, "agent-role-builder");
  assert.equal(entry.recorded_at, snapshot.last_updated_at);
  assert.deepEqual(entry.snapshot, snapshot);
});

test("writeRunTelemetry appends immutable run-history entries while updating the current snapshot", async () => {
  const runDir = await mkdtemp(join(tmpdir(), "arb-run-telemetry-"));
  const request = createRequest();

  await writeRunTelemetry({
    request,
    runDir,
    startedAtMs: Date.now() - 1000,
    startedAtIso: "2026-03-30T16:00:00.000Z",
    currentPhase: "startup",
    roundsAttempted: 0,
    roundsCompleted: 0,
    participants: [],
    governanceBinding: null,
    latestLearningPath: null,
    runPostmortemPath: null,
    cyclePostmortemPath: null,
    resultPath: null,
    terminalStatus: null,
    stopReason: null,
  });

  await writeRunTelemetry({
    request,
    runDir,
    startedAtMs: Date.now() - 500,
    startedAtIso: "2026-03-30T16:00:00.000Z",
    currentPhase: "terminal",
    roundsAttempted: 1,
    roundsCompleted: 1,
    participants: [],
    governanceBinding: null,
    latestLearningPath: null,
    runPostmortemPath: "tools/agent-role-builder/runs/test/run-postmortem.json",
    cyclePostmortemPath: "tools/agent-role-builder/runs/test/cycle-postmortem.json",
    resultPath: "tools/agent-role-builder/runs/test/result.json",
    terminalStatus: "blocked",
    stopReason: "test-stop",
  });

  const telemetrySnapshot = JSON.parse(await readFile(join(runDir, "runtime", "run-telemetry.json"), "utf-8")) as {
    current_phase: string;
    terminal_status: string | null;
    stop_reason: string | null;
  };
  const historyLines = (await readFile(join(runDir, "runtime", "run-history.jsonl"), "utf-8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as {
      snapshot: {
        current_phase: string;
        terminal_status: string | null;
        stop_reason: string | null;
      };
    });

  assert.equal(telemetrySnapshot.current_phase, "terminal");
  assert.equal(telemetrySnapshot.terminal_status, "blocked");
  assert.equal(telemetrySnapshot.stop_reason, "test-stop");
  assert.equal(historyLines.length, 2);
  assert.equal(historyLines[0]?.snapshot.current_phase, "startup");
  assert.equal(historyLines[0]?.snapshot.terminal_status, null);
  assert.equal(historyLines[1]?.snapshot.current_phase, "terminal");
  assert.equal(historyLines[1]?.snapshot.terminal_status, "blocked");
  assert.equal(historyLines[1]?.snapshot.stop_reason, "test-stop");
});
