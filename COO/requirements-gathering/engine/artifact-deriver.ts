import { z } from "zod";
import {
  RequirementArtifact,
  type RequirementItem,
} from "../contracts/onion-artifact.js";
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

function getMissingSnapshotOuterShellFields(snapshot: NonNullable<OnionStateType["approved_snapshot"]>): Array<"topic" | "goal" | "expected_result" | "success_view"> {
  const missing: Array<"topic" | "goal" | "expected_result" | "success_view"> = [];

  if (!hasMeaningfulText(snapshot.topic)) {
    missing.push("topic");
  }
  if (!hasMeaningfulText(snapshot.goal)) {
    missing.push("goal");
  }
  if (!hasMeaningfulText(snapshot.expected_result)) {
    missing.push("expected_result");
  }
  if (!hasMeaningfulText(snapshot.success_view)) {
    missing.push("success_view");
  }

  return missing;
}

function getSnapshotPartsNeedingClarification(snapshot: NonNullable<OnionStateType["approved_snapshot"]>) {
  return snapshot.major_parts.filter((part) => {
    const clarification = snapshot.part_clarifications[part.id];
    return !clarification || clarification.status !== "clarified" || !hasMeaningfulText(clarification.detail);
  });
}

export const ArtifactDerivationResult = z.object({
  status: z.enum(["ready", "blocked"]),
  artifact: RequirementArtifact.nullable(),
  blockers: z.array(z.string()),
});
export type ArtifactDerivationResult = z.infer<typeof ArtifactDerivationResult>;

function listArtifactDerivationBlockers(stateInput: OnionStateType): string[] {
  const state = OnionState.parse(stateInput);
  const blockers: string[] = [];

  if (state.freeze_status.status !== "approved" || !state.approved_snapshot) {
    blockers.push("The human-facing onion is not explicitly frozen yet.");
    return blockers;
  }

  for (const field of getMissingSnapshotOuterShellFields(state.approved_snapshot)) {
    blockers.push(`Approved snapshot is missing "${field}".`);
  }

  for (const part of getSnapshotPartsNeedingClarification(state.approved_snapshot)) {
    blockers.push(`Approved snapshot is missing clarification for part "${part.label}".`);
  }

  if (state.approved_snapshot.experience_ui.relevant && !hasMeaningfulText(state.approved_snapshot.experience_ui.summary ?? "")) {
    blockers.push("Approved snapshot says UI meaning matters, but the UI summary is missing.");
  }

  if (state.approved_snapshot.experience_ui.relevant && state.approved_snapshot.experience_ui.preview_status !== "preview_approved") {
    blockers.push("Approved snapshot says UI meaning matters, but the preview loop was not approved.");
  }

  for (const decision of state.approved_snapshot.open_decisions) {
    if (decision.status === "open") {
      blockers.push(`Approved snapshot still contains open decision "${decision.id}".`);
    }
  }

  return blockers;
}

export function deriveRequirementArtifactPure(input: {
  trace_id: string;
  state: OnionStateType;
}): ArtifactDerivationResult {
  const state = OnionState.parse(input.state);
  const blockers = listArtifactDerivationBlockers(state);
  if (blockers.length > 0 || !state.approved_snapshot) {
    return {
      status: "blocked",
      artifact: null,
      blockers,
    };
  }

  const snapshot = state.approved_snapshot;
  const requirementItems: RequirementItem[] = [
    {
      id: "scope-anchor",
      title: "Feature outcome",
      detail: `Goal: ${snapshot.goal}\nExpected result: ${snapshot.expected_result}\nSuccess view: ${snapshot.success_view}`,
      source_refs: ["goal", "expected_result", "success_view"],
      meaning_preservation: "verbatim_from_approved_snapshot",
    },
    ...snapshot.major_parts.map((part) => ({
      id: `major-part:${part.id}`,
      title: part.label,
      detail: snapshot.part_clarifications[part.id]?.detail ?? "",
      source_refs: [`major_parts.${part.id}`, `part_clarifications.${part.id}`],
      meaning_preservation: "verbatim_from_approved_snapshot" as const,
    })),
  ];

  if (snapshot.experience_ui.relevant) {
    requirementItems.push({
      id: "experience-ui",
      title: "Experience / UI alignment",
      detail: snapshot.experience_ui.summary ?? "",
      source_refs: [
        "experience_ui.summary",
        ...(snapshot.experience_ui.preview_artifact ? ["experience_ui.preview_artifact"] : []),
      ],
      meaning_preservation: "verbatim_from_approved_snapshot",
    });
  }

  return {
    status: "ready",
    blockers: [],
    artifact: RequirementArtifact.parse({
      schema_version: "1.0",
      artifact_kind: "requirement_list",
      artifact_id: `onion-requirements::${input.trace_id}::${snapshot.approved_turn_id}`,
      source_approval_turn_id: snapshot.approved_turn_id,
      human_scope: snapshot,
      requirement_items: requirementItems,
      explicit_boundaries: snapshot.boundaries,
      open_business_decisions: snapshot.open_decisions.filter((decision) => decision.status === "open"),
      derivation_status: "ready",
      blockers: [],
      derivation_notes: [
        "Derived only from the approved onion snapshot.",
        "No LLM expansion or silent business guessing was used.",
      ],
    }),
  };
}

export function deriveRequirementArtifact(input: {
  trace_id: string;
  turn_id: string;
  state: OnionStateType;
  clock?: OperationClock;
}): ArtifactDerivationResult & { record: OnionOperationRecord } {
  const timed = runTimedOperation({
    trace_id: input.trace_id,
    turn_id: input.turn_id,
    operation: "artifact_deriver",
    clock: input.clock,
    input_summary: {
      freeze_status: OnionState.parse(input.state).freeze_status.status,
      approved_snapshot_present: OnionState.parse(input.state).approved_snapshot !== null,
    },
    execute: () => deriveRequirementArtifactPure({
      trace_id: input.trace_id,
      state: input.state,
    }),
    summarize_output: (result) => ({
      status: result.status,
      blocker_count: result.blockers.length,
      requirement_item_count: result.artifact?.requirement_items.length ?? 0,
    }),
  });

  return {
    ...timed.result,
    record: timed.record,
  };
}
