import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  ComponentReviewContract,
  ReviewRuntimeConfig,
  ReviewVerdictShape,
  ReviewPromptConfig,
  SharedReviewContract,
} from "./types.js";

const ALLOWED_REVIEW_MODES = new Set(["full", "delta", "regression_sanity"]);

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

  assertReviewRuntimeConfig(sharedContract, componentPrompt, componentContract);
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
  if (mode === "full" || mode === "delta" || mode === "regression_sanity") {
    return mode;
  }
  throw new Error(`[shared-review-engine] Invalid or missing review mode: ${String(mode)}`);
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

function assertReviewRuntimeConfig(
  sharedContract: SharedReviewContract,
  componentPrompt: ReviewPromptConfig,
  componentContract: ComponentReviewContract
): void {
  assertStringArray(sharedContract.reviewer_output?.verdicts, "sharedContract.reviewer_output.verdicts");
  assertStringArray(sharedContract.reviewer_output?.severity_levels, "sharedContract.reviewer_output.severity_levels");
  assertStringArray(sharedContract.reviewer_output?.required_sections, "sharedContract.reviewer_output.required_sections");
  assertStringArray(
    sharedContract.reviewer_output?.conceptual_groups?.required_fields,
    "sharedContract.reviewer_output.conceptual_groups.required_fields"
  );
  assertStringArray(
    sharedContract.reviewer_output?.conceptual_groups?.finding_required_fields,
    "sharedContract.reviewer_output.conceptual_groups.finding_required_fields"
  );
  assertStringArray(
    sharedContract.reviewer_output?.fix_decisions?.allowed_decisions,
    "sharedContract.reviewer_output.fix_decisions.allowed_decisions"
  );
  assertStringArray(
    sharedContract.reviewer_output?.fix_decisions?.identity_fields,
    "sharedContract.reviewer_output.fix_decisions.identity_fields"
  );
  assertStringArray(sharedContract.leader_output?.allowed_statuses, "sharedContract.leader_output.allowed_statuses");
  assertStringArray(sharedContract.leader_output?.required_fields, "sharedContract.leader_output.required_fields");
  if (typeof sharedContract.leader_output?.arbitration_rule !== "string" || sharedContract.leader_output.arbitration_rule.trim().length === 0) {
    throw new Error("[shared-review-engine] sharedContract.leader_output.arbitration_rule is required.");
  }
  assertStringArray(sharedContract.audit_requirements?.required_fields, "sharedContract.audit_requirements.required_fields");
  assertStringArray(sharedContract.audit_requirements?.required_outputs, "sharedContract.audit_requirements.required_outputs");

  assertReviewModes(componentPrompt.review_modes, "componentPrompt.review_modes");
  assertReviewModes(componentContract.review_modes, "componentContract.review_modes");
}

function assertReviewModes(
  modes: ReviewPromptConfig["review_modes"] | ComponentReviewContract["review_modes"],
  path: string
): void {
  if (!modes) {
    throw new Error(`[shared-review-engine] ${path} is required.`);
  }
  for (const key of ["first_round", "middle_rounds", "sanity_check"] as const) {
    const mode = modes[key];
    if (!ALLOWED_REVIEW_MODES.has(String(mode))) {
      throw new Error(`[shared-review-engine] ${path}.${key} must be one of full|delta|regression_sanity.`);
    }
  }
}

function assertStringArray(value: unknown, path: string): asserts value is string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`[shared-review-engine] ${path} must be a non-empty string array.`);
  }
  if (value.some((entry) => typeof entry !== "string" || entry.trim().length === 0)) {
    throw new Error(`[shared-review-engine] ${path} must contain only non-empty strings.`);
  }
}
