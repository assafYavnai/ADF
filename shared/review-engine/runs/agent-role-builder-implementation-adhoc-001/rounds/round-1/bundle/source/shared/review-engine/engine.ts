import {
  buildReviewerSummaryText,
  formatFocusAreas,
  formatIgnoreAreas,
  formatSourceAuthorities,
} from "./config.js";
import type { ReviewRuntimeConfig, ReviewVerdictShape, LeaderVerdictShape, ReviewRoundSummary } from "./types.js";

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

export function buildReviewerPrompt(input: ReviewPromptInput): string {
  const verdicts = input.config.sharedContract.reviewer_output?.verdicts ?? ["approved", "conditional", "reject"];
  const severities = input.config.sharedContract.reviewer_output?.severity_levels ?? ["blocking", "major", "minor", "suggestion"];
  const fixDecisionValues = input.config.sharedContract.reviewer_output?.fix_decisions?.allowed_decisions
    ?? ["accept_fix", "reject_fix", "accept_rejection", "reject_rejection"];
  const priorContext = input.priorRounds.length > 0
    ? `\n\nPrior rounds:\n${input.priorRounds.map((round) =>
        `Round ${round.round}: mode=${round.reviewMode}, Leader=${round.leaderVerdict}. Unresolved: ${round.unresolved.length}. Improvements: ${round.improvementsApplied.length}.`
      ).join("\n")}`
    : "";

  return `You are a governed reviewer for ${input.componentName}.\nReview mode: ${input.reviewMode}\nArtifact: ${input.artifactLabel}\n\nRESPOND WITH JSON ONLY:\n{\n  "verdict": ${verdicts.map((value) => `"${value}"`).join(" | ")},\n  "conceptual_groups": [{ "id": "group-1", "summary": "...", "severity": ${severities.map((value) => `"${value}"`).join("|")},\n    "findings": [{ "id": "f1", "description": "...", "source_section": "..." }], "redesign_guidance": "..." }],\n  "fix_decisions": [{ "finding_id": "preferred-if-known", "finding_group_id": "group-fallback", "decision": ${fixDecisionValues.map((value) => `"${value}"`).join(" | ")}, "reason": "..." }],\n  "residual_risks": ["..."],\n  "strengths": ["..."]\n}\n\nFOCUS AREAS:\n${formatFocusAreas(input.config)}\n\nSOURCE AUTHORITY:\n${formatSourceAuthorities(input.config)}\n${formatIgnoreAreas(input.config) ? `\nIGNORE AREAS:\n${formatIgnoreAreas(input.config)}` : ""}\n\nREAD the artifact from: ${input.artifactPath}\n\nContract summary:\n${input.contractSummary}${input.selfCheckContext}${input.complianceContext}${input.fixItemsContext}${priorContext}\n\nJSON response:`;
}

export function buildLeaderPrompt(input: ReviewPromptInput): string {
  const reviewerContext = input.currentRoundReviewers && input.currentRoundReviewers.size > 0
    ? `\n\nReviewer verdict summary:\n${buildReviewerSummaryText(input.currentRoundReviewers)}`
    : "";
  const allowedStatuses = input.config.sharedContract.leader_output?.allowed_statuses
    ?? ["frozen", "frozen_with_conditions", "pushback", "blocked", "resume_required"];

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

export function parseReviewerOutput(raw: string): ReviewVerdictShape {
  const parsed = JSON.parse(cleanJsonResponse(raw));
  return {
    verdict: parsed.verdict === "approve" ? "approved" : (parsed.verdict ?? "reject"),
    conceptual_groups: Array.isArray(parsed.conceptual_groups) ? parsed.conceptual_groups : [],
    fix_decisions: Array.isArray(parsed.fix_decisions) ? parsed.fix_decisions : undefined,
    residual_risks: Array.isArray(parsed.residual_risks) ? parsed.residual_risks : [],
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
  };
}

export function parseLeaderOutput(raw: string): LeaderVerdictShape {
  const parsed = JSON.parse(cleanJsonResponse(raw));
  return {
    status: parsed.status ?? "pushback",
    rationale: parsed.rationale ?? "No rationale",
    unresolved: Array.isArray(parsed.unresolved) ? parsed.unresolved : [],
    improvements_applied: Array.isArray(parsed.improvements_applied) ? parsed.improvements_applied : [],
    arbitration_used: parsed.arbitration_used ?? false,
    arbitration_rationale: parsed.arbitration_rationale ?? null,
  };
}
