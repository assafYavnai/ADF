import { z } from "zod";

export const GovernanceFamily = z.enum([
  "rule",
  "role",
  "requirement",
  "setting",
  "finding",
  "open_loop",
  "artifact_ref",
]);
export type GovernanceFamily = z.infer<typeof GovernanceFamily>;

export const GovernanceManageInput = z.object({
  family: GovernanceFamily,
  action: z.enum(["list", "get", "create", "update", "transition", "search"]),
  id: z.string().uuid().optional(),
  scope: z.string().optional(),
  title: z.string().optional(),
  body: z.record(z.unknown()).optional(),
  status: z.string().optional(),
  query: z.string().optional(),
  tags: z.array(z.string()).optional(),
});
export type GovernanceManageInput = z.infer<typeof GovernanceManageInput>;
