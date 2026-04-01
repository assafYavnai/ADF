import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildAuditTrace } from "./engine/audit-trace.js";
import { deriveRequirementArtifact } from "./engine/artifact-deriver.js";
import { selectNextClarificationQuestion } from "./engine/clarification-policy.js";
import { evaluateFreezeReadiness } from "./engine/freeze-check.js";
import { reduceOnionState } from "./engine/onion-reducer.js";
import { evaluateReadiness } from "./engine/readiness-check.js";
import { NO_LLM_CALLS_POLICY, OnionWorkflowAuditTraceBundle, createStepClock } from "./contracts/onion-observability.js";
import { createEmptyOnionState } from "./contracts/onion-state.js";
import { OnionTurnFixture } from "./contracts/onion-turn.js";

async function loadTurnFixture(name: string) {
  const raw = await readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf-8");
  return OnionTurnFixture.parse(JSON.parse(raw));
}

async function loadTraceFixture(name: string) {
  const raw = await readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf-8");
  return OnionWorkflowAuditTraceBundle.parse(JSON.parse(raw));
}

async function runFixture(name: string, options?: { untilTurnId?: string; startedAtIso?: string }) {
  const fixture = await loadTurnFixture(name);
  const clock = createStepClock(options?.startedAtIso ?? "2026-04-01T12:00:00.000Z", 5);
  const perTurn: Array<{
    turn_id: string;
    clarificationTarget: string | null;
    state: ReturnType<typeof createEmptyOnionState>;
    freezeStatus: string;
    freezeBlockers: string[];
    derivationStatus: string;
    readinessStatus: string;
  }> = [];
  const auditTraces = [];
  const operationRecords = [];

  let state = createEmptyOnionState();
  let latestDerivation = deriveRequirementArtifact({
    trace_id: fixture.trace_id,
    turn_id: "bootstrap",
    state,
    clock,
  });
  let latestReadiness = evaluateReadiness({
    trace_id: fixture.trace_id,
    turn_id: "bootstrap",
    state,
    derivation: latestDerivation,
    clock,
  });

  for (const turn of fixture.turns) {
    const reduced = reduceOnionState({
      trace_id: fixture.trace_id,
      previous_state: state,
      turn,
      clock,
    });
    state = reduced.state;

    const clarification = selectNextClarificationQuestion({
      trace_id: fixture.trace_id,
      turn_id: turn.turn_id,
      state,
      clock,
    });
    const freeze = evaluateFreezeReadiness({
      trace_id: fixture.trace_id,
      turn_id: turn.turn_id,
      state,
      clock,
    });
    latestDerivation = deriveRequirementArtifact({
      trace_id: fixture.trace_id,
      turn_id: turn.turn_id,
      state,
      clock,
    });
    latestReadiness = evaluateReadiness({
      trace_id: fixture.trace_id,
      turn_id: turn.turn_id,
      state,
      derivation: latestDerivation,
      clock,
    });
    const audit = buildAuditTrace({
      trace_id: fixture.trace_id,
      turn,
      state,
      artifact_change_summary: reduced.artifact_change_summary,
      clarification: clarification.selection,
      freeze: freeze.result,
      readiness: latestReadiness,
      clock,
    });

    operationRecords.push(
      reduced.record,
      clarification.record,
      freeze.record,
      latestDerivation.record,
      latestReadiness.record,
      audit.record,
    );
    auditTraces.push(audit.trace);
    perTurn.push({
      turn_id: turn.turn_id,
      clarificationTarget: clarification.selection.next_question?.target ?? null,
      state,
      freezeStatus: freeze.result.status,
      freezeBlockers: freeze.result.blockers,
      derivationStatus: latestDerivation.status,
      readinessStatus: latestReadiness.status,
    });

    if (options?.untilTurnId === turn.turn_id) {
      break;
    }
  }

  return {
    fixture,
    state,
    perTurn,
    auditTraces,
    operationRecords,
    latestDerivation,
    latestReadiness,
  };
}

test("outside-in clarification asks one business question at a time", async () => {
  const emptyState = createEmptyOnionState();
  const firstQuestion = selectNextClarificationQuestion({
    trace_id: "outside-in",
    turn_id: "turn-000",
    state: emptyState,
    clock: createStepClock("2026-04-01T09:00:00.000Z", 5),
  }).selection;

  assert.equal(firstQuestion.current_layer, "topic");
  assert.equal(firstQuestion.next_question?.target, "topic");
  assert.equal(typeof firstQuestion.next_question?.question, "string");

  const sampleTurns = await loadTurnFixture("sample-onion-turns.json");
  const afterFirstTurn = reduceOnionState({
    trace_id: sampleTurns.trace_id,
    previous_state: emptyState,
    turn: sampleTurns.turns[0],
    clock: createStepClock("2026-04-01T09:01:00.000Z", 5),
  }).state;
  const secondQuestion = selectNextClarificationQuestion({
    trace_id: sampleTurns.trace_id,
    turn_id: "turn-001",
    state: afterFirstTurn,
    clock: createStepClock("2026-04-01T09:02:00.000Z", 5),
  }).selection;

  assert.equal(secondQuestion.current_layer, "expected_result");
  assert.equal(secondQuestion.next_question?.target, "expected_result");
  assert.equal(secondQuestion.next_question?.part_id, undefined);
});

test("major parts are required before per-part deep detail", async () => {
  const scenarioAfterTurn3 = await runFixture("sample-onion-turns.json", { untilTurnId: "turn-003" });
  assert.equal(scenarioAfterTurn3.perTurn.at(-1)?.clarificationTarget, "major_parts");

  const scenarioAfterTurn4 = await runFixture("sample-onion-turns.json", { untilTurnId: "turn-004" });
  assert.equal(scenarioAfterTurn4.perTurn.at(-1)?.clarificationTarget, "part_clarification");
  assert.equal(scenarioAfterTurn4.state.major_parts[0].id, "queue_view");
});

test("freeze gate stays explicit and requires approval after readiness", async () => {
  const readyScenario = await runFixture("sample-onion-turns.json", { untilTurnId: "turn-008" });
  assert.equal(readyScenario.perTurn.at(-1)?.freezeStatus, "ready_to_request");
  assert.equal(readyScenario.state.freeze_status.status, "ready_to_request");
  assert.equal(readyScenario.state.approved_snapshot, null);

  const approvedScenario = await runFixture("sample-onion-turns.json");
  assert.equal(approvedScenario.state.freeze_status.status, "approved");
  assert.ok(approvedScenario.state.approved_snapshot);
  assert.equal(approvedScenario.state.approved_snapshot?.approved_turn_id, "turn-009");
});

test("artifact derivation preserves approved meaning without intent drift", async () => {
  const scenario = await runFixture("sample-onion-turns.json");
  assert.equal(scenario.latestDerivation.status, "ready");
  assert.ok(scenario.latestDerivation.artifact);
  assert.deepEqual(scenario.latestDerivation.artifact?.human_scope, scenario.state.approved_snapshot);
  assert.equal(
    scenario.latestDerivation.artifact?.requirement_items.find((item) => item.id === "major-part:queue_view")?.detail,
    "Show active features, current status, owner, and any blocking reason.",
  );
});

test("readiness stays blocked while business decisions remain unresolved", async () => {
  const blockedScenario = await runFixture("sample-onion-turns.json", { untilTurnId: "turn-007" });
  assert.equal(blockedScenario.latestReadiness.status, "blocked");
  assert.match(blockedScenario.latestReadiness.handoff_summary, /open business decision/i);
  assert.ok(blockedScenario.perTurn.at(-1)?.freezeBlockers.some((blocker) => blocker.includes("Open business decision")));
});

test("execution-monitor fixture is deterministic", async () => {
  const first = await runFixture("execution-monitor.json", { startedAtIso: "2026-04-01T13:00:00.000Z" });
  const second = await runFixture("execution-monitor.json", { startedAtIso: "2026-04-01T13:00:00.000Z" });

  assert.deepEqual(first.state, second.state);
  assert.deepEqual(first.auditTraces, second.auditTraces);
  assert.deepEqual(first.operationRecords, second.operationRecords);
});

test("execution-monitor fixture matches expected clarification and end states", async () => {
  const executionFixture = await loadTurnFixture("execution-monitor.json");
  const scenario = await runFixture("execution-monitor.json");
  const expected = executionFixture.expected as {
    final_freeze_status: string;
    final_artifact_status: string;
    final_readiness_status: string;
    expected_next_targets: Array<string | null>;
  };

  assert.equal(scenario.state.freeze_status.status, expected.final_freeze_status);
  assert.equal(scenario.latestDerivation.status, expected.final_artifact_status);
  assert.equal(scenario.latestReadiness.status, expected.final_readiness_status);
  assert.deepEqual(
    scenario.perTurn.map((entry) => entry.clarificationTarget),
    expected.expected_next_targets,
  );
});

test("major onion operations produce typed timing records", async () => {
  const scenario = await runFixture("sample-onion-turns.json");
  const operations = [...new Set(scenario.operationRecords.map((record) => record.operation))].sort();

  assert.deepEqual(operations, [
    "artifact_deriver",
    "audit_trace_build",
    "clarification_policy",
    "freeze_check",
    "onion_reducer",
    "readiness_check",
  ]);

  for (const record of scenario.operationRecords) {
    assert.equal(record.trace_id, "execution-monitor-sample");
    assert.equal(record.duration_ms, 5);
    assert.equal(typeof record.started_at, "string");
    assert.equal(typeof record.completed_at, "string");
    assert.equal(typeof record.success, "boolean");
    assert.ok(record.input_summary);
    assert.ok(record.output_summary);
  }
});

test("workflow trace reconstructs the onion path without ambiguity", async () => {
  const scenario = await runFixture("sample-onion-turns.json");
  const expectedTraceFixture = await loadTraceFixture("sample-onion-trace.json");

  for (const trace of scenario.auditTraces) {
    assert.ok(trace.selected_next_question !== null || trace.no_question_reason !== null);
    assert.equal(trace.trace_id, "execution-monitor-sample");
    assert.equal(typeof trace.workflow_step, "string");
    assert.equal(typeof trace.result_status, "string");
  }

  assert.deepEqual(
    {
      trace_id: scenario.fixture.trace_id,
      traces: scenario.auditTraces,
    },
    expectedTraceFixture,
  );
});

test("the dormant onion lane explicitly contains no LLM calls", () => {
  assert.equal(NO_LLM_CALLS_POLICY.uses_llm_calls, false);
  assert.match(NO_LLM_CALLS_POLICY.rationale, /does not perform any LLM calls/i);
});
