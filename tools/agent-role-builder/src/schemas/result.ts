import { z } from "zod";

export const RoleBuilderStatus = z.enum(["frozen", "pushback", "blocked", "resume_required"]);
export type RoleBuilderStatus = z.infer<typeof RoleBuilderStatus>;

export const ValidationIssue = z.object({
  code: z.string(),
  severity: z.enum(["error", "warning", "info"]),
  message: z.string(),
  evidence: z.string().optional(),
});
export type ValidationIssue = z.infer<typeof ValidationIssue>;

export const ParticipantRecord = z.object({
  participant_id: z.string(),
  provider: z.string(),
  model: z.string(),
  role: z.enum(["leader", "reviewer"]),
  verdict: z.string().optional(),
  round: z.number(),
  latency_ms: z.number().optional(),
  invocation_id: z.string().uuid().optional(),
});
export type ParticipantRecord = z.infer<typeof ParticipantRecord>;

export const RoleBuilderResult = z.object({
  schema_version: z.literal("1.0"),
  tool_name: z.literal("agent-role-builder"),
  request_job_id: z.string(),
  role_slug: z.string(),
  operation: z.enum(["create", "update", "fix"]),
  status: RoleBuilderStatus,
  execution_mode: z.literal("live-roster-v1"),
  summary: z.string(),
  status_reason: z.string(),
  output_dir: z.string(),
  canonical_role_directory: z.string().nullable(),
  canonical_role_markdown_path: z.string().nullable(),
  canonical_role_contract_path: z.string().nullable(),
  canonical_decision_log_path: z.string().nullable(),
  canonical_board_summary_path: z.string().nullable(),
  pushback_path: z.string().nullable(),
  resume_package_path: z.string().nullable(),
  board: z.object({
    profile: z.string(),
    leader_count: z.number(),
    reviewer_count: z.number(),
    rounds_executed: z.number(),
    arbitration_used: z.boolean(),
    participant_records: z.array(ParticipantRecord),
  }),
  evidence: z.object({
    source_count: z.number(),
    missing_required_source_count: z.number(),
    validation_issue_count: z.number(),
    self_check_issue_count: z.number(),
  }),
  validation_issues: z.array(ValidationIssue),
  open_questions: z.array(z.string()),
  red_flags: z.array(z.string()),
});

export type RoleBuilderResult = z.infer<typeof RoleBuilderResult>;
