import { z } from "zod";
import { OnionState, type OnionState as OnionStateType } from "../contracts/onion-state.js";
import {
  runTimedOperation,
  type OnionOperationRecord,
  type OperationClock,
} from "../contracts/onion-observability.js";
import {
  type ArtifactDerivationResult,
} from "./artifact-deriver.js";

function getMissingSnapshotOuterShellFields(snapshot: NonNullable<OnionStateType["approved_snapshot"]>): Array<"topic" | "goal" | "expected_result" | "success_view"> {
  const missing: Array<"topic" | "goal" | "expected_result" | "success_view"> = [];
  if (!snapshot.topic.trim()) {
    missing.push("topic");
  }
  if (!snapshot.goal.trim()) {
    missing.push("goal");
  }
  if (!snapshot.expected_result.trim()) {
    missing.push("expected_result");
  }
  if (!snapshot.success_view.trim()) {
    missing.push("success_view");
  }
  return missing;
}

function getSnapshotPartsNeedingClarification(snapshot: NonNullable<OnionStateType["approved_snapshot"]>) {
  return snapshot.major_parts.filter((part) => {
    const clarification = snapshot.part_clarifications[part.id];
    return !clarification || clarification.status !== "clarified" || !clarification.detail.trim();
  });
}

export const ReadinessChecklistItem = z.object({
  id: z.string(),
  passed: z.boolean(),
  reason: z.string(),
});
export type ReadinessChecklistItem = z.infer<typeof ReadinessChecklistItem>;

export const ReadinessCheckResult = z.object({
  status: z.enum(["ready", "blocked"]),
  blockers: z.array(z.string()),
  checklist: z.array(ReadinessChecklistItem),
  handoff_summary: z.string(),
});
export type ReadinessCheckResult = z.infer<typeof ReadinessCheckResult>;

export function evaluateReadinessPure(input: {
  state: OnionStateType;
  derivation: ArtifactDerivationResult;
}): ReadinessCheckResult {
  const state = OnionState.parse(input.state);
  const approvedSnapshot = state.approved_snapshot;
  const openDecisionCount = approvedSnapshot
    ? approvedSnapshot.open_decisions.filter((decision) => decision.status === "open").length
    : state.open_decisions.filter((decision) => decision.status === "open").length;
  const missingOuterShell = approvedSnapshot
    ? getMissingSnapshotOuterShellFields(approvedSnapshot)
    : [
      !state.topic.trim() ? "topic" : null,
      !state.goal.trim() ? "goal" : null,
      !state.expected_result.trim() ? "expected_result" : null,
      !state.success_view.trim() ? "success_view" : null,
    ].filter((value): value is "topic" | "goal" | "expected_result" | "success_view" => value !== null);
  const partsMissingClarification = approvedSnapshot
    ? getSnapshotPartsNeedingClarification(approvedSnapshot).length
    : state.major_parts.filter((part) => {
      const clarification = state.part_clarifications[part.id];
      return !clarification || clarification.status !== "clarified" || !clarification.detail.trim();
    }).length;
  const uiAligned = approvedSnapshot
    ? (
      !approvedSnapshot.experience_ui.relevant
      || (
        approvedSnapshot.experience_ui.preview_status === "preview_approved"
        && Boolean(approvedSnapshot.experience_ui.summary)
      )
    )
    : (
      state.experience_ui.relevant === false
      || (
        state.experience_ui.relevant === true
        && state.experience_ui.preview_status === "preview_approved"
        && Boolean(state.experience_ui.summary)
      )
    );
  const meaningPreserved = input.derivation.status === "ready"
    && input.derivation.artifact !== null
    && approvedSnapshot !== null
    && input.derivation.artifact.human_scope.approved_turn_id === approvedSnapshot.approved_turn_id
    && approvedSnapshot.major_parts.every((part) =>
      input.derivation.artifact?.requirement_items.some((item) => item.id === `major-part:${part.id}`),
    );

  const checklist: ReadinessChecklistItem[] = [
    {
      id: "freeze_approved",
      passed: state.freeze_status.status === "approved" && approvedSnapshot !== null,
      reason: state.freeze_status.status === "approved"
        ? "The human-facing onion has explicit freeze approval."
        : "The human-facing onion is not approved yet.",
    },
    {
      id: "outer_shell_complete",
      passed: missingOuterShell.length === 0,
      reason: missingOuterShell.length === 0
        ? "Topic, goal, expected result, and success view are explicit."
        : `Missing outer-shell fields: ${missingOuterShell.join(", ")}.`,
    },
    {
      id: "major_parts_clarified",
      passed: partsMissingClarification === 0,
      reason: partsMissingClarification === 0
        ? "Every major part has a business-level clarification."
        : `${partsMissingClarification} major part(s) still need clarification.`,
    },
    {
      id: "ui_alignment_resolved",
      passed: uiAligned,
      reason: uiAligned
        ? "UI alignment is either not needed or explicitly approved."
        : "UI meaning still needs a complete approved preview loop.",
    },
    {
      id: "boundaries_explicit",
      passed: approvedSnapshot ? approvedSnapshot.boundaries.length > 0 : state.boundaries.length > 0,
      reason: (approvedSnapshot ? approvedSnapshot.boundaries.length > 0 : state.boundaries.length > 0)
        ? "Boundaries and constraints are explicit."
        : "Boundaries and constraints are still missing.",
    },
    {
      id: "open_decisions_resolved",
      passed: openDecisionCount === 0,
      reason: openDecisionCount === 0
        ? "No open business decisions remain."
        : `${openDecisionCount} open business decision(s) remain.`,
    },
    {
      id: "artifact_ready",
      passed: input.derivation.status === "ready" && input.derivation.artifact !== null,
      reason: input.derivation.status === "ready"
        ? "Requirement artifact derivation completed successfully."
        : `Requirement artifact is blocked: ${input.derivation.blockers.join(" | ")}`,
    },
    {
      id: "meaning_preserved",
      passed: meaningPreserved,
      reason: meaningPreserved
        ? "The requirement artifact preserves the approved human meaning directly from the snapshot."
        : "The derived artifact does not yet prove end-to-end meaning preservation.",
    },
  ];

  const blockers = checklist
    .filter((item) => !item.passed)
    .map((item) => item.reason);

  return {
    status: blockers.length === 0 ? "ready" : "blocked",
    blockers,
    checklist,
    handoff_summary: blockers.length === 0
      ? "Requirement artifact is ready for downstream technical review without hidden business guessing."
      : `Requirement artifact handoff is blocked: ${blockers.join(" | ")}`,
  };
}

export function evaluateReadiness(input: {
  trace_id: string;
  turn_id: string;
  state: OnionStateType;
  derivation: ArtifactDerivationResult;
  clock?: OperationClock;
}): ReadinessCheckResult & { record: OnionOperationRecord } {
  const timed = runTimedOperation({
    trace_id: input.trace_id,
    turn_id: input.turn_id,
    operation: "readiness_check",
    clock: input.clock,
    input_summary: {
      freeze_status: OnionState.parse(input.state).freeze_status.status,
      derivation_status: input.derivation.status,
    },
    execute: () => evaluateReadinessPure({
      state: input.state,
      derivation: input.derivation,
    }),
    summarize_output: (result) => ({
      status: result.status,
      blocker_count: result.blockers.length,
      checklist_count: result.checklist.length,
    }),
  });

  return {
    ...timed.result,
    record: timed.record,
  };
}
