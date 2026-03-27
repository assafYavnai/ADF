import { z } from "zod";

export const ToolBuilderRequest = z.object({
  schema_version: z.literal("2.1"),
  operation: z.enum(["create", "update"]),
  job_id: z.string(),
  tool_name: z.string(),
  tool_slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  tool_root: z.string(),
  goal: z.string(),
  business_context: z.string(),
  owner: z.string().default("COO"),
  entry_point: z.string(),
  baseline_contract_path: z.string().optional(),
  import_existing_role: z.string().optional(),
  agent_role_request_path: z.string().optional(),
  skip_build_agent_role: z.boolean().default(false),
  notes: z.array(z.string()).default([]),
  required_outputs: z.array(z.string()).default([]),
});
export type ToolBuilderRequest = z.infer<typeof ToolBuilderRequest>;

export const ToolBuilderResult = z.object({
  schema_version: z.literal("2.1"),
  tool_name: z.string(),
  tool_slug: z.string(),
  operation: z.enum(["create", "update"]),
  status: z.enum(["success", "blocked", "failure"]),
  status_reason: z.string(),
  output_dir: z.string(),
  tool_contract_path: z.string().nullable(),
  role_directory: z.string().nullable(),
  role_build_status: z.string().nullable(),
});
export type ToolBuilderResult = z.infer<typeof ToolBuilderResult>;
