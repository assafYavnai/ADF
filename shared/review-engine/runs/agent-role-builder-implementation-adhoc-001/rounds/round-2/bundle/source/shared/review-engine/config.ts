import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  ComponentReviewContract,
  ReviewRuntimeConfig,
  ReviewVerdictShape,
  ReviewPromptConfig,
  SharedReviewContract,
} from "./types.js";

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
  domain: "generic",
  artifact_kind: "artifact",
  focus_areas: ["Correctness", "Contract alignment", "Terminal-state safety"],
  review_modes: {
    first_round: "full",
    middle_rounds: "delta",
    sanity_check: "regression_sanity",
  },
};

const DEFAULT_COMPONENT_CONTRACT: ComponentReviewContract = {
  component: "unknown-component",
  review_modes: {
    first_round: "full",
    middle_rounds: "delta",
    sanity_check: "regression_sanity",
  },
};

export async function loadReviewRuntimeConfig(componentRoot: string): Promise<ReviewRuntimeConfig> {
  const sharedContract = await loadJsonRequired<SharedReviewContract>(
    join("shared", "learning-engine", "review-contract.json")
  );
  const componentPrompt = await loadJsonRequired<ReviewPromptConfig>(
    join(componentRoot, "review-prompt.json")
  );
  const componentContract = await loadJsonRequired<ComponentReviewContract>(
    join(componentRoot, "review-contract.json")
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

async function loadJsonRequired<T>(path: string): Promise<T> {
  const raw = await readFile(path, "utf-8");
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new Error(
      `[shared-review-engine] Failed to parse required governance file ${path}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function normalizeMode(mode?: string): "full" | "delta" | "regression_sanity" {
  if (mode === "delta" || mode === "regression_sanity") {
    return mode;
  }
  return "full";
}

function countSeverities(groups: Array<{ severity: "blocking" | "major" | "minor" | "suggestion" }>) {
  const counts = { blocking: 0, major: 0, minor: 0, suggestion: 0 };
  for (const group of groups) {
    counts[group.severity]++;
  }
  return counts;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
