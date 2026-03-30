import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { RoleBuilderRequest } from "../schemas/request.js";
import type { ParticipantRecord } from "../schemas/result.js";
import {
  buildArtifactQualityAssessment,
  buildRunHistoryLedgerEntry,
  buildRunTelemetrySnapshot,
  readPhaseDurations,
  writeRunTelemetry,
} from "./run-telemetry.js";

function createRequest(): RoleBuilderRequest {
  return {
    job_id: "telemetry-test",
    role_slug: "agent-role-builder",
    runtime: {
      execution_mode: "live-roster-v1",
    },
  } as RoleBuilderRequest;
}

test("buildRunTelemetrySnapshot summarizes reviewer outcomes, llm economics, and engine metrics", () => {
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
      verdict: "ERROR: claude timed out",
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
        operation: "llm-invocation",
        latency_ms: 100,
        success: false,
        metadata: {
          engine: "board-review",
          session_status: "resumed",
        },
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
        operation: "llm-invocation",
        latency_ms: 120,
        success: true,
        tokens_in: 250,
        tokens_out: 80,
        estimated_cost_usd: 0.012,
        metadata: {
          engine: "self-learning-engine",
          session_status: "none",
        },
      },
      {
        provenance: {
          invocation_id: "33333333-3333-4333-8333-333333333333",
          provider: "codex",
          model: "gpt-5.4",
          reasoning: "high",
          was_fallback: false,
          source_path: "test",
          timestamp: "2026-03-30T16:00:00.000Z",
        },
        category: "tool",
        operation: "rules-compliance-enforcer",
        latency_ms: 250,
        success: true,
        metadata: {
          engine: "rules-compliance-enforcer",
          rule_count_checked: 3,
          rule_ids_checked: ["ARB-001", "ARB-002", "ARB-003"],
          non_compliant_count: 1,
          rule_ids_non_compliant: ["ARB-002"],
          fix_item_count: 2,
          changed: true,
        },
      },
      {
        provenance: {
          invocation_id: "44444444-4444-4444-8444-444444444444",
          provider: "system",
          model: "none",
          reasoning: "none",
          was_fallback: false,
          source_path: "test",
          timestamp: "2026-03-30T16:00:00.000Z",
        },
        category: "tool",
        operation: "self-learning-engine",
        latency_ms: 75,
        success: true,
        metadata: {
          engine: "self-learning-engine",
          review_finding_count: 2,
          new_rule_count: 1,
          new_rule_ids: ["ARB-026"],
          existing_rule_cover_count: 1,
          covered_rule_ids: ["ARB-002"],
          no_rule_needed_count: 0,
        },
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
  assert.equal(snapshot.llm_call_count, 2);
  assert.equal(snapshot.llm_failure_count, 1);
  assert.equal(snapshot.total_tokens_in_estimated, 250);
  assert.equal(snapshot.total_tokens_out_estimated, 80);
  assert.equal(snapshot.total_estimated_cost_usd, 0.012);
  assert.deepEqual(snapshot.session_status_counts, {
    none: 1,
    fresh: 0,
    resumed: 1,
    replaced: 0,
  });
  assert.equal(snapshot.rounds_attempted, 1);
  assert.equal(snapshot.rounds_completed, 1);
  assert.equal(snapshot.learning_artifact_written, true);
  assert.equal(snapshot.governance_snapshot_path, "tools/agent-role-builder/runs/test/governance-snapshot.json");
  assert.deepEqual(snapshot.provider_failures, [
    { provider: "codex", count: 1 },
  ]);
  assert.equal(snapshot.engine_metrics.length, 3);
  assert.equal(snapshot.major_bottleneck_engine, "rules-compliance-enforcer");
  assert.equal(snapshot.rule_metrics.checked_total, 3);
  assert.equal(snapshot.rule_metrics.non_compliant_total, 1);
  assert.equal(snapshot.rule_metrics.new_rule_proposal_total, 1);
  assert.deepEqual(snapshot.rule_metrics.rule_usage.find((entry) => entry.rule_id === "ARB-002"), {
    rule_id: "ARB-002",
    checked_count: 1,
    non_compliant_count: 1,
    learning_cover_count: 1,
    proposal_count: 0,
  });
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

test("buildArtifactQualityAssessment scores terminal quality deterministically", () => {
  const assessment = buildArtifactQualityAssessment({
    terminalStatus: "frozen_with_conditions",
    validationIssueCount: 1,
    selfCheckIssueCount: 1,
    reviewIssueCount: 3,
    unresolvedCount: 1,
  });

  assert.equal(assessment.method, "status-and-issue-weighting-v1");
  assert.equal(assessment.score, 58);
  assert.equal(assessment.band, "low");
});

test("readPhaseDurations aggregates repeated phases from run-history ledger", async () => {
  const runDir = await mkdtemp(join(tmpdir(), "arb-phase-history-"));
  const runtimeDir = join(runDir, "runtime");
  await mkdir(runtimeDir, { recursive: true });
  await writeFile(join(runtimeDir, "run-history.jsonl"), [
    JSON.stringify({
      schema_version: "1.0",
      component: "agent-role-builder",
      recorded_at: "2026-03-31T09:00:00.000Z",
      snapshot: { current_phase: "startup" },
    }),
    JSON.stringify({
      schema_version: "1.0",
      component: "agent-role-builder",
      recorded_at: "2026-03-31T09:00:05.000Z",
      snapshot: { current_phase: "governance-ready" },
    }),
    JSON.stringify({
      schema_version: "1.0",
      component: "agent-role-builder",
      recorded_at: "2026-03-31T09:00:15.000Z",
      snapshot: { current_phase: "round-0-started" },
    }),
  ].join("\n"), "utf-8");

  const phaseDurations = await readPhaseDurations(runDir, Date.parse("2026-03-31T09:00:20.000Z"));

  assert.deepEqual(phaseDurations, [
    { phase: "governance-ready", duration_ms: 10000 },
    { phase: "startup", duration_ms: 5000 },
    { phase: "round-0-started", duration_ms: 5000 },
  ]);
});
