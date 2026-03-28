import { z } from "zod";

/**
 * Compliance Map — produced by the implementer before submitting for review.
 * Maps each rulebook rule to evidence of compliance in the artifact.
 *
 * - Full scope: all rules checked (first and last round)
 * - Delta scope: only rules relevant to changed sections (middle rounds)
 */

export const ComplianceEntry = z.object({
  rule_id: z.string(),
  status: z.enum(["compliant", "not_applicable"]),
  evidence_location: z.string().describe("Section, tag, or line where compliance is demonstrated"),
  evidence_summary: z.string().describe("Brief explanation of how the rule is satisfied"),
});
export type ComplianceEntry = z.infer<typeof ComplianceEntry>;

export const ComplianceMap = z.object({
  schema_version: z.literal("1.0"),
  component: z.string(),
  scope: z.enum(["full", "delta"]).describe("full = all rules checked, delta = only changed sections"),
  git_commit: z.string().optional().describe("Git commit hash of the artifact version being checked"),
  artifact_path: z.string().describe("Path to the artifact being checked"),
  round: z.number(),
  entries: z.array(ComplianceEntry),
  unchecked_rules: z.array(z.string()).default([]).describe("Rule IDs not checked (delta mode only — rules for unchanged sections)"),
  generated_at: z.string().datetime(),
});
export type ComplianceMap = z.infer<typeof ComplianceMap>;
