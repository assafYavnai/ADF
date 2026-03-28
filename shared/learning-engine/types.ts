import { z } from "zod";

/**
 * Learning Engine types — input/output schemas for rule extraction.
 */

export const ReviewFinding = z.object({
  group_id: z.string(),
  summary: z.string(),
  severity: z.enum(["blocking", "major", "minor", "suggestion"]),
  redesign_guidance: z.string(),
  finding_count: z.number(),
});
export type ReviewFinding = z.infer<typeof ReviewFinding>;

export const ExistingRule = z.object({
  id: z.string(),
  rule: z.string(),
  applies_to: z.array(z.string()),
  do: z.string(),
  dont: z.string(),
  source: z.string(),
  version: z.number(),
});
export type ExistingRule = z.infer<typeof ExistingRule>;

export const LearningInput = z.object({
  component: z.string(),
  round: z.number(),
  review_findings: z.array(ReviewFinding),
  current_rulebook: z.array(ExistingRule),
  review_prompt_domain: z.string().describe("Domain from review-prompt.json: design, code, prompt, architecture"),
  unresolved_from_leader: z.array(z.string()),
});
export type LearningInput = z.infer<typeof LearningInput>;

export const ProposedRule = z.object({
  id: z.string().describe("Proposed rule ID following component prefix convention"),
  rule: z.string(),
  applies_to: z.array(z.string()),
  do: z.string(),
  dont: z.string(),
  source: z.string(),
  version: z.literal(1),
});
export type ProposedRule = z.infer<typeof ProposedRule>;

export const LearningOutput = z.object({
  new_rules: z.array(ProposedRule).describe("New rules to add to the rulebook"),
  existing_rules_covering: z.array(z.object({
    finding_group_id: z.string(),
    covered_by_rule_id: z.string(),
    explanation: z.string(),
  })).describe("Findings already covered by existing rules"),
  no_rule_needed: z.array(z.object({
    finding_group_id: z.string(),
    reason: z.string(),
  })).describe("Findings that are too specific to generalize into a rule"),
});
export type LearningOutput = z.infer<typeof LearningOutput>;
