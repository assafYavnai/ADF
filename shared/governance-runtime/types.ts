import type { ReviewRuntimeConfig } from "../review-engine/types.js";

export interface GovernanceBinding {
  snapshot_id: string;
  snapshot_manifest_path: string;
}

export interface GovernanceFileSnapshot {
  kind: string;
  repo_path: string;
  snapshot_path: string;
  source_sha256: string;
  snapshot_sha256: string;
}

export interface GovernanceSnapshot {
  snapshot_id: string;
  component: string;
  governed_files: GovernanceFileSnapshot[];
  authority_docs: GovernanceFileSnapshot[];
}

export interface GovernanceFault {
  code: string;
  message: string;
  evidence?: string;
}

export interface GovernanceIncident {
  governance_binding: GovernanceBinding | null;
  stage: string;
  faults: GovernanceFault[];
  status: "blocked";
  intended_snapshot_manifest_path?: string;
}

export interface PilotGovernanceContext {
  snapshot_id: string;
  snapshot_manifest_path: string;
  snapshot_root: string;
  shared_contract_path: string;
  component_contract_path: string;
  component_rulebook_path: string;
  component_review_prompt_path: string;
  authority_doc_paths: string[];
  review_runtime_config: ReviewRuntimeConfig;
}

export interface ReviewRuntimeAuthorityPaths {
  sharedContractPath: string;
  componentPromptPath: string;
  componentContractPath: string;
}

export interface PilotAuthorityInputPaths {
  shared_contract: string;
  component_contract: string;
  component_rulebook: string;
  component_review_prompt: string;
  authority_docs: string[];
}

export interface PilotGovernanceContextInput {
  component: string;
  run_dir: string;
  authority: PilotAuthorityInputPaths;
}

export interface PilotRosterBootstrap {
  shared_contract_path: string;
  minimum_reviewer_count: number;
  reviewer_count_must_be_even: boolean;
  required_pair_shape: string;
  validation_phase: string;
  fail_closed: boolean;
}

export interface PilotBoardRoster {
  reviewer_count: number;
  reviewers: Array<{ provider: string }>;
}

export interface TerminalLegalityInput {
  leaderVerdict: "frozen" | "frozen_with_conditions" | "pushback" | "blocked" | "resume_required";
  finalRound: boolean;
  hasAnyRepairWork: boolean;
  hasMaterialRepairWork: boolean;
}

export interface TerminalLegalityDecision {
  effectiveVerdict: "frozen" | "frozen_with_conditions" | "pushback" | "blocked" | "resume_required";
  overrideReason: string | null;
}
