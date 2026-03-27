import { existsSync } from "node:fs";
import type { RoleBuilderRequest } from "../schemas/request.js";
import type { ValidationIssue } from "../schemas/result.js";

/**
 * Validate request: schema compliance, source refs, semantic rules.
 */
export function validateRequest(request: RoleBuilderRequest): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Source refs exist
  for (const ref of request.source_refs) {
    if (ref.required && !existsSync(ref.path)) {
      issues.push({
        code: "MISSING_REQUIRED_SOURCE",
        severity: "error",
        message: `Required source not found: ${ref.path}`,
        evidence: ref.purpose,
      });
    }
  }

  // Board roster pair validation
  const reviewers = request.board_roster.reviewers;
  if (reviewers.length !== request.board_roster.reviewer_count) {
    issues.push({
      code: "ROSTER_MISMATCH",
      severity: "error",
      message: `reviewer_count (${request.board_roster.reviewer_count}) does not match reviewers array length (${reviewers.length})`,
    });
  }

  // Pair validation: every 2 reviewers should be one codex + one claude
  for (let i = 0; i < reviewers.length; i += 2) {
    if (i + 1 < reviewers.length) {
      const pair = [reviewers[i].provider, reviewers[i + 1].provider].sort();
      if (pair[0] !== "claude" || pair[1] !== "codex") {
        issues.push({
          code: "INVALID_REVIEWER_PAIR",
          severity: "error",
          message: `Reviewer pair ${i / 2 + 1} must be one Codex + one Claude, got: ${reviewers[i].provider} + ${reviewers[i + 1].provider}`,
        });
      }
    }
  }

  // Scope validation: primary_objective should not conflict with out_of_scope
  const objectiveLower = request.primary_objective.toLowerCase();
  for (const excluded of request.out_of_scope) {
    if (objectiveLower.includes(excluded.toLowerCase())) {
      issues.push({
        code: "OBJECTIVE_SCOPE_CONFLICT",
        severity: "warning",
        message: `Primary objective mentions excluded scope: "${excluded}"`,
      });
    }
  }

  // Baseline validation for update/fix
  if ((request.operation === "update" || request.operation === "fix") && !request.baseline) {
    issues.push({
      code: "BASELINE_REQUIRED",
      severity: "error",
      message: `Operation "${request.operation}" requires a baseline`,
    });
  }

  return issues;
}

/**
 * Self-check: verify generated markdown and contract are coherent.
 */
export function selfCheck(
  markdown: string,
  request: RoleBuilderRequest
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const requiredTags = [
    "role", "authority", "scope", "context-gathering",
    "inputs", "guardrails", "steps", "outputs", "completion",
  ];

  for (const tag of requiredTags) {
    if (!markdown.includes(`<${tag}>`)) {
      issues.push({
        code: "MISSING_TAG",
        severity: "error",
        message: `Required XML tag <${tag}> not found in generated markdown`,
      });
    }
  }

  if (!markdown.includes(request.role_name)) {
    issues.push({
      code: "MISSING_ROLE_NAME",
      severity: "warning",
      message: `Role name "${request.role_name}" not found in generated markdown`,
    });
  }

  for (const item of request.out_of_scope) {
    if (!markdown.toLowerCase().includes(item.toLowerCase())) {
      issues.push({
        code: "MISSING_OUT_OF_SCOPE",
        severity: "warning",
        message: `Out-of-scope item "${item}" not represented in markdown`,
      });
    }
  }

  return issues;
}
