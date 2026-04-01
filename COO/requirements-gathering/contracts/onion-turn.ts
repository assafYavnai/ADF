import { z } from "zod";
import { Boundary, ExperienceUi, MajorPart, OpenDecision } from "./onion-state.js";

const NonEmptyText = z.string().trim().min(1);

const MajorPartInput = MajorPart.extend({
  order: z.number().int().nonnegative().optional(),
});

const PartClarificationUpdate = z.object({
  part_id: NonEmptyText,
  detail: NonEmptyText,
  questions_answered: z.array(NonEmptyText).default([]),
});

const ExperienceUiUpdate = ExperienceUi.partial();

const OpenDecisionResolution = z.object({
  id: NonEmptyText,
  resolution: NonEmptyText,
});

const FreezeResponse = z.object({
  action: z.enum(["approve", "reject"]),
  note: NonEmptyText.optional(),
});

export const OnionTurnUpdate = z.object({
  topic: NonEmptyText.optional(),
  goal: NonEmptyText.optional(),
  expected_result: NonEmptyText.optional(),
  success_view: NonEmptyText.optional(),
  major_parts: z.array(MajorPartInput).optional(),
  part_clarifications: z.array(PartClarificationUpdate).optional(),
  experience_ui: ExperienceUiUpdate.optional(),
  boundaries: z.array(Boundary).optional(),
  open_decisions: z.array(OpenDecision).optional(),
  resolve_open_decisions: z.array(OpenDecisionResolution).optional(),
  freeze_response: FreezeResponse.optional(),
}).default({});
export type OnionTurnUpdate = z.infer<typeof OnionTurnUpdate>;

export const OnionTurn = z.object({
  turn_id: NonEmptyText,
  timestamp: z.string().datetime(),
  actor: z.enum(["ceo", "coo"]),
  summary: NonEmptyText,
  update: OnionTurnUpdate,
});
export type OnionTurn = z.infer<typeof OnionTurn>;

export const OnionTurnFixture = z.object({
  trace_id: NonEmptyText,
  description: NonEmptyText,
  turns: z.array(OnionTurn),
  expected: z.record(z.unknown()).optional(),
});
export type OnionTurnFixture = z.infer<typeof OnionTurnFixture>;
