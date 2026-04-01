import { z } from "zod";

const NonEmptyText = z.string().trim().min(1);

export const OnionLayer = z.enum([
  "topic",
  "goal",
  "expected_result",
  "success_view",
  "major_parts",
  "part_clarification",
  "experience_ui",
  "boundaries",
  "open_decisions",
  "whole_onion_freeze",
  "approved",
]);
export type OnionLayer = z.infer<typeof OnionLayer>;

export const MajorPart = z.object({
  id: NonEmptyText,
  label: NonEmptyText,
  summary: NonEmptyText.optional(),
  order: z.number().int().nonnegative(),
});
export type MajorPart = z.infer<typeof MajorPart>;

export const PartClarification = z.object({
  part_id: NonEmptyText,
  detail: NonEmptyText,
  questions_answered: z.array(NonEmptyText).default([]),
  status: z.enum(["pending", "clarified"]).default("clarified"),
});
export type PartClarification = z.infer<typeof PartClarification>;

export const ExperienceUi = z.object({
  relevant: z.boolean().nullable(),
  summary: NonEmptyText.optional(),
  preview_status: z.enum([
    "not_needed",
    "needed",
    "preview_proposed",
    "preview_approved",
  ]),
  preview_artifact: NonEmptyText.optional(),
  approval_notes: NonEmptyText.optional(),
});
export type ExperienceUi = z.infer<typeof ExperienceUi>;

export const Boundary = z.object({
  id: NonEmptyText,
  kind: z.enum(["constraint", "non_goal", "assumption"]),
  statement: NonEmptyText,
});
export type Boundary = z.infer<typeof Boundary>;

export const OpenDecision = z.object({
  id: NonEmptyText,
  question: NonEmptyText,
  impact: NonEmptyText,
  status: z.enum(["open", "resolved"]),
  resolution: NonEmptyText.optional(),
});
export type OpenDecision = z.infer<typeof OpenDecision>;

export const FreezeStatus = z.object({
  status: z.enum(["draft", "ready_to_request", "approved", "blocked"]),
  blockers: z.array(NonEmptyText).default([]),
  ready_since_turn_id: NonEmptyText.optional(),
  approved_turn_id: NonEmptyText.optional(),
  approval_note: NonEmptyText.optional(),
});
export type FreezeStatus = z.infer<typeof FreezeStatus>;

export const ApprovedOnionSnapshot = z.object({
  approved_turn_id: NonEmptyText,
  approved_at: z.string().datetime(),
  topic: NonEmptyText,
  goal: NonEmptyText,
  expected_result: NonEmptyText,
  success_view: NonEmptyText,
  major_parts: z.array(MajorPart),
  part_clarifications: z.record(PartClarification),
  experience_ui: ExperienceUi,
  boundaries: z.array(Boundary),
  open_decisions: z.array(OpenDecision),
});
export type ApprovedOnionSnapshot = z.infer<typeof ApprovedOnionSnapshot>;

export const OnionState = z.object({
  topic: z.string(),
  goal: z.string(),
  expected_result: z.string(),
  success_view: z.string(),
  major_parts: z.array(MajorPart),
  part_clarifications: z.record(PartClarification),
  experience_ui: ExperienceUi,
  boundaries: z.array(Boundary),
  open_decisions: z.array(OpenDecision),
  freeze_status: FreezeStatus,
  approved_snapshot: ApprovedOnionSnapshot.nullable(),
});
export type OnionState = z.infer<typeof OnionState>;

export function createEmptyOnionState(): OnionState {
  return OnionState.parse({
    topic: "",
    goal: "",
    expected_result: "",
    success_view: "",
    major_parts: [],
    part_clarifications: {},
    experience_ui: {
      relevant: null,
      preview_status: "not_needed",
    },
    boundaries: [],
    open_decisions: [],
    freeze_status: {
      status: "draft",
      blockers: [],
    },
    approved_snapshot: null,
  });
}

export function hasMeaningfulText(value: string): boolean {
  return value.trim().length > 0;
}

export function createApprovedOnionSnapshot(
  state: OnionState,
  approvedTurnId: string,
  approvedAt: string,
): ApprovedOnionSnapshot {
  return ApprovedOnionSnapshot.parse({
    approved_turn_id: approvedTurnId,
    approved_at: approvedAt,
    topic: state.topic,
    goal: state.goal,
    expected_result: state.expected_result,
    success_view: state.success_view,
    major_parts: state.major_parts,
    part_clarifications: state.part_clarifications,
    experience_ui: state.experience_ui,
    boundaries: state.boundaries,
    open_decisions: state.open_decisions,
  });
}
