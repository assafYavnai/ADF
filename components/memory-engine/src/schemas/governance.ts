import { z } from "zod";
import { ProvenanceSchema } from "../provenance.js";

export const GovernanceFamily = z.enum([
  "rule",
  "role",
  "requirement",
  "setting",
  "finding",
  "open_loop",
]);
export type GovernanceFamily = z.infer<typeof GovernanceFamily>;

export const GovernanceManageInput = z.object({
  family: GovernanceFamily,
  action: z.enum(["list", "get", "create", "search"]),
  id: z.string().uuid().optional(),
  scope: z.string().optional(),
  title: z.string().optional(),
  body: z.record(z.unknown()).optional(),
  status: z.string().optional(),
  query: z.string().optional(),
  tags: z.array(z.string()).optional(),
  include_legacy: z.boolean().default(false),
  provenance: ProvenanceSchema.optional(),
}).superRefine((value, ctx) => {
  if (!value.scope) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["scope"],
      message: `scope is required for governance ${value.action}`,
    });
  }

  if (value.action === "get" && !value.id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["id"],
      message: "id is required for governance get",
    });
  }

  if (value.action === "create" && !value.title) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["title"],
      message: "title is required for governance create",
    });
  }

  if (value.action === "create" && !value.provenance) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["provenance"],
      message: "provenance is required for governance create",
    });
  }

  if (value.action === "search" && !value.query) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["query"],
      message: "query is required for governance search",
    });
  }
});
export type GovernanceManageInput = z.infer<typeof GovernanceManageInput>;
