import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { RoleBuilderRequest } from "../schemas/request.js";
import type { ValidationIssue } from "../schemas/result.js";

/**
 * Validate request: schema compliance, source refs, semantic rules.
 */
export function validateRequest(request: RoleBuilderRequest): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const governanceFiles = [
    join("tools", "agent-role-builder", "review-prompt.json"),
    join("tools", "agent-role-builder", "review-contract.json"),
    join("tools", "agent-role-builder", "rulebook.json"),
  ];

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

  for (const governanceFile of governanceFiles) {
    if (!existsSync(governanceFile)) {
      issues.push({
        code: "MISSING_GOVERNANCE_FILE",
        severity: "error",
        message: `Required governance file not found: ${governanceFile}`,
      });
      continue;
    }

    try {
      JSON.parse(readFileSync(governanceFile, "utf-8"));
    } catch (error) {
      issues.push({
        code: "INVALID_GOVERNANCE_FILE",
        severity: "error",
        message: `Required governance file is not valid JSON: ${governanceFile}`,
        evidence: error instanceof Error ? error.message : String(error),
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

  if (reviewers.length < 2) {
    issues.push({
      code: "MIN_REVIEWER_PAIR_REQUIRED",
      severity: "error",
      message: "Governed review requires at least one full Codex + Claude reviewer pair",
    });
  }

  if (reviewers.length % 2 !== 0) {
    issues.push({
      code: "ODD_REVIEWER_COUNT",
      severity: "error",
      message: `Reviewer roster must contain complete Codex + Claude pairs, got odd reviewer count (${reviewers.length})`,
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

  // Semantic out-of-scope check: extract key concepts, not literal strings
  for (const item of request.out_of_scope) {
    const keywords = extractKeywords(item);
    const scopeSection = extractSection(markdown, "scope");
    if (scopeSection) {
      const scopeLower = scopeSection.toLowerCase();
      const covered = keywords.some((kw) => scopeLower.includes(kw));
      if (!covered) {
        issues.push({
          code: "MISSING_OUT_OF_SCOPE",
          severity: "warning",
          message: `Out-of-scope concept "${item}" not found in <scope> section (checked keywords: ${keywords.join(", ")})`,
        });
      }
    }
  }

  // Structural: required_outputs paths should appear in <outputs>
  const outputsSection = extractSection(markdown, "outputs");
  if (outputsSection) {
    for (const reqOutput of request.required_outputs) {
      const slug = request.role_slug;
      const filename = reqOutput.split("/").pop() ?? reqOutput;
      // Check for slug-prefixed or generic filename
      if (!outputsSection.includes(filename) && !outputsSection.includes(slug)) {
        issues.push({
          code: "MISSING_REQUIRED_OUTPUT",
          severity: "error",
          message: `Required output "${reqOutput}" not referenced in <outputs> section`,
        });
      }
    }
  }

  // Lifecycle: completion criteria should reference result.json
  const completionSection = extractSection(markdown, "completion");
  if (completionSection && !completionSection.toLowerCase().includes("result.json") && !completionSection.toLowerCase().includes("result")) {
    issues.push({
      code: "COMPLETION_MISSING_RESULT",
      severity: "error",
      message: "Completion criteria should reference terminal result artifact",
    });
  }

  return issues;
}

function extractKeywords(text: string): string[] {
  // Extract meaningful words (3+ chars), removing noise
  const noise = new Set(["that", "the", "for", "and", "not", "from", "with", "this", "only"]);
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !noise.has(w));
}

function extractSection(markdown: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i");
  const match = markdown.match(regex);
  return match ? match[1] : null;
}
