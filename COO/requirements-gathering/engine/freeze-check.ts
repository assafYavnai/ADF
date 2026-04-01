import { z } from "zod";
import { WorkingScopeArtifact, buildWorkingScopeArtifact } from "../contracts/onion-artifact.js";
import {
  OnionState,
  hasMeaningfulText,
  type OnionState as OnionStateType,
} from "../contracts/onion-state.js";
import {
  runTimedOperation,
  type OnionOperationRecord,
  type OperationClock,
} from "../contracts/onion-observability.js";
import {
  getMissingOuterShellFields,
  getPartsNeedingClarification,
} from "./clarification-policy.js";

export const FreezeRequest = z.object({
  reflection: z.array(z.string()).min(1),
  approval_question: z.string(),
});
export type FreezeRequest = z.infer<typeof FreezeRequest>;

export const FreezeCheckResult = z.object({
  status: z.enum(["blocked", "ready_to_request", "approved"]),
  blockers: z.array(z.string()),
  whole_onion_artifact: WorkingScopeArtifact,
  freeze_request: FreezeRequest.nullable(),
});
export type FreezeCheckResult = z.infer<typeof FreezeCheckResult>;

export function listFreezeBlockers(stateInput: OnionStateType): string[] {
  const state = OnionState.parse(stateInput);
  const blockers: string[] = [];

  for (const field of getMissingOuterShellFields(state)) {
    blockers.push(`Outer-shell field "${field}" is still missing.`);
  }

  if (state.major_parts.length === 0) {
    blockers.push("Major parts are still missing.");
  }

  for (const part of getPartsNeedingClarification(state)) {
    blockers.push(`Major part "${part.label}" still needs clarification.`);
  }

  if (state.experience_ui.relevant === null) {
    blockers.push("The scope still needs an explicit UI/experience relevance decision.");
  }

  if (state.experience_ui.relevant) {
    if (!hasMeaningfulText(state.experience_ui.summary ?? "")) {
      blockers.push("UI meaning matters, but the experience summary is still missing.");
    }
    if (state.experience_ui.preview_status !== "preview_approved") {
      blockers.push("UI meaning matters, but the preview/mockup loop is not approved yet.");
    }
  }

  if (state.boundaries.length === 0) {
    blockers.push("Boundaries, non-goals, or constraints are still missing.");
  }

  for (const decision of state.open_decisions) {
    if (decision.status === "open") {
      blockers.push(`Open business decision "${decision.id}" is unresolved: ${decision.question}`);
    }
  }

  return blockers;
}

export function evaluateFreezeReadinessPure(stateInput: OnionStateType): FreezeCheckResult {
  const state = OnionState.parse(stateInput);
  const wholeOnionArtifact = buildWorkingScopeArtifact(state);

  if (state.freeze_status.status === "approved" && state.approved_snapshot) {
    return {
      status: "approved",
      blockers: [],
      whole_onion_artifact: wholeOnionArtifact,
      freeze_request: null,
    };
  }

  const blockers = listFreezeBlockers(state);
  if (blockers.length > 0) {
    return {
      status: "blocked",
      blockers,
      whole_onion_artifact: wholeOnionArtifact,
      freeze_request: null,
    };
  }

  return {
    status: "ready_to_request",
    blockers: [],
    whole_onion_artifact: wholeOnionArtifact,
    freeze_request: {
      reflection: wholeOnionArtifact.scope_summary,
      approval_question: "This is the full human-facing onion. Is anything missing or wrong, and should I freeze it now?",
    },
  };
}

export function evaluateFreezeReadiness(input: {
  trace_id: string;
  turn_id: string;
  state: OnionStateType;
  clock?: OperationClock;
}): {
  result: FreezeCheckResult;
  record: OnionOperationRecord;
} {
  const timed = runTimedOperation({
    trace_id: input.trace_id,
    turn_id: input.turn_id,
    operation: "freeze_check",
    clock: input.clock,
    input_summary: {
      freeze_status: OnionState.parse(input.state).freeze_status.status,
      open_decision_count: OnionState.parse(input.state).open_decisions.filter((decision) => decision.status === "open").length,
    },
    execute: () => evaluateFreezeReadinessPure(input.state),
    summarize_output: (result) => ({
      status: result.status,
      blocker_count: result.blockers.length,
      has_freeze_request: result.freeze_request !== null,
    }),
  });

  return {
    result: timed.result,
    record: timed.record,
  };
}
