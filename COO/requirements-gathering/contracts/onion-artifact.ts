import { z } from "zod";
import {
  ApprovedOnionSnapshot,
  Boundary,
  FreezeStatus,
  MajorPart,
  OnionState,
  OpenDecision,
  PartClarification,
  hasMeaningfulText,
  type OnionState as OnionStateType,
} from "./onion-state.js";

export const WorkingScopeArtifact = z.object({
  schema_version: z.literal("1.0"),
  artifact_kind: z.literal("working_scope"),
  topic: z.string(),
  goal: z.string(),
  expected_result: z.string(),
  success_view: z.string(),
  major_parts: z.array(MajorPart),
  part_clarifications: z.record(PartClarification),
  experience_ui: OnionState.shape.experience_ui,
  boundaries: z.array(Boundary),
  open_decisions: z.array(OpenDecision),
  freeze_status: FreezeStatus,
  approved_snapshot: ApprovedOnionSnapshot.nullable(),
  scope_summary: z.array(z.string()),
});
export type WorkingScopeArtifact = z.infer<typeof WorkingScopeArtifact>;

export const RequirementItem = z.object({
  id: z.string(),
  title: z.string(),
  detail: z.string(),
  source_refs: z.array(z.string()).min(1),
  meaning_preservation: z.literal("verbatim_from_approved_snapshot"),
});
export type RequirementItem = z.infer<typeof RequirementItem>;

export const RequirementArtifact = z.object({
  schema_version: z.literal("1.0"),
  artifact_kind: z.literal("requirement_list"),
  artifact_id: z.string(),
  source_approval_turn_id: z.string(),
  human_scope: ApprovedOnionSnapshot,
  requirement_items: z.array(RequirementItem),
  explicit_boundaries: z.array(Boundary),
  open_business_decisions: z.array(OpenDecision),
  derivation_status: z.enum(["ready", "blocked"]),
  blockers: z.array(z.string()),
  derivation_notes: z.array(z.string()),
});
export type RequirementArtifact = z.infer<typeof RequirementArtifact>;

export function buildScopeSummaryLinesFromSnapshot(snapshot: ApprovedOnionSnapshot): string[] {
  const partLabels = snapshot.major_parts.map((part) => part.label);
  const openDecisionLabels = snapshot.open_decisions
    .filter((decision) => decision.status === "open")
    .map((decision) => decision.question);

  return [
    `Topic: ${snapshot.topic}`,
    `Goal: ${snapshot.goal}`,
    `Expected result: ${snapshot.expected_result}`,
    `Success view: ${snapshot.success_view}`,
    `Major parts: ${partLabels.length > 0 ? partLabels.join(", ") : "not yet defined"}`,
    `Experience/UI: ${snapshot.experience_ui.relevant ? snapshot.experience_ui.summary ?? "UI relevant but not yet summarized" : "not part of scope"}`,
    `Boundaries: ${snapshot.boundaries.length > 0 ? snapshot.boundaries.map((boundary) => boundary.statement).join(" | ") : "not yet explicit"}`,
    `Open decisions: ${openDecisionLabels.length > 0 ? openDecisionLabels.join(" | ") : "none"}`,
  ];
}

export function buildWorkingScopeArtifact(stateInput: OnionStateType): WorkingScopeArtifact {
  const state = OnionState.parse(stateInput);
  const partLabels = state.major_parts.map((part) => part.label);
  const openDecisionLabels = state.open_decisions
    .filter((decision) => decision.status === "open")
    .map((decision) => decision.question);

  const scopeSummary = [
    `Topic: ${hasMeaningfulText(state.topic) ? state.topic : "missing"}`,
    `Goal: ${hasMeaningfulText(state.goal) ? state.goal : "missing"}`,
    `Expected result: ${hasMeaningfulText(state.expected_result) ? state.expected_result : "missing"}`,
    `Success view: ${hasMeaningfulText(state.success_view) ? state.success_view : "missing"}`,
    `Major parts: ${partLabels.length > 0 ? partLabels.join(", ") : "missing"}`,
    `Experience/UI: ${state.experience_ui.relevant === null ? "not yet decided" : state.experience_ui.relevant ? state.experience_ui.summary ?? "UI relevant but not yet summarized" : "not part of scope"}`,
    `Boundaries: ${state.boundaries.length > 0 ? state.boundaries.map((boundary) => boundary.statement).join(" | ") : "missing"}`,
    `Open decisions: ${openDecisionLabels.length > 0 ? openDecisionLabels.join(" | ") : "none"}`,
  ];

  return WorkingScopeArtifact.parse({
    schema_version: "1.0",
    artifact_kind: "working_scope",
    topic: state.topic,
    goal: state.goal,
    expected_result: state.expected_result,
    success_view: state.success_view,
    major_parts: state.major_parts,
    part_clarifications: state.part_clarifications,
    experience_ui: state.experience_ui,
    boundaries: state.boundaries,
    open_decisions: state.open_decisions,
    freeze_status: state.freeze_status,
    approved_snapshot: state.approved_snapshot,
    scope_summary: scopeSummary,
  });
}
