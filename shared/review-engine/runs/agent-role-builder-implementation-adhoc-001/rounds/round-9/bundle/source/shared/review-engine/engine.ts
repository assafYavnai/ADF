export {
  buildReviewerSummaryText,
  formatFocusAreas,
  formatIgnoreAreas,
  formatSourceAuthorities,
  loadReviewRuntimeConfig,
  resolveReviewMode,
} from "./config.js";
import {
  buildReviewerSummaryText,
  formatFocusAreas,
  formatIgnoreAreas,
  formatSourceAuthorities,
} from "./config.js";
import type { ReviewRuntimeConfig, ReviewVerdictShape, LeaderVerdictShape, ReviewRoundSummary } from "./types.js";

type GovernedReviewerContract = {
  verdicts: string[];
  severity_levels: string[];
  required_sections: string[];
  conceptual_groups: {
    required_fields: string[];
    finding_required_fields: string[];
  };
  fix_decisions: {
    required_when_fix_items_map_present?: boolean;
    identity_fields: string[];
    allowed_decisions: string[];
  };
};

type GovernedLeaderContract = {
  allowed_statuses: string[];
  required_fields: string[];
  arbitration_rule: string;
};

export interface ReviewPromptInput {
  componentName: string;
  artifactLabel: string;
  round: number;
  reviewMode: "full" | "delta" | "regression_sanity";
  artifactPath: string;
  contractSummary: string;
  selfCheckContext: string;
  complianceContext: string;
  fixItemsContext: string;
  priorRounds: ReviewRoundSummary[];
  currentRoundReviewers?: Map<string, ReviewVerdictShape>;
  config: ReviewRuntimeConfig;
}

interface ParseReviewerOutputOptions {
  requireFixDecisions?: boolean;
  config?: ReviewRuntimeConfig;
}

export function buildReviewerPrompt(input: ReviewPromptInput): string {
  const reviewerContract = requireReviewerContract(input.config);
  const verdicts = reviewerContract.verdicts;
  const severities = reviewerContract.severity_levels;
  const fixDecisionValues = reviewerContract.fix_decisions.allowed_decisions;
  const priorContext = input.priorRounds.length > 0
    ? `\n\nPrior rounds:\n${input.priorRounds.map((round) =>
        `Round ${round.round}: mode=${round.reviewMode}, Outcome=${round.leaderVerdict}. Unresolved: ${round.unresolved.length}. Improvements: ${round.improvementsApplied.length}.`
      ).join("\n")}`
    : "";

  return `You are a governed reviewer for ${input.componentName}.\nReview mode: ${input.reviewMode}\nArtifact: ${input.artifactLabel}\n\nRESPOND WITH JSON ONLY:\n{\n  "verdict": ${verdicts.map((value) => `"${value}"`).join(" | ")},\n  "conceptual_groups": [{ "id": "group-1", "summary": "...", "severity": ${severities.map((value) => `"${value}"`).join("|")},\n    "findings": [{ "id": "f1", "description": "...", "source_section": "..." }], "redesign_guidance": "..." }],\n  "fix_decisions": [{ "finding_id": "preferred-if-known", "finding_group_id": "group-fallback", "decision": ${fixDecisionValues.map((value) => `"${value}"`).join(" | ")}, "reason": "..." }],\n  "residual_risks": ["..."],\n  "strengths": ["..."]\n}\n\nFOCUS AREAS:\n${formatFocusAreas(input.config)}\n\nSOURCE AUTHORITY:\n${formatSourceAuthorities(input.config)}\n${formatIgnoreAreas(input.config) ? `\nIGNORE AREAS:\n${formatIgnoreAreas(input.config)}` : ""}\n\nREAD the artifact from: ${input.artifactPath}\n\nContract summary:\n${input.contractSummary}${input.selfCheckContext}${input.complianceContext}${input.fixItemsContext}${priorContext}\n\nJSON response:`;
}

export function buildLeaderPrompt(input: ReviewPromptInput): string {
  const reviewerContext = input.currentRoundReviewers && input.currentRoundReviewers.size > 0
    ? `\n\nReviewer verdict summary:\n${buildReviewerSummaryText(input.currentRoundReviewers)}`
    : "";
  const allowedStatuses = requireLeaderContract(input.config).allowed_statuses;

  return `You are the leader synthesizer for ${input.componentName}.\nReview mode: ${input.reviewMode}\n\nRESPOND WITH JSON ONLY:\n{ "status": ${allowedStatuses.map((value) => `"${value}"`).join("|")}, "rationale": "...",\n  "unresolved": ["blocking/major only"], "improvements_applied": ["..."],\n  "arbitration_used": false, "arbitration_rationale": null }\n\nRULES: frozen = all approved/conditional and no remaining material issues. frozen_with_conditions = only deferred minor/suggestion items remain after arbitration. pushback = repair work still required. blocked = unrecoverable execution failure. resume_required = budget exhausted with material issues still deferred.\n\nFOCUS AREAS:\n${formatFocusAreas(input.config)}\n\nSOURCE AUTHORITY:\n${formatSourceAuthorities(input.config)}\n${formatIgnoreAreas(input.config) ? `\nIGNORE AREAS:\n${formatIgnoreAreas(input.config)}` : ""}\n\nREAD the artifact from: ${input.artifactPath}\n${input.selfCheckContext}${input.complianceContext}${input.fixItemsContext}${reviewerContext}\n\nJSON response:`;
}

export function preValidateResponse(raw: string): string | null {
  if (!raw || raw.trim().length === 0) {
    return "Response is empty or whitespace-only";
  }
  if (raw.trimStart().startsWith("ERROR:")) {
    return `CLI failure detected: ${raw.slice(0, 200)}`;
  }
  if (!raw.includes("{") && !raw.includes("[")) {
    return `No JSON content found in response: ${raw.slice(0, 200)}`;
  }
  return null;
}

export function cleanJsonResponse(raw: string): string {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/```json?\n?/g, "").replace(/\n?```/g, "").trim();
  const objStart = cleaned.indexOf("{");
  const arrStart = cleaned.indexOf("[");
  const isArray = arrStart >= 0 && (objStart < 0 || arrStart < objStart);
  const openChar = isArray ? "[" : "{";
  const closeChar = isArray ? "]" : "}";
  const start = cleaned.indexOf(openChar);
  if (start > 0) cleaned = cleaned.slice(start);
  const end = cleaned.lastIndexOf(closeChar);
  if (end > 0) cleaned = cleaned.slice(0, end + 1);
  return cleaned;
}

export function parseReviewerOutput(raw: string, options: ParseReviewerOutputOptions = {}): ReviewVerdictShape {
  const parsed = parseJsonPayload(raw);
  const reviewerContract = requireReviewerContract(requireRuntimeConfig(options.config));
  const requiredSections = reviewerContract.required_sections;
  for (const requiredSection of requiredSections) {
    if (!(requiredSection in parsed)) {
      throw new Error(`Reviewer output is missing required section: ${requiredSection}.`);
    }
  }

  const allowedVerdicts = reviewerContract.verdicts;
  const verdict = parsed.verdict;
  if (!allowedVerdicts.includes(String(verdict))) {
    throw new Error("Reviewer output contains an invalid verdict.");
  }
  if (!Array.isArray(parsed.conceptual_groups)) {
    throw new Error("Reviewer output conceptual_groups must be an array.");
  }
  const conceptualGroups = parsed.conceptual_groups;
  const allowedSeverities = reviewerContract.severity_levels;
  const requiredGroupFields = reviewerContract.conceptual_groups.required_fields;
  const requiredFindingFields = reviewerContract.conceptual_groups.finding_required_fields;
  for (const group of conceptualGroups) {
    if (!group || typeof group !== "object") {
      throw new Error("Reviewer conceptual_groups must contain objects.");
    }
    const groupRecord = group as Record<string, unknown>;
    for (const field of requiredGroupFields) {
      if (!(field in groupRecord)) {
        throw new Error(`Reviewer conceptual_groups entry is missing required field: ${field}.`);
      }
    }
    if (typeof groupRecord.id !== "string" || typeof groupRecord.summary !== "string" || typeof groupRecord.redesign_guidance !== "string") {
      throw new Error("Reviewer conceptual_groups entry contains invalid field types.");
    }
    if (!Array.isArray(groupRecord.findings)) {
      throw new Error("Reviewer conceptual_groups findings must be an array.");
    }
    const severity = groupRecord.severity;
    if (!allowedSeverities.includes(String(severity))) {
      throw new Error("Reviewer conceptual_groups entry contains an invalid severity.");
    }
    for (const finding of groupRecord.findings as Array<Record<string, unknown>>) {
      if (!finding || typeof finding !== "object") {
        throw new Error("Reviewer findings must contain objects.");
      }
      for (const field of requiredFindingFields) {
        if (!(field in finding)) {
          throw new Error(`Reviewer finding is missing required field: ${field}.`);
        }
      }
      if (
        typeof finding.id !== "string"
        || typeof finding.description !== "string"
        || typeof finding.source_section !== "string"
      ) {
        throw new Error("Reviewer finding contains invalid field types.");
      }
    }
  }
  if (!Array.isArray(parsed.residual_risks) || parsed.residual_risks.some((entry) => typeof entry !== "string")) {
    throw new Error("Reviewer output residual_risks must be an array of strings.");
  }
  if (!Array.isArray(parsed.strengths) || parsed.strengths.some((entry) => typeof entry !== "string")) {
    throw new Error("Reviewer output strengths must be an array of strings.");
  }
  const fixDecisions = Array.isArray(parsed.fix_decisions) ? parsed.fix_decisions : undefined;
  const requireFixDecisions = options.requireFixDecisions
    ?? reviewerContract.fix_decisions.required_when_fix_items_map_present
    ?? false;
  if (requireFixDecisions && (!fixDecisions || fixDecisions.length === 0)) {
    throw new Error("Reviewer output is missing required fix_decisions for a round with fix-items evidence.");
  }
  if (fixDecisions) {
    const allowedFixDecisions = reviewerContract.fix_decisions.allowed_decisions;
    const identityFields = reviewerContract.fix_decisions.identity_fields;
    for (const decision of fixDecisions) {
      if (!decision || typeof decision !== "object") {
        throw new Error("Reviewer fix_decisions must contain objects.");
      }
      const record = decision as Record<string, unknown>;
      const target = identityFields
        .map((field) => record[field])
        .find((value) => typeof value === "string" && value.trim().length > 0);
      if (typeof target !== "string" || target.trim().length === 0) {
        throw new Error(`Reviewer fix_decisions entries must include one of: ${identityFields.join(", ")}.`);
      }
      if (
        !allowedFixDecisions.includes(String(record.decision))
      ) {
        throw new Error("Reviewer fix_decisions entry contains an invalid decision value.");
      }
      if (typeof record.reason !== "string" || record.reason.trim().length === 0) {
        throw new Error("Reviewer fix_decisions entry is missing a reason.");
      }
    }
  }

  return {
    verdict,
    conceptual_groups: conceptualGroups,
    fix_decisions: fixDecisions,
    residual_risks: Array.isArray(parsed.residual_risks) ? parsed.residual_risks : [],
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
  };
}

export function parseLeaderOutput(raw: string, options: { config?: ReviewRuntimeConfig } = {}): LeaderVerdictShape {
  const parsed = parseJsonPayload(raw);
  const leaderContract = requireLeaderContract(requireRuntimeConfig(options.config));
  const requiredFields = leaderContract.required_fields;
  for (const requiredField of requiredFields) {
    if (!(requiredField in parsed)) {
      throw new Error(`Leader output is missing required field: ${requiredField}.`);
    }
  }
  const allowedStatuses = leaderContract.allowed_statuses;
  if (!allowedStatuses.includes(String(parsed.status))) {
    throw new Error("Leader output contains an invalid status.");
  }
  if (
    typeof parsed.rationale !== "string"
    || !Array.isArray(parsed.unresolved)
    || !Array.isArray(parsed.improvements_applied)
    || typeof parsed.arbitration_used !== "boolean"
    || !parsed.unresolved.every((entry: unknown) => typeof entry === "string")
    || !parsed.improvements_applied.every((entry: unknown) => typeof entry === "string")
    || (parsed.arbitration_rationale !== null && typeof parsed.arbitration_rationale !== "string")
  ) {
    throw new Error("Leader output contains invalid field types.");
  }
  if (
    parsed.status === "frozen_with_conditions"
    && (parsed.arbitration_used !== true || typeof parsed.arbitration_rationale !== "string" || parsed.arbitration_rationale.trim().length === 0)
  ) {
    throw new Error("Leader output frozen_with_conditions requires arbitration evidence.");
  }
  if (parsed.arbitration_used === true && (typeof parsed.arbitration_rationale !== "string" || parsed.arbitration_rationale.trim().length === 0)) {
    throw new Error("Leader output arbitration_used=true requires a non-empty arbitration_rationale.");
  }
  if (parsed.arbitration_used === false && parsed.arbitration_rationale !== null) {
    throw new Error("Leader output arbitration_rationale must be null when arbitration_used=false.");
  }
  return {
    status: parsed.status,
    rationale: parsed.rationale,
    unresolved: parsed.unresolved,
    improvements_applied: parsed.improvements_applied,
    arbitration_used: parsed.arbitration_used,
    arbitration_rationale: typeof parsed.arbitration_rationale === "string" ? parsed.arbitration_rationale : null,
  };
}

function parseJsonPayload(raw: string): Record<string, any> {
  const attempts = [
    cleanJsonResponse(raw),
    extractFencedJson(raw),
  ].filter((candidate, index, values) => candidate.length > 0 && values.indexOf(candidate) === index);

  let lastError: unknown = null;
  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt) as Record<string, any>;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Failed to parse JSON payload.");
}

function extractFencedJson(raw: string): string {
  const match = raw.match(/```json\s*([\s\S]*?)```/i) ?? raw.match(/```\s*([\s\S]*?)```/i);
  return match?.[1]?.trim() ?? "";
}

function requireRuntimeConfig(config?: ReviewRuntimeConfig): ReviewRuntimeConfig {
  if (!config) {
    throw new Error("[shared-review-engine] Review runtime config is required for governed parsing.");
  }
  return config;
}

function requireReviewerContract(config: ReviewRuntimeConfig): GovernedReviewerContract {
  if (
    !config.sharedContract.reviewer_output
    || !config.sharedContract.reviewer_output.verdicts
    || !config.sharedContract.reviewer_output.severity_levels
    || !config.sharedContract.reviewer_output.required_sections
    || !config.sharedContract.reviewer_output.conceptual_groups?.required_fields
    || !config.sharedContract.reviewer_output.conceptual_groups?.finding_required_fields
    || !config.sharedContract.reviewer_output.fix_decisions?.allowed_decisions
    || !config.sharedContract.reviewer_output.fix_decisions?.identity_fields
  ) {
    throw new Error("[shared-review-engine] Reviewer contract is incomplete or missing required governed fields.");
  }
  return config.sharedContract.reviewer_output as GovernedReviewerContract;
}

function requireLeaderContract(config: ReviewRuntimeConfig): GovernedLeaderContract {
  if (
    !config.sharedContract.leader_output
    || !config.sharedContract.leader_output.allowed_statuses
    || !config.sharedContract.leader_output.required_fields
    || typeof config.sharedContract.leader_output.arbitration_rule !== "string"
    || config.sharedContract.leader_output.arbitration_rule.trim().length === 0
  ) {
    throw new Error("[shared-review-engine] Leader contract is incomplete or missing required governed fields.");
  }
  return config.sharedContract.leader_output as GovernedLeaderContract;
}
