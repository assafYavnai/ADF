import { z } from "zod";

export const PlanCreateInput = z.object({
  scope: z.string(),
  title: z.string(),
  discussion_topic: z.string().optional(),
  body: z.string(),
  tags: z.array(z.string()).default([]),
});
export type PlanCreateInput = z.infer<typeof PlanCreateInput>;

export const PlanGetInput = z.object({
  scope: z.string(),
  plan_id: z.string().uuid(),
  include_revisions: z.boolean().default(false),
});
export type PlanGetInput = z.infer<typeof PlanGetInput>;

export const PlanListInput = z.object({
  scope: z.string(),
  status: z.string().optional(),
  tags: z.array(z.string()).optional(),
});
export type PlanListInput = z.infer<typeof PlanListInput>;

export const PlanRevisionInput = z.object({
  plan_id: z.string().uuid(),
  body: z.string(),
  based_on_revision: z.number(),
  change_summary: z.string(),
});
export type PlanRevisionInput = z.infer<typeof PlanRevisionInput>;

export const PlanFinalizeInput = z.object({
  plan_id: z.string().uuid(),
  revision_number: z.number(),
});
export type PlanFinalizeInput = z.infer<typeof PlanFinalizeInput>;

export const PlanDiffInput = z.object({
  plan_id: z.string().uuid(),
  from_revision: z.number(),
  to_revision: z.number(),
});
export type PlanDiffInput = z.infer<typeof PlanDiffInput>;

export const PlanCRInput = z.object({
  plan_id: z.string().uuid(),
  title: z.string(),
  body: z.string(),
  based_on_revision: z.number(),
});
export type PlanCRInput = z.infer<typeof PlanCRInput>;

export const PlanCRUpdateInput = z.object({
  cr_id: z.string().uuid(),
  action: z.enum(["approve", "reject", "withdraw"]),
  reason: z.string().optional(),
});
export type PlanCRUpdateInput = z.infer<typeof PlanCRUpdateInput>;
