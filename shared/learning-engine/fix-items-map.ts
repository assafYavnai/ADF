import { z } from "zod";

/**
 * Fix Items Map — produced by the implementer when fixing review feedback.
 * Shows for each reviewer finding whether it was accepted (with fix) or rejected (with reason).
 *
 * The reviewer then responds with a Fix Decision Map accepting or rejecting each item.
 */

export const FixItem = z.object({
  finding_id: z.string().optional(),
  finding_group_id: z.string().optional(),
  action: z.enum(["accepted", "rejected"]),
  summary: z.string().describe("What was changed (if accepted) or why it was rejected"),
  evidence_location: z.string().optional().describe("Where in the artifact the fix was applied"),
  rejection_reason: z.string().optional().describe("Why the finding was rejected (only if action=rejected)"),
}).superRefine((value, ctx) => {
  if (!value.finding_id && !value.finding_group_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Fix item must include finding_id or finding_group_id",
      path: ["finding_id"],
    });
  }
});
export type FixItem = z.infer<typeof FixItem>;

export const FixItemsMap = z.object({
  schema_version: z.literal("1.0"),
  component: z.string(),
  round: z.number(),
  items: z.array(FixItem),
  generated_at: z.string().datetime(),
});
export type FixItemsMap = z.infer<typeof FixItemsMap>;

/**
 * Fix Decision Map — produced by the reviewer in response to the implementer's Fix Items Map.
 * Each finding gets a decision: accept the fix, reject the fix, accept the rejection, or reject the rejection.
 */

export const FixDecision = z.object({
  finding_id: z.string().optional(),
  finding_group_id: z.string().optional(),
  decision: z.enum(["accept_fix", "reject_fix", "accept_rejection", "reject_rejection"]),
  reason: z.string().describe("Why this decision was made"),
}).superRefine((value, ctx) => {
  if (!value.finding_id && !value.finding_group_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Fix decision must include finding_id or finding_group_id",
      path: ["finding_id"],
    });
  }
});
export type FixDecision = z.infer<typeof FixDecision>;

export const FixDecisionMap = z.object({
  schema_version: z.literal("1.0"),
  reviewer_id: z.string(),
  round: z.number(),
  decisions: z.array(FixDecision),
  generated_at: z.string().datetime(),
});
export type FixDecisionMap = z.infer<typeof FixDecisionMap>;
