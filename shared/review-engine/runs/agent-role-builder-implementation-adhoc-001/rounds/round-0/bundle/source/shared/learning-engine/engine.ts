import { readFile } from "node:fs/promises";
import type { LearningInput, LearningOutput, ProposedRule } from "./types.js";

/**
 * Learning Engine — extracts generalizable rules from review feedback.
 *
 * Generic service. Same engine, different domain prompt per component.
 * Loads review-prompt.json from the component directory for domain context.
 *
 * Does NOT write to rulebook directly — returns proposals for the caller to apply.
 */

export async function extractRules(
  input: LearningInput,
  invoker: (prompt: string, sourcePath: string) => Promise<string>,
): Promise<LearningOutput> {
  let reviewPromptContext = "";
  let reviewContractContext = "";

  if (input.review_prompt_path) {
    try {
      reviewPromptContext = await readFile(input.review_prompt_path, "utf-8");
    } catch {
      reviewPromptContext = "";
    }
  }

  if (input.review_contract_path) {
    try {
      reviewContractContext = await readFile(input.review_contract_path, "utf-8");
    } catch {
      reviewContractContext = "";
    }
  }

  const existingRulesSummary = input.current_rulebook
    .map((r) => `${r.id}: ${r.rule}`)
    .join("\n");

  const findingsSummary = input.review_findings
    .map((f) => `[${f.group_id}] (${f.severity}) ${f.summary}\n  Guidance: ${f.redesign_guidance}`)
    .join("\n\n");

  const unresolvedSummary = input.unresolved_from_leader
    .map((u, i) => `${i + 1}. ${u}`)
    .join("\n");

  const prompt = `You are the ADF Learning Engine. Your job is to analyze review feedback and extract generalizable rules.

DOMAIN: ${input.review_prompt_domain}
COMPONENT: ${input.component}
ROUND: ${input.round}

COMPONENT REVIEW PROMPT:
${reviewPromptContext || "(not provided)"}

COMPONENT REVIEW CONTRACT:
${reviewContractContext || "(not provided)"}

EXISTING RULEBOOK (${input.current_rulebook.length} rules):
${existingRulesSummary || "(empty)"}

REVIEW FINDINGS THIS ROUND:
${findingsSummary || "(none)"}

LEADER'S UNRESOLVED ISSUES:
${unresolvedSummary || "(none)"}

YOUR TASK:
For each finding, determine ONE of:
1. It reveals a NEW generalizable rule not covered by existing rules -> propose a new rule
2. It is ALREADY COVERED by an existing rule -> cite which rule and explain
3. It is TOO SPECIFIC to generalize -> explain why

For new rules, follow this format:
- id: ${input.component.toUpperCase().replace(/-/g, "").slice(0, 3)}-NNN (next available number)
- rule: one sentence, high-level principle (understandable without context)
- applies_to: which sections/files it applies to
- do: concrete example of compliance (actionable, copy-able)
- dont: concrete example of violation (recognizable)
- source: "Round ${input.round}: [brief description of what was observed]"

RESPOND WITH JSON ONLY:
{
  "new_rules": [{ "id", "rule", "applies_to", "do", "dont", "source", "version": 1 }],
  "existing_rules_covering": [{ "finding_group_id", "covered_by_rule_id", "explanation" }],
  "no_rule_needed": [{ "finding_group_id", "reason" }]
}

IMPORTANT:
- Only propose rules that are GENERAL enough to apply across runs
- The "do" must include a concrete example a first-time implementer can follow
- The "dont" must include a concrete example of the violation
- If an existing rule covers it, cite it — don't create duplicates
- Prefer updating existing rules over creating new ones (but don't update here — just flag)

JSON response:`;

  const rawResponse = await invoker(prompt, `shared/learning-engine/extract-rules/${input.component}`);

  try {
    const cleaned = rawResponse.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return {
      new_rules: Array.isArray(parsed.new_rules) ? parsed.new_rules : [],
      existing_rules_covering: Array.isArray(parsed.existing_rules_covering) ? parsed.existing_rules_covering : [],
      no_rule_needed: Array.isArray(parsed.no_rule_needed) ? parsed.no_rule_needed : [],
    };
  } catch {
    return {
      new_rules: [],
      existing_rules_covering: [],
      no_rule_needed: [{
        finding_group_id: "parse-error",
        reason: `Failed to parse learning engine response: ${rawResponse.slice(0, 200)}`,
      }],
    };
  }
}

/**
 * Apply proposed rules to a rulebook (in memory).
 * Returns the updated rules array. Caller writes to disk.
 */
export function applyProposedRules(
  currentRules: Array<{ id: string; [key: string]: unknown }>,
  proposedRules: ProposedRule[]
): Array<{ id: string; [key: string]: unknown }> {
  const existingIds = new Set(currentRules.map((r) => r.id));
  const newRules = proposedRules.filter((r) => !existingIds.has(r.id));
  return [...currentRules, ...newRules];
}
