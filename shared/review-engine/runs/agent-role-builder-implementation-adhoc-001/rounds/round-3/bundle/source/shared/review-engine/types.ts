export interface ReviewFixDecision {
  finding_id?: string;
  finding_group_id?: string;
  decision: "accept_fix" | "reject_fix" | "accept_rejection" | "reject_rejection";
  reason: string;
}

export interface ReviewConceptualGroup {
  id: string;
  summary: string;
  severity: "blocking" | "major" | "minor" | "suggestion";
  findings: Array<{ id: string; description: string; source_section: string }>;
  redesign_guidance: string;
}

export interface ReviewVerdictShape {
  verdict: "approved" | "conditional" | "reject";
  conceptual_groups: ReviewConceptualGroup[];
  fix_decisions?: ReviewFixDecision[];
  residual_risks: string[];
  strengths: string[];
}

export interface LeaderVerdictShape {
  status: "frozen" | "frozen_with_conditions" | "pushback" | "blocked" | "resume_required";
  rationale: string;
  unresolved: string[];
  improvements_applied: string[];
  arbitration_used: boolean;
  arbitration_rationale: string | null;
}

export interface ReviewPromptConfig {
  schema_version?: string;
  domain?: string;
  domain_description?: string;
  artifact_kind?: string;
  focus_areas?: string[];
  review_modes?: Record<string, string>;
  severity_definitions?: Record<string, string>;
  source_authority_paths?: string[];
  ignore_areas?: string[];
  schema_refs?: Record<string, string>;
  budget_hints?: Record<string, unknown>;
  compliance_map_required?: boolean;
  fix_items_map_required_from_round?: number;
}

export interface SharedReviewContract {
  schema_version?: string;
  review_modes?: Record<string, string>;
  reviewer_output?: {
    verdicts?: string[];
    severity_levels?: string[];
    fix_decisions?: {
      identity_fields?: string[];
      allowed_decisions?: string[];
    };
  };
  leader_output?: {
    allowed_statuses?: string[];
  };
  audit_requirements?: {
    required_outputs?: string[];
  };
}

export interface ComponentReviewContract {
  schema_version?: string;
  component?: string;
  review_modes?: Record<string, string>;
  source_authority_paths?: string[];
  artifact_scope?: string[];
  ignore_areas?: string[];
  schema_refs?: Record<string, string>;
  budget_hints?: Record<string, unknown>;
}

export interface ReviewRuntimeConfig {
  sharedContract: SharedReviewContract;
  componentPrompt: ReviewPromptConfig;
  componentContract: ComponentReviewContract;
}

export interface ReviewRoundSummary {
  round: number;
  reviewMode: "full" | "delta" | "regression_sanity";
  leaderVerdict: string;
  unresolved: string[];
  improvementsApplied: string[];
}
