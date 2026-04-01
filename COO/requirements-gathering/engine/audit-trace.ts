import { OnionWorkflowAuditTrace } from "../contracts/onion-observability.js";
import {
  runTimedOperation,
  type OnionOperationRecord,
  type OperationClock,
} from "../contracts/onion-observability.js";
import { type OnionState as OnionStateType } from "../contracts/onion-state.js";
import { type OnionTurn as OnionTurnType } from "../contracts/onion-turn.js";
import {
  determineCurrentLayer,
  type ClarificationSelection,
} from "./clarification-policy.js";
import { type FreezeCheckResult } from "./freeze-check.js";
import { type ReadinessCheckResult } from "./readiness-check.js";

export function buildAuditTracePure(input: {
  trace_id: string;
  turn: OnionTurnType;
  state: OnionStateType;
  artifact_change_summary: string[];
  clarification: ClarificationSelection;
  freeze: FreezeCheckResult;
  readiness?: ReadinessCheckResult;
}) {
  const currentLayer = determineCurrentLayer(input.state);
  const readiness = input.readiness;

  let workflowStep = "state_update";
  let resultStatus = "updated";
  let decisionReason = input.clarification.decision_reason;

  if (readiness?.status === "ready") {
    workflowStep = "handoff_ready";
    resultStatus = "ready_for_handoff";
    decisionReason = readiness.handoff_summary;
  } else if (input.freeze.status === "ready_to_request") {
    workflowStep = "freeze_ready";
    resultStatus = "awaiting_freeze_approval";
    decisionReason = "The whole onion is coherent enough to request explicit freeze approval.";
  } else if (input.freeze.status === "blocked") {
    workflowStep = "clarification";
    resultStatus = "clarification_needed";
    decisionReason = input.freeze.blockers[0] ?? input.clarification.decision_reason;
  } else if (readiness?.status === "blocked") {
    workflowStep = "readiness_blocked";
    resultStatus = "handoff_blocked";
    decisionReason = readiness.handoff_summary;
  }

  return OnionWorkflowAuditTrace.parse({
    trace_id: input.trace_id,
    turn_id: input.turn.turn_id,
    current_layer: currentLayer,
    workflow_step: workflowStep,
    decision_reason: decisionReason,
    selected_next_question: input.clarification.next_question?.question ?? null,
    no_question_reason: input.clarification.no_question_reason,
    freeze_blockers: input.freeze.blockers,
    open_decisions_snapshot: input.state.open_decisions,
    artifact_change_summary: input.artifact_change_summary,
    result_status: resultStatus,
  });
}

export function buildAuditTrace(input: {
  trace_id: string;
  turn: OnionTurnType;
  state: OnionStateType;
  artifact_change_summary: string[];
  clarification: ClarificationSelection;
  freeze: FreezeCheckResult;
  readiness?: ReadinessCheckResult;
  clock?: OperationClock;
}): {
  trace: ReturnType<typeof buildAuditTracePure>;
  record: OnionOperationRecord;
} {
  const timed = runTimedOperation({
    trace_id: input.trace_id,
    turn_id: input.turn.turn_id,
    operation: "audit_trace_build",
    clock: input.clock,
    input_summary: {
      current_layer: determineCurrentLayer(input.state),
      change_count: input.artifact_change_summary.length,
      freeze_status: input.state.freeze_status.status,
    },
    execute: () => buildAuditTracePure(input),
    summarize_output: (trace) => ({
      workflow_step: trace.workflow_step,
      result_status: trace.result_status,
      has_next_question: trace.selected_next_question !== null,
    }),
  });

  return {
    trace: timed.result,
    record: timed.record,
  };
}
