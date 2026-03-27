import { z } from "zod";

export const BoardProfile = z.enum(["small", "medium", "hard", "complex"]);

export const BoardParticipant = z.object({
  provider: z.enum(["codex", "claude", "gemini"]),
  model: z.string(),
  throttle: z.string().optional(),
  role: z.enum(["leader", "reviewer"]),
});
export type BoardParticipant = z.infer<typeof BoardParticipant>;

export const BoardRoster = z.object({
  profile: BoardProfile,
  leader_count: z.literal(1),
  reviewer_count: z.number().refine((n) => [0, 2, 4, 6].includes(n), {
    message: "reviewer_count must be 0, 2, 4, or 6 (pair-based growth)",
  }),
  growth_rule: z.string().default("reviewers grow in Codex/Claude pairs only"),
  leader: BoardParticipant,
  reviewers: z.array(BoardParticipant).default([]),
});

export const SourceRef = z.object({
  path: z.string(),
  purpose: z.string(),
  required: z.boolean().default(true),
});

export const AuthoritySpec = z.object({
  reports_to: z.string(),
  subordinate_to: z.array(z.string()).default([]),
  owns: z.array(z.string()).default([]),
  does_not_own: z.array(z.string()).default([]),
});

export const StepSpec = z.object({
  title: z.string(),
  actions: z.array(z.string()).default([]),
  outputs: z.array(z.string()).default([]),
});

export const ArtifactSpec = z.object({
  path: z.string(),
  description: z.string(),
});

export const RoleRequirements = z.object({
  role_summary: z.string(),
  authority: AuthoritySpec,
  scope: z.object({
    use_when: z.array(z.string()).default([]),
    not_in_scope: z.array(z.string()).default([]),
  }),
  context_gathering: z.array(z.string()).default([]),
  inputs: z.object({
    required: z.array(z.string()).default([]),
    optional: z.array(z.string()).default([]),
    examples: z.array(z.string()).default([]),
  }),
  guardrails: z.array(z.string()).default([]),
  steps: z.array(StepSpec).default([]),
  outputs: z.object({
    artifacts: z.array(ArtifactSpec).default([]),
    state_changes: z.array(z.string()).default([]),
  }),
  completion: z.array(z.string()).default([]),
  handoff: z.record(z.unknown()).optional(),
});

export const GovernanceSpec = z.object({
  mode: z.literal("governed"),
  max_review_rounds: z.number().min(0).default(2),
  allow_single_arbitration_round: z.boolean().default(true),
  freeze_requires_no_material_pushback: z.boolean().default(true),
  pushback_on_material_ambiguity: z.boolean().default(true),
});

export const RuntimeSpec = z.object({
  execution_mode: z.literal("live-roster-v1"),
  watchdog_timeout_seconds: z.number().min(30).default(600),
  max_launch_attempts: z.number().min(1).default(2),
  allow_provider_fallback: z.literal(false).default(false),
});

export const RoleBuilderRequest = z.object({
  schema_version: z.literal("1.0"),
  request_type: z.literal("role_definition"),
  operation: z.enum(["create", "update", "fix"]),
  job_id: z.string(),
  role_slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  role_name: z.string(),
  intent: z.string(),
  business_context: z.string(),
  primary_objective: z.string(),
  out_of_scope: z.array(z.string()).min(1),
  source_refs: z.array(SourceRef).min(1),
  board_roster: BoardRoster,
  governance: GovernanceSpec,
  runtime: RuntimeSpec,
  required_outputs: z.array(z.string()).min(1),
  role_requirements: RoleRequirements,
  pushback_policy: z
    .object({
      enabled: z.boolean().default(true),
      include_evidence_refs: z.boolean().default(true),
    })
    .default({}),
  baseline: z
    .object({
      role_package_path: z.string(),
      artifact_paths: z.record(z.string()).optional(),
      allow_role_name_change: z.boolean().default(false),
      allow_restructure: z.boolean().default(false),
    })
    .optional(),
  resume: z
    .object({
      resume_package_path: z.string(),
      session_registry_path: z.string().optional(),
    })
    .optional(),
});

export type RoleBuilderRequest = z.infer<typeof RoleBuilderRequest>;
