import { buildWorkingScopeArtifact } from "../contracts/onion-artifact.js";
import {
  Boundary,
  MajorPart,
  OpenDecision,
  OnionState,
  PartClarification,
  createApprovedOnionSnapshot,
  createEmptyOnionState,
  hasMeaningfulText,
  type OnionState as OnionStateType,
} from "../contracts/onion-state.js";
import { OnionTurn, type OnionTurn as OnionTurnType } from "../contracts/onion-turn.js";
import {
  runTimedOperation,
  type OnionOperationRecord,
  type OperationClock,
} from "../contracts/onion-observability.js";
import { evaluateFreezeReadinessPure } from "./freeze-check.js";

export interface ReduceOnionStateResult {
  state: OnionStateType;
  working_artifact: ReturnType<typeof buildWorkingScopeArtifact>;
  artifact_change_summary: string[];
}

function normalizeMajorParts(parts: Array<Omit<MajorPart, "order"> & { order?: number }>): MajorPart[] {
  const deduped = new Map<string, MajorPart>();

  parts.forEach((part, index) => {
    const normalized = MajorPart.parse({
      ...part,
      order: part.order ?? index,
    });
    deduped.set(normalized.id, normalized);
  });

  return [...deduped.values()].sort((left, right) => left.order - right.order);
}

function normalizeBoundaries(boundaries: Boundary[]): Boundary[] {
  const deduped = new Map<string, Boundary>();
  boundaries.forEach((boundary) => {
    deduped.set(boundary.id, Boundary.parse(boundary));
  });
  return [...deduped.values()];
}

function normalizeOpenDecisions(openDecisions: OpenDecision[]): OpenDecision[] {
  const deduped = new Map<string, OpenDecision>();
  openDecisions.forEach((decision) => {
    deduped.set(decision.id, OpenDecision.parse(decision));
  });
  return [...deduped.values()];
}

function applyScopeText(
  label: "topic" | "goal" | "expected_result" | "success_view",
  nextState: OnionStateType,
  nextValue: string | undefined,
  changes: string[],
): boolean {
  if (nextValue === undefined || nextValue === nextState[label]) {
    return false;
  }

  nextState[label] = nextValue;
  changes.push(`Updated ${label.replace(/_/g, " ")}.`);
  return true;
}

export function reduceOnionStatePure(input: {
  previous_state?: OnionStateType;
  turn: OnionTurnType;
}): ReduceOnionStateResult {
  const previousState = input.previous_state
    ? OnionState.parse(input.previous_state)
    : createEmptyOnionState();
  const turn = OnionTurn.parse(input.turn);
  const nextState = structuredClone(previousState);
  const changes: string[] = [];
  let scopeChanged = false;

  scopeChanged = applyScopeText("topic", nextState, turn.update.topic, changes) || scopeChanged;
  scopeChanged = applyScopeText("goal", nextState, turn.update.goal, changes) || scopeChanged;
  scopeChanged = applyScopeText("expected_result", nextState, turn.update.expected_result, changes) || scopeChanged;
  scopeChanged = applyScopeText("success_view", nextState, turn.update.success_view, changes) || scopeChanged;

  if (turn.update.major_parts !== undefined) {
    const normalizedParts = normalizeMajorParts(turn.update.major_parts);
    nextState.major_parts = normalizedParts;
    nextState.part_clarifications = Object.fromEntries(
      Object.entries(nextState.part_clarifications)
        .filter(([partId]) => normalizedParts.some((part) => part.id === partId)),
    );
    changes.push(`Replaced major parts with ${normalizedParts.length} item(s).`);
    scopeChanged = true;
  }

  for (const clarificationUpdate of turn.update.part_clarifications ?? []) {
    if (!nextState.major_parts.some((part) => part.id === clarificationUpdate.part_id)) {
      throw new Error(`Cannot clarify unknown major part "${clarificationUpdate.part_id}".`);
    }

    nextState.part_clarifications[clarificationUpdate.part_id] = PartClarification.parse({
      part_id: clarificationUpdate.part_id,
      detail: clarificationUpdate.detail,
      questions_answered: clarificationUpdate.questions_answered,
      status: "clarified",
    });
    changes.push(`Clarified part "${clarificationUpdate.part_id}".`);
    scopeChanged = true;
  }

  if (turn.update.experience_ui) {
    nextState.experience_ui = OnionState.shape.experience_ui.parse({
      ...nextState.experience_ui,
      ...turn.update.experience_ui,
    });
    changes.push("Updated experience/UI alignment.");
    scopeChanged = true;
  }

  if (turn.update.boundaries !== undefined) {
    nextState.boundaries = normalizeBoundaries(turn.update.boundaries);
    changes.push(`Replaced boundaries with ${nextState.boundaries.length} item(s).`);
    scopeChanged = true;
  }

  if (turn.update.open_decisions !== undefined) {
    nextState.open_decisions = normalizeOpenDecisions(turn.update.open_decisions);
    changes.push(`Replaced open decisions with ${nextState.open_decisions.length} item(s).`);
    scopeChanged = true;
  }

  for (const resolution of turn.update.resolve_open_decisions ?? []) {
    const existingDecision = nextState.open_decisions.find((decision) => decision.id === resolution.id);
    if (!existingDecision) {
      throw new Error(`Cannot resolve missing open decision "${resolution.id}".`);
    }

    existingDecision.status = "resolved";
    existingDecision.resolution = resolution.resolution;
    changes.push(`Resolved open decision "${resolution.id}".`);
    scopeChanged = true;
  }

  if (scopeChanged && previousState.freeze_status.status === "approved") {
    nextState.approved_snapshot = null;
    changes.push("Cleared prior approved snapshot because the scope changed.");
  }

  const freezeReadiness = evaluateFreezeReadinessPure(nextState);
  if (turn.update.freeze_response?.action === "approve") {
    if (freezeReadiness.status === "blocked") {
      nextState.freeze_status = {
        status: "blocked",
        blockers: freezeReadiness.blockers,
        approval_note: turn.update.freeze_response.note,
      };
      nextState.approved_snapshot = null;
      changes.push("Freeze approval was rejected internally because blockers remain.");
    } else {
      nextState.freeze_status = {
        status: "approved",
        blockers: [],
        ready_since_turn_id: previousState.freeze_status.ready_since_turn_id ?? turn.turn_id,
        approved_turn_id: turn.turn_id,
        approval_note: turn.update.freeze_response.note,
      };
      nextState.approved_snapshot = createApprovedOnionSnapshot(nextState, turn.turn_id, turn.timestamp);
      changes.push("Recorded explicit whole-onion freeze approval.");
    }
  } else if (turn.update.freeze_response?.action === "reject") {
    nextState.freeze_status = {
      status: "draft",
      blockers: freezeReadiness.blockers,
      approval_note: turn.update.freeze_response.note,
    };
    nextState.approved_snapshot = null;
    changes.push("Recorded explicit freeze rejection.");
  } else if (freezeReadiness.status === "ready_to_request") {
    nextState.freeze_status = {
      status: "ready_to_request",
      blockers: [],
      ready_since_turn_id: turn.turn_id,
    };
  } else {
    nextState.freeze_status = {
      status: "draft",
      blockers: freezeReadiness.blockers,
    };
  }

  if (changes.length === 0) {
    changes.push("No scope changes were applied.");
  }

  const workingArtifact = buildWorkingScopeArtifact(nextState);
  return {
    state: OnionState.parse(nextState),
    working_artifact: workingArtifact,
    artifact_change_summary: changes.length > 0 ? changes : ["No scope changes were applied."],
  };
}

export function reduceOnionState(input: {
  trace_id: string;
  turn: OnionTurnType;
  previous_state?: OnionStateType;
  clock?: OperationClock;
}): ReduceOnionStateResult & { record: OnionOperationRecord } {
  const turn = OnionTurn.parse(input.turn);
  const previousState = input.previous_state ?? createEmptyOnionState();
  const timed = runTimedOperation({
    trace_id: input.trace_id,
    turn_id: turn.turn_id,
    operation: "onion_reducer",
    clock: input.clock,
    input_summary: {
      actor: turn.actor,
      summary: turn.summary,
      had_previous_approval: OnionState.parse(previousState).freeze_status.status === "approved",
    },
    execute: () => reduceOnionStatePure({
      previous_state: previousState,
      turn,
    }),
    summarize_output: (result) => ({
      freeze_status: result.state.freeze_status.status,
      major_part_count: result.state.major_parts.length,
      change_count: result.artifact_change_summary.length,
    }),
  });

  return {
    ...timed.result,
    record: timed.record,
  };
}
