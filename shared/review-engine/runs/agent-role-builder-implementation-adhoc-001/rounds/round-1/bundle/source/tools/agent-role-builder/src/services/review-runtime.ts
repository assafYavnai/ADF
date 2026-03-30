import { readFile } from "node:fs/promises";
import { join } from "node:path";

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

const DEFAULT_SHARED_CONTRACT: SharedReviewContract = {
  review_modes: {
    full: "Review the whole artifact and perform a full rulebook sweep.",
    delta: "Review changed sections plus directly affected cross-cutting areas.",
    regression_sanity: "Check only changed sections against prior approvals.",
  },
  reviewer_output: {
    verdicts: ["approved", "conditional", "reject"],
    severity_levels: ["blocking", "major", "minor", "suggestion"],
    fix_decisions: {
      identity_fields: ["finding_id", "finding_group_id"],
      allowed_decisions: ["accept_fix", "reject_fix", "accept_rejection", "reject_rejection"],
    },
  },
  leader_output: {
    allowed_statuses: ["frozen", "frozen_with_conditions", "pushback", "blocked", "resume_required"],
  },
  audit_requirements: {
    required_outputs: ["review.json", "run-postmortem.json", "cycle-postmortem.json"],
  },
};

const DEFAULT_COMPONENT_PROMPT: ReviewPromptConfig = {
  domain: "design",
  artifact_kind: "role-definition",
  focus_areas: [
    "Authority model clarity",
    "Scope boundary consistency",
    "Artifact lifecycle consistency",
    "Terminal-state correctness",
  ],
  review_modes: {
    first_round: "full",
    middle_rounds: "delta",
    sanity_check: "regression_sanity",
  },
  source_authority_paths: [
    "docs/v0/review-process-architecture.md",
    "docs/v0/architecture.md",
  ],
};

const DEFAULT_COMPONENT_CONTRACT: ComponentReviewContract = {
  component: "agent-role-builder",
  review_modes: {
    first_round: "full",
    middle_rounds: "delta",
    sanity_check: "regression_sanity",
  },
  source_authority_paths: [
    "docs/v0/review-process-architecture.md",
    "docs/v0/architecture.md",
  ],
};

export async function loadReviewRuntimeConfig(): Promise<ReviewRuntimeConfig> {
  const sharedContract = await loadJson(
    join("shared", "learning-engine", "review-contract.json"),
    DEFAULT_SHARED_CONTRACT
  );
  const componentPrompt = await loadJson(
    join("tools", "agent-role-builder", "review-prompt.json"),
    DEFAULT_COMPONENT_PROMPT
  );
  const componentContract = await loadJson(
    join("tools", "agent-role-builder", "review-contract.json"),
    DEFAULT_COMPONENT_CONTRACT
  );

  return { sharedContract, componentPrompt, componentContract };
}

export function resolveReviewMode(
  round: number,
  isSanityCheck: boolean,
  config: ReviewRuntimeConfig
): "full" | "delta" | "regression_sanity" {
  if (isSanityCheck) {
    return normalizeMode(config.componentContract.review_modes?.sanity_check ?? config.componentPrompt.review_modes?.sanity_check);
  }
  if (round === 0) {
    return normalizeMode(config.componentContract.review_modes?.first_round ?? config.componentPrompt.review_modes?.first_round);
  }
  return normalizeMode(config.componentContract.review_modes?.middle_rounds ?? config.componentPrompt.review_modes?.middle_rounds);
}

export function buildReviewerSummaryText(verdicts: Map<string, ReviewVerdictShape>): string {
  const summaries = [...verdicts.entries()].map(([reviewerId, verdict]) => {
    const counts = countSeverities(verdict.conceptual_groups);
    const unresolvedGroups = verdict.conceptual_groups
      .filter((group) => group.severity === "blocking" || group.severity === "major")
      .map((group) => `${group.id}: ${group.summary}`);
    const fixDecisions = (verdict.fix_decisions ?? []).map((decision) => {
      const target = decision.finding_id ?? decision.finding_group_id ?? "unknown";
      return `${target} -> ${decision.decision}: ${decision.reason}`;
    });

    return [
      `${reviewerId}`,
      `  verdict: ${verdict.verdict}`,
      `  severity_counts: blocking=${counts.blocking}, major=${counts.major}, minor=${counts.minor}, suggestion=${counts.suggestion}`,
      `  unresolved_groups: ${unresolvedGroups.length > 0 ? unresolvedGroups.join(" | ") : "(none)"}`,
      `  strengths: ${verdict.strengths.length > 0 ? verdict.strengths.join(" | ") : "(none)"}`,
      `  residual_risks: ${verdict.residual_risks.length > 0 ? verdict.residual_risks.join(" | ") : "(none)"}`,
      `  fix_decisions: ${fixDecisions.length > 0 ? fixDecisions.join(" | ") : "(none)"}`,
    ].join("\n");
  });

  return summaries.join("\n\n");
}

export function formatFocusAreas(config: ReviewRuntimeConfig): string {
  return (config.componentPrompt.focus_areas ?? []).map((area) => `- ${area}`).join("\n");
}

export function formatSourceAuthorities(config: ReviewRuntimeConfig): string {
  const values = uniqueStrings([
    ...(config.componentPrompt.source_authority_paths ?? []),
    ...(config.componentContract.source_authority_paths ?? []),
  ]);

  return values.map((path) => `- ${path}`).join("\n");
}

export function formatIgnoreAreas(config: ReviewRuntimeConfig): string {
  return (config.componentPrompt.ignore_areas ?? config.componentContract.ignore_areas ?? [])
    .map((area) => `- ${area}`)
    .join("\n");
}

function countSeverities(groups: ReviewConceptualGroup[]) {
  const counts = { blocking: 0, major: 0, minor: 0, suggestion: 0 };
  for (const group of groups) {
    counts[group.severity]++;
  }
  return counts;
}

function normalizeMode(mode?: string): "full" | "delta" | "regression_sanity" {
  if (mode === "delta" || mode === "regression_sanity") {
    return mode;
  }
  return "full";
}

async function loadJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error(`[agent-role-builder review-runtime] Failed to load ${path}, using defaults:`, error instanceof Error ? error.message : error);
    return fallback;
  }
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
