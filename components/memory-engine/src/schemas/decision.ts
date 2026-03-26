import { z } from "zod";

export const DecisionAlternative = z.object({
  option: z.string(),
  pros: z.array(z.string()).default([]),
  cons: z.array(z.string()).default([]),
  rejected_reason: z.string().optional(),
});
export type DecisionAlternative = z.infer<typeof DecisionAlternative>;

export const LogDecisionInput = z.object({
  title: z.string(),
  reasoning: z.string(),
  alternatives_considered: z.array(DecisionAlternative).default([]),
  scope: z.string().optional(),
  tags: z.array(z.string()).default([]),
  decided_by: z.string().default("ceo"),
});
export type LogDecisionInput = z.infer<typeof LogDecisionInput>;

export const DecisionSchema = z.object({
  id: z.string().uuid(),
  memory_item_id: z.string().uuid(),
  title: z.string(),
  reasoning: z.string(),
  alternatives_considered: z.array(DecisionAlternative),
  decided_by: z.string(),
  status: z.string(),
  created_at: z.string(),
});
export type Decision = z.infer<typeof DecisionSchema>;
